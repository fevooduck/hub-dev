/**
 * npm run -s baseline -- "jpeg xl"
 * Procura recursos no pacote web-features e mostra o status Baseline (útil durante a curadoria).
 */
import { SUPPORT_LABEL, searchFeatures } from '../lib/baseline.ts';

const query = process.argv.slice(2).join(' ');
if (!query) {
  console.error('Uso: npm run -s baseline -- "termo ou id"');
  process.exit(1);
}
const results = searchFeatures(query, 12);
if (!results.length) {
  console.log(`Nada encontrado para "${query}".`);
} else {
  for (const f of results) {
    const since = f.status === 'widely' ? f.highDate : f.status === 'newly' ? f.lowDate : undefined;
    console.log(`${f.id.padEnd(34)} ${f.name.padEnd(36)} ${SUPPORT_LABEL[f.status]}${since ? ` (desde ${since})` : ''}`);
  }
}
