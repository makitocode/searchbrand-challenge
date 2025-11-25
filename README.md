# SearchBrand - Competitor Intelligence Tool

## Live Demo

**[https://searchbrand-challenge-production.up.railway.app/](https://searchbrand-challenge-production.up.railway.app/)**

Automated competitor intelligence tool that identifies relevant competitors for any brand using AI.

## The Problem

Marketing Intelligence teams need to identify competitors manually - a process that consumes time and resources. This tool automates that search, handling two distinct scenarios:

### Case A: Global Brands (High Data Availability)

Established brands with abundant public information available (e.g., Spotify, Nike, Coca-Cola).

**Challenge**: Filter noise and avoid false positives amid information overload.

**Expected output**:
- 3-5 direct competitors
- Transparent similarity score (0-100%)
- Technical justification for each match

### Case B: "Ghost" Brands (Low Data Availability)

Niche, local, or very new startup brands with little digital presence (e.g., local vegan bakery, boutique consultancy, specific B2B SaaS).

**Challenge**: Discover competitors where barely any structured public data exists.

**Expected output**:
- 2-3 potential competitors
- Clear evidence of why they are competitors

## Challenge Requirements

1. **Input**: Brand name or website
2. **Output**: List of competitors with technical justification
3. **Deployment**: Cloud platform (Railway, Vercel, Render)
4. **Database**: Simple integration (Supabase, PostgreSQL)

---

## Solution: Claude-Powered Analysis

This implementation uses **Anthropic Claude** as the single source for intelligent brand analysis. No external scraping APIs, no complex multi-source pipelines - just Claude's knowledge combined with smart caching.

### How It Works

1. **User enters a brand name** via the web interface
2. **Claude analyzes the brand** using its pre-trained knowledge
3. **Results are cached** in PostgreSQL for 7 days
4. **Subsequent queries** return cached results instantly

### Performance

| Query Type | Response Time |
|------------|---------------|
| New brand (first query) | 5-15 seconds |
| Cached brand | < 100ms |

### Analysis Output

For each brand, the system provides:

- **Brand Classification**: Global vs Niche
- **Industry**: Primary industry/sector
- **Top 5 Competitors** with:
  - Similarity score (0-100%)
  - Detailed reasoning
  - Key differentiators

```json
{
  "brand": "Tesla",
  "classification": "global",
  "industry": "Electric Vehicles & Clean Energy",
  "competitors": [
    {
      "name": "Rivian",
      "similarity": 85,
      "reasoning": "Direct EV competitor focused on trucks and SUVs..."
    },
    {
      "name": "BYD",
      "similarity": 82,
      "reasoning": "Chinese EV manufacturer with global expansion..."
    }
  ]
}
```

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **AI**: Anthropic Claude (claude-sonnet-4-20250514)
- **Database**: PostgreSQL (Supabase)
- **API**: Express.js
- **Frontend**: Single-page HTML/CSS/JS
- **Deployment**: Railway (Docker)

## Architecture

```
searchbrand-challenge/
├── src/
│   ├── api/                  # Express REST API
│   │   ├── controllers/      # Request handlers
│   │   ├── middleware/       # Auth, error handling
│   │   ├── routes/           # Route definitions
│   │   └── server.ts         # Express setup
│   ├── services/
│   │   ├── analysis/         # Brand analysis service (Claude)
│   │   ├── auth/             # JWT authentication
│   │   └── database/         # PostgreSQL client
│   └── utils/                # Config, logger
├── public/                   # Web UI (single page)
├── database/                 # SQL schemas
└── Dockerfile                # Production deployment
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/analysis` | Analyze a brand |
| GET | `/api/v1/analysis/history` | Get analysis history |
| GET | `/api/v1/analysis/:id` | Get specific analysis |

### Example Request

```bash
curl -X POST https://searchbrand-challenge-production.up.railway.app/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{"brand": "Spotify"}'
```

## Quick Start

See [INSTALL.md](INSTALL.md) for detailed setup instructions.

```bash
# Clone and install
git clone <repository-url>
cd searchbrand-challenge
npm install

# Configure environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY and DATABASE_URL

# Run locally
npm run dev

# Open http://localhost:3000
```

## Key Design Decisions

1. **Claude-only approach**: Simpler architecture, faster development, reliable results
2. **Aggressive caching**: 7-day cache reduces API costs and improves UX
3. **Single-page UI**: Minimal frontend, mobile-first design
4. **Docker deployment**: Consistent builds across environments
