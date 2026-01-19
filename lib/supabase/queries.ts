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
