// @ts-check
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// Painel local do Hub Dev: renderizado no servidor (lê o Postgres a cada requisição).
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321 },
  devToolbar: { enabled: false },
  security: {
    // Os formulários (status, relevância, notas) funcionam tanto em localhost quanto em 127.0.0.1.
    checkOrigin: true,
    allowedDomains: [{ hostname: 'localhost' }, { hostname: '127.0.0.1' }],
  },
});
