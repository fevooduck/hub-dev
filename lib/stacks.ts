/**
 * Taxonomia do hub. Os slugs precisam existir na tabela `stacks` (migração 001).
 * As categorias do OPML usam exatamente o `name` de cada stack, então a categoria
 * do Miniflux já define a stack principal de cada item.
 */
export const STACKS = [
  { slug: 'plataforma', name: 'Plataforma Web' },
  { slug: 'css', name: 'CSS' },
  { slug: 'javascript', name: 'JavaScript' },
  { slug: 'php', name: 'PHP' },
  { slug: 'drupal', name: 'Drupal' },
  { slug: 'wordpress', name: 'WordPress' },
  { slug: 'react', name: 'React' },
  { slug: 'next', name: 'Next.js' },
  { slug: 'nest', name: 'NestJS' },
  { slug: 'astro', name: 'Astro' },
  { slug: 'performance', name: 'Performance' },
  { slug: 'seo', name: 'SEO' },
  { slug: 'acessibilidade', name: 'Acessibilidade' },
  { slug: 'seguranca', name: 'Segurança' },
] as const;

export type StackSlug = (typeof STACKS)[number]['slug'];

export const STACK_SLUGS = STACKS.map((s) => s.slug) as StackSlug[];

const norm = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Categoria do Miniflux → stack (compara com nome e slug, sem acento). */
export function stackFromCategory(category: string | null | undefined): StackSlug | null {
  if (!category) return null;
  const c = norm(category);
  const found = STACKS.find((s) => norm(s.name) === c || s.slug === c);
  return found ? found.slug : null;
}

/**
 * Regras de pré-classificação aplicadas só ao TÍTULO (conteúdo gera falso positivo demais).
 * A curadoria com IA substitui essas tags depois; aqui é só para o painel já nascer organizado.
 */
const TITLE_RULES: Record<StackSlug, RegExp[]> = {
  plataforma: [/\bbaseline\b/i, /\binterop 20\d\d\b/i, /\bweb platform\b/i, /\bHTML\b/, /\bweb components?\b/i, /\bJPEG XL\b/i],
  css: [/\bCSS\b/, /\bcontainer (style )?quer(y|ies)\b/i, /\bscroll-driven\b/i, /\banchor positioning\b/i, /\bview transitions?\b/i, /\b:has\(\)/i, /\bsubgrid\b/i],
  javascript: [/\bJavaScript\b/i, /\bTypeScript\b/i, /\bECMAScript\b/i, /\bNode\.?js\b/i, /\bDeno\b/, /\bVite\b/],
  php: [/\bPHP\b/i, /\bComposer\b/, /\bSymfony\b/i, /\bLaravel\b/i],
  drupal: [/\bDrupal\b/i, /\bSA-(CORE|CONTRIB)-/i],
  wordpress: [/\bWordPress\b/i, /\bGutenberg\b/i, /\bWP\b/, /\bWooCommerce\b/i],
  react: [/\bReact\b/, /\bRSC\b/],
  next: [/\bNext\.?js\b/i, /\bTurbopack\b/i],
  nest: [/\bNest\.?JS\b/i, /@nestjs\//i],
  astro: [/\bAstro\b/],
  performance: [/\bperformance\b/i, /\bCore Web Vitals\b/i, /\b(INP|LCP|CLS|TTFB)\b/, /\bpage ?speed\b/i, /\bJPEG XL\b|\bAVIF\b|\bWebP\b/i, /\bcaching\b/i],
  seo: [/\bSEO\b/i, /\bsearch console\b/i, /\bcore update\b/i, /\bGooglebot\b/i, /\bstructured data\b/i, /\bschema\.org\b/i, /\bAI (Overviews?|Mode)\b/i],
  acessibilidade: [/\baccessib/i, /\ba11y\b/i, /\bWCAG\b/i, /\bARIA\b/, /\bacessib/i],
  seguranca: [/\bsecurity\b/i, /\bvulnerab/i, /\bCVE-\d{4}-\d+/i, /\bXSS\b/, /\bRCE\b/, /\bSQL injection\b/i, /\bSA-(CORE|CONTRIB)-/i, /\bseguran[cç]a\b/i],
};

export function stacksFromTitle(title: string): StackSlug[] {
  return STACK_SLUGS.filter((slug) => TITLE_RULES[slug].some((re) => re.test(title)));
}

/** Alerta imediato: categoria Segurança ou título com identificador de advisory/CVE. */
export function isSecurityItem(title: string, category: string | null | undefined): boolean {
  if (stackFromCategory(category) === 'seguranca') return true;
  return /\bSA-(CORE|CONTRIB)-\d{4}-\d+/i.test(title) || /\bCVE-\d{4}-\d+/i.test(title);
}

/** Stacks iniciais de um item vindo do Miniflux: categoria + regras de título, sem repetição. */
export function initialStacks(title: string, category: string | null | undefined): StackSlug[] {
  const set = new Set<StackSlug>();
  const fromCategory = stackFromCategory(category);
  if (fromCategory) set.add(fromCategory);
  for (const slug of stacksFromTitle(title)) set.add(slug);
  if (isSecurityItem(title, category)) set.add('seguranca');
  return [...set];
}
