/**
 * Input validation utilities
 */

/**
 * Validates if a string is a valid URL
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
