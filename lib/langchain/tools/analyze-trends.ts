// Tool: Analyze Trends
// Track team performance metrics over time

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';

export const analyzeTrendsTool = new DynamicStructuredTool({
  name: 'analyze_trends',
  description: `Analyze how a team's performance changes over time.
    Use this tool to:
    - Track improvement or decline in period performance
    - See trends in good wins vs bad wins
    - Analyze monthly/weekly performance patterns
    - Identify hot and cold streaks

    Great for answering questions like "Is this team getting better?"`,
  schema: z.object({
    teamCode: z.string().describe('3-letter team code (e.g., CAR)'),
    metric: z.enum(['periods_won', 'good_wins', 'win_pct', 'goals_per_game', 'period_win_pct'])
      .default('periods_won')
      .describe('Metric to analyze'),
    window: z.enum(['weekly', 'monthly', 'rolling10']).default('monthly')
      .describe('Time window for grouping (default: monthly)'),
    season: z.string().optional()
      .describe('Season to analyze (e.g., "2024-2025")'),
  }),
  func: async ({ teamCode, metric = 'periods_won', window = 'monthly', season }) => {
    try {
      const code = teamCode.toUpperCase();

      // Validate team exists
      const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('team_code', code)
        .single();

      if (!team) {
        return JSON.stringify({
          success: false,
          error: `Team ${code} not found. Use lookup_team to find the correct code.`,
        });
      }

      // Get all games for the team
      let gamesQuery = supabase
        .from('games')
        .select('*')
        .or(`home_team_code.eq.${code},away_team_code.eq.${code}`)
        .order('game_date', { ascending: true });

      if (season) {
        gamesQuery = gamesQuery.eq('season', season);
      }

      const { data: games } = await gamesQuery;

      if (!games || games.length === 0) {
        return JSON.stringify({
          success: true,
          team: { code: team.team_code, name: team.team_name },
          message: 'No games found for analysis',
          trend_data: [],
        });
      }

      // Get period results
      const gameIds = games.map(g => g.game_id);
      const { data: periodResults } = await supabase
        .from('period_results')
        .select('*')
        .in('game_id', gameIds)
        .eq('team_code', code);

      // Group games by time window
      const gamesByWindow = new Map<string, typeof games>();

      for (const game of games) {
        let windowKey: string;
        const date = new Date(game.game_date);

        if (window === 'weekly') {
          // ISO week number
          const startOfYear = new Date(date.getFullYear(), 0, 1);
          const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
          windowKey = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        } else if (window === 'monthly') {
          windowKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        } else {
          // rolling10 - we'll handle this differently
          windowKey = game.game_date;
        }

        if (!gamesByWindow.has(windowKey)) {
          gamesByWindow.set(windowKey, []);
        }
        gamesByWindow.get(windowKey)!.push(game);
      }

      // Calculate metrics for each window
      const trendData: Array<{
        period: string;
        games: number;
        value: number;
        details: any;
      }> = [];

      if (window === 'rolling10') {
        // Calculate rolling 10-game averages
        for (let i = 9; i < games.length; i++) {
          const windowGames = games.slice(i - 9, i + 1);
          const windowGameIds = windowGames.map(g => g.game_id);
          const windowPeriods = periodResults?.filter(pr => windowGameIds.includes(pr.game_id)) || [];

          const stats = calculateWindowStats(windowGames, windowPeriods, code);
          const value = getMetricValue(stats, metric);

          trendData.push({
            period: `Games ${i - 8}-${i + 1} (ending ${games[i].game_date})`,
            games: 10,
            value,
            details: stats,
          });
        }
      } else {
        for (const [windowKey, windowGames] of Array.from(gamesByWindow.entries()).sort()) {
          const windowGameIds = windowGames.map(g => g.game_id);
          const windowPeriods = periodResults?.filter(pr => windowGameIds.includes(pr.game_id)) || [];

          const stats = calculateWindowStats(windowGames, windowPeriods, code);
          const value = getMetricValue(stats, metric);

          trendData.push({
            period: windowKey,
            games: windowGames.length,
            value,
            details: stats,
          });
        }
      }

      // Calculate trend direction
      let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
      if (trendData.length >= 2) {
        const recentValues = trendData.slice(-3).map(t => t.value);
        const earlierValues = trendData.slice(0, 3).map(t => t.value);
        const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
        const earlierAvg = earlierValues.reduce((a, b) => a + b, 0) / earlierValues.length;

        const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;
        if (changePercent > 10) {
          trendDirection = 'improving';
        } else if (changePercent < -10) {
          trendDirection = 'declining';
        }
      }

      // Find best and worst periods
      const sortedByValue = [...trendData].sort((a, b) => b.value - a.value);
      const bestPeriod = sortedByValue[0];
      const worstPeriod = sortedByValue[sortedByValue.length - 1];

      return JSON.stringify({
        success: true,
        team: { code: team.team_code, name: team.team_name },
        metric,
        window,
        season: season || 'all',
        total_games: games.length,
        trend_direction: trendDirection,
        analysis: {
          best_period: bestPeriod ? { period: bestPeriod.period, value: bestPeriod.value } : null,
          worst_period: worstPeriod ? { period: worstPeriod.period, value: worstPeriod.value } : null,
          current: trendData.length > 0 ? trendData[trendData.length - 1] : null,
        },
        trend_data: trendData,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});

function calculateWindowStats(games: any[], periodResults: any[], teamCode: string) {
  const regulationPeriods = periodResults.filter(pr => pr.period_number <= 3);
  const periodsWon = regulationPeriods.filter(pr => pr.period_outcome === 'WIN').length;
  const totalPeriods = regulationPeriods.length;

  let wins = 0;
  let goodWins = 0;
  let badWins = 0;
  let totalGoals = 0;

  const gameIds = new Set(games.map(g => g.game_id));
  const processedGames = new Set<string>();

  for (const pr of periodResults) {
    if (processedGames.has(pr.game_id)) continue;
    if (!gameIds.has(pr.game_id)) continue;

    const gamePeriods = periodResults.filter(p => p.game_id === pr.game_id);
    const goalsFor = gamePeriods.reduce((sum, p) => sum + p.goals_for, 0);
    const goalsAgainst = gamePeriods.reduce((sum, p) => sum + p.goals_against, 0);
    const wonTwoPlus = gamePeriods.some(p => p.won_two_plus_reg_periods);

    totalGoals += goalsFor;

    if (goalsFor > goalsAgainst) {
      wins++;
      if (wonTwoPlus) {
        goodWins++;
      } else {
        badWins++;
      }
    }

    processedGames.add(pr.game_id);
  }

  return {
    games: games.length,
    wins,
    losses: games.length - wins,
    good_wins: goodWins,
    bad_wins: badWins,
    periods_won: periodsWon,
    total_periods: totalPeriods,
    period_win_pct: totalPeriods > 0 ? (periodsWon / totalPeriods) * 100 : 0,
    win_pct: games.length > 0 ? (wins / games.length) * 100 : 0,
    goals_per_game: games.length > 0 ? totalGoals / games.length : 0,
  };
}

function getMetricValue(stats: ReturnType<typeof calculateWindowStats>, metric: string): number {
  switch (metric) {
    case 'periods_won':
      return stats.periods_won;
    case 'good_wins':
      return stats.good_wins;
    case 'win_pct':
      return stats.win_pct;
    case 'goals_per_game':
      return parseFloat(stats.goals_per_game.toFixed(2));
    case 'period_win_pct':
      return parseFloat(stats.period_win_pct.toFixed(1));
    default:
      return stats.periods_won;
  }
}
