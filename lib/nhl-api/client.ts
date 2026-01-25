// NHL API Client with retry logic and rate limiting
// Constitution Principle I: Data Accuracy & Integrity - NHL API is exclusive data source

import type {
  NHLScheduleResponse,
  NHLGameFeed,
  NewNHLScheduleResponse,
  NewNHLPlayByPlayResponse,
  NewNHLLandingResponse
} from './types';

const NHL_API_BASE_URL = process.env.NHL_API_BASE_URL || 'https://api-web.nhle.com';

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
 * Helper function to generate array of dates between start and end
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * NHL API Client
 */
export const nhlApi = {
  /**
   * Get schedule for a date range
   * Note: New API only supports single-date queries, so we iterate through the range
   * @param startDate YYYY-MM-DD format
   * @param endDate YYYY-MM-DD format
   */
  async getSchedule(startDate: string, endDate: string): Promise<NHLScheduleResponse> {
    const dates = getDateRange(startDate, endDate);
    const allGames: any[] = [];

    // Fetch schedule for each date
    for (const date of dates) {
      try {
        const url = `${NHL_API_BASE_URL}/v1/schedule/${date}`;
        const response = await fetchWithRetry<NewNHLScheduleResponse>(url);

        // Extract games from the response
        if (response.gameWeek && response.gameWeek.length > 0) {
          for (const week of response.gameWeek) {
            if (week.games && week.games.length > 0) {
              allGames.push(...week.games);
            }
          }
        }
      } catch (error) {
        // If a date has no games, the API may return 404 - continue to next date
        if (error instanceof Error && error.message.includes('not found')) {
          continue;
        }
        throw error;
      }
    }

    // Transform to legacy format for backward compatibility
    const scheduleDates = dates.map(date => ({
      date,
      totalItems: 0,
      totalEvents: 0,
      totalGames: 0,
      totalMatches: 0,
      games: allGames
        .filter(g => g.gameDate === date)
        .map(game => ({
          gamePk: game.id,
          gameType: game.gameType === 2 ? 'R' : game.gameType === 3 ? 'P' : 'PR',
          season: game.season.toString(),
          gameDate: `${game.startTimeUTC}`,
          status: {
            abstractGameState: game.gameState === 'OFF' ? 'Final' :
                              game.gameState === 'LIVE' ? 'Live' : 'Preview',
            codedGameState: game.gameState,
            detailedState: game.gameScheduleState,
            statusCode: game.gameState === 'OFF' ? '7' : '1',
          },
          teams: {
            away: {
              team: {
                id: game.awayTeam.id,
                name: `${game.awayTeam.placeName.default} ${game.awayTeam.commonName.default}`,
                abbreviation: game.awayTeam.abbrev,
                teamName: game.awayTeam.commonName.default,
                locationName: game.awayTeam.placeName.default,
                division: { id: 0, name: '' },
                conference: { id: 0, name: '' },
              },
              score: game.awayTeam.score,
            },
            home: {
              team: {
                id: game.homeTeam.id,
                name: `${game.homeTeam.placeName.default} ${game.homeTeam.commonName.default}`,
                abbreviation: game.homeTeam.abbrev,
                teamName: game.homeTeam.commonName.default,
                locationName: game.homeTeam.placeName.default,
                division: { id: 0, name: '' },
                conference: { id: 0, name: '' },
              },
              score: game.homeTeam.score,
            },
          },
          venue: {
            name: game.venue.default,
          },
          content: {
            link: '',
          },
        })),
    }));

    return {
      copyright: '',
      totalItems: allGames.length,
      totalEvents: allGames.length,
      totalGames: allGames.length,
      totalMatches: allGames.length,
      dates: scheduleDates,
    };
  },

  /**
   * Get game landing data with summary scoring
   * This is the preferred endpoint for parsing period-by-period game data
   * @param gameId NHL game ID (e.g., "2024020003")
   */
  async getGameLanding(gameId: string): Promise<NewNHLLandingResponse> {
    const url = `${NHL_API_BASE_URL}/v1/gamecenter/${gameId}/landing`;
    return fetchWithRetry<NewNHLLandingResponse>(url);
  },

  /**
   * Get detailed game feed with play-by-play data
   * @param gameId NHL game ID (e.g., "2024020705")
   */
  async getGameFeed(gameId: string): Promise<NHLGameFeed> {
    const url = `${NHL_API_BASE_URL}/v1/gamecenter/${gameId}/play-by-play`;
    const response = await fetchWithRetry<NewNHLPlayByPlayResponse>(url);

    // Transform new API response to legacy format for backward compatibility
    // This allows existing transformers to continue working
    return {
      gamePk: response.id,
      gameData: {
        gamePk: response.id,
        gameDate: response.startTimeUTC,
        season: response.season.toString(),
        gameType: response.gameType === 2 ? 'R' : response.gameType === 3 ? 'P' : 'PR',
        status: {
          abstractGameState: response.gameState === 'OFF' ? 'Final' :
                            response.gameState === 'LIVE' ? 'Live' : 'Preview',
          codedGameState: response.gameState,
          detailedState: response.gameScheduleState,
          statusCode: response.gameState === 'OFF' ? '7' : '1',
          startTimeTBD: false,
        },
        teams: {
          away: {
            team: {
              id: response.awayTeam.id,
              name: `${response.awayTeam.placeName.default} ${response.awayTeam.commonName.default}`,
              abbreviation: response.awayTeam.abbrev,
              teamName: response.awayTeam.commonName.default,
              locationName: response.awayTeam.placeName.default,
              division: { id: 0, name: '' },
              conference: { id: 0, name: '' },
            },
            score: response.awayTeam.score,
          },
          home: {
            team: {
              id: response.homeTeam.id,
              name: `${response.homeTeam.placeName.default} ${response.homeTeam.commonName.default}`,
              abbreviation: response.homeTeam.abbrev,
              teamName: response.homeTeam.commonName.default,
              locationName: response.homeTeam.placeName.default,
              division: { id: 0, name: '' },
              conference: { id: 0, name: '' },
            },
            score: response.homeTeam.score,
          },
        },
        venue: {
          name: response.venue.default,
          link: '',
        },
      },
      liveData: {
        plays: {
          allPlays: response.plays.map(play => ({
            result: {
              event: play.typeDescKey,
              eventCode: play.typeCode.toString(),
              eventTypeId: play.typeDescKey.toUpperCase(),
              description: '',
              secondaryType: play.details?.shotType,
              strength: undefined,
              gameWinningGoal: false,
              emptyNet: false, // Will be calculated from situation
            },
            about: {
              eventIdx: play.eventId,
              eventId: play.eventId,
              period: play.periodDescriptor.number,
              periodType: play.periodDescriptor.periodType,
              ordinalNum: play.periodDescriptor.number <= 3 ?
                         `${play.periodDescriptor.number}${play.periodDescriptor.number === 1 ? 'st' : play.periodDescriptor.number === 2 ? 'nd' : 'rd'}` :
                         play.periodDescriptor.periodType,
              periodTime: play.timeInPeriod,
              periodTimeRemaining: play.timeRemaining,
              dateTime: response.startTimeUTC,
              goals: {
                away: play.details?.awayScore || 0,
                home: play.details?.homeScore || 0,
              },
            },
            coordinates: undefined,
            team: play.details?.eventOwnerTeamId ? {
              id: play.details.eventOwnerTeamId,
              name: play.details.eventOwnerTeamId === response.homeTeam.id ?
                    `${response.homeTeam.placeName.default} ${response.homeTeam.commonName.default}` :
                    `${response.awayTeam.placeName.default} ${response.awayTeam.commonName.default}`,
              triCode: play.details.eventOwnerTeamId === response.homeTeam.id ?
                      response.homeTeam.abbrev : response.awayTeam.abbrev,
            } : undefined,
          })),
          scoringPlays: response.plays
            .filter(p => p.typeCode === 505)
            .map(p => p.eventId),
          penaltyPlays: response.plays
            .filter(p => p.typeCode === 509) // Penalty type code
            .map(p => p.eventId),
          playsByPeriod: [],
          currentPlay: {} as any,
        },
        linescore: {
          currentPeriod: response.periodDescriptor.number,
          currentPeriodOrdinal: response.periodDescriptor.periodType,
          currentPeriodTimeRemaining: 'Final',
          periods: [], // Will be calculated from plays
          shootoutInfo: undefined,
          teams: {
            home: {
              team: {
                id: response.homeTeam.id,
                name: `${response.homeTeam.placeName.default} ${response.homeTeam.commonName.default}`,
                abbreviation: response.homeTeam.abbrev,
                teamName: response.homeTeam.commonName.default,
                locationName: response.homeTeam.placeName.default,
                division: { id: 0, name: '' },
                conference: { id: 0, name: '' },
              },
              goals: response.homeTeam.score,
              shotsOnGoal: 0,
              goaliePulled: false,
              numSkaters: 5,
            },
            away: {
              team: {
                id: response.awayTeam.id,
                name: `${response.awayTeam.placeName.default} ${response.awayTeam.commonName.default}`,
                abbreviation: response.awayTeam.abbrev,
                teamName: response.awayTeam.commonName.default,
                locationName: response.awayTeam.placeName.default,
                division: { id: 0, name: '' },
                conference: { id: 0, name: '' },
              },
              goals: response.awayTeam.score,
              shotsOnGoal: 0,
              goaliePulled: false,
              numSkaters: 5,
            },
          },
          powerPlayStrength: 'Even',
          hasShootout: response.periodDescriptor.periodType === 'SO',
          intermissionInfo: undefined,
        },
        boxscore: {},
        decisions: {},
      },
    };
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
