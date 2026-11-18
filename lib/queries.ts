import type { SupportStatus } from './baseline.ts';
import { db } from './db.ts';
import type { StudyStatus } from './items.ts';

/** Consultas de leitura usadas pelo painel (Astro). */

export interface ItemRow {
  id: number;
  origin: string;
  title: string;
  url: string;
  source: string | null;
  category: string | null;
  published_at: Date | null;
  sort_at: Date;
  stacks: string[];
  relevance: number | null;
  summary: string | null;
  impact: string | null;
  study_hint: string | null;
  web_feature_id: string | null;
  support_status: SupportStatus;
  study_status: StudyStatus;
  is_security: boolean;
  curated_at: Date | null;
  curated_by: string | null;
}

export interface NoteRow {
  id: number;
  body: string;
  lab_path: string | null;
  created_at: Date;
}

export interface StackRow {
  slug: string;
  name: string;
  total: number;
  recent: number;
}

const COLS = `id, origin, title, url, source, category, published_at, sort_at, stacks, relevance, summary, impact,
  study_hint, web_feature_id, support_status, study_status, is_security, curated_at, curated_by`;

export const PAGE_SIZE = 30;

const like = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function homeData() {
  const pool = db();
  const [stats, security, highlights, queue, uncurated] = await Promise.all([
    pool.query<{ total: number; pending: number; to_test: number; testing: number; security_30d: number; last_ingest: Date | null }>(`
      SELECT
        (SELECT count(*)::int FROM items) AS total,
        (SELECT count(*)::int FROM items WHERE curated_at IS NULL AND NOT is_security) AS pending,
        (SELECT count(*)::int FROM items WHERE study_status = 'pra_testar') AS to_test,
        (SELECT count(*)::int FROM items WHERE study_status = 'testando') AS testing,
        (SELECT count(*)::int FROM items WHERE is_security AND coalesce(published_at, ingested_at) >= now() - interval '30 days') AS security_30d,
        (SELECT max(ingested_at) FROM items WHERE origin = 'miniflux') AS last_ingest`),
    pool.query<ItemRow>(`SELECT ${COLS} FROM v_items WHERE is_security AND sort_at >= now() - interval '30 days' ORDER BY sort_at DESC LIMIT 8`),
    pool.query<ItemRow>(
      `SELECT ${COLS} FROM v_items WHERE NOT is_security AND relevance >= 4 AND sort_at >= now() - interval '45 days'
        ORDER BY relevance DESC, sort_at DESC LIMIT 10`,
    ),
    pool.query<ItemRow>(
      `SELECT ${COLS} FROM v_items WHERE study_status IN ('testando', 'pra_testar')
        ORDER BY array_position(ARRAY['testando','pra_testar']::study_status[], study_status), relevance DESC NULLS LAST, sort_at DESC LIMIT 6`,
    ),
    pool.query<ItemRow>(`SELECT ${COLS} FROM v_items WHERE curated_at IS NULL AND NOT is_security ORDER BY sort_at DESC LIMIT 12`),
  ]);
  return {
    stats: stats.rows[0],
    security: security.rows,
    highlights: highlights.rows,
    queue: queue.rows,
    uncurated: uncurated.rows,
  };
}

export async function listStacks(): Promise<StackRow[]> {
  const { rows } = await db().query<StackRow>(`
    SELECT s.slug, s.name,
           count(x.item_id)::int AS total,
           count(x.item_id) FILTER (WHERE coalesce(i.published_at, i.ingested_at) >= now() - interval '30 days')::int AS recent
      FROM stacks s
      LEFT JOIN item_stacks x ON x.stack_id = s.id
      LEFT JOIN items i ON i.id = x.item_id
     GROUP BY s.slug, s.name, s.position
     ORDER BY s.position`);
  return rows;
}

export interface ListOptions {
  page?: number;
  q?: string;
  stack?: string;
  curated?: 'todos' | 'curados' | 'pendentes';
  minRelevance?: number;
}

export async function listItems(opts: ListOptions) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.stack) {
    params.push(opts.stack);
    where.push(`$${params.length} = ANY(stacks)`);
  }
  if (opts.q) {
    params.push(like(opts.q));
    where.push(`(title ILIKE $${params.length} OR summary ILIKE $${params.length} OR impact ILIKE $${params.length} OR source ILIKE $${params.length})`);
  }
  if (opts.curated === 'curados') where.push('curated_at IS NOT NULL');
  if (opts.curated === 'pendentes') where.push('curated_at IS NULL');
  if (opts.minRelevance) {
    params.push(opts.minRelevance);
    where.push(`relevance >= $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const page = Math.max(1, opts.page ?? 1);
  const [items, count] = await Promise.all([
    db().query<ItemRow>(`SELECT ${COLS} FROM v_items ${whereSql} ORDER BY sort_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, params),
    db().query<{ n: number }>(`SELECT count(*)::int AS n FROM v_items ${whereSql}`, params),
  ]);
  return { items: items.rows, total: count.rows[0].n, page, pages: Math.max(1, Math.ceil(count.rows[0].n / PAGE_SIZE)) };
}

export async function itemById(id: number) {
  const [item, notes] = await Promise.all([
    db().query<ItemRow & { content: string | null }>(`SELECT ${COLS}, content FROM v_items WHERE id = $1`, [id]),
    db().query<NoteRow>('SELECT id, body, lab_path, created_at FROM notes WHERE item_id = $1 ORDER BY created_at DESC', [id]),
  ]);
  return item.rows[0] ? { item: item.rows[0], notes: notes.rows } : null;
}

export async function studyBoard() {
  const { rows } = await db().query<ItemRow>(
    `SELECT ${COLS} FROM v_items WHERE study_status IN ('pra_testar', 'testando', 'testado', 'anotado')
      ORDER BY relevance DESC NULLS LAST, sort_at DESC`,
  );
  const columns: Record<'pra_testar' | 'testando' | 'testado' | 'anotado', ItemRow[]> = { pra_testar: [], testando: [], testado: [], anotado: [] };
  for (const row of rows) columns[row.study_status as keyof typeof columns]?.push(row);
  return columns;
}

export async function recentNotes(limit = 10) {
  const { rows } = await db().query<NoteRow & { item_id: number | null; item_title: string | null }>(
    `SELECT n.id, n.body, n.lab_path, n.created_at, n.item_id, i.title AS item_title
       FROM notes n LEFT JOIN items i ON i.id = n.item_id
      ORDER BY n.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function listDigests() {
  const { rows } = await db().query<{ key: string; title: string; period_start: string | null; period_end: string | null; item_count: number; updated_at: Date }>(
    `SELECT key, title, period_start::text, period_end::text, item_count, updated_at FROM digests ORDER BY updated_at DESC`,
  );
  return rows;
}

export async function digestByKey(key: string) {
  const { rows } = await db().query<{ key: string; title: string; markdown: string; file_path: string | null; updated_at: Date }>(
    'SELECT key, title, markdown, file_path, updated_at FROM digests WHERE key = $1',
    [key],
  );
  return rows[0] ?? null;
}
