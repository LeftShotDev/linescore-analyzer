// calculate_period_stats tool implementation
// Calculate statistical analysis of period performance
// Tool Contract: specs/001-period-analyzer/contracts/stats-tool.md

import { z } from 'zod';
import { supabase } from '../supabase/client';

// Tool parameter schema with validation
export const calculatePeriodStatsToolSchema = z.object({
  teamCode: z.string()
    .regex(/^[A-Z]{3}$/, 'Team code must be 3 uppercase letters')
    .optional()
    .nullable(),
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  season: z.string()
    .regex(/^\d{4}-\d{4}$/, 'Season must be in YYYY-YYYY format')
    .optional(),
  includePlayoffs: z.boolean().default(false),
});

export type CalculatePeriodStatsToolParams = z.infer<typeof calculatePeriodStatsToolSchema>;

interface PeriodStats {
  period_number: number;
  games_played: number;
  wins: number;
  losses: number;
  ties: number;
  win_percentage: number;
  avg_goals_for: number;
  avg_goals_against: number;
  goal_differential: number;
}

interface OverallStats {
  total_games: number;
  total_periods: number;
  period_stats: PeriodStats[];
  regulation_periods_won_2_plus: {
    count: number;
    percentage: number;
  };
  first_period_performance: {
    wins: number;
    win_percentage: number;
    correlation_with_game_wins: number;
  };
}

interface CalculatePeriodStatsToolResult {
  success: boolean;
  data?: {
    team_code?: string;
    date_range?: {
      start: string;
      end: string;
    };
    stats: OverallStats;
    execution_time_ms: number;
  };
  error?: {
    type: 'VALIDATION_ERROR' | 'QUERY_ERROR' | 'DATABASE_ERROR';
    message: string;
    suggestion: string;
  };
}

/**
 * Calculate period-by-period statistics
 */
async function calculatePeriodByPeriodStats(
  teamCode?: string,
  startDate?: string,
  endDate?: string,
  includePlayoffs: boolean = false
): Promise<PeriodStats[]> {
  let query = supabase
    .from('period_results')
    .select(`
      period_number,
      period_outcome,
      goals_for,
      goals_against,
      games!inner(game_date, game_type)
    `);

  // Apply filters
  if (teamCode) {
    query = query.eq('team_code', teamCode);
  }

  if (startDate) {
    query = query.gte('games.game_date', startDate);
  }

  if (endDate) {
    query = query.lte('games.game_date', endDate);
  }

  if (!includePlayoffs) {
    query = query.eq('games.game_type', 'Regular Season');
  }

  // Only regulation periods (1, 2, 3)
  query = query.lte('period_number', 3);

  const { data, error } = await query;

  if (error) throw error;

  // Group by period number and calculate stats
  const periodMap = new Map<number, {
    games: Set<string>;
    wins: number;
    losses: number;
    ties: number;
    total_goals_for: number;
    total_goals_against: number;
  }>();

  // Initialize periods 1, 2, 3
  [1, 2, 3].forEach(p => {
    periodMap.set(p, {
      games: new Set(),
      wins: 0,
      losses: 0,
      ties: 0,
      total_goals_for: 0,
      total_goals_against: 0,
    });
  });

  // Aggregate data
  for (const row of data || []) {
    const period = row.period_number;
    const stats = periodMap.get(period);

    if (stats) {
      stats.total_goals_for += row.goals_for;
      stats.total_goals_against += row.goals_against;

      if (row.period_outcome === 'WIN') stats.wins++;
      else if (row.period_outcome === 'LOSS') stats.losses++;
      else if (row.period_outcome === 'TIE') stats.ties++;
    }
  }

  // Calculate statistics for each period
  const periodStats: PeriodStats[] = [];

  for (const [period, stats] of periodMap.entries()) {
    const total = stats.wins + stats.losses + stats.ties;
    const games_played = total;

    periodStats.push({
      period_number: period,
      games_played,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      win_percentage: games_played > 0 ? (stats.wins / games_played) * 100 : 0,
      avg_goals_for: games_played > 0 ? stats.total_goals_for / games_played : 0,
      avg_goals_against: games_played > 0 ? stats.total_goals_against / games_played : 0,
      goal_differential: stats.total_goals_for - stats.total_goals_against,
    });
  }

  return periodStats.sort((a, b) => a.period_number - b.period_number);
}

/**
 * Calculate correlation between winning 2+ regulation periods and game outcomes
 */
async function calculateTwoPlusRegCorrelation(
  teamCode?: string,
  startDate?: string,
  endDate?: string,
  includePlayoffs: boolean = false
): Promise<{ count: number; percentage: number }> {
  let query = supabase
    .from('period_results')
    .select(`
      game_id,
      won_two_plus_reg_periods,
      games!inner(game_date, game_type)
    `);

  if (teamCode) {
    query = query.eq('team_code', teamCode);
  }

  if (startDate) {
    query = query.gte('games.game_date', startDate);
  }

  if (endDate) {
    query = query.lte('games.game_date', endDate);
  }

  if (!includePlayoffs) {
    query = query.eq('games.game_type', 'Regular Season');
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by game_id to get unique games
  const gameMap = new Map<string, boolean>();
  for (const row of data || []) {
    gameMap.set(row.game_id, row.won_two_plus_reg_periods);
  }

  const totalGames = gameMap.size;
  const gamesWithTwoPlus = Array.from(gameMap.values()).filter(v => v).length;

  return {
    count: gamesWithTwoPlus,
    percentage: totalGames > 0 ? (gamesWithTwoPlus / totalGames) * 100 : 0,
  };
}

/**
 * Main tool implementation: Calculate period statistics
 */
export async function calculatePeriodStats(
  params: CalculatePeriodStatsToolParams
): Promise<CalculatePeriodStatsToolResult> {
  const startTime = Date.now();

  try {
    // Calculate period-by-period stats
    const periodStats = await calculatePeriodByPeriodStats(
      params.teamCode || undefined,
      params.startDate,
      params.endDate,
      params.includePlayoffs
    );

    // Calculate total games and periods
    const totalPeriods = periodStats.reduce((sum, p) => sum + p.games_played, 0);
    const totalGames = periodStats.length > 0 ? periodStats[0].games_played : 0;

    // Calculate 2+ regulation periods correlation
    const twoPlusRegStats = await calculateTwoPlusRegCorrelation(
      params.teamCode || undefined,
      params.startDate,
      params.endDate,
      params.includePlayoffs
    );

    // Calculate first period performance
    const firstPeriod = periodStats.find(p => p.period_number === 1);
    const firstPeriodPerformance = {
      wins: firstPeriod?.wins || 0,
      win_percentage: firstPeriod?.win_percentage || 0,
      correlation_with_game_wins: 0, // TODO: Calculate actual correlation
    };

    const stats: OverallStats = {
      total_games: totalGames,
      total_periods: totalPeriods,
      period_stats: periodStats,
      regulation_periods_won_2_plus: twoPlusRegStats,
      first_period_performance: firstPeriodPerformance,
    };

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        team_code: params.teamCode || undefined,
        date_range: params.startDate && params.endDate
          ? { start: params.startDate, end: params.endDate }
          : undefined,
        stats,
        execution_time_ms: executionTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check database connection and query parameters',
      },
    };
  }
}

// Export tool definition for Vercel AI SDK
export const calculatePeriodStatsToolDefinition = {
  description: 'Calculate statistical analysis of period performance including win percentages, goal differentials, and correlations. Use this when the user asks for analytics, statistics, or performance metrics.',
  parameters: calculatePeriodStatsToolSchema,
  execute: calculatePeriodStats,
};
