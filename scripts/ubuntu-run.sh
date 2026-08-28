#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PUBLIC_PORT="${PUBLIC_PORT:-7400}"
PUBLIC_BIND="${PUBLIC_BIND:-0.0.0.0}"
CREDENTIAL_FILE="$ROOT_DIR/.admin-credentials"

log() { printf '\n[D DRONE] %s\n' "$*"; }
fail() { printf '\n[D DRONE] ERROR: %s\n' "$*" >&2; exit 1; }

if [[ "$(uname -s)" != "Linux" ]]; then
  fail "สคริปต์นี้ออกแบบสำหรับ Ubuntu/Linux"
fi

if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
  SUDO=()
else
  command -v sudo >/dev/null 2>&1 || fail "ต้องมี sudo หรือรันด้วย root"
  SUDO=(sudo)
fi

install_prerequisites() {
  log "ตรวจสอบ Docker / curl / openssl"
  if ! command -v docker >/dev/null 2>&1; then
    "${SUDO[@]}" apt-get update
    "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io ca-certificates curl openssl
  else
    if ! command -v curl >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
      "${SUDO[@]}" apt-get update
      "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl openssl
    fi
  fi

  "${SUDO[@]}" systemctl enable --now docker

  if ! docker compose version >/dev/null 2>&1 && ! "${SUDO[@]}" docker compose version >/dev/null 2>&1; then
    "${SUDO[@]}" apt-get update
    if ! "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-v2; then
      "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose
    fi
  fi
}

select_compose() {
  if docker info >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
      COMPOSE=(docker compose)
    elif command -v docker-compose >/dev/null 2>&1; then
      COMPOSE=(docker-compose)
    else
      fail "ติดตั้ง Docker แล้ว แต่ไม่พบ Docker Compose"
    fi
  else
    if "${SUDO[@]}" docker compose version >/dev/null 2>&1; then
      COMPOSE=("${SUDO[@]}" docker compose)
    elif command -v docker-compose >/dev/null 2>&1; then
      COMPOSE=("${SUDO[@]}" docker-compose)
    else
      fail "ไม่สามารถเรียก Docker Compose ได้"
    fi
  fi
}

set_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

get_env() {
  local key="$1"
  grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true
}

ensure_secret() {
  local key="$1" placeholder="$2" bytes="$3" current
  current="$(get_env "$key")"
  if [[ -z "$current" || "$current" == "$placeholder" ]]; then
    set_env "$key" "$(openssl rand -hex "$bytes")"
  fi
}

prepare_env() {
  log "เตรียม .env สำหรับ Ubuntu :${PUBLIC_PORT}"
  if [[ ! -f .env ]]; then
    cp .env.example .env
  fi
  chmod 600 .env

  set_env NODE_ENV production
  set_env PORT 3000
  set_env TZ Asia/Bangkok
  set_env PUBLIC_BIND "$PUBLIC_BIND"
  set_env PUBLIC_PORT "$PUBLIC_PORT"
  set_env SESSION_COOKIE_SECURE false
  set_env DB_HOST mysql
  set_env DB_PORT 3306
  set_env DB_NAME drone_alert
  set_env DB_USER dronealert
  set_env UPLOAD_DIR /app/uploads

  ensure_secret SESSION_SECRET change-this-to-a-long-random-secret 48
  ensure_secret DB_PASSWORD change-this-password 24
  ensure_secret DB_ROOT_PASSWORD change-this-root-password 24
}

prepare_admin_credentials() {
  if [[ ! -f "$CREDENTIAL_FILE" ]]; then
    umask 077
    {
      printf 'ADMIN_USERNAME=admin\n'
      printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 10)"
    } > "$CREDENTIAL_FILE"
  fi
  chmod 600 "$CREDENTIAL_FILE"
  # shellcheck disable=SC1090
  source "$CREDENTIAL_FILE"
  [[ -n "${ADMIN_USERNAME:-}" && -n "${ADMIN_PASSWORD:-}" ]] || fail "ไฟล์ .admin-credentials ไม่สมบูรณ์"
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1 && "${SUDO[@]}" ufw status 2>/dev/null | grep -q '^Status: active'; then
    log "เปิด UFW TCP ${PUBLIC_PORT}"
    "${SUDO[@]}" ufw allow "${PUBLIC_PORT}/tcp" comment 'D DRONE' >/dev/null
  fi
}

start_stack() {
  log "ตรวจ Docker Compose configuration"
  "${COMPOSE[@]}" config --quiet

  log "Build และ Start ระบบ"
  "${COMPOSE[@]}" up -d --build

  log "รอ Health Check ที่ http://127.0.0.1:${PUBLIC_PORT}/api/health"
  local ok=0
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${PUBLIC_PORT}/api/health" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 2
  done

  if [[ "$ok" -ne 1 ]]; then
    "${COMPOSE[@]}" ps || true
    "${COMPOSE[@]}" logs --tail=80 app caddy mysql || true
    fail "ระบบไม่ผ่าน Health Check ภายในเวลาที่กำหนด"
  fi
}

ensure_admin() {
  log "สร้าง/ยืนยันบัญชี Super Admin"
  "${COMPOSE[@]}" exec -T app npm run create-admin -- "$ADMIN_USERNAME" "$ADMIN_PASSWORD" >/dev/null
}

print_summary() {
  local lan_ip
  lan_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "$lan_ip" ]] || lan_ip="<UBUNTU-LAN-IP>"

  printf '\n============================================================\n'
  printf ' D DRONE พร้อมใช้งาน\n'
  printf '============================================================\n'
  printf ' Dashboard : http://%s:%s/dashboard/\n' "$lan_ip" "$PUBLIC_PORT"
  printf ' Login     : http://%s:%s/login/\n' "$lan_ip" "$PUBLIC_PORT"
  printf ' Report    : http://%s:%s/report/\n' "$lan_ip" "$PUBLIC_PORT"
  printf ' Health    : http://%s:%s/api/health\n' "$lan_ip" "$PUBLIC_PORT"
  printf '\n Super Admin\n'
  printf ' Username  : %s\n' "$ADMIN_USERNAME"
  printf ' Password  : %s\n' "$ADMIN_PASSWORD"
  printf ' เก็บรหัสไว้ที่: %s (permission 600)\n' "$CREDENTIAL_FILE"
  printf '\n MikroTik dst-nat: TCP %s -> %s:%s\n' "$PUBLIC_PORT" "$lan_ip" "$PUBLIC_PORT"
  printf ' phpMyAdmin ยังเปิดเฉพาะ localhost ของ Ubuntu ที่ 127.0.0.1:8082\n'
  printf '============================================================\n'
}

install_prerequisites
select_compose
prepare_env
prepare_admin_credentials
open_firewall
start_stack
ensure_admin
print_summary
