// NHL API Client with retry logic and rate limiting
// Constitution Principle I: Data Accuracy & Integrity - NHL API is exclusive data source

const NHL_API_BASE_URL = process.env.NHL_API_BASE_URL || 'https://statsapi.web.nhl.com/api/v1';

// Rate limiting configuration (FR-016: 2 requests per second)
const RATE_LIMIT_MS = 500; // 500ms between requests = 2 req/sec
let lastRequestTime = 0;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  retries?: number;
}

/**
 * Sleep utility for rate limiting and retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enforce rate limiting before making requests
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest);
  }

  lastRequestTime = Date.now();
}

/**
 * Fetch with exponential backoff retry logic
 */
async function fetchWithRetry<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { retries = MAX_RETRIES, ...fetchOptions } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Enforce rate limiting
      await enforceRateLimit();

      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      // Handle specific HTTP status codes
      if (response.status === 404) {
        throw new Error(`Resource not found: ${url}`);
      }

      if (response.status === 429) {
        // Rate limited - use exponential backoff
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.warn(`Rate limited (429). Retrying in ${retryDelay}ms...`);
        await sleep(retryDelay);
        continue;
      }

      if (response.status >= 500) {
        // Server error - retry after delay
        if (attempt < retries) {
          const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`Server error (${response.status}). Retrying in ${retryDelay}ms...`);
          await sleep(retryDelay);
          continue;
        }
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;

    } catch (error) {
      lastError = error as Error;

      // Don't retry on 404 or JSON parse errors
      if (error instanceof Error &&
          (error.message.includes('not found') || error.message.includes('JSON'))) {
        throw error;
      }

      // Last attempt failed
      if (attempt === retries) {
        throw lastError;
      }

      // Exponential backoff for next retry
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      console.warn(`Request failed (attempt ${attempt + 1}/${retries + 1}). Retrying in ${retryDelay}ms...`);
      await sleep(retryDelay);
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

/**
 * NHL API Client
 */
export const nhlApi = {
  /**
   * Get schedule for a date range
   * @param startDate YYYY-MM-DD format
   * @param endDate YYYY-MM-DD format
   */
  async getSchedule(startDate: string, endDate: string) {
    const url = `${NHL_API_BASE_URL}/schedule?startDate=${startDate}&endDate=${endDate}`;
    return fetchWithRetry(url);
  },

  /**
   * Get detailed game feed with linescore and play-by-play
   * @param gameId NHL game ID (e.g., "2025020767")
   */
  async getGameFeed(gameId: string) {
    const url = `${NHL_API_BASE_URL}/game/${gameId}/feed/live`;
    return fetchWithRetry(url);
  },

  /**
   * Get all NHL teams
   */
  async getTeams() {
    const url = `${NHL_API_BASE_URL}/teams`;
    return fetchWithRetry(url);
  },

  /**
   * Get current standings
   */
  async getStandings() {
    const url = `${NHL_API_BASE_URL}/standings`;
    return fetchWithRetry(url);
  },

  /**
   * Get standings for a specific date
   * @param date YYYY-MM-DD format
   */
  async getStandingsByDate(date: string) {
    const url = `${NHL_API_BASE_URL}/standings?date=${date}`;
    return fetchWithRetry(url);
  },
};
