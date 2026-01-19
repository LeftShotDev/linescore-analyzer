import { supabase, supabaseAdmin } from './client';

// Database types
export interface Team {
  team_code: string;
  team_name: string;
  division: string | null;
  conference: string | null;
}

export interface Game {
  game_id: string;
  game_date: string;
  season: string;
  home_team_code: string;
  away_team_code: string;
  game_type: string;
  home_team_standing: number | null;
  away_team_standing: number | null;
}

export interface PeriodResult {
  id: string;
  game_id: string;
  team_code: string;
  period_number: number;
  period_type: 'REGULATION' | 'OT' | 'SO';
  goals_for: number;
  goals_against: number;
  empty_net_goals: number;
  period_outcome: 'WIN' | 'LOSS' | 'TIE';
  won_two_plus_reg_periods: boolean;
}

/**
 * Team Queries
 */
export const teamQueries = {
  /**
   * Get all teams
   */
  async getAll(): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('team_code');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get team by code
   */
  async getByCode(teamCode: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('team_code', teamCode)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  },

  /**
   * Get team by name (case-insensitive)
   */
  async getByName(teamName: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .ilike('team_name', teamName)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Check if team exists
   */
  async exists(teamCode: string): Promise<boolean> {
    const team = await this.getByCode(teamCode);
    return team !== null;
  },
};

/**
 * Game Queries
 */
export const gameQueries = {
  /**
   * Get game by ID
   */
  async getById(gameId: string): Promise<Game | null> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('game_id', gameId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Get games by date range
   */
  async getByDateRange(startDate: string, endDate: string): Promise<Game[]> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .gte('game_date', startDate)
      .lte('game_date', endDate)
      .order('game_date');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get games for a team
   */
  async getByTeam(teamCode: string, startDate?: string, endDate?: string): Promise<Game[]> {
    let query = supabase
      .from('games')
      .select('*')
      .or(`home_team_code.eq.${teamCode},away_team_code.eq.${teamCode}`);

    if (startDate) {
      query = query.gte('game_date', startDate);
    }

    if (endDate) {
      query = query.lte('game_date', endDate);
    }

    query = query.order('game_date');

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Check if game exists
   */
  async exists(gameId: string): Promise<boolean> {
    const game = await this.getById(gameId);
    return game !== null;
  },

  /**
   * Insert game (requires service role)
   */
  async insert(game: Omit<Game, 'created_at'>): Promise<Game> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('games')
      .insert(game)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

/**
 * Period Result Queries
 */
export const periodResultQueries = {
  /**
   * Get period results for a game
   */
  async getByGame(gameId: string): Promise<PeriodResult[]> {
    const { data, error } = await supabase
      .from('period_results')
      .select('*')
      .eq('game_id', gameId)
      .order('team_code')
      .order('period_number');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get period results for a team
   */
  async getByTeam(
    teamCode: string,
    options?: {
      startDate?: string;
      endDate?: string;
      periodOutcome?: 'WIN' | 'LOSS' | 'TIE';
      limit?: number;
    }
  ): Promise<PeriodResult[]> {
    let query = supabase
      .from('period_results')
      .select(`
        *,
        games!inner(game_date)
      `)
      .eq('team_code', teamCode);

    if (options?.startDate) {
      query = query.gte('games.game_date', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('games.game_date', options.endDate);
    }

    if (options?.periodOutcome) {
      query = query.eq('period_outcome', options.periodOutcome);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('games.game_date', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Insert period result (requires service role)
   */
  async insert(periodResult: Omit<PeriodResult, 'id' | 'created_at'>): Promise<PeriodResult> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('period_results')
      .insert(periodResult)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Bulk insert period results (requires service role)
   */
  async insertMany(periodResults: Array<Omit<PeriodResult, 'id' | 'created_at'>>): Promise<PeriodResult[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('period_results')
      .insert(periodResults)
      .select();

    if (error) throw error;
    return data || [];
  },

  /**
   * Update won_two_plus_reg_periods flag for a team in a game
   */
  async updateTwoPlusRegPeriods(gameId: string, teamCode: string, value: boolean): Promise<void> {
    const admin = supabaseAdmin();
    const { error } = await admin
      .from('period_results')
      .update({ won_two_plus_reg_periods: value })
      .eq('game_id', gameId)
      .eq('team_code', teamCode);

    if (error) throw error;
  },
};

/**
 * Helper function to calculate if team won 2+ regulation periods
 */
export async function calculateWonTwoPlusRegPeriods(gameId: string, teamCode: string): Promise<boolean> {
  const periodResults = await periodResultQueries.getByGame(gameId);

  const regulationWins = periodResults
    .filter(p => p.team_code === teamCode)
    .filter(p => p.period_number <= 3) // Regulation periods only
    .filter(p => p.period_outcome === 'WIN')
    .length;

  return regulationWins >= 2;
}

/**
 * Advanced Query Builders for query_linescore_data tool
 * Pattern implementations from contracts/query-tool.md
 */

export interface TeamPeriodPerformanceRow {
  game_date: string;
  home_team_code: string;
  away_team_code: string;
  period_number: number;
  goals_for: number;
  goals_against: number;
  empty_net_goals: number;
  period_outcome: string;
}

export interface PeriodWinRankingRow {
  team_code: string;
  team_name: string;
  periods_won: number;
}

export interface TwoPlusRegPeriodsRow {
  game_date: string;
  team_code: string;
  home_team_code: string;
  away_team_code: string;
  regulation_periods_won: number;
}

/**
 * Pattern 1: Team Period Performance (User Story 1)
 * Get period-by-period results for a team in a date range
 */
export async function queryTeamPeriodPerformance(
  teamCode: string,
  startDate: string,
  endDate: string,
  limit: number = 100
): Promise<TeamPeriodPerformanceRow[]> {
  const { data, error } = await supabase.rpc('query_team_period_performance', {
    p_team_code: teamCode,
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
  });

  if (error) {
    // Fallback to TypeScript query if RPC not available
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('period_results')
      .select(`
        game_id,
        period_number,
        goals_for,
        goals_against,
        empty_net_goals,
        period_outcome,
        games!inner(
          game_date,
          home_team_code,
          away_team_code
        )
      `)
      .eq('team_code', teamCode)
      .gte('games.game_date', startDate)
      .lte('games.game_date', endDate)
      .order('games.game_date', { ascending: true })
      .order('period_number', { ascending: true })
      .limit(limit);

    if (fallbackError) throw fallbackError;

    // Transform to expected format
    return (fallbackData || []).map((row: any) => ({
      game_date: row.games.game_date,
      home_team_code: row.games.home_team_code,
      away_team_code: row.games.away_team_code,
      period_number: row.period_number,
      goals_for: row.goals_for,
      goals_against: row.goals_against,
      empty_net_goals: row.empty_net_goals,
      period_outcome: row.period_outcome,
    }));
  }

  return data || [];
}

/**
 * Pattern 2: Period Win Rankings (User Story 2)
 * Get teams ranked by period wins in a date range
 */
export async function queryPeriodWinRankings(
  periodOutcome: 'WIN' | 'LOSS' | 'TIE',
  startDate: string,
  endDate: string,
  limit: number = 100
): Promise<PeriodWinRankingRow[]> {
  const { data, error } = await supabase
    .from('period_results')
    .select(`
      team_code,
      teams!inner(team_name),
      games!inner(game_date)
    `)
    .eq('period_outcome', periodOutcome)
    .gte('games.game_date', startDate)
    .lte('games.game_date', endDate);

  if (error) throw error;

  // Aggregate by team_code
  const aggregated = new Map<string, { team_name: string; count: number }>();

  for (const row of data || []) {
    const teamCode = row.team_code;
    const teamName = (row.teams as any).team_name;

    if (aggregated.has(teamCode)) {
      aggregated.get(teamCode)!.count++;
    } else {
      aggregated.set(teamCode, { team_name: teamName, count: 1 });
    }
  }

  // Convert to array and sort
  const results: PeriodWinRankingRow[] = Array.from(aggregated.entries())
    .map(([team_code, { team_name, count }]) => ({
      team_code,
      team_name,
      periods_won: count,
    }))
    .sort((a, b) => {
      // Sort by periods_won descending, then by team_code ascending
      if (b.periods_won !== a.periods_won) {
        return b.periods_won - a.periods_won;
      }
      return a.team_code.localeCompare(b.team_code);
    })
    .slice(0, limit);

  return results;
}

/**
 * Pattern 3: Two Plus Regulation Periods (User Story 3)
 * Get games where a team won 2+ regulation periods
 */
export async function queryTwoPlusRegPeriods(
  teamCode: string,
  limit: number = 100
): Promise<TwoPlusRegPeriodsRow[]> {
  const { data, error } = await supabase
    .from('period_results')
    .select(`
      game_id,
      team_code,
      period_number,
      period_outcome,
      games!inner(
        game_date,
        home_team_code,
        away_team_code
      )
    `)
    .eq('team_code', teamCode)
    .eq('won_two_plus_reg_periods', true)
    .lte('period_number', 3) // Regulation periods only
    .order('games.game_date', { ascending: false });

  if (error) throw error;

  // Group by game_id and count wins
  const gameMap = new Map<string, {
    game_date: string;
    home_team_code: string;
    away_team_code: string;
    wins: number;
  }>();

  for (const row of data || []) {
    const gameId = row.game_id;
    const game = (row.games as any);

    if (!gameMap.has(gameId)) {
      gameMap.set(gameId, {
        game_date: game.game_date,
        home_team_code: game.home_team_code,
        away_team_code: game.away_team_code,
        wins: 0,
      });
    }

    if (row.period_outcome === 'WIN') {
      gameMap.get(gameId)!.wins++;
    }
  }

  // Convert to array, filter for 2+ wins, and limit
  const results: TwoPlusRegPeriodsRow[] = Array.from(gameMap.entries())
    .filter(([_, game]) => game.wins >= 2)
    .map(([_, game]) => ({
      game_date: game.game_date,
      team_code: teamCode,
      home_team_code: game.home_team_code,
      away_team_code: game.away_team_code,
      regulation_periods_won: game.wins,
    }))
    .slice(0, limit);

  return results;
}
