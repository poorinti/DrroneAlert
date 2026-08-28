export type PublicBranding = {
  app_title: string;
  organization_name: string;
  app_logo_url?: string;
  secondary_logo_url?: string;
};

export function brandingAssetUrl(path?: string) {
  if (!path) return '';
  const normalized = path.replaceAll('\\', '/');
  if (normalized.startsWith('branding/')) {
    const file = normalized.split('/').pop();
    return file ? `/branding-assets/${encodeURIComponent(file)}` : '';
  }
  return `/uploads/${normalized}`;
}

const defaultFavicon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230878ff%22/%3E%3Cpath d=%22M18 32h28M32 18v28%22 stroke=%22white%22 stroke-width=%226%22 stroke-linecap=%22round%22/%3E%3C/svg%3E';

export function updateFavicon(url?: string) {
  const href = url || defaultFavicon;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
