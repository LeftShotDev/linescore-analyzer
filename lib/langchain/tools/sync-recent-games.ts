// Tool: Sync Recent Games
// Automatically fetch and store games from recent days that aren't in the database

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';
import { nhlApi } from '@/lib/nhl-api/client';
import { transformGameLanding } from '@/lib/nhl-api/transformers';
import { gameQueries, periodResultQueries, teamQueries } from '@/lib/supabase/queries';
import type { NewNHLLandingResponse } from '@/lib/nhl-api/types';

export const syncRecentGamesTool = new DynamicStructuredTool({
  name: 'sync_recent_games',
  description: `Automatically sync recent NHL games to the database.
    Use this tool to:
    - Keep the database up to date with recent games
    - Fill in any gaps in game data
    - Sync games from the last N days (default: 7)

    This tool automatically:
    - Finds games that are missing from the database
    - Fetches game data from the NHL API
    - Stores games and period results

    Much simpler than manually specifying date ranges!`,
  schema: z.object({
    days: z.number().min(1).max(30).default(7).describe('Number of days to look back (default: 7, max: 30)'),
    season: z.string().optional().describe('Season to sync (e.g., "2024-2025"). Defaults to current season.'),
  }),
  func: async ({ days = 7, season }) => {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`[sync_recent_games] Syncing games from ${startDateStr} to ${endDateStr}`);

      // Fetch schedule from NHL API
      const scheduleResponse = await nhlApi.getSchedule(startDateStr, endDateStr);

      // Get all game IDs from the schedule
      const scheduledGames: Array<{ gameId: string; gameDate: string }> = [];
      for (const date of scheduleResponse.dates) {
        for (const game of date.games) {
          // Filter by season if specified
          if (season) {
            const gameSeason = game.season.length === 8
              ? `${game.season.slice(0, 4)}-${game.season.slice(4)}`
              : game.season;
            if (gameSeason !== season) continue;
          }
          scheduledGames.push({
            gameId: game.gamePk.toString(),
            gameDate: date.date,
          });
        }
      }

      if (scheduledGames.length === 0) {
        return JSON.stringify({
          success: true,
          message: 'No games found in the specified date range.',
          results: { games_found: 0, games_added: 0, games_skipped: 0, games_failed: 0 },
        });
      }

      // Check which games are already in the database
      const gameIds = scheduledGames.map(g => g.gameId);
      const { data: existingGames } = await supabase
        .from('games')
        .select('game_id')
        .in('game_id', gameIds);

      const existingGameIds = new Set(existingGames?.map(g => g.game_id) || []);
      const missingGames = scheduledGames.filter(g => !existingGameIds.has(g.gameId));

      console.log(`[sync_recent_games] Found ${scheduledGames.length} games, ${missingGames.length} missing from database`);

      const results = {
        games_found: scheduledGames.length,
        games_already_synced: existingGameIds.size,
        games_added: 0,
        games_skipped: 0,
        games_failed: 0,
        failures: [] as Array<{ game_id: string; error: string }>,
      };

      // Process missing games
      for (const game of missingGames) {
        try {
          // Fetch game landing data
          const landingData: NewNHLLandingResponse = await nhlApi.getGameLanding(game.gameId);

          // Skip non-final games
          if (landingData.gameState !== 'OFF') {
            results.games_skipped++;
            continue;
          }

          // Transform data
          const { game: gameData, periodResults } = transformGameLanding(landingData);

          // Validate teams exist
          const homeExists = await teamQueries.exists(gameData.home_team_code);
          const awayExists = await teamQueries.exists(gameData.away_team_code);

          if (!homeExists || !awayExists) {
            results.games_failed++;
            results.failures.push({
              game_id: game.gameId,
              error: `Team not found: ${!homeExists ? gameData.home_team_code : gameData.away_team_code}`,
            });
            continue;
          }

          // Insert game and period results
          await gameQueries.insert(gameData);
          if (periodResults.length > 0) {
            await periodResultQueries.insertMany(periodResults);
          }

          results.games_added++;
          console.log(`[sync_recent_games] Added game ${game.gameId}`);
        } catch (error) {
          results.games_failed++;
          results.failures.push({
            game_id: game.gameId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return JSON.stringify({
        success: true,
        message: `Synced games from ${startDateStr} to ${endDateStr}`,
        date_range: { start: startDateStr, end: endDateStr },
        results,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
