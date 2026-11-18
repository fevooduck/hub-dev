/**
 * npm run digest                         → últimos 7 dias, arquivo digests/AAAA-MM-DD.md
 * npm run digest -- --days 14            → janela maior
 * npm run digest -- --all --origin seed --name 00-carga-inicial --title "Carga inicial"
 * Opções: --min 3 (relevância mínima), --out pasta (padrão: DIGEST_DIR do .env)
 *
 * Gera um Markdown pronto para o Obsidian e grava uma cópia na tabela `digests` (o painel lê de lá).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SUPPORT_LABEL, explorerUrl, lookupFeature, type SupportStatus } from '../lib/baseline.ts';
import { config } from '../lib/config.ts';
import { closeDb, db } from '../lib/db.ts';
import { STACKS } from '../lib/stacks.ts';
import { escapeHtml, formatDate, isoDay, mdLinkText } from '../lib/text.ts';

function opt(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : 'true';
}

interface Row {
  id: number;
  title: string;
  url: string;
  source: string | null;
  sort_at: Date;
  published_at: Date | null;
  stacks: string[];
  relevance: number | null;
  summary: string | null;
  impact: string | null;
  study_hint: string | null;
  web_feature_id: string | null;
  support_status: SupportStatus;
  study_status: string;
  is_security: boolean;
}

const stars = (n: number | null) => (n === null ? '' : `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`);
const chips = (stacks: string[]) => stacks.map((s) => `\`${s}\``).join(' ');

function supportLine(row: Row): string | null {
  if (row.support_status === 'nao_aplica' || row.support_status === 'desconhecido') return null;
  const f = lookupFeature(row.web_feature_id);
  const since = f?.status === 'widely' ? f.highDate : f?.status === 'newly' ? f.lowDate : undefined;
  const link = row.web_feature_id ? ` — [web-features](${explorerUrl(row.web_feature_id)})` : '';
  return `**Suporte:** ${SUPPORT_LABEL[row.support_status]}${since ? ` (desde ${since})` : ''}${link}`;
}

function renderItem(row: Row): string {
  const meta = [row.source ? escapeHtml(row.source) : null, formatDate(row.published_at), chips(row.stacks), stars(row.relevance)]
    .filter(Boolean)
    .join(' · ');
  const parts = [`- **[${mdLinkText(row.title)}](${row.url})** — ${meta}`];
  if (row.summary) parts.push(`  ${escapeHtml(row.summary)}`);
  if (row.impact) parts.push(`  **Impacto:** ${escapeHtml(row.impact)}`);
  const support = supportLine(row);
  if (support) parts.push(`  ${support}`);
  return parts.join('\n\n');
}

async function main() {
  const all = opt('all') === 'true';
  const days = Number(opt('days') ?? 7);
  const minRelevance = Number(opt('min') ?? 3);
  const origin = opt('origin');
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  const name = opt('name') ?? isoDay(until);
  const title = opt('title') ?? (all ? 'Visão geral' : `Semana até ${formatDate(until)}`);
  const outDir = path.resolve(opt('out') ?? config.digestDir);

  const where: string[] = ['(curated_at IS NOT NULL OR is_security)'];
  const params: unknown[] = [];
  if (!all) {
    params.push(since);
    where.push(`sort_at >= $${params.length}`);
  }
  if (origin) {
    params.push(origin);
    where.push(`origin = $${params.length}`);
  }
  const { rows } = await db().query<Row>(
    `SELECT id, title, url, source, sort_at, published_at, stacks, relevance, summary, impact, study_hint,
            web_feature_id, support_status, study_status, is_security
       FROM v_items WHERE ${where.join(' AND ')}
      ORDER BY relevance DESC NULLS LAST, sort_at DESC`,
    params,
  );
  const pendingParams = all ? [] : [since];
  const { rows: pend } = await db().query<{ n: number }>(
    `SELECT count(*)::int AS n FROM v_items WHERE curated_at IS NULL AND NOT is_security ${all ? '' : 'AND sort_at >= $1'}`,
    pendingParams,
  );
  const { rows: queue } = await db().query<{ n: number }>(`SELECT count(*)::int AS n FROM items WHERE study_status = 'pra_testar'`);

  const security = rows.filter((r) => r.is_security);
  const rest = rows.filter((r) => !r.is_security && (r.relevance ?? 0) >= minRelevance);
  const highlights = rest.filter((r) => r.relevance === 5);
  const others = rest.filter((r) => r.relevance !== 5);
  const toTest = rows.filter((r) => r.study_status === 'pra_testar' && r.study_hint);

  const out: string[] = [];
  out.push('---');
  out.push('tipo: digest-hub-dev');
  out.push(all ? 'periodo: tudo' : `periodo: ${isoDay(since)} a ${isoDay(until)}`);
  out.push(`itens: ${security.length + rest.length}`);
  out.push(`gerado_em: ${new Date().toISOString()}`);
  out.push('tags: [hub-dev, digest]');
  out.push('---', '');
  out.push(`# Hub Dev — ${escapeHtml(title)}`, '');
  out.push(
    `> ${rest.length} novidade(s) com relevância ≥ ${minRelevance} · ${security.length} alerta(s) de segurança · ${queue[0].n} item(ns) na fila "pra testar"` +
      (pend[0].n ? ` · ${pend[0].n} aguardando curadoria` : ''),
    '',
  );

  if (security.length) {
    out.push('## 🔴 Segurança', '');
    for (const r of security) out.push(renderItem(r), '');
  }
  if (highlights.length) {
    out.push('## ⭐ Destaques', '');
    for (const r of highlights) out.push(renderItem(r), '');
  }
  if (others.length) {
    out.push('## Por stack', '');
    for (const stack of STACKS) {
      const inStack = others.filter((r) => r.stacks[0] === stack.slug);
      if (!inStack.length) continue;
      out.push(`### ${stack.name}`, '');
      for (const r of inStack) out.push(renderItem(r), '');
    }
    const noStack = others.filter((r) => !r.stacks.length);
    if (noStack.length) {
      out.push('### Outros', '');
      for (const r of noStack) out.push(renderItem(r), '');
    }
  }
  if (toTest.length) {
    out.push('## 🧪 Pra testar', '');
    for (const r of toTest) out.push(`- [ ] **${mdLinkText(r.title)}** — ${escapeHtml(r.study_hint)} ([fonte](${r.url}))`);
    out.push('');
  }
  if (pend[0].n) {
    out.push(`> ${pend[0].n} item(ns) do período ainda sem curadoria — rode \`/curar\` no Claude Code ou \`npm run curate:auto\`.`, '');
  }
  const markdown = `${out.join('\n').trim()}\n`;

  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.md`);
  await writeFile(file, markdown);
  await db().query(
    `INSERT INTO digests (key, title, period_start, period_end, item_count, markdown, file_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end,
       item_count = EXCLUDED.item_count, markdown = EXCLUDED.markdown, file_path = EXCLUDED.file_path, updated_at = now()`,
    [name, title, all ? null : isoDay(since), all ? null : isoDay(until), security.length + rest.length, markdown, file],
  );
  console.log(`✓ Digest "${title}" → ${file} (${security.length + rest.length} itens)`);
}

main()
  .then(() => closeDb())
  .catch(async (error) => {
    console.error(`✗ ${(error as Error).message}`);
    await closeDb();
    process.exit(1);
  });
