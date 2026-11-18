import dotenv from 'dotenv';

// Os scripts (npm run ...) e o painel rodam a partir da raiz do projeto,
// então o .env da raiz é carregado aqui uma única vez.
dotenv.config({ quiet: true });

const env = (name: string, fallback = ''): string => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
};

export const config = {
  databaseUrl: env('HUB_DATABASE_URL', 'postgres://hub:hub@localhost:5433/hub'),
  miniflux: {
    url: env('MINIFLUX_URL', 'http://localhost:8088').replace(/\/+$/, ''),
    token: env('MINIFLUX_TOKEN'),
    user: env('MINIFLUX_ADMIN_USER', 'admin'),
    password: env('MINIFLUX_ADMIN_PASSWORD'),
  },
  digestDir: env('DIGEST_DIR', './digests'),
  claudeBin: env('CLAUDE_BIN', 'claude'),
  curateDays: Number(env('CURATE_DAYS', '30')),
  notifyMac: env('HUB_NOTIFY_MAC', '0') === '1',
};
