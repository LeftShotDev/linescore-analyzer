// Tool 2: Fetch NHL Games from External API
// Integrates with the NHL Web API (api-web.nhle.com) to fetch and store game data

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { nhlApi } from '@/lib/nhl-api/client';
import { transformGameLanding, validateGameData } from '@/lib/nhl-api/transformers';
import { gameQueries, periodResultQueries, teamQueries } from '@/lib/supabase/queries';
import type { NewNHLLandingResponse } from '@/lib/nhl-api/types';

export const fetchNhlGamesTool = new DynamicStructuredTool({
  name: 'fetch_nhl_games',
  description: `Fetch NHL game data from the official NHL API and store it in the database.
    Use this tool to:
    - Import games for specific dates or date ranges
    - Import individual games by game ID
    - Update the database with new game data

    Game ID format: YYYYTTGGGG where:
    - YYYY = season start year (e.g., 2024)
    - TT = game type (02 = regular season, 03 = playoffs)
    - GGGG = game number (0001-1312 for regular season)

    Example: 2024020003 = 3rd regular season game of 2024-2025 season

    IMPORTANT: For very large date ranges (>30 days), use request_human_approval first.`,
  schema: z.object({
    gameId: z.string().optional().describe('Specific NHL game ID to fetch (e.g., 2024020003)'),
    startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
    endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
    skipExisting: z.boolean().default(true).describe('Skip games already in the database'),
  }),
  func: async ({ gameId, startDate, endDate, skipExisting }) => {
    try {
      const results = {
        games_processed: 0,
        games_inserted: 0,
        games_skipped: 0,
        games_failed: 0,
        failures: [] as Array<{ game_id: string; error: string }>,
      };

      // If a specific game ID is provided, fetch just that game
      if (gameId) {
        const result = await fetchAndStoreGame(gameId, skipExisting);
        if (result.success) {
          if (result.skipped) {
            results.games_skipped = 1;
          } else {
            results.games_inserted = 1;
          }
        } else {
          results.games_failed = 1;
          results.failures.push({ game_id: gameId, error: result.error || 'Unknown error' });
        }
        results.games_processed = 1;

        return JSON.stringify({
          success: true,
          message: `Processed game ${gameId}`,
          results,
        });
      }

      // If date range is provided, fetch games from schedule
      if (startDate && endDate) {
        // Validate date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > 30) {
          return JSON.stringify({
            success: false,
            error: `Date range too large (${daysDiff} days). Maximum allowed is 30 days.`,
            suggestion: 'For larger imports, use request_human_approval tool first, then import in smaller batches.',
            days_requested: daysDiff,
          });
        }

        // Fetch schedule
        const scheduleResponse = await nhlApi.getSchedule(startDate, endDate);
        const gameIds: string[] = [];

        for (const date of scheduleResponse.dates) {
          for (const game of date.games) {
            gameIds.push(game.gamePk.toString());
          }
        }

        if (gameIds.length === 0) {
          return JSON.stringify({
            success: true,
            message: 'No games found in the specified date range.',
            results,
          });
        }

        // Process each game
        for (const id of gameIds) {
          results.games_processed++;
          const result = await fetchAndStoreGame(id, skipExisting);

          if (result.success) {
            if (result.skipped) {
              results.games_skipped++;
            } else {
              results.games_inserted++;
            }
          } else {
            results.games_failed++;
            results.failures.push({ game_id: id, error: result.error || 'Unknown error' });
          }
        }

        return JSON.stringify({
          success: true,
          message: `Processed ${results.games_processed} games from ${startDate} to ${endDate}`,
          results,
        });
      }

      return JSON.stringify({
        success: false,
        error: 'Either gameId or both startDate and endDate must be provided.',
        suggestion: 'Provide a specific game ID or a date range to fetch games.',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check NHL API availability and try again.',
      });
    }
  },
});

/**
 * Helper function to fetch and store a single game
 */
async function fetchAndStoreGame(
  gameId: string,
  skipExisting: boolean
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    // Check if game already exists
    const exists = await gameQueries.exists(gameId);
    if (exists && skipExisting) {
      console.log(`[fetchAndStoreGame] Game ${gameId} already exists, skipping`);
      return { success: true, skipped: true };
    }

    // Fetch game from NHL API
    console.log(`[fetchAndStoreGame] Fetching game ${gameId} from NHL API`);
    const landingData: NewNHLLandingResponse = await nhlApi.getGameLanding(gameId);

    // Check if game is final
    if (landingData.gameState !== 'OFF') {
      console.log(`[fetchAndStoreGame] Game ${gameId} not final (state: ${landingData.gameState}), skipping`);
      return { success: true, skipped: true }; // Skip non-final games
    }

    // Transform data
    const { game, periodResults } = transformGameLanding(landingData);
    console.log(`[fetchAndStoreGame] Transformed game ${gameId}: ${periodResults.length} period results generated`);

    // Validate team codes exist
    const homeExists = await teamQueries.exists(game.home_team_code);
    const awayExists = await teamQueries.exists(game.away_team_code);

    if (!homeExists || !awayExists) {
      console.error(`[fetchAndStoreGame] Team not found for game ${gameId}: home=${game.home_team_code}(${homeExists}), away=${game.away_team_code}(${awayExists})`);
      return {
        success: false,
        error: `Team not found: ${!homeExists ? game.home_team_code : game.away_team_code}`,
      };
    }

    // Validate game data
    const validation = validateGameData(game, periodResults);
    if (!validation.valid) {
      console.error(`[fetchAndStoreGame] Validation failed for game ${gameId}: ${validation.errors.join('; ')}`);
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join('; ')}`,
      };
    }

    // Insert game
    console.log(`[fetchAndStoreGame] Inserting game ${gameId}`);
    await gameQueries.insert(game);

    // Insert period results
    if (periodResults.length > 0) {
      console.log(`[fetchAndStoreGame] Inserting ${periodResults.length} period results for game ${gameId}`);
      const insertedResults = await periodResultQueries.insertMany(periodResults);
      console.log(`[fetchAndStoreGame] Inserted ${insertedResults.length} period results for game ${gameId}`);
    } else {
      console.warn(`[fetchAndStoreGame] No period results to insert for game ${gameId}`);
    }

    return { success: true, skipped: false };
  } catch (error) {
    console.error(`[fetchAndStoreGame] Error processing game ${gameId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
