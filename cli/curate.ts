/**
 * Curadoria em 3 modos:
 *
 *   npm run -s curate:pending [-- --limit 20 --days 30]
 *       Imprime (stdout) o JSON dos itens ainda não curados, com trecho e dicas de Baseline.
 *
 *   npm run -s curate:apply -- tmp/curadoria.json [--by claude] [--force]
 *       Valida e grava a curadoria (array JSON no formato de prompts/curadoria.md).
 *
 *   npm run curate:auto [-- --limit 15 --days 30 --batches 3]
 *       Faz tudo sozinho chamando o Claude Code em modo headless (`claude -p`), usando a sua assinatura.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { lookupFeature, suggestFeatures } from '../lib/baseline.ts';
import { config } from '../lib/config.ts';
import { closeDb, db, tx } from '../lib/db.ts';
import { setItemStacks } from '../lib/items.ts';
import { STACK_SLUGS } from '../lib/stacks.ts';
import { htmlToText, isoDay, truncate } from '../lib/text.ts';

function opt(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : 'true';
}

// ---------- pending ----------

interface PendingRow {
  id: number;
  title: string;
  source: string | null;
  category: string | null;
  published_at: Date | null;
  url: string;
  stacks: string[];
  is_security: boolean;
  content: string | null;
}

export async function loadPending(limit: number, days: number) {
  const { rows } = await db().query<PendingRow>(
    `SELECT id, title, source, category, published_at, url, stacks, is_security, content
       FROM v_items
      WHERE curated_at IS NULL
        AND sort_at >= now() - make_interval(days => $2)
      ORDER BY is_security DESC, sort_at DESC
      LIMIT $1`,
    [limit, days],
  );
  const { rows: countRows } = await db().query<{ n: number }>(
    `SELECT count(*)::int AS n FROM v_items WHERE curated_at IS NULL AND sort_at >= now() - make_interval(days => $1)`,
    [days],
  );
  const items = rows.map((r) => {
    const excerpt = truncate(htmlToText(r.content), 2500);
    const hints = suggestFeatures(`${r.title}\n${excerpt.slice(0, 1500)}`, 4).map((f) => ({ id: f.id, name: f.name, status: f.status }));
    return {
      id: r.id,
      title: r.title,
      source: r.source,
      category: r.category,
      published: r.published_at ? isoDay(r.published_at) : null,
      url: r.url,
      current_stacks: r.stacks,
      is_security: r.is_security,
      excerpt,
      feature_hints: hints,
    };
  });
  return { remaining: countRows[0].n, items };
}

// ---------- apply ----------

const nullableText = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : null));

const CurationItem = z.object({
  id: z.number().int().positive(),
  stacks: z.array(z.enum(STACK_SLUGS as [string, ...string[]])).min(1).max(4),
  relevance: z.number().int().min(0).max(5),
  summary: z.string().trim().min(10),
  impact: nullableText,
  study_hint: nullableText,
  web_feature_id: nullableText,
  support_status: z.enum(['nao_aplica']).nullish(),
  study_status: z.enum(['pra_testar', 'descartado']).nullish(),
});

type Curation = z.infer<typeof CurationItem>;

/** Extrai o array JSON de uma resposta que pode vir com texto ou cercas de código em volta. */
export function extractJsonArray(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* tenta achar o array dentro do texto */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* segue */
    }
  }
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start !== -1 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error('Não encontrei um array JSON na resposta.');
}

export async function applyCuration(data: unknown, curatedBy: string, force = false) {
  if (!Array.isArray(data)) throw new Error('O arquivo de curadoria precisa ser um array JSON.');
  const ok: Curation[] = [];
  const problems: string[] = [];
  for (const [i, raw] of data.entries()) {
    const parsed = CurationItem.safeParse(raw);
    if (parsed.success) ok.push(parsed.data);
    else problems.push(`#${i} (id ${(raw as { id?: unknown })?.id ?? '?'}): ${parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
  }

  let applied = 0;
  let skipped = 0;
  const highlights: string[] = [];
  for (const c of ok) {
    const feature = lookupFeature(c.web_feature_id);
    if (c.web_feature_id && !feature) problems.push(`id ${c.id}: web_feature_id "${c.web_feature_id}" não existe no web-features (ignorado)`);
    const supportStatus = feature ? feature.status : c.support_status === 'nao_aplica' ? 'nao_aplica' : 'desconhecido';

    const done = await tx(async (client) => {
      const { rows } = await client.query<{ curated_at: Date | null; title: string }>('SELECT curated_at, title FROM items WHERE id = $1 FOR UPDATE', [c.id]);
      if (!rows.length) {
        problems.push(`id ${c.id}: item não existe`);
        return false;
      }
      if (rows[0].curated_at && !force) return false;
      await client.query(
        `UPDATE items SET
           relevance = $2, summary = $3, impact = $4, study_hint = $5,
           web_feature_id = $6, support_status = $7, support_checked_at = CASE WHEN $6::text IS NULL THEN NULL ELSE now() END,
           study_status = CASE WHEN study_status = 'novo' AND $8::study_status IS NOT NULL THEN $8::study_status ELSE study_status END,
           curated_by = $9, curated_at = now(), updated_at = now()
         WHERE id = $1`,
        [c.id, c.relevance, c.summary, c.impact, c.study_hint, feature?.id ?? null, supportStatus, c.study_status ?? null, curatedBy],
      );
      await setItemStacks(client, c.id, c.stacks, 'curadoria');
      if (c.relevance >= 4) highlights.push(`  [${c.relevance}] ${rows[0].title}`);
      return true;
    });
    if (done) applied++;
    else skipped++;
  }

  console.error(`✓ ${applied} item(ns) curado(s)${skipped ? ` · ${skipped} ignorado(s) (já curados ou inexistentes; use --force para refazer)` : ''}`);
  if (highlights.length) console.error(`Destaques:\n${highlights.join('\n')}`);
  if (problems.length) console.error(`⚠ Problemas:\n  ${problems.join('\n  ')}`);
  return { applied, problems };
}

// ---------- auto (claude -p) ----------

function runClaude(prompt: string): Promise<string> {
  const extra = (process.env.CLAUDE_CURATE_ARGS ?? '').split(' ').filter(Boolean);
  return new Promise((resolve, reject) => {
    const child = spawn(config.claudeBin, ['-p', '--output-format', 'json', ...extra], { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.on('error', (error) =>
      reject(new Error(`Não consegui executar "${config.claudeBin}". O Claude Code está instalado e no PATH? (${error.message})`)),
    );
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`claude saiu com código ${code}`))));
    child.stdin.end(prompt);
  });
}

function resultText(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as { result?: string; is_error?: boolean };
    if (parsed.is_error) throw new Error(`Claude retornou erro: ${parsed.result ?? ''}`);
    if (typeof parsed.result === 'string') return parsed.result;
  } catch (error) {
    if ((error as Error).message.startsWith('Claude retornou')) throw error;
  }
  return stdout;
}

async function auto(limit: number, days: number, batches: number) {
  const instructions = await readFile('prompts/curadoria.md', 'utf8');
  await mkdir('tmp', { recursive: true });
  for (let batch = 1; batch <= batches; batch++) {
    const pending = await loadPending(limit, days);
    if (!pending.items.length) {
      console.error('Nada pendente de curadoria. ✓');
      return;
    }
    console.error(`Lote ${batch}/${batches}: ${pending.items.length} item(ns) (restam ${pending.remaining} no período de ${days} dias). Chamando o Claude…`);
    const prompt = `${instructions}\n\n## Itens para curar\n\n${JSON.stringify({ items: pending.items }, null, 2)}\n\nResponda somente com o array JSON.`;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const raw = resultText(await runClaude(prompt));
    let data: unknown;
    try {
      data = extractJsonArray(raw);
    } catch (error) {
      const file = path.join('tmp', `curadoria-falhou-${stamp}.txt`);
      await writeFile(file, raw);
      throw new Error(`${(error as Error).message} Resposta salva em ${file}`);
    }
    await writeFile(path.join('tmp', `curadoria-${stamp}.json`), JSON.stringify(data, null, 2));
    const { applied } = await applyCuration(data, 'claude');
    if (!applied) {
      console.error('Nenhum item aplicado neste lote; parando para não entrar em loop.');
      return;
    }
  }
}

// ---------- main ----------

async function main() {
  const mode = process.argv[2];
  const limit = Number(opt('limit', mode === 'auto' ? '15' : '20'));
  const days = Number(opt('days', String(config.curateDays)));

  if (mode === 'pending') {
    const pending = await loadPending(limit, days);
    process.stdout.write(`${JSON.stringify({ remaining: pending.remaining, period_days: days, items: pending.items }, null, 2)}\n`);
  } else if (mode === 'apply') {
    const file = process.argv[3];
    if (!file || file.startsWith('--')) throw new Error('Uso: npm run -s curate:apply -- caminho/curadoria.json');
    const data = extractJsonArray(await readFile(file, 'utf8'));
    await applyCuration(data, opt('by', 'claude')!, opt('force') === 'true');
  } else if (mode === 'auto') {
    await auto(limit, days, Number(opt('batches', '3')));
  } else {
    throw new Error('Modo inválido. Use: pending | apply <arquivo> | auto');
  }
}

main()
  .then(() => closeDb())
  .catch(async (error) => {
    console.error(`✗ ${(error as Error).message}`);
    await closeDb();
    process.exit(1);
  });
