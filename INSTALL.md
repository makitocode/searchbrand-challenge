# Installation Guide

## Prerequisites

- **Node.js** 20+ and npm
- **PostgreSQL** database (local or Supabase)
- **Anthropic API Key** (required)

## Quick Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd searchbrand-challenge
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-xxx    # Your Anthropic API key
DATABASE_URL=postgresql://...          # PostgreSQL connection string

# Optional
PORT=3000
NODE_ENV=development
```

### 3. Database Setup

**Option A: Use Supabase (Recommended)**

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to Settings > Database > Connection string
3. Copy the connection string to `DATABASE_URL`
4. Run the schema:

```bash
# Connect to Supabase and run the schema
psql $DATABASE_URL -f database/schema.sql
```

**Option B: Local PostgreSQL with Docker**

```bash
# Start PostgreSQL
docker-compose up -d

# The schema runs automatically on first start
```

### 4. Run the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build && npm start
```

Open **http://localhost:3000** in your browser.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Compile TypeScript |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:start` | Start local PostgreSQL |
| `npm run db:stop` | Stop local PostgreSQL |
| `npm run db:logs` | View database logs |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | API key from Anthropic |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (development/production) |

## Troubleshooting

### "Missing ANTHROPIC_API_KEY"

Get your API key from [console.anthropic.com](https://console.anthropic.com)

### Database connection errors

1. Verify `DATABASE_URL` is correct
2. Check if PostgreSQL is running
3. Ensure the database exists

### Build errors

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

## Production Deployment (Railway)

1. Connect your GitHub repository to Railway
2. Set environment variables:
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL` (Railway provides this if using their PostgreSQL)
3. Deploy - Railway uses the Dockerfile automatically
