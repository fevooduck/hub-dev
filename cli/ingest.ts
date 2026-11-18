/**
 * npm run ingest                 → sincroniza uma vez
 * npm run ingest -- --watch 30   → fica rodando, sincroniza a cada 30 min
 * npm run ingest -- --from-start → reprocessa tudo desde o começo (não duplica nada)
 *
 * Lê as entradas novas do Miniflux pela API (cursor = último id visto), grava no banco `hub`
 * com stacks pré-classificadas (categoria + regras de título) e avisa sobre segurança na hora.
 */
import { execFile } from 'node:child_process';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../lib/config.ts';
import { db, closeDb } from '../lib/db.ts';
import { setItemStacks } from '../lib/items.ts';
import { MinifluxClient, type MinifluxEntry } from '../lib/miniflux.ts';
import { initialStacks, isSecurityItem } from '../lib/stacks.ts';
import { formatDate, isoDay } from '../lib/text.ts';

const CURSOR_KEY = 'miniflux_last_entry_id';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : '';
}

async function getCursor(): Promise<number> {
  const { rows } = await db().query<{ value: string }>('SELECT value FROM sync_state WHERE key = $1', [CURSOR_KEY]);
  return Number(rows[0]?.value ?? 0);
}

async function setCursor(id: number) {
  await db().query(
    `INSERT INTO sync_state (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [CURSOR_KEY, String(id)],
  );
}

async function storeEntry(entry: MinifluxEntry): Promise<{ inserted: boolean; security: boolean; stacks: string[] }> {
  const category = entry.feed?.category?.title ?? null;
  const security = isSecurityItem(entry.title, category);
  const stacks = initialStacks(entry.title, category);
  const published = entry.published_at && !entry.published_at.startsWith('0001') ? entry.published_at : null;

  const { rows } = await db().query<{ id: number }>(
    `INSERT INTO items (origin, miniflux_entry_id, url, title, source, category, author, published_at, content, is_security)
     VALUES ('miniflux', $1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [entry.id, entry.url, entry.title || '(sem título)', entry.feed?.title ?? null, category, entry.author || null, published, entry.content, security],
  );
  if (!rows.length) return { inserted: false, security, stacks };
  await setItemStacks(db(), rows[0].id, stacks, 'regra');
  return { inserted: true, security, stacks };
}

async function notifySecurity(entries: MinifluxEntry[]) {
  // Registro permanente (abre bem no Obsidian se DIGEST_DIR apontar para o vault)
  const dir = path.resolve(config.digestDir);
  await mkdir(dir, { recursive: true });
  const lines = entries.map((e) => `- [ ] ${isoDay()} — [${e.title.replace(/[\[\]]/g, '')}](${e.url}) · ${e.feed?.title ?? ''}`);
  await appendFile(path.join(dir, 'ALERTAS-SEGURANCA.md'), `${lines.join('\n')}\n`);

  if (config.notifyMac && process.platform === 'darwin') {
    const msg = entries.length === 1 ? entries[0].title : `${entries.length} alertas de segurança novos`;
    const script = `display notification ${JSON.stringify(msg.slice(0, 180))} with title "Hub Dev — Segurança" sound name "Basso"`;
    execFile('osascript', ['-e', script], () => {});
  }
}

async function syncOnce(client: MinifluxClient) {
  let cursor = await getCursor();
  let inserted = 0;
  let seen = 0;
  const perStack = new Map<string, number>();
  const securityHits: MinifluxEntry[] = [];

  while (true) {
    const page = await client.entriesAfter(cursor, 100);
    if (!page.entries.length) break;
    for (const entry of page.entries) {
      seen++;
      const result = await storeEntry(entry);
      if (result.inserted) {
        inserted++;
        for (const s of result.stacks) perStack.set(s, (perStack.get(s) ?? 0) + 1);
        if (result.security) securityHits.push(entry);
      }
      cursor = Math.max(cursor, entry.id);
    }
    await setCursor(cursor);
    if (page.entries.length < 100) break;
  }

  const stamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${stamp}] ${inserted} novo(s) de ${seen} entrada(s) lida(s) · cursor ${cursor}`);
  if (perStack.size) {
    console.log(`  por stack: ${[...perStack].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' · ')}`);
  }
  if (securityHits.length) {
    console.log(`\n🔴 ${securityHits.length} alerta(s) de segurança:`);
    for (const e of securityHits) console.log(`  - ${e.title} (${e.feed?.title}, ${formatDate(e.published_at)})\n    ${e.url}`);
    await notifySecurity(securityHits);
  }
  return inserted;
}

async function main() {
  const client = new MinifluxClient();
  if (arg('--from-start') !== undefined) {
    await setCursor(0);
    console.log('Cursor zerado: reprocessando tudo (itens já gravados são ignorados).');
  }
  const watch = arg('--watch');
  if (watch === undefined) {
    await syncOnce(client);
    await closeDb();
    return;
  }
  const minutes = Number(watch) || 30;
  console.log(`Modo watch: sincronizando a cada ${minutes} min. Ctrl+C para sair.`);
  while (true) {
    try {
      await syncOnce(client);
    } catch (error) {
      console.error(`✗ ${(error as Error).message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, minutes * 60_000));
  }
}

main().catch(async (error) => {
  console.error(`✗ ${(error as Error).message}`);
  await closeDb();
  process.exit(1);
});
