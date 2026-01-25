// Tool 3: Calculate Team Statistics
// Aggregates period-by-period data to calculate team performance metrics

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';

export const calculateTeamStatsTool = new DynamicStructuredTool({
  name: 'calculate_team_stats',
  description: `Calculate aggregated team statistics from period-by-period game data.
    Use this tool to:
    - Get team records (wins, losses, OT losses)
    - Calculate period win/loss/tie totals
    - Determine "good wins" (won 2+ regulation periods AND won the game)
    - Determine "bad wins" (won game WITHOUT winning 2+ regulation periods)
    - Compare team performance across divisions or conferences
    - Analyze trends over time

    This tool aggregates data from the unique period_results dataset to provide insights
    about team success patterns related to the core hypothesis: teams winning 2+ regulation
    periods are more likely to succeed in playoffs.`,
  schema: z.object({
    teamCode: z.string().optional().describe('3-letter NHL team code (e.g., CAR, TBL). Leave empty for all teams.'),
    season: z.string().optional().describe('Season in YYYY-YYYY format (e.g., 2024-2025)'),
    conference: z.enum(['Eastern', 'Western']).optional().describe('Filter by conference'),
    division: z.enum(['Atlantic', 'Metropolitan', 'Central', 'Pacific']).optional().describe('Filter by division'),
    sortBy: z.enum(['points', 'good_wins', 'difference', 'periods_won']).default('points').describe('Sort results by this metric'),
  }),
  func: async ({ teamCode, season, conference, division, sortBy }) => {
    try {
      // Step 1: Get teams with optional filters
      let teamsQuery = supabase.from('teams').select('*');

      if (teamCode) {
        teamsQuery = teamsQuery.eq('team_code', teamCode.toUpperCase());
      }
      if (conference) {
        teamsQuery = teamsQuery.eq('conference', conference);
      }
      if (division) {
        teamsQuery = teamsQuery.eq('division', division);
      }

      const { data: teams, error: teamsError } = await teamsQuery;

      if (teamsError) {
        return JSON.stringify({
          success: false,
          error: teamsError.message,
        });
      }

      if (!teams || teams.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No teams found matching the criteria.',
        });
      }

      // Step 2: Calculate statistics for each team
      const teamStats = [];

      for (const team of teams) {
        // Get all period results for this team
        let periodQuery = supabase
          .from('period_results')
          .select(`
            *,
            games (
              game_id,
              game_date,
              season,
              home_team_code,
              away_team_code
            )
          `)
          .eq('team_code', team.team_code);

        const { data: periodResults, error: periodError } = await periodQuery;

        if (periodError) {
          console.error(`Error fetching period results for ${team.team_code}:`, periodError);
          continue;
        }

        // Filter by season if provided
        let filteredResults = periodResults || [];
        if (season) {
          filteredResults = filteredResults.filter((r: any) => r.games?.season === season);
        }

        // Calculate period statistics
        const periodsWon = filteredResults.filter((r: any) => r.period_outcome === 'WIN').length;
        const periodsLost = filteredResults.filter((r: any) => r.period_outcome === 'LOSS').length;
        const periodsTied = filteredResults.filter((r: any) => r.period_outcome === 'TIE').length;

        // Get unique games and calculate game-level stats
        const gameMap = new Map<string, any>();
        for (const result of filteredResults) {
          if (result.games?.game_id) {
            if (!gameMap.has(result.games.game_id)) {
              gameMap.set(result.games.game_id, {
                game_id: result.games.game_id,
                game_date: result.games.game_date,
                home_team_code: result.games.home_team_code,
                away_team_code: result.games.away_team_code,
                is_home: result.games.home_team_code === team.team_code,
                won_two_plus: result.won_two_plus_reg_periods,
                periods: [],
              });
            }
            gameMap.get(result.games.game_id).periods.push(result);
          }
        }

        // Calculate game outcomes
        let wins = 0;
        let losses = 0;
        let otLosses = 0;
        let goodWins = 0;
        let badWins = 0;

        for (const [, gameData] of gameMap) {
          // Calculate total goals for this team in the game
          const regulationPeriods = gameData.periods.filter((p: any) => p.period_number <= 3);
          const totalGoalsFor = regulationPeriods.reduce((sum: number, p: any) => sum + p.goals_for, 0);
          const totalGoalsAgainst = regulationPeriods.reduce((sum: number, p: any) => sum + p.goals_against, 0);

          // Include OT if exists
          const otPeriod = gameData.periods.find((p: any) => p.period_number === 4);
          const soPeriod = gameData.periods.find((p: any) => p.period_number === 5);

          let gameWon = false;
          let gameInOT = false;

          if (soPeriod) {
            gameWon = soPeriod.goals_for > soPeriod.goals_against;
            gameInOT = true;
          } else if (otPeriod) {
            gameWon = (totalGoalsFor + otPeriod.goals_for) > (totalGoalsAgainst + otPeriod.goals_against);
            gameInOT = true;
          } else {
            gameWon = totalGoalsFor > totalGoalsAgainst;
          }

          if (gameWon) {
            wins++;
            if (gameData.won_two_plus) {
              goodWins++;
            } else {
              badWins++;
            }
          } else {
            if (gameInOT) {
              otLosses++;
            } else {
              losses++;
            }
          }
        }

        // Calculate points (2 for win, 1 for OT loss)
        const points = wins * 2 + otLosses;

        teamStats.push({
          team_code: team.team_code,
          team_name: team.team_name,
          conference: team.conference,
          division: team.division,
          games_played: gameMap.size,
          record: { wins, losses, otLosses },
          points,
          periods_won: periodsWon,
          periods_lost: periodsLost,
          periods_tied: periodsTied,
          good_wins: goodWins,
          bad_wins: badWins,
          difference: goodWins - badWins,
        });
      }

      // Sort results
      teamStats.sort((a, b) => {
        switch (sortBy) {
          case 'points':
            return b.points - a.points;
          case 'good_wins':
            return b.good_wins - a.good_wins;
          case 'difference':
            return b.difference - a.difference;
          case 'periods_won':
            return b.periods_won - a.periods_won;
          default:
            return b.points - a.points;
        }
      });

      return JSON.stringify({
        success: true,
        filters: { teamCode, season, conference, division },
        sorted_by: sortBy,
        teams_count: teamStats.length,
        data: teamStats,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
