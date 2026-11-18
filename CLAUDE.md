# Hub Dev — contexto para o Claude Code

Hub pessoal de novidades de desenvolvimento web para estudo (PHP, Drupal, WordPress, CSS/plataforma web, React, Next, Nest, Astro, performance, SEO, segurança).
Fluxo: **Miniflux coleta RSS → `npm run ingest` grava no banco `hub` → curadoria com Claude → painel Astro + digests em Markdown → experimentos em `lab/`.**

## Estrutura

- `docker-compose.yml` — Postgres 17 (pgvector) + Miniflux. Bancos: `miniflux` (do Miniflux) e `hub` (nosso).
- `db/migrations/` — schema do banco `hub`, aplicado por `npm run db:migrate`.
- `lib/` — código compartilhado (config, db, stacks, baseline/web-features, cliente Miniflux, consultas).
- `cli/` — scripts (`npm run ...`). `src/` — painel Astro 7 (SSR, adapter Node).
- `prompts/curadoria.md` — regras e formato da curadoria (fonte única para `/curar` e `curate:auto`).
- `seed/` — itens já curados (carga inicial). `feeds/feeds.opml` — feeds por categoria = stack.
- `lab/` — experimentos de estudo, uma pasta por item.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run setup` | migra, carrega o seed e gera o digest inicial |
| `npm run feeds:import` | importa o OPML no Miniflux e dispara atualização |
| `npm run ingest` / `ingest:watch` | puxa entradas novas do Miniflux (cursor por id) |
| `npm run -s curate:pending -- --limit 20` | JSON dos itens sem curadoria |
| `npm run -s curate:apply -- tmp/curadoria.json` | grava a curadoria (valida com zod) |
| `npm run curate:auto` | curadoria headless via `claude -p` |
| `npm run digest` | digest dos últimos 7 dias em `DIGEST_DIR` + tabela `digests` |
| `npm run -s item -- show/status/relevance/note/queue` | mexer em itens sem SQL |
| `npm run -s baseline -- "termo"` | procura recurso no web-features |
| `npm run status` | diagnóstico |
| `npm run dev` | painel em http://localhost:4321 (fora de um terminal interativo o Astro 7 roda em segundo plano; pare com `npx astro dev stop`) |

Comandos do Claude Code: `/curar`, `/digest`, `/estudar`.

## Regras

- **Nunca** ler ou escrever no banco `miniflux`; falar com o Miniflux só pela API (`lib/miniflux.ts`).
- Para alterar itens, prefira os scripts (`npm run -s item ...`, `curate:apply`). SQL direto só para leitura:
  `docker compose exec db psql -U hub -d hub`.
- Curadoria: seguir `prompts/curadoria.md`. Resumos sempre com palavras próprias — nunca copiar texto das fontes.
- Status de suporte (Baseline) vem do pacote `web-features`; a curadoria só informa o `web_feature_id`.
- Migrações: criar um arquivo novo `db/migrations/00N_descricao.sql`; nunca editar uma migração já aplicada.
- Nova stack: migração inserindo em `stacks` + `lib/stacks.ts` (STACKS e TITLE_RULES) + categoria no OPML + lista em `prompts/curadoria.md`.
- Novo feed: adicionar na categoria certa de `feeds/feeds.opml` e rodar `npm run feeds:import`.

## Código

- TypeScript ESM, imports relativos com extensão `.ts`; scripts rodam com `tsx`. `npm run typecheck` antes de terminar.
- Astro 7 (compilador em Rust): feche todas as tags; espaço entre elementos inline em linhas diferentes some — use `{' '}`.
- Formulários do painel fazem POST para a própria página e redirecionam (PRG); `security.allowedDomains` libera localhost e 127.0.0.1.
- Interface e mensagens em português do Brasil.
