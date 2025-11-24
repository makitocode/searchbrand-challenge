/**
 * Scoring System - 10 Criteria Transparent Scoring
 * Evaluates competitor similarity based on weighted criteria
 */

export interface CompetitorScoreBreakdown {
  industry: number; // 0-15
  businessModel: number; // 0-15
  productOffering: number; // 0-15
  targetAudience: number; // 0-10
  geography: number; // 0-10
  marketSize: number; // 0-10
  priceRange: number; // 0-10
  digitalPresence: number; // 0-5
  brandMaturity: number; // 0-5
  keywords: number; // 0-5
}

export interface CompetitorScore {
  name: string;
  url?: string;
  similarityScore: number; // 0-100 (sum of all criteria)
  breakdown: CompetitorScoreBreakdown;
  evidence: string[];
}

/**
 * Criteria weights and max scores
 */
export const CRITERIA_WEIGHTS = {
  industry: 15,
  businessModel: 15,
  productOffering: 15,
  targetAudience: 10,
  geography: 10,
  marketSize: 10,
  priceRange: 10,
  digitalPresence: 5,
  brandMaturity: 5,
  keywords: 5,
} as const;

/**
 * Calculate total similarity score from breakdown
 */
export function calculateTotalScore(breakdown: CompetitorScoreBreakdown): number {
  return (
    breakdown.industry +
    breakdown.businessModel +
    breakdown.productOffering +
    breakdown.targetAudience +
    breakdown.geography +
    breakdown.marketSize +
    breakdown.priceRange +
    breakdown.digitalPresence +
    breakdown.brandMaturity +
    breakdown.keywords
  );
}

/**
 * Validate that breakdown scores are within allowed ranges
 */
export function validateBreakdown(breakdown: CompetitorScoreBreakdown): boolean {
  return (
    breakdown.industry >= 0 &&
    breakdown.industry <= CRITERIA_WEIGHTS.industry &&
    breakdown.businessModel >= 0 &&
    breakdown.businessModel <= CRITERIA_WEIGHTS.businessModel &&
    breakdown.productOffering >= 0 &&
    breakdown.productOffering <= CRITERIA_WEIGHTS.productOffering &&
    breakdown.targetAudience >= 0 &&
    breakdown.targetAudience <= CRITERIA_WEIGHTS.targetAudience &&
    breakdown.geography >= 0 &&
    breakdown.geography <= CRITERIA_WEIGHTS.geography &&
    breakdown.marketSize >= 0 &&
    breakdown.marketSize <= CRITERIA_WEIGHTS.marketSize &&
    breakdown.priceRange >= 0 &&
    breakdown.priceRange <= CRITERIA_WEIGHTS.priceRange &&
    breakdown.digitalPresence >= 0 &&
    breakdown.digitalPresence <= CRITERIA_WEIGHTS.digitalPresence &&
    breakdown.brandMaturity >= 0 &&
    breakdown.brandMaturity <= CRITERIA_WEIGHTS.brandMaturity &&
    breakdown.keywords >= 0 &&
    breakdown.keywords <= CRITERIA_WEIGHTS.keywords
  );
}

/**
 * Generate visual progress bar for a score
 */
export function generateProgressBar(score: number, maxScore: number, width: number = 15): string {
  const filled = Math.round((score / maxScore) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format breakdown for display with progress bars
 */
export function formatBreakdownDisplay(breakdown: CompetitorScoreBreakdown): string[] {
  const lines: string[] = [];

  const criteria: Array<{ label: string; score: number; max: number }> = [
    { label: 'Industry', score: breakdown.industry, max: CRITERIA_WEIGHTS.industry },
    { label: 'Business Model', score: breakdown.businessModel, max: CRITERIA_WEIGHTS.businessModel },
    { label: 'Product Offering', score: breakdown.productOffering, max: CRITERIA_WEIGHTS.productOffering },
    { label: 'Target Audience', score: breakdown.targetAudience, max: CRITERIA_WEIGHTS.targetAudience },
    { label: 'Geography', score: breakdown.geography, max: CRITERIA_WEIGHTS.geography },
    { label: 'Market Size', score: breakdown.marketSize, max: CRITERIA_WEIGHTS.marketSize },
    { label: 'Price Range', score: breakdown.priceRange, max: CRITERIA_WEIGHTS.priceRange },
    { label: 'Digital Presence', score: breakdown.digitalPresence, max: CRITERIA_WEIGHTS.digitalPresence },
    { label: 'Brand Maturity', score: breakdown.brandMaturity, max: CRITERIA_WEIGHTS.brandMaturity },
    { label: 'Keywords', score: breakdown.keywords, max: CRITERIA_WEIGHTS.keywords },
  ];

  for (const criterion of criteria) {
    const bar = generateProgressBar(criterion.score, criterion.max);
    const scoreStr = `${criterion.score}/${criterion.max}`.padEnd(6);
    const label = criterion.label.padEnd(18);
    lines.push(`   ${label} ${scoreStr} ${bar}`);
  }

  return lines;
}

/**
 * Get score tier label
 */
export function getScoreTier(score: number): string {
  if (score >= 90) return 'Excellent Match';
  if (score >= 80) return 'Strong Match';
  if (score >= 70) return 'Good Match';
  if (score >= 60) return 'Moderate Match';
  if (score >= 50) return 'Weak Match';
  return 'Poor Match';
}
