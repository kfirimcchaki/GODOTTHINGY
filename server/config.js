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
const hasConnect = Boolean(process.env.CONNECT_CLIENT_ID);

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
    // The live site authenticates as client_id=9 against connect.nulls.gg.
    clientId: process.env.CONNECT_CLIENT_ID || '9',
    authorizeUrl: process.env.CONNECT_AUTHORIZE_URL || 'https://connect.nulls.gg/authorize',
    jwksUrl: process.env.CONNECT_JWKS_URL || 'https://connect.nulls.gg/.well-known/jwks.json',
    issuer: process.env.CONNECT_ISSUER || 'https://connect.nulls.gg',
    audience: process.env.CONNECT_AUDIENCE || process.env.CONNECT_CLIENT_ID || '9',
    // OIDC implicit flow — the credential comes back as an id_token fragment.
    responseType: process.env.CONNECT_RESPONSE_TYPE || 'id_token',
    scope: process.env.CONNECT_SCOPE || 'openid email',
    redirectUri: process.env.CONNECT_REDIRECT_URI || '',
  },

  limits: {
    betaRequired: bool(process.env.BETA_REQUIRED, true),
    maxCodeBytes: num(process.env.MAX_CODE_BYTES, 512 * 1024),
    maxEventsPerSecond: num(process.env.MAX_EVENTS_PER_SECOND, 20),
  },
};

export default config;
