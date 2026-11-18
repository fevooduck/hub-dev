import type pg from 'pg';
import { db } from './db.ts';

type Queryable = pg.Pool | pg.PoolClient;

export type StudyStatus = 'novo' | 'pra_testar' | 'testando' | 'testado' | 'anotado' | 'descartado';
export const STUDY_STATUSES: StudyStatus[] = ['novo', 'pra_testar', 'testando', 'testado', 'anotado', 'descartado'];

export const STUDY_LABEL: Record<StudyStatus, string> = {
  novo: 'Novo',
  pra_testar: 'Pra testar',
  testando: 'Testando',
  testado: 'Testado',
  anotado: 'Anotado',
  descartado: 'Descartado',
};

let stackIds: Map<string, number> | undefined;

export async function stackIdMap(q: Queryable = db()): Promise<Map<string, number>> {
  if (!stackIds) {
    const { rows } = await q.query<{ id: number; slug: string }>('SELECT id, slug FROM stacks');
    stackIds = new Map(rows.map((r) => [r.slug, r.id]));
  }
  return stackIds;
}

/**
 * Define as stacks de um item.
 * - source 'regra': só adiciona (não remove nada).
 * - source 'curadoria': substitui as tags de regra/curadoria, preservando as marcadas à mão.
 */
export async function setItemStacks(q: Queryable, itemId: number, slugs: string[], source: 'regra' | 'curadoria' | 'manual') {
  const ids = await stackIdMap(q);
  const unknown = slugs.filter((s) => !ids.has(s));
  if (unknown.length) throw new Error(`Stack desconhecida: ${unknown.join(', ')}`);
  if (source === 'curadoria') {
    await q.query(`DELETE FROM item_stacks WHERE item_id = $1 AND source <> 'manual'`, [itemId]);
  }
  // A ordem importa: a primeira stack é a principal (agrupa o item no digest).
  const offset = source === 'manual' ? 50 : 0;
  for (const [index, slug] of [...new Set(slugs)].entries()) {
    await q.query(
      `INSERT INTO item_stacks (item_id, stack_id, source, position) VALUES ($1, $2, $3, $4)
       ON CONFLICT (item_id, stack_id) DO UPDATE SET position = LEAST(item_stacks.position, EXCLUDED.position)`,
      [itemId, ids.get(slug), source, offset + index],
    );
  }
}

export async function updateStudyStatus(itemId: number, status: StudyStatus) {
  if (!STUDY_STATUSES.includes(status)) throw new Error(`Status inválido: ${status}`);
  const { rowCount } = await db().query('UPDATE items SET study_status = $2, updated_at = now() WHERE id = $1', [itemId, status]);
  if (!rowCount) throw new Error(`Item ${itemId} não existe`);
}

export async function updateRelevance(itemId: number, relevance: number) {
  if (!Number.isInteger(relevance) || relevance < 0 || relevance > 5) throw new Error('Relevância vai de 0 a 5');
  await db().query('UPDATE items SET relevance = $2, updated_at = now() WHERE id = $1', [itemId, relevance]);
}

export async function addNote(itemId: number | null, body: string, labPath?: string | null) {
  const text = body.trim();
  if (!text) throw new Error('Nota vazia');
  const { rows } = await db().query<{ id: number }>(
    'INSERT INTO notes (item_id, body, lab_path) VALUES ($1, $2, $3) RETURNING id',
    [itemId, text, labPath ?? null],
  );
  if (itemId) {
    // anotar algo de um item da fila move o status para "anotado" se ele já foi testado
    await db().query(`UPDATE items SET study_status = 'anotado', updated_at = now() WHERE id = $1 AND study_status = 'testado'`, [itemId]);
  }
  return rows[0].id;
}
