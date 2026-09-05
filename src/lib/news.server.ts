/**
 * Server-only headline fetching via Google News RSS (no API key required).
 */

export type Headline = {
  title: string;
  source: string | null;
  url: string;
  published: string | null;
};

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function pick(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m?.[1] ? decode(m[1]) : null;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Finnhub company news (used when a key is configured). */
async function fetchFinnhubHeadlines(symbol: string, limit: number): Promise<Headline[]> {
  const key = process.env["FINNHUB_API_KEY"];
  if (!key) return [];
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${ymd(from)}&to=${ymd(to)}&token=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    const json: unknown = await res.json();
    if (!Array.isArray(json)) return [];
    const out: Headline[] = [];
    for (const raw of json as Record<string, unknown>[]) {
      const title = typeof raw["headline"] === "string" ? raw["headline"] : null;
      const link = typeof raw["url"] === "string" ? raw["url"] : null;
      if (!title || !link) continue;
      const ts = Number(raw["datetime"]);
      out.push({
        title,
        source: typeof raw["source"] === "string" ? raw["source"] : null,
        url: link,
        published: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : null,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchHeadlines(symbol: string, limit = 3): Promise<Headline[]> {
  const finnhub = await fetchFinnhubHeadlines(symbol, limit);
  if (finnhub.length > 0) return finnhub;
  return fetchGoogleHeadlines(symbol, limit);
}

async function fetchGoogleHeadlines(symbol: string, limit: number): Promise<Headline[]> {
  const query = encodeURIComponent(`${symbol} stock`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; SignalWatchlist/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split("<item>").slice(1, limit + 4);
    const out: Headline[] = [];
    for (const block of items) {
      const title = pick(block, "title");
      const link = pick(block, "link");
      if (!title || !link) continue;
      out.push({
        title,
        source: pick(block, "source"),
        url: link,
        published: pick(block, "pubDate"),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
