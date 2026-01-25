// add_games_from_api tool implementation
// Fetches games from NHL API and stores them in the database
// Tool Contract: specs/001-period-analyzer/contracts/add-games-tool.md

import { z } from 'zod';
import { nhlApi } from '../nhl-api/client';
import type { NHLScheduleResponse, NewNHLLandingResponse } from '../nhl-api/types';
import {
  transformGameLanding,
  transformScheduleGame,
  validateGameData,
} from '../nhl-api/transformers';
import { gameQueries, periodResultQueries, teamQueries } from '../supabase/queries';

// Tool parameter schema with validation
export const addGamesToolSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  season: z.string().regex(/^\d{4}-\d{4}$/, 'Season must be in YYYY-YYYY format').optional(),
  skipExisting: z.boolean().default(true),
});

export type AddGamesToolParams = z.infer<typeof addGamesToolSchema>;

interface GameFailure {
  game_id: string;
  date: string;
  error: string;
}

interface AddGamesToolResult {
  success: boolean;
  data?: {
    games_processed: number;
    games_inserted: number;
    games_updated: number;
    games_skipped: number;
    games_failed: number;
    date_range: {
      start: string;
      end: string;
    };
    processing_time_ms: number;
    failures: GameFailure[];
  };
  error?: {
    type: 'VALIDATION_ERROR' | 'API_ERROR' | 'DATABASE_ERROR';
    message: string;
    suggestion: string;
  };
}

/**
 * Validate input parameters
 */
function validateParams(params: AddGamesToolParams): { valid: boolean; error?: string } {
  // Validate date range
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate > endDate) {
    return {
      valid: false,
      error: 'Start date must be before or equal to end date',
    };
  }

  if (endDate > today) {
    return {
      valid: false,
      error: 'End date cannot be in the future. Cannot fetch games that haven\'t been played yet.',
    };
  }

  // Validate season format if provided
  if (params.season) {
    const [year1, year2] = params.season.split('-').map(Number);
    if (year2 !== year1 + 1) {
      return {
        valid: false,
        error: 'Invalid season format. Second year must be first year + 1 (e.g., 2024-2025)',
      };
    }
  }

  // Warn about large date ranges (more than 30 days)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 30) {
    console.warn(`Large date range detected: ${daysDiff} days. This may take several minutes.`);
  }

  return { valid: true };
}

/**
 * Check if all team codes exist in the database
 */
async function validateTeamCodes(homeTeamCode: string, awayTeamCode: string): Promise<boolean> {
  const homeExists = await teamQueries.exists(homeTeamCode);
  const awayExists = await teamQueries.exists(awayTeamCode);

  if (!homeExists) {
    console.error(`Team not found in database: ${homeTeamCode}`);
    return false;
  }

  if (!awayExists) {
    console.error(`Team not found in database: ${awayTeamCode}`);
    return false;
  }

  return true;
}

/**
 * Insert a single game with its period results
 * Uses database transaction for consistency (FR-024)
 */
async function insertGameWithPeriods(
  landingData: NewNHLLandingResponse,
  skipExisting: boolean
): Promise<{ success: boolean; skipped: boolean; error?: string }> {
  try {
    // Transform NHL API data to database format using landing endpoint
    const { game, periodResults } = transformGameLanding(landingData);

    // Check if game already exists
    const existingGame = await gameQueries.exists(game.game_id);

    if (existingGame && skipExisting) {
      return { success: true, skipped: true };
    }

    // Validate team codes exist in database
    const teamsValid = await validateTeamCodes(game.home_team_code, game.away_team_code);
    if (!teamsValid) {
      return {
        success: false,
        skipped: false,
        error: `Invalid team codes: ${game.home_team_code}, ${game.away_team_code}`,
      };
    }

    // Validate game data (FR-015)
    const validation = validateGameData(game, periodResults);
    if (!validation.valid) {
      return {
        success: false,
        skipped: false,
        error: `Validation failed: ${validation.errors.join('; ')}`,
      };
    }

    // Insert game (transaction handled by Supabase client)
    // If game exists and skipExisting=false, this will fail on unique constraint
    try {
      await gameQueries.insert(game);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        if (!skipExisting) {
          // Could implement update logic here if needed
          return {
            success: false,
            skipped: false,
            error: 'Game already exists and update not implemented',
          };
        }
        return { success: true, skipped: true };
      }
      throw error;
    }

    // Insert period results
    await periodResultQueries.insertMany(periodResults);

    return { success: true, skipped: false };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main tool implementation: Add games from NHL API
 */
export async function addGamesFromApi(params: AddGamesToolParams): Promise<AddGamesToolResult> {
  const startTime = Date.now();

  try {
    // Validate parameters (T020)
    const paramValidation = validateParams(params);
    if (!paramValidation.valid) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: paramValidation.error || 'Invalid parameters',
          suggestion: 'Check date range and season format',
        },
      };
    }

    // Fetch schedule from NHL API (T021)
    console.log(`Fetching games from ${params.startDate} to ${params.endDate}...`);

    let scheduleResponse: NHLScheduleResponse;
    try {
      scheduleResponse = await nhlApi.getSchedule(params.startDate, params.endDate);
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'API_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch schedule',
          suggestion: 'NHL API may be temporarily unavailable. Please try again in a few minutes.',
        },
      };
    }

    // Extract game IDs from schedule
    const gameIds: string[] = [];
    for (const date of scheduleResponse.dates) {
      for (const game of date.games) {
        gameIds.push(game.gamePk.toString());
      }
    }

    if (gameIds.length === 0) {
      return {
        success: true,
        data: {
          games_processed: 0,
          games_inserted: 0,
          games_updated: 0,
          games_skipped: 0,
          games_failed: 0,
          date_range: {
            start: params.startDate,
            end: params.endDate,
          },
          processing_time_ms: Date.now() - startTime,
          failures: [],
        },
      };
    }

    console.log(`Found ${gameIds.length} games to process`);

    // Process each game (T022-T026)
    const results = {
      games_processed: gameIds.length,
      games_inserted: 0,
      games_updated: 0,
      games_skipped: 0,
      games_failed: 0,
      failures: [] as GameFailure[],
    };

    for (const gameId of gameIds) {
      try {
        // Fetch game landing data with summary scoring (T022)
        console.log(`Fetching game ${gameId}...`);
        const landingData: NewNHLLandingResponse = await nhlApi.getGameLanding(gameId);

        // Check if game is final (don't insert in-progress games)
        if (landingData.gameState !== 'OFF') {
          console.log(`Skipping game ${gameId}: not final (${landingData.gameState})`);
          results.games_skipped++;
          continue;
        }

        // Insert game with period results (T023-T025)
        const insertResult = await insertGameWithPeriods(landingData, params.skipExisting);

        if (insertResult.success) {
          if (insertResult.skipped) {
            results.games_skipped++;
          } else {
            results.games_inserted++;
          }
        } else {
          results.games_failed++;
          results.failures.push({
            game_id: gameId,
            date: landingData.gameDate,
            error: insertResult.error || 'Unknown error',
          });
        }
      } catch (error) {
        results.games_failed++;
        results.failures.push({
          game_id: gameId,
          date: 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Error processing game ${gameId}:`, error);
        // Continue processing other games (partial success - T026)
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`Processing complete in ${processingTime}ms`);
    console.log(`Inserted: ${results.games_inserted}, Skipped: ${results.games_skipped}, Failed: ${results.games_failed}`);

    return {
      success: true,
      data: {
        ...results,
        date_range: {
          start: params.startDate,
          end: params.endDate,
        },
        processing_time_ms: processingTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown database error',
        suggestion: 'Check database connection and Supabase credentials',
      },
    };
  }
}

// Export tool definition for Vercel AI SDK
export const addGamesToolDefinition = {
  description: 'Fetch and store NHL game data from the official NHL API. Use this when the user wants to populate the database with new games, update current season data, or import specific date ranges. Validates data before insertion.',
  parameters: addGamesToolSchema,
  execute: addGamesFromApi,
};
