/**
 * Backfill Period Results Migration
 *
 * This script populates the period_results table for games that exist in the
 * games table but don't have corresponding period results.
 *
 * Usage: npx tsx scripts/backfill-period-results.ts
 *
 * Options:
 *   --dry-run    Show what would be done without making changes
 *   --limit N    Process only N games (for testing)
 *   --season S   Filter to specific season (e.g., "2024-2025")
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { transformGameLanding } from '../lib/nhl-api/transformers';
import type { NewNHLLandingResponse } from '../lib/nhl-api/types';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;
const seasonIndex = args.indexOf('--season');
const season = seasonIndex !== -1 ? args[seasonIndex + 1] : '2024-2025';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// NHL API configuration
const NHL_API_BASE_URL = 'https://api-web.nhle.com';
const RATE_LIMIT_MS = 500; // 500ms between requests

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGameLanding(gameId: string): Promise<NewNHLLandingResponse | null> {
  try {
    const url = `${NHL_API_BASE_URL}/v1/gamecenter/${gameId}/landing`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`  Game ${gameId} not found in NHL API`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`  Error fetching game ${gameId}:`, error);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Period Results Backfill Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Season: ${season}`);
  console.log(`Force: ${force ? 'YES (will reprocess all games)' : 'NO'}`);
  if (limit) console.log(`Limit: ${limit} games`);
  console.log('');

  // Step 1: Find games to process
  console.log('Step 1: Finding games to process...');

  // Get all games for the season
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('game_id')
    .eq('season', season)
    .order('game_date', { ascending: true });

  if (gamesError) {
    console.error('Error fetching games:', gamesError);
    process.exit(1);
  }

  console.log(`  Found ${games?.length || 0} games in season ${season}`);

  let gamesToProcess: typeof games;

  if (force) {
    // Process all games when force flag is set
    gamesToProcess = (games || []).slice(0, limit);
    console.log(`  Force mode: will process all ${gamesToProcess.length} games`);
  } else {
    // Get game IDs that have complete period results (6+ records per game)
    const { data: existingResults, error: resultsError } = await supabase
      .from('period_results')
      .select('game_id');

    if (resultsError) {
      console.error('Error fetching existing period results:', resultsError);
      process.exit(1);
    }

    // Count period results per game
    const resultCountByGame = new Map<string, number>();
    for (const r of existingResults || []) {
      resultCountByGame.set(r.game_id, (resultCountByGame.get(r.game_id) || 0) + 1);
    }

    // Games with 6+ period results are considered complete
    const completeGames = new Set(
      Array.from(resultCountByGame.entries())
        .filter(([_, count]) => count >= 6)
        .map(([gameId]) => gameId)
    );

    console.log(`  Found ${completeGames.size} games with complete period results`);

    // Find games that need backfilling (incomplete or missing)
    gamesToProcess = (games || [])
      .filter(g => !completeGames.has(g.game_id))
      .slice(0, limit);

    console.log(`  Need to backfill: ${gamesToProcess.length} games`);
  }

  console.log('');

  if (gamesToProcess.length === 0) {
    console.log('No games to process. Exiting.');
    return;
  }

  // Step 2: Process each game
  console.log('Step 2: Processing games...');

  let processed = 0;
  let successful = 0;
  let failed = 0;
  let skipped = 0;

  for (const game of gamesToProcess) {
    processed++;
    const gameId = game.game_id;

    process.stdout.write(`  [${processed}/${gamesToProcess.length}] Game ${gameId}... `);

    // Rate limiting
    await sleep(RATE_LIMIT_MS);

    // Fetch game data from NHL API
    const landingData = await fetchGameLanding(gameId);

    if (!landingData) {
      console.log('SKIPPED (not found)');
      skipped++;
      continue;
    }

    // Check if game is final
    if (landingData.gameState !== 'OFF') {
      console.log(`SKIPPED (state: ${landingData.gameState})`);
      skipped++;
      continue;
    }

    // Transform data
    try {
      const { periodResults } = transformGameLanding(landingData);

      if (periodResults.length === 0) {
        console.log('SKIPPED (no period data)');
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`OK (would upsert ${periodResults.length} period results)`);
        successful++;
        continue;
      }

      // Delete existing period results for this game first (clean slate)
      const { error: deleteError } = await supabase
        .from('period_results')
        .delete()
        .eq('game_id', gameId);

      if (deleteError) {
        console.log(`FAILED (delete): ${deleteError.message}`);
        failed++;
        continue;
      }

      // Insert period results
      const { error: insertError } = await supabase
        .from('period_results')
        .insert(periodResults);

      if (insertError) {
        console.log(`FAILED (insert): ${insertError.message}`);
        failed++;
        continue;
      }

      console.log(`OK (upserted ${periodResults.length} period results)`);
      successful++;
    } catch (error) {
      console.log(`FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`  Total processed: ${processed}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);

  if (dryRun) {
    console.log('');
    console.log('This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
