import pg from 'pg';
import { config } from './config.ts';

let pool: pg.Pool | undefined;

/** Pool único de conexões com o banco `hub` (curadoria). Nunca aponta para o banco do Miniflux. */
export function db(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/** Executa `fn` dentro de uma transação. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
