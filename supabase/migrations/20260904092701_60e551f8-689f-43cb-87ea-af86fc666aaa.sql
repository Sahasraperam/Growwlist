CREATE TABLE public.watchlist_items (
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
CREATE POLICY "Users manage their own watchlist" ON public.watchlist_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.price_snapshots (
  symbol text NOT NULL,
  snapshot_date date NOT NULL,
  close numeric NOT NULL,
  PRIMARY KEY (symbol, snapshot_date)
);

GRANT SELECT ON public.price_snapshots TO authenticated;
GRANT ALL ON public.price_snapshots TO service_role;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read price history" ON public.price_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.quote_cache (
  symbol text PRIMARY KEY,
  price numeric NOT NULL,
  prev_close numeric,
  company_name text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quote_cache TO authenticated;
GRANT ALL ON public.quote_cache TO service_role;
ALTER TABLE public.quote_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read quotes" ON public.quote_cache
  FOR SELECT TO authenticated USING (true);