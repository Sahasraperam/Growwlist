/**
 * Live integration test for nse-bse-api.
 * Tests real network calls — no mocks.
 *
 * Run with:
 *   node --input-type=module scripts/test-market-data.mjs
 */

import { NSE, BSE } from "nse-bse-api";

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

let passCount = 0;
let failCount = 0;

function assert(label, value, check) {
  const ok = check(value);
  if (ok) {
    console.log(`  ${PASS} ${label}:`, JSON.stringify(value));
    passCount++;
  } else {
    console.log(`  ${FAIL} ${label}: got`, JSON.stringify(value));
    failCount++;
  }
}

async function section(title, fn) {
  console.log(`\n── ${title} ──`);
  try {
    await fn();
  } catch (e) {
    console.log(`  ${FAIL} Unhandled error: ${e.message}`);
    failCount++;
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────
const nse = new NSE("/tmp/nse_test_final", { timeout: 15000 });
const bse = new BSE({ timeout: 10000 });

// ── NSE Market Status ──────────────────────────────────────────────────────
await section("NSE Market Status", async () => {
  const status = await nse.market.getStatus();
  assert("returns array", status, (v) => Array.isArray(v) && v.length > 0);
  const cm = status.find((s) => s.market === "Capital Market");
  assert("Capital Market segment present", cm?.market, (v) => v === "Capital Market");
  assert("marketStatus is string", cm?.marketStatus, (v) => typeof v === "string");
  console.log(`  ${WARN} Capital Market is currently: ${cm?.marketStatus ?? "unknown"}`);
});

// ── NSE Historical Data ────────────────────────────────────────────────────
const NSE_SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFCBANK"];

for (const symbol of NSE_SYMBOLS) {
  await section(`NSE Historical — ${symbol}`, async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 10 * 86_400_000);
    const rows = await nse.historical.fetchEquityHistoricalData({
      symbol,
      from_date: from,
      to_date: to,
    });
    assert("returns non-empty array", rows, (v) => Array.isArray(v) && v.length > 0);
    if (Array.isArray(rows) && rows.length > 0) {
      const latest = rows[rows.length - 1];
      const close = latest.chClosingPrice ?? latest.chLastTradedPrice ?? null;
      assert("close price is positive number", close, (v) => typeof v === "number" && v > 0);
      assert("mtimestamp present", latest.mtimestamp, (v) => Boolean(v));
      console.log(`  ℹ️  Latest record: date=${latest.mtimestamp} close=${close}`);
    }
  });
}

// ── NSE Invalid Symbol ─────────────────────────────────────────────────────
await section("NSE Historical — INVALIDSYMBOL (expect empty/error)", async () => {
  try {
    const to = new Date();
    const from = new Date(to.getTime() - 10 * 86_400_000);
    const rows = await nse.historical.fetchEquityHistoricalData({
      symbol: "INVALIDSYMBOL999",
      from_date: from,
      to_date: to,
    });
    assert("empty array for invalid symbol", rows, (v) => Array.isArray(v) && v.length === 0);
  } catch (e) {
    console.log(`  ${PASS} Threw error as expected: ${e.message}`);
    passCount++;
  }
});

// ── BSE Quote ─────────────────────────────────────────────────────────────
const BSE_CODES = [
  { symbol: "RELIANCE", code: "500325" },
  { symbol: "TCS", code: "532540" },
  { symbol: "INFY", code: "500209" },
  { symbol: "HDFCBANK", code: "500180" },
];

for (const { symbol, code } of BSE_CODES) {
  await section(`BSE Quote — ${symbol} (${code})`, async () => {
    const q = await bse.quote(code);
    const ltp = q.LTP ?? q.ltp ?? null;
    const prev = q.PrevClose ?? q.previousclose ?? null;
    assert("LTP is positive number", ltp, (v) => typeof v === "number" && v > 0);
    assert("PrevClose present", prev, (v) => v !== null && v !== undefined);
    console.log(
      `  ℹ️  BSE ${symbol}: LTP=${ltp}, PrevClose=${prev}, Open=${q.Open ?? q.open}, High=${q.High ?? q.high}, Low=${q.Low ?? q.low}`,
    );
  });
}

// ── BSE Invalid Code ──────────────────────────────────────────────────────
await section("BSE Quote — invalid code (999999999)", async () => {
  try {
    const q = await bse.quote("999999999");
    const ltp = q.LTP ?? q.ltp ?? null;
    if (ltp === null || ltp === 0) {
      console.log(`  ${PASS} Invalid code returned null/zero LTP as expected`);
      passCount++;
    } else {
      console.log(`  ${WARN} Unexpected LTP for invalid code: ${ltp}`);
    }
  } catch (e) {
    console.log(`  ${PASS} Threw error for invalid code (expected): ${e.message}`);
    passCount++;
  }
});

// ── BSE Scripcode Lookup ───────────────────────────────────────────────────
await section("BSE getScripCode — RELIANCE", async () => {
  try {
    const code = await bse.getScripCode("RELIANCE");
    assert("returns numeric string", code, (v) => typeof v === "string" && /^\d+$/.test(v.trim()));
    console.log(`  ℹ️  RELIANCE BSE code: ${code}`);
  } catch (e) {
    console.log(`  ${WARN} getScripCode threw: ${e.message}`);
  }
});

// ── BSE Gainers ────────────────────────────────────────────────────────────
await section("BSE Gainers", async () => {
  const gainers = await bse.gainers();
  assert("returns non-empty array", gainers, (v) => Array.isArray(v) && v.length > 0);
  if (Array.isArray(gainers) && gainers.length > 0) {
    const top = gainers[0];
    assert("top gainer has change_percent", top.change_percent, (v) => typeof v === "number");
    console.log(`  ℹ️  Top gainer: ${top.scripname} (+${top.change_percent}%)`);
  }
});

// ── Cleanup ────────────────────────────────────────────────────────────────
nse.exit();
bse.close();

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════`);
console.log(`PASS: ${passCount}  FAIL: ${failCount}`);
console.log(`═══════════════════════════════`);

if (failCount > 0) process.exit(1);
