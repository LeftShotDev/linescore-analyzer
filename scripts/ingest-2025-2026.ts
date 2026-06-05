/**
 * 2025-2026 NHL Season Ingestion Script
 *
 * Fetches all 2025-2026 season games from the NHL API and stores them in Supabase.
 * Processes in batches of 100 games. Safe to re-run — uses upsert logic.
 * Does NOT touch any 2024-2025 season data.
 *
 * Usage:
 *   npx tsx scripts/ingest-2025-2026.ts
 *   npx tsx scripts/ingest-2025-2026.ts --dry-run
 *   npx tsx scripts/ingest-2025-2026.ts --offset 200    # resume from game index 200
 *   npx tsx scripts/ingest-2025-2026.ts --limit 50      # process only 50 games
 *   npx tsx scripts/ingest-2025-2026.ts --force         # reprocess already-ingested games
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { transformGameLanding, validateGameData } from '../lib/nhl-api/transformers';
import type { NewNHLLandingResponse, NewNHLScheduleResponse } from '../lib/nhl-api/types';

const SEASON = '2025-2026';
const SEASON_START = '2025-10-01';
const SEASON_END = new Date().toISOString().split('T')[0]; // today
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 500;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const offsetIdx = args.indexOf('--offset');
const offset = offsetIdx !== -1 ? parseInt(args[offsetIdx + 1], 10) : 0;
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NHL_API = 'https://api-web.nhle.com';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    await sleep(RATE_LIMIT_MS);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  } catch (err) {
    console.error(`  Fetch error for ${url}:`, err);
    return null;
  }
}

async function getAllGameIds(): Promise<string[]> {
  console.log(`Fetching schedule from ${SEASON_START} to ${SEASON_END}...`);

  const gameIds = new Set<string>();
  const dates: string[] = [];

  // Build list of weekly fetch dates across the season
  const current = new Date(SEASON_START);
  const end = new Date(SEASON_END);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }

  for (const date of dates) {
    const data = await fetchJson<NewNHLScheduleResponse>(`${NHL_API}/v1/schedule/${date}`);
    if (!data?.gameWeek) continue;

    for (const day of data.gameWeek) {
      for (const game of day.games ?? []) {
        // Only include 2025-2026 season games (season field = 20252026)
        if (game.season === 20252026) {
          gameIds.add(game.id.toString());
        }
      }
    }
  }

  return Array.from(gameIds).sort();
}

async function gameExists(gameId: string): Promise<boolean> {
  const { data } = await supabase
    .from('games')
    .select('game_id')
    .eq('game_id', gameId)
    .single();
  return !!data;
}

async function processGame(gameId: string): Promise<'inserted' | 'skipped' | 'failed'> {
  const landing = await fetchJson<NewNHLLandingResponse>(
    `${NHL_API}/v1/gamecenter/${gameId}/landing`
  );

  if (!landing) return 'skipped';
  if (landing.gameState !== 'OFF') return 'skipped'; // not final

  const { game, periodResults } = transformGameLanding(landing);

  // Enforce season scope — never write to 2024-2025 data
  if (game.season !== SEASON) {
    console.warn(`  Skipping game ${gameId}: season mismatch (${game.season})`);
    return 'skipped';
  }

  const validation = validateGameData(game, periodResults);
  if (!validation.valid) {
    console.warn(`  Validation failed for ${gameId}: ${validation.errors.join('; ')}`);
    return 'failed';
  }

  // Upsert game
  const { error: gameError } = await supabase
    .from('games')
    .upsert(game, { onConflict: 'game_id' });

  if (gameError) {
    console.error(`  Game upsert error for ${gameId}:`, gameError.message);
    return 'failed';
  }

  // Delete existing period results then re-insert (clean slate per game)
  await supabase.from('period_results').delete().eq('game_id', gameId);

  const { error: prError } = await supabase.from('period_results').insert(periodResults);

  if (prError) {
    console.error(`  Period results insert error for ${gameId}:`, prError.message);
    return 'failed';
  }

  return 'inserted';
}

async function main() {
  console.log('='.repeat(60));
  console.log('NHL 2025-2026 Season Ingestion');
  console.log('='.repeat(60));
  console.log(`Mode:    ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Offset:  ${offset}`);
  console.log(`Limit:   ${limit ?? 'none'}`);
  console.log(`Force:   ${force ? 'YES (reprocess existing)' : 'NO'}`);
  console.log('');

  // Verify 2024-2025 data is present before starting
  const { count: existing2425 } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season', '2024-2025');
  console.log(`Verified 2024-2025 data: ${existing2425 ?? 0} games (will not be touched)\n`);

  const allGameIds = await getAllGameIds();
  console.log(`Found ${allGameIds.length} total 2025-2026 game IDs from schedule\n`);

  // Apply offset and limit
  let gameIds = allGameIds.slice(offset);
  if (limit) gameIds = gameIds.slice(0, limit);

  // Skip already-ingested games unless --force
  if (!force) {
    const { data: ingested } = await supabase
      .from('games')
      .select('game_id')
      .eq('season', SEASON);
    const ingestedSet = new Set((ingested ?? []).map((g: { game_id: string }) => g.game_id));
    const before = gameIds.length;
    gameIds = gameIds.filter(id => !ingestedSet.has(id));
    console.log(`Already ingested: ${before - gameIds.length} | Remaining: ${gameIds.length}\n`);
  }

  if (gameIds.length === 0) {
    console.log('Nothing to process. All games already ingested. Use --force to reprocess.');
    return;
  }

  let inserted = 0, skipped = 0, failed = 0;

  for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
    const batch = gameIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(gameIds.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches} (games ${i + 1}–${Math.min(i + BATCH_SIZE, gameIds.length)}):`);

    for (const gameId of batch) {
      process.stdout.write(`  ${gameId}... `);

      if (dryRun) {
        console.log('(dry run)');
        inserted++;
        continue;
      }

      const result = await processGame(gameId);
      console.log(result);

      if (result === 'inserted') inserted++;
      else if (result === 'skipped') skipped++;
      else failed++;
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped:  ${skipped} (not final or already ingested)`);
  console.log(`  Failed:   ${failed}`);

  if (dryRun) {
    console.log('\nDRY RUN — no changes made. Remove --dry-run to apply.');
  }

  // Final verification: 2024-2025 data unchanged
  const { count: final2425 } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season', '2024-2025');
  console.log(`\n2024-2025 game count (should match ${existing2425 ?? 0}): ${final2425 ?? 0}`);
  if (final2425 !== existing2425) {
    console.error('WARNING: 2024-2025 game count changed! Investigate immediately.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
