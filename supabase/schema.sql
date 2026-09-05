-- Consolidated Supabase Schema for SmartWatchlist / GrowwList
-- Run this script in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Watchlist Items Table
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  last_seen_price numeric,
  last_seen_at timestamptz,
  UNIQUE (user_id, symbol)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_items TO authenticated;
GRANT ALL ON public.watchlist_items TO service_role;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'watchlist_items' AND policyname = 'Users manage their own watchlist'
  ) THEN
    CREATE POLICY "Users manage their own watchlist" ON public.watchlist_items
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Price Snapshots Table
CREATE TABLE IF NOT EXISTS public.price_snapshots (
  symbol text NOT NULL,
  snapshot_date date NOT NULL,
  close numeric NOT NULL,
  PRIMARY KEY (symbol, snapshot_date)
);

GRANT SELECT ON public.price_snapshots TO authenticated;
GRANT ALL ON public.price_snapshots TO service_role;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_snapshots' AND policyname = 'Signed-in users can read price history'
  ) THEN
    CREATE POLICY "Signed-in users can read price history" ON public.price_snapshots
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 3. Quote Cache Table
CREATE TABLE IF NOT EXISTS public.quote_cache (
  symbol text PRIMARY KEY,
  price numeric NOT NULL,
  prev_close numeric,
  company_name text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  data_source text,
  data_status text
);

GRANT SELECT ON public.quote_cache TO authenticated;
GRANT ALL ON public.quote_cache TO service_role;
ALTER TABLE public.quote_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quote_cache' AND policyname = 'Signed-in users can read quote cache'
  ) THEN
    CREATE POLICY "Signed-in users can read quote cache" ON public.quote_cache
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 4. Instruments Table
CREATE TABLE IF NOT EXISTS public.instruments (
  symbol text PRIMARY KEY,
  exchange text NOT NULL,
  exchange_code text NOT NULL,
  company_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.instruments TO authenticated;
GRANT ALL ON public.instruments TO service_role;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'instruments' AND policyname = 'Signed-in users can read instruments'
  ) THEN
    CREATE POLICY "Signed-in users can read instruments" ON public.instruments
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_price_snapshots_symbol_date ON public.price_snapshots (symbol, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_symbol ON public.watchlist_items (user_id, symbol);
