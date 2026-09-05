import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Headline } from "./news.server";

export type NewsPayload = { news: Record<string, Headline[]> };

export const getNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { symbols: string[] }) => ({
    symbols: (input.symbols ?? [])
      .map((s) => String(s).trim().toUpperCase())
      .filter((s) => /^[A-Z0-9.-]{1,12}$/.test(s))
      .slice(0, 12),
  }))
  .handler(async ({ data }): Promise<NewsPayload> => {
    const { fetchHeadlines } = await import("./news.server");
    const results = await Promise.all(
      data.symbols.map(async (symbol) => [symbol, await fetchHeadlines(symbol, 3)] as const),
    );
    return { news: Object.fromEntries(results) };
  });
