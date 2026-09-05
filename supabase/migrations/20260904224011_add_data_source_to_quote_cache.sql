-- Add data_source column to quote_cache.
-- Tracks whether the price came from BSE (live intraday LTP) or NSE (historical EOD close).
-- Nullable so existing rows without source info remain valid.
ALTER TABLE public.quote_cache ADD COLUMN IF NOT EXISTS data_source text;
