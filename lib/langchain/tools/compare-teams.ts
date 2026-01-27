// Tool: Compare Teams
// Head-to-head analysis between two teams with period-level insights

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';

export const compareTeamsTool = new DynamicStructuredTool({
  name: 'compare_teams',
  description: `Compare two NHL teams head-to-head with detailed period-level analysis.
    Use this tool to:
    - See head-to-head record between two teams
    - Compare period performance in their matchups
    - Analyze which team dominates which periods
    - See good wins vs bad wins in their matchups
    - Compare overall season statistics

    Great for rivalry analysis and playoff matchup predictions!`,
  schema: z.object({
    teamA: z.string().describe('First team code (e.g., CAR)'),
    teamB: z.string().describe('Second team code (e.g., TBL)'),
    season: z.string().optional().describe('Season to analyze (e.g., "2024-2025"). Defaults to current season.'),
  }),
  func: async ({ teamA, teamB, season }) => {
    try {
      const teamACode = teamA.toUpperCase();
      const teamBCode = teamB.toUpperCase();

      // Validate teams exist
      const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .in('team_code', [teamACode, teamBCode]);

      if (!teams || teams.length !== 2) {
        return JSON.stringify({
          success: false,
          error: 'One or both teams not found. Use lookup_team to find the correct team code.',
        });
      }

      const teamAData = teams.find(t => t.team_code === teamACode)!;
      const teamBData = teams.find(t => t.team_code === teamBCode)!;

      // Find head-to-head games
      let gamesQuery = supabase
        .from('games')
        .select('*')
        .or(`and(home_team_code.eq.${teamACode},away_team_code.eq.${teamBCode}),and(home_team_code.eq.${teamBCode},away_team_code.eq.${teamACode})`);

      if (season) {
        gamesQuery = gamesQuery.eq('season', season);
      }

      const { data: h2hGames } = await gamesQuery.order('game_date', { ascending: true });

      if (!h2hGames || h2hGames.length === 0) {
        return JSON.stringify({
          success: true,
          message: `No head-to-head games found between ${teamAData.team_name} and ${teamBData.team_name}${season ? ` in ${season}` : ''}`,
          teams: {
            teamA: { code: teamACode, name: teamAData.team_name },
            teamB: { code: teamBCode, name: teamBData.team_name },
          },
          head_to_head: null,
        });
      }

      // Get period results for all H2H games
      const gameIds = h2hGames.map(g => g.game_id);
      const { data: periodResults } = await supabase
        .from('period_results')
        .select('*')
        .in('game_id', gameIds);

      // Analyze head-to-head
      const h2hStats = {
        teamA: {
          code: teamACode,
          name: teamAData.team_name,
          wins: 0,
          losses: 0,
          otLosses: 0,
          goodWins: 0,
          badWins: 0,
          periodsWon: 0,
          periodsLost: 0,
          periodsTied: 0,
          periodWinsByPeriod: { 1: 0, 2: 0, 3: 0 },
        },
        teamB: {
          code: teamBCode,
          name: teamBData.team_name,
          wins: 0,
          losses: 0,
          otLosses: 0,
          goodWins: 0,
          badWins: 0,
          periodsWon: 0,
          periodsLost: 0,
          periodsTied: 0,
          periodWinsByPeriod: { 1: 0, 2: 0, 3: 0 },
        },
      };

      const gameDetails: Array<{
        date: string;
        home: string;
        away: string;
        winner: string;
        teamAPeriodsWon: number;
        teamBPeriodsWon: number;
        wentToOT: boolean;
      }> = [];

      for (const game of h2hGames) {
        const gamePeriodResults = periodResults?.filter(pr => pr.game_id === game.game_id) || [];

        const teamAPeriods = gamePeriodResults.filter(pr => pr.team_code === teamACode);
        const teamBPeriods = gamePeriodResults.filter(pr => pr.team_code === teamBCode);

        // Count period wins for each team
        const teamAPeriodsWon = teamAPeriods.filter(pr => pr.period_number <= 3 && pr.period_outcome === 'WIN').length;
        const teamBPeriodsWon = teamBPeriods.filter(pr => pr.period_number <= 3 && pr.period_outcome === 'WIN').length;
        const wentToOT = gamePeriodResults.some(pr => pr.period_number > 3);

        // Period-by-period wins
        for (const period of teamAPeriods.filter(pr => pr.period_number <= 3)) {
          if (period.period_outcome === 'WIN') {
            h2hStats.teamA.periodsWon++;
            h2hStats.teamA.periodWinsByPeriod[period.period_number as 1 | 2 | 3]++;
          } else if (period.period_outcome === 'LOSS') {
            h2hStats.teamA.periodsLost++;
          } else {
            h2hStats.teamA.periodsTied++;
          }
        }

        for (const period of teamBPeriods.filter(pr => pr.period_number <= 3)) {
          if (period.period_outcome === 'WIN') {
            h2hStats.teamB.periodsWon++;
            h2hStats.teamB.periodWinsByPeriod[period.period_number as 1 | 2 | 3]++;
          } else if (period.period_outcome === 'LOSS') {
            h2hStats.teamB.periodsLost++;
          } else {
            h2hStats.teamB.periodsTied++;
          }
        }

        // Determine game winner
        const teamAGoals = teamAPeriods.reduce((sum, pr) => sum + pr.goals_for, 0);
        const teamBGoals = teamBPeriods.reduce((sum, pr) => sum + pr.goals_for, 0);
        const teamAWonTwoPlus = teamAPeriods.some(pr => pr.won_two_plus_reg_periods);
        const teamBWonTwoPlus = teamBPeriods.some(pr => pr.won_two_plus_reg_periods);

        let winner: string;
        if (teamAGoals > teamBGoals) {
          winner = teamACode;
          h2hStats.teamA.wins++;
          if (teamAWonTwoPlus) {
            h2hStats.teamA.goodWins++;
          } else {
            h2hStats.teamA.badWins++;
          }
          if (wentToOT) {
            h2hStats.teamB.otLosses++;
          } else {
            h2hStats.teamB.losses++;
          }
        } else {
          winner = teamBCode;
          h2hStats.teamB.wins++;
          if (teamBWonTwoPlus) {
            h2hStats.teamB.goodWins++;
          } else {
            h2hStats.teamB.badWins++;
          }
          if (wentToOT) {
            h2hStats.teamA.otLosses++;
          } else {
            h2hStats.teamA.losses++;
          }
        }

        gameDetails.push({
          date: game.game_date,
          home: game.home_team_code,
          away: game.away_team_code,
          winner,
          teamAPeriodsWon,
          teamBPeriodsWon,
          wentToOT,
        });
      }

      // Determine period dominance
      const periodDominance = {
        period1: h2hStats.teamA.periodWinsByPeriod[1] > h2hStats.teamB.periodWinsByPeriod[1] ? teamACode :
                 h2hStats.teamA.periodWinsByPeriod[1] < h2hStats.teamB.periodWinsByPeriod[1] ? teamBCode : 'EVEN',
        period2: h2hStats.teamA.periodWinsByPeriod[2] > h2hStats.teamB.periodWinsByPeriod[2] ? teamACode :
                 h2hStats.teamA.periodWinsByPeriod[2] < h2hStats.teamB.periodWinsByPeriod[2] ? teamBCode : 'EVEN',
        period3: h2hStats.teamA.periodWinsByPeriod[3] > h2hStats.teamB.periodWinsByPeriod[3] ? teamACode :
                 h2hStats.teamA.periodWinsByPeriod[3] < h2hStats.teamB.periodWinsByPeriod[3] ? teamBCode : 'EVEN',
      };

      return JSON.stringify({
        success: true,
        season: season || 'all',
        games_played: h2hGames.length,
        teams: {
          teamA: h2hStats.teamA,
          teamB: h2hStats.teamB,
        },
        period_dominance: periodDominance,
        game_details: gameDetails,
        analysis: {
          series_leader: h2hStats.teamA.wins > h2hStats.teamB.wins ? teamACode :
                        h2hStats.teamA.wins < h2hStats.teamB.wins ? teamBCode : 'TIED',
          period_leader: h2hStats.teamA.periodsWon > h2hStats.teamB.periodsWon ? teamACode :
                        h2hStats.teamA.periodsWon < h2hStats.teamB.periodsWon ? teamBCode : 'TIED',
          better_quality_wins: h2hStats.teamA.goodWins > h2hStats.teamB.goodWins ? teamACode :
                              h2hStats.teamA.goodWins < h2hStats.teamB.goodWins ? teamBCode : 'TIED',
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
