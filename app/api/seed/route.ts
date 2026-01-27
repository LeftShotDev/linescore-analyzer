import { NextRequest, NextResponse } from 'next/server';
import { nhlApi } from '@/lib/nhl-api/client';
import { transformGameLanding, validateGameData } from '@/lib/nhl-api/transformers';
import { gameQueries, periodResultQueries, teamQueries } from '@/lib/supabase/queries';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { NewNHLLandingResponse } from '@/lib/nhl-api/types';

// Allow up to 5 minutes for large seed operations
export const maxDuration = 300;

interface SeedResult {
  games_processed: number;
  games_inserted: number;
  games_skipped: number;
  games_failed: number;
  failures: Array<{ game_id: string; error: string }>;
}

/**
 * POST /api/seed
 * Bulk import NHL games for seeding the database
 *
 * Body parameters:
 * - startDate: string (YYYY-MM-DD) - Start of date range
 * - endDate: string (YYYY-MM-DD) - End of date range
 * - batchSize: number (optional, default 10) - Games to process concurrently
 */
export async function POST(req: NextRequest) {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { startDate, endDate, batchSize = 10 } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (end < start) {
      return NextResponse.json(
        { error: 'endDate must be after startDate' },
        { status: 400 }
      );
    }

    const results: SeedResult = {
      games_processed: 0,
      games_inserted: 0,
      games_skipped: 0,
      games_failed: 0,
      failures: [],
    };

    // Fetch schedule for the date range
    console.log(`[Seed] Fetching schedule from ${startDate} to ${endDate}`);
    let scheduleResponse;
    try {
      scheduleResponse = await nhlApi.getSchedule(startDate, endDate);
      console.log(`[Seed] Schedule fetch successful, found ${scheduleResponse.totalGames} total games`);
    } catch (scheduleError) {
      console.error(`[Seed] Schedule fetch failed:`, scheduleError);
      return NextResponse.json({
        error: 'Failed to fetch schedule',
        message: scheduleError instanceof Error ? scheduleError.message : 'Unknown error',
        stage: 'schedule_fetch'
      }, { status: 500 });
    }

    const gameIds: string[] = [];
    for (const date of scheduleResponse.dates) {
      for (const game of date.games) {
        gameIds.push(game.gamePk.toString());
      }
    }

    console.log(`[Seed] Found ${gameIds.length} games to process`);

    if (gameIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No games found in the specified date range',
        results,
      });
    }

    // Process games in batches
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      console.log(`[Seed] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gameIds.length / batchSize)}`);

      const batchResults = await Promise.all(
        batch.map(gameId => fetchAndStoreGame(gameId))
      );

      for (let j = 0; j < batchResults.length; j++) {
        results.games_processed++;
        const result = batchResults[j];

        if (result.success) {
          if (result.skipped) {
            results.games_skipped++;
          } else {
            results.games_inserted++;
          }
        } else {
          results.games_failed++;
          results.failures.push({
            game_id: batch[j],
            error: result.error || 'Unknown error',
          });
        }
      }
    }

    console.log(`[Seed] Complete: ${results.games_inserted} inserted, ${results.games_skipped} skipped, ${results.games_failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.games_processed} games`,
      results,
    });
  } catch (error) {
    console.error('[Seed] Error:', error);
    return NextResponse.json(
      {
        error: 'Seed operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seed
 * Returns info about seeding and suggested date ranges
 */
export async function GET() {
  const season2024Start = '2024-10-04';
  const today = new Date().toISOString().split('T')[0];

  return NextResponse.json({
    info: 'POST to this endpoint to seed NHL game data',
    usage: {
      method: 'POST',
      body: {
        startDate: 'YYYY-MM-DD (required)',
        endDate: 'YYYY-MM-DD (required)',
        batchSize: 'number (optional, default 10)',
      },
    },
    suggestions: {
      full_2024_season: {
        startDate: season2024Start,
        endDate: today,
        description: 'Import all 2024-2025 season games to date',
      },
      october_2024: {
        startDate: '2024-10-04',
        endDate: '2024-10-31',
        description: 'Import October 2024 games (~150 games)',
      },
      november_2024: {
        startDate: '2024-11-01',
        endDate: '2024-11-30',
        description: 'Import November 2024 games (~200 games)',
      },
      recent_week: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: today,
        description: 'Import last 7 days of games',
      },
    },
    example_curl: `curl -X POST http://localhost:3000/api/seed -H "Content-Type: application/json" -d '{"startDate":"2024-10-04","endDate":"2024-10-31"}'`,
  });
}

/**
 * Helper function to fetch and store a single game
 */
async function fetchAndStoreGame(
  gameId: string
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    // Check if game already exists
    const exists = await gameQueries.exists(gameId);
    if (exists) {
      return { success: true, skipped: true };
    }

    console.log(`[Seed] Fetching game ${gameId}...`);
    // Fetch game from NHL API
    const landingData: NewNHLLandingResponse = await nhlApi.getGameLanding(gameId);
    console.log(`[Seed] Game ${gameId} fetched, state: ${landingData.gameState}`);

    // Check if game is final
    if (landingData.gameState !== 'OFF') {
      return { success: true, skipped: true }; // Skip non-final games
    }

    // Transform data
    const { game, periodResults } = transformGameLanding(landingData);

    // Validate team codes exist
    const homeExists = await teamQueries.exists(game.home_team_code);
    const awayExists = await teamQueries.exists(game.away_team_code);

    if (!homeExists || !awayExists) {
      return {
        success: false,
        error: `Team not found: ${!homeExists ? game.home_team_code : game.away_team_code}`,
      };
    }

    // Validate game data
    const validation = validateGameData(game, periodResults);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join('; ')}`,
      };
    }

    // Insert game
    await gameQueries.insert(game);

    // Insert period results
    await periodResultQueries.insertMany(periodResults);

    return { success: true, skipped: false };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
