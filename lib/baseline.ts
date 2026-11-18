import { features } from 'web-features';
import { explorerUrl } from './labels.ts';

export { SUPPORT_LABEL, explorerUrl } from './labels.ts';

/**
 * Status de suporte vem do pacote oficial `web-features` (dados do Baseline / WebDX),
 * nunca de "achismo" da IA: a curadoria só sugere o `web_feature_id`, o status é calculado aqui.
 * Atualize o pacote com `npm update web-features` para ter dados novos.
 */

export type SupportStatus = 'widely' | 'newly' | 'limited' | 'nao_aplica' | 'desconhecido';

export interface FeatureInfo {
  id: string;
  name: string;
  baseline: 'high' | 'low' | false;
  lowDate?: string;
  highDate?: string;
  status: SupportStatus;
  url: string;
}

type RawFeature = {
  kind?: string;
  name?: string;
  redirect_target?: string;
  status?: { baseline?: 'high' | 'low' | false; baseline_low_date?: string; baseline_high_date?: string };
};

const all = features as unknown as Record<string, RawFeature>;

export function toSupportStatus(baseline: 'high' | 'low' | false | undefined): SupportStatus {
  if (baseline === 'high') return 'widely';
  if (baseline === 'low') return 'newly';
  if (baseline === false) return 'limited';
  return 'desconhecido';
}

export function lookupFeature(rawId: string | null | undefined): FeatureInfo | null {
  if (!rawId) return null;
  let id = rawId.trim().toLowerCase();
  let feature = all[id];
  // Features renomeadas viram { kind: 'moved', redirect_target }
  for (let hops = 0; feature && feature.kind === 'moved' && feature.redirect_target && hops < 3; hops++) {
    id = feature.redirect_target;
    feature = all[id];
  }
  if (!feature || feature.kind !== 'feature' || !feature.status) return null;
  return {
    id,
    name: feature.name ?? id,
    baseline: feature.status.baseline ?? false,
    lowDate: feature.status.baseline_low_date,
    highDate: feature.status.baseline_high_date,
    status: toSupportStatus(feature.status.baseline),
    url: explorerUrl(id),
  };
}

const normalize = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9:()\-\s]/g, ' ')
    .replace(/\s+/g, ' ')} `;

let index: { id: string; needles: string[] }[] | undefined;

function buildIndex() {
  index = Object.entries(all)
    .filter(([, f]) => f.kind === 'feature' && f.name)
    .map(([id, f]) => {
      const needles = new Set<string>();
      const name = normalize(f.name!).trim();
      if (name.length >= 6) needles.add(` ${name} `);
      const idWords = id.replace(/-/g, ' ');
      if (idWords.length >= 8 && idWords.includes(' ')) needles.add(` ${idWords} `);
      return { id, needles: [...needles] };
    })
    .filter((entry) => entry.needles.length > 0);
  return index;
}

/** Sugere features do web-features citadas num texto (título + trecho). Só dica para a curadoria. */
export function suggestFeatures(text: string, limit = 5): FeatureInfo[] {
  const haystack = normalize(text);
  const hits: { id: string; score: number }[] = [];
  for (const entry of index ?? buildIndex()) {
    const match = entry.needles.find((needle) => haystack.includes(needle));
    if (match) hits.push({ id: entry.id, score: match.length });
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => lookupFeature(hit.id))
    .filter((f): f is FeatureInfo => f !== null);
}

/** Busca livre por id ou nome (usada em `npm run baseline -- "termo"`). */
export function searchFeatures(query: string, limit = 10): FeatureInfo[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const exact = lookupFeature(q);
  const results = Object.entries(all)
    .filter(([id, f]) => f.kind === 'feature' && (id.includes(q) || (f.name ?? '').toLowerCase().includes(q)))
    .map(([id]) => lookupFeature(id))
    .filter((f): f is FeatureInfo => f !== null && f.id !== exact?.id);
  return (exact ? [exact, ...results] : results).slice(0, limit);
}

