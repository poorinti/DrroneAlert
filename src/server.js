require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');

const reportsRouter = require('./routes/reports');
const authRouter = require('./routes/auth');
const lineRouter = require('./routes/line');
const adminRouter = require('./routes/admin');
const brandingRouter = require('./routes/branding');
const { requireAuth } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false }
});

const secureCookieEnv = process.env.SESSION_COOKIE_SECURE;
const secureSessionCookie = secureCookieEnv == null
  ? process.env.NODE_ENV === 'production'
  : /^(1|true|yes)$/i.test(secureCookieEnv);

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: secureSessionCookie,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
});

app.set('io', io);
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

const uploadRoot = path.join(__dirname, '..', 'uploads');
app.use('/branding-assets', express.static(path.join(uploadRoot, 'branding'), {
  fallthrough: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  dotfiles: 'deny'
}));
app.use('/uploads', requireAuth, express.static(uploadRoot, {
  fallthrough: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  dotfiles: 'deny'
}));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => res.redirect('/report/'));
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'DroneAlert' }));

app.use('/api/reports', reportsRouter);
app.use('/api/auth', authRouter);
app.use('/api/line', lineRouter);
app.use('/api/branding', brandingRouter);
app.use('/api/admin', adminRouter);

io.engine.use(sessionMiddleware);
io.on('connection', (socket) => {
  const user = socket.request.session?.user;
  if (!user) {
    socket.disconnect(true);
    return;
  }
  socket.join('dashboard');
  console.log('dashboard socket connected:', socket.id, user.username);
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'ไฟล์มีขนาดใหญ่เกินกำหนด' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ error: 'แนบไฟล์มากเกินกำหนด' });
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`DroneAlert listening on port ${port}`);
});
