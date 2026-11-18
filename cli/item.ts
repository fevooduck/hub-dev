/**
 * Atalhos para mexer num item sem SQL (usados também pelos comandos do Claude Code):
 *   npm run -s item -- show 42
 *   npm run -s item -- status 42 testando        (novo | pra_testar | testando | testado | anotado | descartado)
 *   npm run -s item -- relevance 42 5
 *   npm run -s item -- note 42 "O que aprendi..." [--lab lab/42-jpeg-xl]
 *   npm run -s item -- queue                     (fila de estudo)
 */
import { closeDb, db } from '../lib/db.ts';
import { addNote, STUDY_STATUSES, type StudyStatus, updateRelevance, updateStudyStatus } from '../lib/items.ts';

function opt(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const [cmd, idArg, value] = process.argv.slice(2);
  const id = Number(idArg);

  switch (cmd) {
    case 'show': {
      const { rows } = await db().query(
        `SELECT id, title, url, source, published_at, stacks, relevance, summary, impact, study_hint,
                web_feature_id, support_status, study_status, is_security, curated_by, curated_at
           FROM v_items WHERE id = $1`,
        [id],
      );
      if (!rows.length) throw new Error(`Item ${id} não existe`);
      const { rows: notes } = await db().query('SELECT id, body, lab_path, created_at FROM notes WHERE item_id = $1 ORDER BY created_at', [id]);
      console.log(JSON.stringify({ ...rows[0], notes }, null, 2));
      break;
    }
    case 'status': {
      if (!STUDY_STATUSES.includes(value as StudyStatus)) throw new Error(`Status deve ser um de: ${STUDY_STATUSES.join(', ')}`);
      await updateStudyStatus(id, value as StudyStatus);
      console.log(`✓ item ${id} → ${value}`);
      break;
    }
    case 'relevance': {
      await updateRelevance(id, Number(value));
      console.log(`✓ item ${id} → relevância ${value}`);
      break;
    }
    case 'note': {
      if (!value) throw new Error('Uso: npm run -s item -- note <id> "texto" [--lab caminho]');
      const noteId = await addNote(id, value, opt('lab'));
      console.log(`✓ nota ${noteId} adicionada ao item ${id}`);
      break;
    }
    case 'queue': {
      const { rows } = await db().query(
        `SELECT id, study_status, relevance, title, study_hint FROM v_items
          WHERE study_status IN ('pra_testar', 'testando', 'testado')
          ORDER BY array_position(ARRAY['testando','pra_testar','testado']::study_status[], study_status), relevance DESC NULLS LAST, sort_at DESC`,
      );
      console.log(JSON.stringify(rows, null, 2));
      break;
    }
    default:
      throw new Error('Comandos: show <id> | status <id> <status> | relevance <id> <0-5> | note <id> "texto" | queue');
  }
}

main()
  .then(() => closeDb())
  .catch(async (error) => {
    console.error(`✗ ${(error as Error).message}`);
    await closeDb();
    process.exit(1);
  });
