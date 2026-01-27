// Tool: Check Data Health
// Identify gaps or issues in the database

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';

export const checkDataHealthTool = new DynamicStructuredTool({
  name: 'check_data_health',
  description: `Check the health and completeness of the database.
    Use this tool to:
    - Find games missing period results
    - Identify date ranges with no data
    - Check for incomplete seasons
    - Detect data quality issues
    - Get database statistics

    Useful for diagnosing why statistics might look wrong or incomplete.`,
  schema: z.object({
    season: z.string().optional().describe('Season to check (e.g., "2024-2025"). Defaults to all seasons.'),
    detailed: z.boolean().default(false).describe('Include detailed breakdown of issues'),
  }),
  func: async ({ season, detailed = false }) => {
    try {
      const issues: Array<{ type: string; severity: 'error' | 'warning' | 'info'; message: string; details?: any }> = [];

      // Get all games
      let gamesQuery = supabase.from('games').select('*');
      if (season) {
        gamesQuery = gamesQuery.eq('season', season);
      }
      const { data: games, error: gamesError } = await gamesQuery;

      if (gamesError) {
        throw new Error(`Failed to fetch games: ${gamesError.message}`);
      }

      // Get all period results
      const { data: periodResults, error: periodError } = await supabase
        .from('period_results')
        .select('game_id, team_code, period_number');

      if (periodError) {
        throw new Error(`Failed to fetch period results: ${periodError.message}`);
      }

      // Get all teams
      const { data: teams } = await supabase.from('teams').select('team_code');
      const validTeamCodes = new Set(teams?.map(t => t.team_code) || []);

      // Count period results per game
      const periodCountByGame = new Map<string, number>();
      for (const pr of periodResults || []) {
        periodCountByGame.set(pr.game_id, (periodCountByGame.get(pr.game_id) || 0) + 1);
      }

      // Check 1: Games without period results
      const gamesWithoutPeriods: string[] = [];
      const gamesWithIncompletePeriods: Array<{ game_id: string; count: number }> = [];

      for (const game of games || []) {
        const periodCount = periodCountByGame.get(game.game_id) || 0;
        if (periodCount === 0) {
          gamesWithoutPeriods.push(game.game_id);
        } else if (periodCount < 6) {
          // Minimum 6 period results (3 periods × 2 teams)
          gamesWithIncompletePeriods.push({ game_id: game.game_id, count: periodCount });
        }
      }

      if (gamesWithoutPeriods.length > 0) {
        issues.push({
          type: 'missing_period_results',
          severity: 'error',
          message: `${gamesWithoutPeriods.length} games have no period results`,
          details: detailed ? gamesWithoutPeriods.slice(0, 20) : undefined,
        });
      }

      if (gamesWithIncompletePeriods.length > 0) {
        issues.push({
          type: 'incomplete_period_results',
          severity: 'warning',
          message: `${gamesWithIncompletePeriods.length} games have incomplete period results`,
          details: detailed ? gamesWithIncompletePeriods.slice(0, 20) : undefined,
        });
      }

      // Check 2: Invalid team codes in games
      const invalidTeamGames: Array<{ game_id: string; invalid_team: string }> = [];
      for (const game of games || []) {
        if (!validTeamCodes.has(game.home_team_code)) {
          invalidTeamGames.push({ game_id: game.game_id, invalid_team: game.home_team_code });
        }
        if (!validTeamCodes.has(game.away_team_code)) {
          invalidTeamGames.push({ game_id: game.game_id, invalid_team: game.away_team_code });
        }
      }

      if (invalidTeamGames.length > 0) {
        issues.push({
          type: 'invalid_team_codes',
          severity: 'error',
          message: `${invalidTeamGames.length} games reference invalid team codes`,
          details: detailed ? invalidTeamGames : undefined,
        });
      }

      // Check 3: Season coverage
      const seasons = [...new Set((games || []).map(g => g.season))].sort();
      const seasonStats: Record<string, { games: number; dateRange: { first: string; last: string } }> = {};

      for (const s of seasons) {
        const seasonGames = (games || []).filter(g => g.season === s);
        const dates = seasonGames.map(g => g.game_date).sort();
        seasonStats[s] = {
          games: seasonGames.length,
          dateRange: {
            first: dates[0] || 'N/A',
            last: dates[dates.length - 1] || 'N/A',
          },
        };
      }

      // Check 4: Date gaps (look for gaps > 3 days)
      const dateGaps: Array<{ season: string; gap_start: string; gap_end: string; days: number }> = [];

      for (const s of seasons) {
        const seasonGames = (games || [])
          .filter(g => g.season === s)
          .map(g => g.game_date)
          .sort();

        for (let i = 1; i < seasonGames.length; i++) {
          const prevDate = new Date(seasonGames[i - 1]);
          const currDate = new Date(seasonGames[i]);
          const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff > 5) { // More than 5 days gap (accounting for all-star break, etc.)
            dateGaps.push({
              season: s,
              gap_start: seasonGames[i - 1],
              gap_end: seasonGames[i],
              days: daysDiff,
            });
          }
        }
      }

      if (dateGaps.length > 0) {
        issues.push({
          type: 'date_gaps',
          severity: 'warning',
          message: `${dateGaps.length} significant date gaps found`,
          details: detailed ? dateGaps : undefined,
        });
      }

      // Check 5: Orphaned period results (period results for games not in database)
      const gameIdsInDb = new Set((games || []).map(g => g.game_id));
      const orphanedPeriodGameIds = new Set<string>();

      for (const pr of periodResults || []) {
        if (!gameIdsInDb.has(pr.game_id)) {
          orphanedPeriodGameIds.add(pr.game_id);
        }
      }

      if (orphanedPeriodGameIds.size > 0) {
        issues.push({
          type: 'orphaned_period_results',
          severity: 'warning',
          message: `${orphanedPeriodGameIds.size} games have period results but no game record`,
          details: detailed ? Array.from(orphanedPeriodGameIds).slice(0, 20) : undefined,
        });
      }

      // Summary
      const healthScore = Math.max(0, 100 - (
        gamesWithoutPeriods.length * 2 +
        gamesWithIncompletePeriods.length +
        invalidTeamGames.length * 5 +
        orphanedPeriodGameIds.size
      ));

      return JSON.stringify({
        success: true,
        health_score: Math.min(100, healthScore),
        summary: {
          total_games: games?.length || 0,
          total_period_results: periodResults?.length || 0,
          total_teams: validTeamCodes.size,
          seasons_covered: seasons.length,
        },
        season_details: seasonStats,
        issues: issues.length > 0 ? issues : 'No issues found',
        issue_counts: {
          errors: issues.filter(i => i.severity === 'error').length,
          warnings: issues.filter(i => i.severity === 'warning').length,
          info: issues.filter(i => i.severity === 'info').length,
        },
        recommendation: issues.length > 0
          ? 'Run sync_recent_games or the backfill migration to fix missing data'
          : 'Database is healthy!',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
