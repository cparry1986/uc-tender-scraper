# ⚡ UC Tender Scraper

Automated public sector electricity supply tender intelligence for UrbanChain.

## What It Does

- **Scrapes daily** from Find a Tender (FTS) + Contracts Finder (CF) government APIs
- **Scores 0-100** based on value fit, timeline, keywords, geography
- **Filters automatically** — excludes generation, installation, consultancy, metering
- **Emails daily digest** of HIGH + MEDIUM priority opportunities
- **Dashboard** to browse and filter results on-demand

## Architecture

```
Next.js 14 (App Router) on Vercel
├── /api/scrape     → Manual scrape endpoint (GET, returns JSON)
├── /api/cron       → Daily automated scrape (Vercel Cron, 6am UTC)
├── /               → Dashboard UI
└── lib/
    ├── collectors  → FTS + Contracts Finder API clients
    ├── scoring     → 0-100 scoring engine
    ├── email       → Resend-powered daily digest
    └── types       → TypeScript definitions
```

## Scoring

| Component   | Max Points | Criteria                                    |
|-------------|-----------|---------------------------------------------|
| Base        | 40        | Starting score for any electricity tender   |
| Value       | 25        | Sweet spot: £500k-£2m                       |
| Timeline    | 15        | 7-30 days until deadline                    |
| Keywords    | 20        | "supply of electricity", "PPA", "REGO" etc  |
| Geography   | 5         | North West = +5, North England = +3         |
| Penalties   | -30       | Expired, >£10m, no value stated             |

**Exclusions** (score = 0): solar installation, heat networks, EV charging, consultancy, audit, metering, retrofit, insulation, electrical works, street lighting.

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_ORG/uc-tender-scraper.git
cd uc-tender-scraper
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
# Edit with your Resend API key and email addresses
```

### 3. Run Locally

```bash
npm run dev
# Visit http://localhost:3000
# API: http://localhost:3000/api/scrape?days=30
```

### 4. Deploy to Vercel

```bash
# Connect to GitHub repo in Vercel dashboard, or:
npx vercel --prod
```

Add environment variables in Vercel dashboard → Settings → Environment Variables.

The cron job (`/api/cron`) runs automatically at 6am UTC daily.

## Email Setup (Resend)

1. Sign up at [resend.com](https://resend.com) (free tier = 100 emails/day)
2. Get API key → set as `RESEND_API_KEY`
3. Set `ALERT_EMAIL` to recipient(s) (comma-separated)
4. Set `FROM_EMAIL` (must be verified domain in Resend)

## API Endpoints

| Endpoint     | Method | Description                              |
|-------------|--------|------------------------------------------|
| `/api/scrape` | GET    | Manual scrape. Params: `days`, `minScore` |
| `/api/cron`   | GET    | Automated daily scrape + email digest     |

## Future Enhancements

- [ ] HubSpot deal creation for HIGH priority tenders
- [ ] Proactis/The Chest regional portal scraping
- [ ] Monarch integration
- [ ] Slack notifications
- [ ] Historical tracking / trend analysis
- [ ] NEPO, ESPO, LASER framework monitoring
