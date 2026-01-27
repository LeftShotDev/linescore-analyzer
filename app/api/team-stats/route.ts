import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured', teamStats: [] },
      { status: 503 }
    );
  }

  try {
    // Fetch all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('team_name', { ascending: true });

    if (teamsError) {
      throw teamsError;
    }

    // Fetch all period results
    const { data: periodResults, error: periodError } = await supabase
      .from('period_results')
      .select('*');

    if (periodError) {
      throw periodError;
    }

    // Fetch all games to determine wins/losses
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*');

    if (gamesError) {
      throw gamesError;
    }

    // Calculate stats for each team
    const teamStats = teams?.map((team) => {
      const teamCode = team.team_code;

      // Get all period results for this team
      const teamPeriodResults = periodResults?.filter(
        (pr) => pr.team_code === teamCode
      ) || [];

      // Count period outcomes (only regulation periods 1-3)
      const regulationPeriods = teamPeriodResults.filter(
        (pr) => pr.period_number <= 3
      );

      const periodsWon = regulationPeriods.filter(
        (pr) => pr.period_outcome === 'WIN'
      ).length;

      const periodsLost = regulationPeriods.filter(
        (pr) => pr.period_outcome === 'LOSS'
      ).length;

      const periodsTied = regulationPeriods.filter(
        (pr) => pr.period_outcome === 'TIE'
      ).length;

      // Get unique game IDs for this team
      const teamGameIds = [...new Set(teamPeriodResults.map((pr) => pr.game_id))];

      // Calculate wins, losses, and OT losses
      let wins = 0;
      let losses = 0;
      let otLosses = 0;
      let goodWins = 0;
      let badWins = 0;

      for (const gameId of teamGameIds) {
        const game = games?.find((g) => g.game_id === gameId);
        if (!game) continue;

        const isHome = game.home_team_code === teamCode;
        const gamePeriodResults = teamPeriodResults.filter(
          (pr) => pr.game_id === gameId
        );

        // Determine if team won 2+ regulation periods
        const wonTwoPlusRegPeriods = gamePeriodResults.some(
          (pr) => pr.won_two_plus_reg_periods === true
        );

        // Calculate total goals for each team in this game
        const homeGoals = periodResults
          ?.filter((pr) => pr.game_id === gameId && pr.team_code === game.home_team_code)
          .reduce((sum, pr) => sum + (pr.goals_for || 0), 0) || 0;

        const awayGoals = periodResults
          ?.filter((pr) => pr.game_id === gameId && pr.team_code === game.away_team_code)
          .reduce((sum, pr) => sum + (pr.goals_for || 0), 0) || 0;

        const teamGoals = isHome ? homeGoals : awayGoals;
        const opponentGoals = isHome ? awayGoals : homeGoals;

        // Check if game went to OT/SO
        const hasOT = gamePeriodResults.some((pr) => pr.period_number > 3);

        if (teamGoals > opponentGoals) {
          wins++;
          if (wonTwoPlusRegPeriods) {
            goodWins++;
          } else {
            badWins++;
          }
        } else if (teamGoals < opponentGoals) {
          if (hasOT) {
            otLosses++;
          } else {
            losses++;
          }
        }
      }

      const points = wins * 2 + otLosses;

      return {
        teamCode: team.team_code,
        teamName: team.team_name,
        conference: team.conference,
        division: team.division,
        record: { wins, losses, otLosses },
        points,
        periodsWon,
        periodsLost,
        periodsTied,
        goodWins,
        badWins,
        difference: goodWins - badWins,
        gamesPlayed: teamGameIds.length,
        rank: 0,
        rankScore: 0,
      };
    }) || [];

    // Calculate rank score: combines points and win difference
    // Formula: (points * 2) + (difference * 3)
    // This weights period dominance (difference) heavily while still respecting standings
    const maxPoints = Math.max(...teamStats.map(t => t.points), 1);
    const maxDiff = Math.max(...teamStats.map(t => Math.abs(t.difference)), 1);

    teamStats.forEach((team) => {
      // Normalize points and difference to 0-100 scale, then combine
      const normalizedPoints = (team.points / maxPoints) * 100;
      const normalizedDiff = ((team.difference + maxDiff) / (2 * maxDiff)) * 100; // Shift to positive range
      // Rank score: 60% points, 40% difference
      team.rankScore = Math.round((normalizedPoints * 0.6) + (normalizedDiff * 0.4));
    });

    // Sort by good wins (descending), then by rankScore
    teamStats.sort((a, b) => {
      if (b.goodWins !== a.goodWins) return b.goodWins - a.goodWins;
      return b.rankScore - a.rankScore;
    });

    // Assign rank position
    teamStats.forEach((team, index) => {
      team.rank = index + 1;
    });

    return NextResponse.json({ teamStats });
  } catch (error) {
    console.error('Error calculating team stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate team stats', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
