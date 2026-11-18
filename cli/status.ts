/**
 * npm run status
 * Diagnóstico rápido: banco, Miniflux, volume de itens, curadoria e fila de estudo.
 */
import { config } from '../lib/config.ts';
import { closeDb, db } from '../lib/db.ts';
import { MinifluxClient } from '../lib/miniflux.ts';
import { formatDate } from '../lib/text.ts';

async function main() {
  try {
    const { rows } = await db().query<Record<string, number | Date | null>>(`
      SELECT
        (SELECT count(*)::int FROM items)                                         AS total,
        (SELECT count(*)::int FROM items WHERE curated_at IS NOT NULL)            AS curados,
        (SELECT count(*)::int FROM v_items WHERE curated_at IS NULL
            AND sort_at >= now() - make_interval(days => ${Number(config.curateDays)})) AS pendentes,
        (SELECT count(*)::int FROM items WHERE is_security
            AND coalesce(published_at, ingested_at) >= now() - interval '30 days') AS seguranca_30d,
        (SELECT count(*)::int FROM items WHERE study_status = 'pra_testar')       AS pra_testar,
        (SELECT count(*)::int FROM items WHERE study_status = 'testando')         AS testando,
        (SELECT count(*)::int FROM notes)                                         AS notas,
        (SELECT count(*)::int FROM digests)                                       AS digests,
        (SELECT max(ingested_at) FROM items WHERE origin = 'miniflux')            AS ultima_ingestao`);
    const s = rows[0];
    console.log('Banco hub ✓');
    console.log(`  itens: ${s.total} (curados ${s.curados}, pendentes nos últimos ${config.curateDays} dias: ${s.pendentes})`);
    console.log(`  segurança (30 dias): ${s.seguranca_30d}`);
    console.log(`  estudo: ${s.pra_testar} pra testar · ${s.testando} testando · ${s.notas} notas`);
    console.log(`  digests: ${s.digests} · última ingestão do Miniflux: ${s.ultima_ingestao ? formatDate(s.ultima_ingestao as Date) : 'nunca'}`);
  } catch (error) {
    console.log(`Banco hub ✗ ${(error as Error).message}`);
    console.log('  → rode "docker compose up -d" e "npm run db:migrate"');
  }

  try {
    const me = await new MinifluxClient().me();
    console.log(`Miniflux ✓ (${config.miniflux.url}, usuário ${me.username})`);
  } catch (error) {
    console.log(`Miniflux ✗ ${(error as Error).message}`);
  }
}

main().finally(() => closeDb());
