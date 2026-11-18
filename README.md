# Hub Dev

Hub pessoal de novidades de desenvolvimento web **para estudo**: coleta feeds de PHP, Drupal, WordPress, CSS/plataforma web, React, Next, Nest, Astro, performance, SEO e segurança; a IA resume e diz o que muda no seu trabalho; você testa e anota.

```
feeds (OPML) ─► Miniflux ─► npm run ingest ─► Postgres "hub" ─► curadoria (/curar) ─► painel + digest (Obsidian) ─► lab/
```

- **Miniflux** coleta os RSS (e é um leitor completo em http://localhost:8088, se quiser ler por lá).
- **Banco `hub`** guarda itens, stacks, relevância, resumo, impacto, status Baseline, fila de estudo e notas.
- **Curadoria** com o Claude Code (`/curar`) usando a sua assinatura — sem custo de API.
- **Painel** em Astro 7 (http://localhost:4321): destaques, segurança, filtros por stack, quadro de estudo, notas e digests.
- **Digest** semanal em Markdown, pronto para o Obsidian.

## Requisitos

- Docker Desktop
- Node **22.23.4+** (o Astro 7 exige) — `node -v`
- Claude Code (para a curadoria)

## Começando

```bash
cp .env.example .env          # troque MINIFLUX_ADMIN_PASSWORD antes do primeiro up
docker compose up -d          # Postgres + Miniflux
npm install
npm run setup                 # cria o banco hub, carrega a carga inicial curada e gera o primeiro digest
npm run feeds:import          # cadastra os feeds no Miniflux e manda buscar
# espere 1–2 minutos
npm run ingest                # puxa as entradas para o hub
npm run dev                   # painel em http://localhost:4321
```

Depois, no Claude Code, dentro da pasta do projeto:

```
/curar      → resume e classifica os itens novos (em lotes de 20)
/digest     → gera o digest da semana e diz o que importa
/estudar    → monta um experimento em lab/ para o próximo item da fila
```

A carga inicial (`seed/2026-11-17-carga-inicial.json`) já traz 18 itens curados com o estado atual de cada stack — JPEG XL no Chrome 155, scroll-driven animations no Baseline, Drupal 12 e o fim do Drupal 10, WordPress 7.1, PHP 8.6, React 19.3, Next 16.4, NestJS 12, TypeScript 7, Astro 7, core update de novembro — e 12 deles já estão na fila "pra testar". O digest dela fica em `digests/00-carga-inicial.md`.

## Rotina sugerida

| Quando | O quê |
|---|---|
| sempre | `npm run ingest:watch` numa aba do terminal (sincroniza a cada 30 min) — ou um cron, veja abaixo |
| 2× por semana | `/curar` no Claude Code |
| sexta | `/digest` e escolher 1 item da fila |
| quando testar algo | `/estudar`, depois anotar o resultado no painel (página do item) |

Cron (macOS/Linux) a cada 30 min — use o caminho do seu `npm` (`which npm`):

```cron
*/30 * * * * cd /caminho/para/hub-dev && /caminho/do/npm run -s ingest >> tmp/ingest.log 2>&1
```

Com `HUB_NOTIFY_MAC=1` no `.env`, a ingestão mostra uma notificação do macOS quando chega alerta de segurança. Alertas também vão para `DIGEST_DIR/ALERTAS-SEGURANCA.md`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run setup` | migra, carrega o seed e gera o digest inicial |
| `npm run db:migrate` | cria o banco `hub` (se preciso) e aplica `db/migrations` |
| `npm run seed` | carrega `seed/*.json` (idempotente) |
| `npm run feeds:import` | importa `feeds/feeds.opml` no Miniflux e dispara a atualização |
| `npm run ingest` | sincroniza com o Miniflux uma vez (`-- --from-start` reprocessa tudo, sem duplicar) |
| `npm run ingest:watch` | sincroniza a cada 30 min |
| `npm run -s curate:pending -- --limit 20` | itens sem curadoria em JSON (com dicas de Baseline) |
| `npm run -s curate:apply -- arquivo.json` | grava uma curadoria (valida tudo antes) |
| `npm run curate:auto` | curadoria sem interação via `claude -p` (dá para agendar) |
| `npm run digest` | digest dos últimos 7 dias (`-- --days 14`, `-- --min 4`, `-- --all`) |
| `npm run -s item -- queue` | fila de estudo |
| `npm run -s item -- status 42 testando` | muda o status (novo, pra_testar, testando, testado, anotado, descartado) |
| `npm run -s item -- note 42 "texto" --lab lab/42-x` | adiciona nota |
| `npm run -s baseline -- "anchor"` | consulta o status Baseline no web-features |
| `npm run status` | diagnóstico do banco e do Miniflux |
| `npm run dev` / `build` / `start` | painel |

## Como a curadoria funciona

1. A ingestão já pré-classifica: a **categoria** do feed no OPML define a stack principal, e regras no título adicionam outras (ex.: "SA-CORE" → drupal + segurança).
2. `/curar` (ou `curate:auto`) lê `prompts/curadoria.md`, que tem o seu contexto de trabalho, a régua de relevância 0–5 e o formato de saída. Para cada item a IA devolve stacks, relevância, resumo próprio, impacto, sugestão de experimento e o `web_feature_id` quando é recurso de navegador.
3. O `curate:apply` valida tudo e calcula o **status Baseline pelo pacote `web-features`** (dado oficial), não pela IA. Mantenha o pacote atualizado com `npm update web-features`.
4. Relevância ≥ 4 com experimento possível entra na fila "pra testar"; ≤ 1 vira "descartado".

Para mudar o critério de relevância, edite `prompts/curadoria.md` — vale para `/curar` e para o `curate:auto`.

## Obsidian

Aponte `DIGEST_DIR` no `.env` para uma pasta do seu vault. Os digests saem com frontmatter (`tipo`, `periodo`, `tags`) e a fila "pra testar" vira checklist (`- [ ]`).

## Adicionar feeds ou stacks

- **Feed:** coloque no `feeds/feeds.opml`, dentro da categoria certa (o nome da categoria = nome da stack), e rode `npm run feeds:import` de novo.
- **Stack nova:** crie uma migração (`db/migrations/002_...sql`) inserindo em `stacks`, adicione em `lib/stacks.ts` (lista e regras de título), crie a categoria no OPML e inclua o slug na lista de `prompts/curadoria.md`.

## Problemas comuns

- **Porta ocupada** — mude `HUB_DB_PORT` / `MINIFLUX_PORT` no `.env` (e a `HUB_DATABASE_URL`).
- **Miniflux 401** — a senha do admin só é criada no primeiro `up`. Se trocou depois, use a nova no `.env` ou crie uma chave de API e preencha `MINIFLUX_TOKEN`.
- **Feed sem itens** — abra o Miniflux (localhost:8088 → Feeds); ele mostra o erro de cada feed.
- **Painel diz que não lê o banco** — `docker compose up -d` e `npm run db:migrate`.
- **Formulário do painel dá 403** — acesse por `localhost` ou `127.0.0.1` (os dois estão liberados em `astro.config.mjs`).
- **Ver o banco** — `docker compose exec db psql -U hub -d hub`.

## Próximos passos (roadmap)

- Busca semântica com pgvector ("o que já li sobre view transitions?").
- Container do painel + ingestão para rodar no droplet (mesmo compose + nginx com TLS e autenticação — o painel não tem login — + backup do volume).
- Digest público para o blog (só resumo próprio + link para a fonte).
- Quando o DuckOS voltar: a skill dele só precisa chamar `/curar`, `/digest` e os scripts `npm run -s item ...`.
