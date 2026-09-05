-- Remediation Database Migration
-- 1. Add data_status column to quote_cache
ALTER TABLE public.quote_cache ADD COLUMN IF NOT EXISTS data_status text;

-- 2. Create instruments table for persistent BSE scripcode mapping
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
CREATE POLICY "Signed-in users can read instruments" ON public.instruments
  FOR SELECT TO authenticated USING (true);

-- 3. Database Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_price_snapshots_symbol_date ON public.price_snapshots (symbol, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_symbol ON public.watchlist_items (user_id, symbol);
