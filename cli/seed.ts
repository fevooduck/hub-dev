/**
 * npm run seed
 * Carrega os arquivos seed/*.json (itens já curados, com fonte e resumo próprio).
 * Idempotente: URLs que já existem no banco são ignoradas.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { lookupFeature } from '../lib/baseline.ts';
import { closeDb, tx } from '../lib/db.ts';
import { setItemStacks } from '../lib/items.ts';
import { STACK_SLUGS } from '../lib/stacks.ts';

const SeedItem = z.object({
  url: z.string().url(),
  title: z.string().min(3),
  source: z.string(),
  published_at: z.string().nullable(),
  stacks: z.array(z.enum(STACK_SLUGS as [string, ...string[]])).min(1),
  relevance: z.number().int().min(0).max(5),
  summary: z.string().min(10),
  impact: z.string().nullable().optional(),
  study_hint: z.string().nullable().optional(),
  web_feature_id: z.string().nullable().optional(),
  support_status: z.enum(['nao_aplica']).nullable().optional(),
  study_status: z.enum(['novo', 'pra_testar', 'descartado']).nullable().optional(),
  is_security: z.boolean().optional(),
});

const SeedFile = z.object({ description: z.string().optional(), items: z.array(SeedItem) });

async function main() {
  const dir = path.resolve('seed');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  let inserted = 0;
  let existing = 0;
  for (const file of files) {
    const parsed = SeedFile.parse(JSON.parse(await readFile(path.join(dir, file), 'utf8')));
    for (const item of parsed.items) {
      // Datas sem hora viram meio-dia UTC: o dia não muda em nenhum fuso das Américas/Europa.
      const publishedAt = item.published_at && /^\d{4}-\d{2}-\d{2}$/.test(item.published_at) ? `${item.published_at}T12:00:00Z` : item.published_at;
      const feature = lookupFeature(item.web_feature_id);
      if (item.web_feature_id && !feature) console.warn(`⚠ ${file}: web_feature_id "${item.web_feature_id}" não existe no web-features`);
      const support = feature ? feature.status : item.support_status === 'nao_aplica' ? 'nao_aplica' : 'desconhecido';
      const created = await tx(async (client) => {
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO items (origin, url, title, source, published_at, is_security, relevance, summary, impact, study_hint,
                              web_feature_id, support_status, support_checked_at, study_status, curated_by, curated_at)
           VALUES ('seed', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $10::text IS NULL THEN NULL ELSE now() END,
                   $12, 'seed', now())
           ON CONFLICT (url) DO NOTHING
           RETURNING id`,
          [
            item.url,
            item.title,
            item.source,
            publishedAt,
            item.is_security ?? item.stacks.includes('seguranca'),
            item.relevance,
            item.summary,
            item.impact ?? null,
            item.study_hint ?? null,
            feature?.id ?? null,
            support,
            item.study_status ?? 'novo',
          ],
        );
        if (!rows.length) return false;
        await setItemStacks(client, rows[0].id, item.stacks, 'curadoria');
        return true;
      });
      if (created) inserted++;
      else existing++;
    }
    console.log(`✓ ${file}: ${parsed.items.length} item(ns)`);
  }
  console.log(`${inserted} inserido(s), ${existing} já existia(m).`);
}

main()
  .then(() => closeDb())
  .catch(async (error) => {
    console.error(`✗ ${(error as Error).message}`);
    await closeDb();
    process.exit(1);
  });
