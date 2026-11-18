/**
 * npm run db:migrate
 * Cria o banco `hub` se ainda não existir e aplica as migrações de db/migrations em ordem.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { config } from '../lib/config.ts';

const MIGRATIONS_DIR = path.resolve('db/migrations');

async function ensureDatabase() {
  const url = new URL(config.databaseUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const probe = new pg.Client({ connectionString: config.databaseUrl });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== '3D000') {
      throw new Error(`Não consegui conectar ao Postgres (${url.host}). O "docker compose up -d" está rodando? — ${(error as Error).message}`);
    }
  }
  const adminUrl = new URL(config.databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  await admin.end();
  console.log(`✓ banco "${dbName}" criado`);
}

async function migrate() {
  await ensureDatabase();
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = new Set((await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✓ ${file}`);
        count++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falha em ${file}: ${(error as Error).message}`);
      }
    }
    console.log(count ? `${count} migração(ões) aplicada(s).` : 'Banco já está atualizado.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
