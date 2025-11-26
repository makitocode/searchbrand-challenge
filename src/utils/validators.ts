/**
 * Input validation utilities
 */

/**
 * Detects if input looks like a URL/domain (with or without protocol)
 * Handles: bendita.cl, www.bendita.cl, https://bendita.cl, https://www.bendita.cl
 */
export function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim().toLowerCase();

  // Common domain patterns without protocol
  // Must have at least one dot and a valid TLD-like ending
  const domainPattern = /^(www\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

  // Check if it has a protocol
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  // Check if it looks like a domain (e.g., bendita.cl, www.nike.com)
  return domainPattern.test(trimmed);
}

/**
 * Normalizes a URL input to a full URL with protocol
 * bendita.cl → https://bendita.cl
 * www.bendita.cl → https://www.bendita.cl
 * https://bendita.cl → https://bendita.cl
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

/**
 * Extracts domain info from URL input
 * Returns: { domain: 'bendita.cl', brandHint: 'bendita', tld: 'cl' }
 */
export function extractDomainInfo(input: string): { domain: string; brandHint: string; tld: string } | null {
  try {
    const normalized = normalizeUrl(input);
    const url = new URL(normalized);
    const hostname = url.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');

    if (parts.length < 2) return null;

    const tld = parts.at(-1) as string;
    const brandHint = parts[0]; // First part is usually the brand name

    return {
      domain: hostname,
      brandHint,
      tld,
    };
  } catch {
    return null;
  }
}

/**
 * Validates if a string is a valid URL (strict - requires protocol)
 * @deprecated Use looksLikeUrl for more flexible detection
 */
export function isValidUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid brand name (not empty, reasonable length)
 */
export function isValidBrandName(input: string): boolean {
  return input.trim().length > 0 && input.trim().length <= 100;
}

/**
 * Sanitizes user input by trimming whitespace
 */
export function sanitizeInput(input: string): string {
  return input.trim();
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
