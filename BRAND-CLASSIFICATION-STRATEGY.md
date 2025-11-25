# Brand Classification Strategy

## Overview

This document describes how the system classifies brands and identifies competitors using Claude AI.

## Classification: Global vs Niche

### Global Brand

A brand with **recognition and operations across multiple continents (3+)**.

**Characteristics:**
- Operates in 10+ countries
- International media coverage
- Millions of social media followers
- Recognized worldwide

**Examples:** Nike, Coca-Cola, Apple, Netflix, Spotify, Tesla

### Niche Brand

**Everything that is NOT global**.

Includes: national, regional, local, specialized brands.

**Examples:** Local restaurants, regional banks, boutique consultancies, specialized B2B services

## How Classification Works

Claude analyzes each brand and determines its classification based on:

1. **Geographic reach** - Where does the brand operate?
2. **Brand recognition** - Is it known internationally?
3. **Industry presence** - How does it compare to industry leaders?
4. **Digital footprint** - International vs local online presence

### Classification Prompt

```
Analyze the brand "{brandName}" and classify it as either GLOBAL or NICHE.

GLOBAL: Operates in multiple continents, internationally recognized
NICHE: Local, regional, or specialized focus

Return:
- classification: "global" or "niche"
- confidence: 0-100
- reasoning: Brief explanation
```

## Competitor Identification

Once classified, Claude identifies 5 relevant competitors using different strategies:

### For Global Brands

Claude focuses on:
- Direct industry competitors at similar scale
- Companies competing for the same global market
- Alternative solutions in the same category

### For Niche Brands

Claude focuses on:
- Local/regional competitors in the same area
- Similar businesses serving the same audience
- Companies with comparable offerings and price points

## Competitor Scoring

Each competitor receives a similarity score (0-100%) based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Industry Match | High | Same industry/sector |
| Business Model | High | Similar revenue model |
| Target Audience | Medium | Same customer demographic |
| Geographic Overlap | Medium | Operating in same regions |
| Price Point | Low | Comparable pricing |

## Example Analysis

### Input: "Tesla"

```json
{
  "brand": "Tesla",
  "classification": "global",
  "industry": "Electric Vehicles & Clean Energy",
  "competitors": [
    {
      "name": "Rivian",
      "similarity": 85,
      "reasoning": "Direct EV competitor, premium segment, US-based"
    },
    {
      "name": "BYD",
      "similarity": 82,
      "reasoning": "Global EV manufacturer, competing in multiple markets"
    },
    {
      "name": "Lucid Motors",
      "similarity": 78,
      "reasoning": "Luxury EV segment, direct Tesla competitor"
    }
  ]
}
```

### Input: "Local Coffee Shop"

```json
{
  "brand": "Local Coffee Shop",
  "classification": "niche",
  "industry": "Food & Beverage - Coffee",
  "competitors": [
    {
      "name": "Nearby independent cafes",
      "similarity": 90,
      "reasoning": "Same local market, similar offering"
    },
    {
      "name": "Starbucks (local stores)",
      "similarity": 70,
      "reasoning": "Chain competition in the area"
    }
  ]
}
```

## Caching Strategy

Results are cached in PostgreSQL for 7 days to:
- Reduce API costs
- Improve response times (< 100ms for cached queries)
- Provide consistent results for the same brand

## Why Claude-Only?

Previous iterations used multiple data sources (Wikipedia, SerpAPI, Google Trends). The simplified Claude-only approach offers:

1. **Simplicity** - Single API, single point of failure
2. **Speed** - 5-15s vs 30-60s with multiple sources
3. **Reliability** - No dependency on external scraping APIs
4. **Quality** - Claude's knowledge is comprehensive for most brands
5. **Cost** - Fewer API calls, simpler infrastructure
