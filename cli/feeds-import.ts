/**
 * npm run feeds:import [-- caminho/do/arquivo.opml]
 * Importa o OPML no Miniflux pela API e pede uma atualização de todos os feeds.
 * Pode rodar de novo depois de editar o OPML: feeds já cadastrados são ignorados pelo Miniflux.
 */
import { readFile } from 'node:fs/promises';
import { MinifluxClient } from '../lib/miniflux.ts';

async function main() {
  const file = process.argv[2] ?? 'feeds/feeds.opml';
  const opml = await readFile(file, 'utf8');
  const client = new MinifluxClient();

  const me = await client.me();
  console.log(`Conectado ao Miniflux como "${me.username}".`);

  const result = await client.importOpml(opml);
  console.log(`✓ ${result?.message ?? 'OPML importado'} (${file})`);

  await client.refreshAllFeeds();
  console.log('✓ Atualização de todos os feeds disparada (roda em segundo plano no Miniflux).');

  const categories = await client.categories();
  console.log('\nCategorias:');
  for (const c of categories.sort((a, b) => a.title.localeCompare(b.title))) {
    console.log(`  ${c.title.padEnd(16)} ${String(c.feed_count ?? '?').padStart(3)} feeds`);
  }
  console.log('\nAguarde 1–2 minutos e rode: npm run ingest');
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
