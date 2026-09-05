# 📈 GrowwList — Smart Market Watchlist

> **Smart, Context-Aware Stock Watchlist powered by TanStack Start, React 19 & Supabase**

GrowwList answers the fundamental question every investor and trader faces:

> _"When I return to my watchlist, what meaningfully changed since I last checked, how unusual is that movement relative to stock volatility, and why does it deserve my attention?"_

---

## 🌟 Key Features

- **🧠 Stock-Specific Attention Score**: Calculates movement significance normalized by historical daily volatility ($\text{Score} = \frac{\Delta \%}{\text{Typical Swing}}$), replacing arbitrary static percentage alerts.
- **🔖 Personal Check-In** — Save your own last-seen price so you can quickly spot what changed since your previous check.
- **🔴 Clear Data Status** — See whether market data is live, delayed, stale, end-of-day, or simulated.
- **📊 Stock Insights** — Explore price history, key metrics, volatility, and relevant news in one pl
- **⚡ Fast & Responsive** — Built with React 19, TanStack Start, TanStack Query, and Supabase for a smooth experience.

---

## 🏗️ Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Browser (React 19)                               │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       │                              │
                       ▼                              ▼
        ┌────────────────────────────┐  ┌────────────────────────────┐
        │   TanStack Query Polling   │  │   "Check In Now" Action    │
        │   (Every 3 Minutes)        │  │   (Explicit User Trigger) │
        └──────────────┬─────────────┘  └──────────────┬─────────────┘
                       │                              │
                       ▼                              ▼
        ┌────────────────────────────┐  ┌────────────────────────────┐
        │ getWatchlist() [Read-Only] │  │ checkInWatchlist() [Atomic]│
        └──────────────┬─────────────┘  └──────────────┬─────────────┘
                       │                              │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    TanStack Start (SSR/Node)  │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
         ┌─────────────────────────────────────────────────────────┐
         │                  Supabase PostgreSQL                    │
         │ (watchlist_items, price_snapshots, quote_cache, etc.)   │
         └────────────────────────────┬────────────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    Market Data Provider       │
                      │       (nse-bse-api)           │
                      └───────────────────────────────┘
```

---

## 📐 Key Concepts & Algorithms

### 1. Stock-Specific Attention Score Math

Static alerts (like "alert me if stock moves >2%") fail because a 2% move in a low-volatility blue chip (e.g. TCS) is significant, while the same move in a highly volatile stock is normal noise. GrowwList calculates an **Attention Multiple**:

1. **Daily Returns Series**: For stock $i$ over $N$ historical days:
   $$r_t = \frac{P_t - P_{t-1}}{P_{t-1}} \times 100$$
2. **Typical Daily Swing ($\sigma$)**: Sample standard deviation of daily return percentages:
   $$\sigma = \sqrt{\frac{1}{N-1} \sum_{t=1}^{N} (r_t - \bar{r})^2}$$
3. **Attention Multiple**:
   $$\text{Attention Score} = \frac{|\Delta \%|}{\sigma}$$
4. **Significance Thresholds**:
   - 🚨 **Unusual Move**: $\ge 2.0\times$ typical daily swing
   - ⚡ **Notable Move**: $\ge 1.0\times$ typical daily swing
   - 🟢 **Normal Range**: $< 1.0\times$ typical daily swing
   - 💤 **Quiet**: $< 0.35\times$ typical daily swing
   - 🔄 **Learning**: Fallback state when historical data is under 11 days

### 2. User-Owned Checkpoints vs. Background Polling

- **Background Refetches** (`getWatchlist()`): Frontend background polling (every 3 minutes) updates the currently observed prices without shifting your `last_seen_price`.
- **Explicit Check-In** (`checkInWatchlist()`): When you click "Check In", an atomic batch upsert writes the current prices to `last_seen_price` and sets `last_seen_at = now()`.

---

## 🚀 Setup & Installation Guide

Follow these steps to set up GrowwList locally on your machine.

### Prerequisites

Ensure you have the following installed:

- **Node.js**: `v20.0.0` or higher
- **Package Manager**: `npm` (v10+), `pnpm`, or `bun`
- **Supabase Account**: A free Supabase project at [supabase.com](https://supabase.com)

---

### Step 1: Clone the Repository & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-username/SmartWatchlist.git
cd SmartWatchlist

# Install project dependencies
npm install
```

---

### Step 2: Set Up Supabase Database & Auth

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Navigate to **SQL Editor** in the left sidebar.
3. Open [`supabase/schema.sql`](file:///Users/apple/Desktop/coding/SmartWatchlist/supabase/schema.sql) from this repository, copy its contents, paste them into the SQL Editor, and click **Run**.

This script sets up:

- `public.watchlist_items` table with Row Level Security (RLS) policies.
- `public.price_snapshots` table for historical returns & volatility math.
- `public.quote_cache` table for caching exchange quotes.
- `public.instruments` table for persistent exchange mapping.
- Performance indexes on symbol and date fields.

---

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Update `.env` with your Supabase credentials:

```env
# ── Supabase Configuration ──────────────────────────────────────────────────
SUPABASE_PROJECT_ID="your-supabase-project-id"
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# Client-side injected environment variables
VITE_SUPABASE_PROJECT_ID="your-supabase-project-id"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"

# ── Market Data Configuration ──────────────────────────────────────────────
MARKET_DATA_INTERVAL_MS=180000
USE_MOCK_MARKET_DATA=false
CRON_SECRET="your-custom-cron-secret"
```

> ⚠️ **Note**: `SUPABASE_SERVICE_ROLE_KEY` is used exclusively on the server side for admin database tasks and quote caching. Never expose it to the browser client.

---

### Step 4: Run Development Server

Start the local development server:

```bash
npm run dev
```

The application will be available at:
`http://localhost:3000` (or the port specified by Vite in your terminal).

---

### Step 5: Verification & Testing

#### Live Market Data Integration Test

To verify live connection with market data providers (BSE/NSE):

```bash
node --input-type=module scripts/test-market-data.mjs
```

#### Linting & Type Checks

Run ESLint to verify code quality:

```bash
npm run lint
```

#### Production Build Validation

Verify SSR and production bundle build:

```bash
npm run build
```

---

## 📁 Repository Structure

```
SmartWatchlist/
├── src/
│   ├── components/            # Reusable UI & Feature components
│   │   ├── ui/                # Radix UI & Shadcn primitive components
│   │   ├── DataSourceBadge.tsx# Market data freshness & provenance indicator
│   │   ├── SideNav.tsx        # Navigation sidebar
│   │   └── watchlist-ui.tsx   # Watchlist status & badge helper components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Core business logic & server functions
│   │   ├── market.server.ts   # Market quote processing & score calculation
│   │   ├── nse-bse.server.ts  # Exchange API integration (nse-bse-api)
│   │   ├── watchlist.functions.ts # TanStack Start server functions
│   │   └── news.server.ts     # Stock news feed fetchers
│   ├── routes/                # TanStack Router route definitions
│   │   ├── _authenticated/    # Protected route layout
│   │   │   ├── dashboard.tsx  # Main Watchlist Dashboard
│   │   │   ├── dashboard.$symbol.tsx # Stock detail modal view
│   │   │   ├── watchlist.tsx  # Watchlist management
│   │   │   ├── portfolio.tsx  # Portfolio overview
│   │   │   └── analytics.tsx  # Volatility & movement analytics
│   │   ├── auth.tsx           # Sign-in & Registration page
│   │   └── index.tsx          # Public landing page
│   ├── server.ts              # Server entry point
│   ├── start.ts               # TanStack Start initializer
│   └── styles.css             # Tailwind v4 custom styling & design tokens
├── supabase/
│   ├── schema.sql             # Consolidated PostgreSQL schema & RLS policies
│   └── migrations/            # SQL migration history
├── scripts/
│   └── test-market-data.mjs   # Live integration test suite for BSE/NSE API
├── package.json               # Dependencies & NPM scripts
└── vite.config.ts             # Vite configuration with TanStack Start plugin
```

---

## 🛠️ Available Scripts

| Script                | Command              | Description                                  |
| :-------------------- | :------------------- | :------------------------------------------- |
| **`npm run dev`**     | `vite dev`           | Launches Vite development server with HMR    |
| **`npm run build`**   | `vite build`         | Builds client and SSR bundles for production |
| **`npm run preview`** | `vite preview`       | Previews the production build locally        |
| **`npm run lint`**    | `eslint .`           | Runs ESLint type checks and code style rules |
| **`npm run format`**  | `prettier --write .` | Formats source files with Prettier           |
| **`npm run clean`**   | `rm -rf ...`         | Cleans build caches and generated artifacts  |

---

## ❓ Troubleshooting

- **Supabase Authentication Issues**: Make sure Email/Password authentication is enabled in your Supabase Dashboard (**Authentication** -> **Providers**).
- **Missing Stock Data**: If BSE live quotes encounter network timeouts, set `USE_MOCK_MARKET_DATA=true` in `.env` for local testing.
- **RLS Access Denied**: Ensure `supabase/schema.sql` was executed in your Supabase SQL Editor and that RLS policies are active.

---

## 📄 License

This project is open-source and built for the **Groww CODE 2026 Hackathon**.
# Growwlist
