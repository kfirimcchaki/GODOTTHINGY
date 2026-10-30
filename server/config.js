import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const bool = (value, fallback) =>
  value === undefined || value === '' ? fallback : /^(1|true|yes|on)$/i.test(String(value));

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== '' && value !== undefined ? parsed : fallback;
};

const mode = (process.env.AUTH_MODE || 'auto').toLowerCase();
const hasConnect = Boolean(process.env.CONNECT_CLIENT_ID && process.env.CONNECT_CLIENT_SECRET);

const authMode = mode === 'mock' ? 'mock' : mode === 'connect' ? 'connect' : hasConnect ? 'connect' : 'mock';

export const config = {
  root: ROOT,
  port: num(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  publicDir: path.join(ROOT, 'public'),
  siteName: process.env.SITE_NAME || 'NT Scripting',
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),

  session: {
    cookie: process.env.SESSION_COOKIE || 'nt_session',
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-session-secret',
    ttlMs: num(process.env.SESSION_TTL_HOURS, 720) * 60 * 60 * 1000,
  },

  auth: {
    mode: authMode,
    clientId: process.env.CONNECT_CLIENT_ID || 'nt-scripting-mock',
    clientSecret: process.env.CONNECT_CLIENT_SECRET || 'nt-scripting-mock-secret',
    authorizeUrl: process.env.CONNECT_AUTHORIZE_URL || '/dev/connect/authorize',
    tokenUrl: process.env.CONNECT_TOKEN_URL || '/dev/connect/token',
    userinfoUrl: process.env.CONNECT_USERINFO_URL || '/dev/connect/userinfo',
    scope: process.env.CONNECT_SCOPE || 'identify',
    redirectUri: process.env.CONNECT_REDIRECT_URI || '',
  },

  limits: {
    betaRequired: bool(process.env.BETA_REQUIRED, true),
    maxCodeBytes: num(process.env.MAX_CODE_BYTES, 512 * 1024),
    maxEventsPerSecond: num(process.env.MAX_EVENTS_PER_SECOND, 20),
  },
};

export default config;
