import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const seasonFilter = searchParams.get('season');
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured', teamStats: [], seasons: [] },
      { status: 503 }
    );
  }

  try {
    // Fetch all teams
    const { data: teams, error: teamsError } = await supabaseAdmin()
      .from('teams')
      .select('*')
      .order('team_name', { ascending: true });

    if (teamsError) {
      throw teamsError;
    }

    // Get all unique seasons for the filter dropdown (most recent first)
    // Use regular-season games only for the seasons list
    const { data: allGames, error: allGamesError } = await supabaseAdmin()
      .from('games')
      .select('season')
      .eq('game_type', 'Regular Season')
      .limit(5000);

    if (allGamesError) {
      throw allGamesError;
    }

    const seasons = [...new Set(allGames?.map(g => g.season) || [])].sort().reverse();

    // Default to most recent season if no filter provided
    const activeSeason = seasonFilter || seasons[0] || null;

    // Fetch all regular season games — paginate since Supabase max_rows = 1000.
    // Each team plays 82 regular season games (1312 total per season).
    const games: any[] = [];
    {
      let from = 0;
      while (true) {
        let q = supabaseAdmin()
          .from('games')
          .select('*')
          .eq('game_type', 'Regular Season')
          .range(from, from + 999);
        if (activeSeason) q = q.eq('season', activeSeason);
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) break;
        games.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
    }

    // Fetch all period results for those games.
    // Paginate per 1000-ID chunk (both IN clause and max_rows are capped at 1000).
    const filteredGameIdArray = games.map(g => g.game_id);
    const periodResults: any[] = [];
    const ID_CHUNK = 1000;
    for (let c = 0; c < filteredGameIdArray.length; c += ID_CHUNK) {
      const idChunk = filteredGameIdArray.slice(c, c + ID_CHUNK);
      let from = 0;
      while (true) {
        const { data, error } = await supabaseAdmin()
          .from('period_results')
          .select('*')
          .in('game_id', idChunk)
          .range(from, from + 999);
        if (error) throw error;
        if (!data?.length) break;
        periodResults.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
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

    return NextResponse.json({ teamStats, seasons, activeSeason });
  } catch (error) {
    console.error('Error calculating team stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate team stats', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
