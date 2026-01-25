// Tool 1: Query Period Data from Supabase (Unique Dataset)
// Queries the period_results and games tables for NHL period analysis

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';

export const queryPeriodDataTool = new DynamicStructuredTool({
  name: 'query_period_data',
  description: `Query NHL period-by-period data from the database. Use this tool to:
    - Get period results for specific teams
    - Analyze period win/loss/tie patterns
    - Find games within date ranges
    - Calculate period outcomes
    This tool queries the unique dataset stored in Supabase containing detailed period-by-period game data.`,
  schema: z.object({
    teamCode: z.string().optional().describe('3-letter NHL team code (e.g., CAR, TBL, COL)'),
    startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
    endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
    periodOutcome: z.enum(['WIN', 'LOSS', 'TIE']).optional().describe('Filter by period outcome'),
    periodNumber: z.number().min(1).max(5).optional().describe('Filter by period number (1-3 regulation, 4 OT, 5 SO)'),
    limit: z.number().min(1).max(100).default(50).describe('Maximum number of results to return'),
  }),
  func: async ({ teamCode, startDate, endDate, periodOutcome, periodNumber, limit }) => {
    try {
      // Build the query
      let query = supabase
        .from('period_results')
        .select(`
          *,
          games (
            game_id,
            game_date,
            season,
            home_team_code,
            away_team_code,
            game_type
          )
        `)
        .limit(limit);

      // Apply filters
      if (teamCode) {
        query = query.eq('team_code', teamCode.toUpperCase());
      }

      if (periodOutcome) {
        query = query.eq('period_outcome', periodOutcome);
      }

      if (periodNumber) {
        query = query.eq('period_number', periodNumber);
      }

      // Execute query
      const { data, error } = await query;

      if (error) {
        return JSON.stringify({
          success: false,
          error: error.message,
          suggestion: 'Check if the database tables exist and have data.',
        });
      }

      // Filter by date range if provided (requires join with games table)
      let filteredData = data || [];
      if (startDate || endDate) {
        filteredData = filteredData.filter((row: any) => {
          const gameDate = row.games?.game_date;
          if (!gameDate) return false;
          if (startDate && gameDate < startDate) return false;
          if (endDate && gameDate > endDate) return false;
          return true;
        });
      }

      // Calculate summary statistics
      const summary = {
        total_records: filteredData.length,
        period_wins: filteredData.filter((r: any) => r.period_outcome === 'WIN').length,
        period_losses: filteredData.filter((r: any) => r.period_outcome === 'LOSS').length,
        period_ties: filteredData.filter((r: any) => r.period_outcome === 'TIE').length,
        games_with_two_plus_wins: filteredData.filter((r: any) => r.won_two_plus_reg_periods).length,
      };

      return JSON.stringify({
        success: true,
        summary,
        data: filteredData.slice(0, 20), // Return first 20 for readability
        total_available: filteredData.length,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'An unexpected error occurred. Please try again.',
      });
    }
  },
});
