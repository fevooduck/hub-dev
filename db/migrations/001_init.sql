-- Hub Dev — schema de curadoria (banco "hub", separado do banco do Miniflux)

CREATE TABLE stacks (
  id        serial PRIMARY KEY,
  slug      text UNIQUE NOT NULL,
  name      text NOT NULL,
  position  int  NOT NULL DEFAULT 0
);

INSERT INTO stacks (slug, name, position) VALUES
  ('plataforma',     'Plataforma Web', 10),
  ('css',            'CSS',            20),
  ('javascript',     'JavaScript',     30),
  ('php',            'PHP',            40),
  ('drupal',         'Drupal',         50),
  ('wordpress',      'WordPress',      60),
  ('react',          'React',          70),
  ('next',           'Next.js',        80),
  ('nest',           'NestJS',         90),
  ('astro',          'Astro',         100),
  ('performance',    'Performance',   110),
  ('seo',            'SEO',           120),
  ('acessibilidade', 'Acessibilidade',130),
  ('seguranca',      'Segurança',     140);

CREATE TYPE study_status AS ENUM ('novo', 'pra_testar', 'testando', 'testado', 'anotado', 'descartado');
CREATE TYPE support_status AS ENUM ('widely', 'newly', 'limited', 'nao_aplica', 'desconhecido');

CREATE TABLE items (
  id                  serial PRIMARY KEY,
  origin              text NOT NULL DEFAULT 'miniflux' CHECK (origin IN ('miniflux', 'seed', 'manual')),
  miniflux_entry_id   bigint UNIQUE,
  url                 text NOT NULL UNIQUE,
  title               text NOT NULL,
  source              text,                 -- título do feed / publicação
  category            text,                 -- categoria do Miniflux
  author              text,
  published_at        timestamptz,
  content             text,                 -- uso interno para resumir; nunca republicar
  is_security         boolean NOT NULL DEFAULT false,

  -- curadoria
  relevance           smallint CHECK (relevance BETWEEN 0 AND 5),
  summary             text,
  impact              text,
  study_hint          text,                 -- sugestão de experimento
  web_feature_id      text,                 -- id do pacote web-features (Baseline)
  support_status      support_status NOT NULL DEFAULT 'desconhecido',
  support_checked_at  timestamptz,
  study_status        study_status NOT NULL DEFAULT 'novo',
  curated_by          text,                 -- 'claude' | 'seed' | 'manual'
  curated_at          timestamptz,

  ingested_at         timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX items_sort_idx       ON items ((coalesce(published_at, ingested_at)) DESC);
CREATE INDEX items_uncurated_idx  ON items (published_at DESC) WHERE curated_at IS NULL;
CREATE INDEX items_study_idx      ON items (study_status);
CREATE INDEX items_security_idx   ON items (published_at DESC) WHERE is_security;

CREATE TABLE item_stacks (
  item_id   int  NOT NULL REFERENCES items(id)  ON DELETE CASCADE,
  stack_id  int  NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
  source    text NOT NULL DEFAULT 'regra' CHECK (source IN ('regra', 'curadoria', 'manual')),
  position  smallint NOT NULL DEFAULT 0,    -- 0 = stack principal do item
  PRIMARY KEY (item_id, stack_id)
);

CREATE TABLE notes (
  id          serial PRIMARY KEY,
  item_id     int REFERENCES items(id) ON DELETE SET NULL,
  body        text NOT NULL,
  lab_path    text,                       -- pasta do experimento em lab/
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_item_idx ON notes (item_id);

CREATE TABLE digests (
  id            serial PRIMARY KEY,
  key           text UNIQUE NOT NULL,     -- nome do arquivo sem .md
  title         text NOT NULL,
  period_start  date,
  period_end    date,
  item_count    int  NOT NULL DEFAULT 0,
  markdown      text NOT NULL,
  file_path     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sync_state (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO sync_state (key, value) VALUES ('miniflux_last_entry_id', '0');

-- Itens com stacks agregadas (principal primeiro) e data de ordenação
CREATE VIEW v_items AS
SELECT
  i.*,
  coalesce(i.published_at, i.ingested_at) AS sort_at,
  coalesce(array_agg(s.slug ORDER BY x.position, s.position) FILTER (WHERE s.slug IS NOT NULL), '{}') AS stacks
FROM items i
LEFT JOIN item_stacks x ON x.item_id = i.id
LEFT JOIN stacks s ON s.id = x.stack_id
GROUP BY i.id;
