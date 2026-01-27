// Tool: Get Team Schedule
// Get a team's recent or upcoming games with results

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';

export const getTeamScheduleTool = new DynamicStructuredTool({
  name: 'get_team_schedule',
  description: `Get a team's schedule with game results and period analysis.
    Use this tool to:
    - See a team's last N games with results
    - View upcoming games
    - Get a month's schedule
    - See period performance in recent games

    Much easier than manually specifying date ranges!`,
  schema: z.object({
    teamCode: z.string().describe('3-letter team code (e.g., CAR)'),
    range: z.enum(['last10', 'last20', 'next10', 'month', 'season']).default('last10')
      .describe('What games to show (default: last10)'),
    month: z.string().optional()
      .describe('For "month" range: month in YYYY-MM format (e.g., "2024-12")'),
    season: z.string().optional()
      .describe('Season filter (e.g., "2024-2025")'),
  }),
  func: async ({ teamCode, range = 'last10', month, season }) => {
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

      // Build query based on range
      let query = supabase
        .from('games')
        .select('*')
        .or(`home_team_code.eq.${code},away_team_code.eq.${code}`);

      if (season) {
        query = query.eq('season', season);
      }

      const today = new Date().toISOString().split('T')[0];

      if (range === 'last10' || range === 'last20') {
        const limit = range === 'last10' ? 10 : 20;
        query = query
          .lte('game_date', today)
          .order('game_date', { ascending: false })
          .limit(limit);
      } else if (range === 'next10') {
        query = query
          .gt('game_date', today)
          .order('game_date', { ascending: true })
          .limit(10);
      } else if (range === 'month' && month) {
        const [year, mon] = month.split('-');
        const startDate = `${year}-${mon}-01`;
        const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().split('T')[0];
        query = query
          .gte('game_date', startDate)
          .lte('game_date', endDate)
          .order('game_date', { ascending: true });
      } else if (range === 'season') {
        query = query.order('game_date', { ascending: true });
      }

      const { data: games, error: gamesError } = await query;

      if (gamesError) {
        throw new Error(`Failed to fetch games: ${gamesError.message}`);
      }

      if (!games || games.length === 0) {
        return JSON.stringify({
          success: true,
          team: { code: team.team_code, name: team.team_name },
          message: 'No games found for the specified range',
          games: [],
        });
      }

      // Get period results for these games
      const gameIds = games.map(g => g.game_id);
      const { data: periodResults } = await supabase
        .from('period_results')
        .select('*')
        .in('game_id', gameIds)
        .eq('team_code', code);

      // Process each game
      const processedGames = games.map(game => {
        const isHome = game.home_team_code === code;
        const opponent = isHome ? game.away_team_code : game.home_team_code;
        const gamePeriods = periodResults?.filter(pr => pr.game_id === game.game_id) || [];

        // Calculate totals
        const regulationPeriods = gamePeriods.filter(pr => pr.period_number <= 3);
        const goalsFor = gamePeriods.reduce((sum, pr) => sum + pr.goals_for, 0);
        const goalsAgainst = gamePeriods.reduce((sum, pr) => sum + pr.goals_against, 0);
        const periodsWon = regulationPeriods.filter(pr => pr.period_outcome === 'WIN').length;
        const wonTwoPlus = gamePeriods.some(pr => pr.won_two_plus_reg_periods);
        const wentToOT = gamePeriods.some(pr => pr.period_number > 3);

        // Determine result
        let result: string;
        if (goalsFor > goalsAgainst) {
          result = wentToOT ? 'OTW' : 'W';
        } else if (goalsFor < goalsAgainst) {
          result = wentToOT ? 'OTL' : 'L';
        } else {
          result = 'T'; // Shouldn't happen in NHL
        }

        // Quality indicator
        let quality: string;
        if (result === 'W' || result === 'OTW') {
          quality = wonTwoPlus ? 'Good Win' : 'Bad Win';
        } else {
          quality = wonTwoPlus ? 'Unlucky Loss' : 'Deserved Loss';
        }

        return {
          date: game.game_date,
          opponent,
          location: isHome ? 'HOME' : 'AWAY',
          score: `${goalsFor}-${goalsAgainst}`,
          result,
          periods_won: periodsWon,
          won_2_plus: wonTwoPlus,
          quality,
          overtime: wentToOT,
        };
      });

      // Calculate summary stats
      const summary = {
        games_played: processedGames.length,
        record: {
          wins: processedGames.filter(g => g.result === 'W' || g.result === 'OTW').length,
          losses: processedGames.filter(g => g.result === 'L').length,
          otLosses: processedGames.filter(g => g.result === 'OTL').length,
        },
        good_wins: processedGames.filter(g => g.quality === 'Good Win').length,
        bad_wins: processedGames.filter(g => g.quality === 'Bad Win').length,
        avg_periods_won: processedGames.length > 0
          ? (processedGames.reduce((sum, g) => sum + g.periods_won, 0) / processedGames.length).toFixed(2)
          : 0,
        home_record: {
          wins: processedGames.filter(g => g.location === 'HOME' && (g.result === 'W' || g.result === 'OTW')).length,
          losses: processedGames.filter(g => g.location === 'HOME' && (g.result === 'L' || g.result === 'OTL')).length,
        },
        away_record: {
          wins: processedGames.filter(g => g.location === 'AWAY' && (g.result === 'W' || g.result === 'OTW')).length,
          losses: processedGames.filter(g => g.location === 'AWAY' && (g.result === 'L' || g.result === 'OTL')).length,
        },
      };

      return JSON.stringify({
        success: true,
        team: { code: team.team_code, name: team.team_name },
        range,
        summary,
        games: processedGames,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
