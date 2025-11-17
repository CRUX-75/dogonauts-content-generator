-- job_queue
CREATE TABLE IF NOT EXISTS job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  error text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- post_feedback
CREATE TABLE IF NOT EXISTS post_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_post_id uuid NOT NULL,
  channel text NOT NULL,          -- 'IG' | 'FB'
  ig_media_id text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- product_performance
CREATE TABLE IF NOT EXISTS product_performance (
  product_id bigint PRIMARY KEY,
  perf_score numeric NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now()
);

-- style_performance (por estilo, canal y formato)
CREATE TABLE IF NOT EXISTS style_performance (
  style text NOT NULL,
  channel text NOT NULL,   -- 'IG' | 'FB'
  format text NOT NULL,    -- 'CAROUSEL' | 'SINGLE' | 'REEL'
  impressions int NOT NULL DEFAULT 0,
  engagement numeric NOT NULL DEFAULT 0,
  perf_score numeric NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (style, channel, format)
);

-- generated_posts: sólo ejemplo de columnas a añadir si ya existe
ALTER TABLE generated_posts
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS ab_test_group_id uuid,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS hook text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS cta text,
  ADD COLUMN IF NOT EXISTS hashtag_block text,
  ADD COLUMN IF NOT EXISTS angle text,
  ADD COLUMN IF NOT EXISTS channel_target text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS ig_media_id text,
  ADD COLUMN IF NOT EXISTS fb_post_id text;
