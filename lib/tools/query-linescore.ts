// query_linescore_data tool implementation
// Execute SELECT queries against period results database
// Tool Contract: specs/001-period-analyzer/contracts/query-tool.md

import { z } from 'zod';
import {
  teamQueries,
  queryTeamPeriodPerformance,
  queryPeriodWinRankings,
  queryTwoPlusRegPeriods,
  type TeamPeriodPerformanceRow,
  type PeriodWinRankingRow,
  type TwoPlusRegPeriodsRow,
} from '../supabase/queries';

// Tool parameter schema with validation
export const queryLinescoreToolSchema = z.object({
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
  periodOutcome: z.enum(['WIN', 'LOSS', 'TIE']).optional().nullable(),
  wonTwoPlusRegPeriods: z.boolean().optional(),
  season: z.string()
    .regex(/^\d{4}-\d{4}$/, 'Season must be in YYYY-YYYY format')
    .optional(),
  limit: z.number().min(1).max(1000).default(100),
});

export type QueryLinescoreToolParams = z.infer<typeof queryLinescoreToolSchema>;

interface QueryMetadata {
  execution_time_ms: number;
  was_limited: boolean;
  filters_applied: string[];
}

interface QueryLinescoreToolResult {
  success: boolean;
  data?: {
    results: Array<TeamPeriodPerformanceRow | PeriodWinRankingRow | TwoPlusRegPeriodsRow>;
    count: number;
    query_metadata: QueryMetadata;
  };
  error?: {
    type: 'QUERY_ERROR' | 'VALIDATION_ERROR' | 'DATABASE_ERROR';
    message: string;
    details?: any;
    suggestion: string;
  };
}

/**
 * Validate input parameters
 * Returns valid team codes if team not found
 */
async function validateParams(params: QueryLinescoreToolParams): Promise<{ valid: boolean; error?: string; suggestion?: string }> {
  // Validate team code if provided
  if (params.teamCode) {
    const teamExists = await teamQueries.exists(params.teamCode);
    if (!teamExists) {
      // Get all valid team codes for suggestion
      const allTeams = await teamQueries.getAll();
      const validCodes = allTeams.map(t => t.team_code).sort().join(', ');

      return {
        valid: false,
        error: `Team code '${params.teamCode}' not found in database`,
        suggestion: `Valid team codes: ${validCodes}`,
      };
    }
  }

  // Validate date range if both provided
  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);

    if (start > end) {
      return {
        valid: false,
        error: 'Start date must be before or equal to end date',
        suggestion: 'Check your date range and try again',
      };
    }
  }

  // Validate season format if provided
  if (params.season) {
    const [year1, year2] = params.season.split('-').map(Number);
    if (year2 !== year1 + 1) {
      return {
        valid: false,
        error: 'Invalid season format',
        suggestion: 'Season must be in format YYYY-YYYY where second year is first year + 1 (e.g., 2024-2025)',
      };
    }
  }

  return { valid: true };
}

/**
 * Determine query pattern based on parameters
 * Returns which SQL pattern to use
 */
function determineQueryPattern(params: QueryLinescoreToolParams): 'team_period_performance' | 'period_win_rankings' | 'two_plus_reg_periods' {
  // Pattern 3: Two Plus Regulation Periods
  if (params.wonTwoPlusRegPeriods && params.teamCode) {
    return 'two_plus_reg_periods';
  }

  // Pattern 2: Period Win Rankings
  if (params.periodOutcome && !params.teamCode) {
    return 'period_win_rankings';
  }

  // Pattern 1: Team Period Performance (default)
  return 'team_period_performance';
}

/**
 * Execute query based on pattern
 */
async function executeQuery(
  pattern: string,
  params: QueryLinescoreToolParams
): Promise<Array<TeamPeriodPerformanceRow | PeriodWinRankingRow | TwoPlusRegPeriodsRow>> {
  const { teamCode, startDate, endDate, periodOutcome, limit } = params;

  switch (pattern) {
    case 'team_period_performance':
      if (!teamCode || !startDate || !endDate) {
        throw new Error('Team code, start date, and end date are required for period performance queries');
      }
      return await queryTeamPeriodPerformance(teamCode, startDate, endDate, limit);

    case 'period_win_rankings':
      if (!periodOutcome || !startDate || !endDate) {
        throw new Error('Period outcome, start date, and end date are required for win ranking queries');
      }
      return await queryPeriodWinRankings(periodOutcome, startDate, endDate, limit);

    case 'two_plus_reg_periods':
      if (!teamCode) {
        throw new Error('Team code is required for two plus regulation periods queries');
      }
      return await queryTwoPlusRegPeriods(teamCode, limit);

    default:
      throw new Error(`Unknown query pattern: ${pattern}`);
  }
}

/**
 * Build list of applied filters for metadata
 */
function getAppliedFilters(params: QueryLinescoreToolParams): string[] {
  const filters: string[] = [];

  if (params.teamCode) filters.push('teamCode');
  if (params.startDate && params.endDate) filters.push('dateRange');
  if (params.periodOutcome) filters.push('periodOutcome');
  if (params.wonTwoPlusRegPeriods) filters.push('wonTwoPlusRegPeriods');
  if (params.season) filters.push('season');

  return filters;
}

/**
 * Main tool implementation: Query linescore data
 */
export async function queryLinescoreData(params: QueryLinescoreToolParams): Promise<QueryLinescoreToolResult> {
  const startTime = Date.now();

  try {
    // Validate parameters (T030)
    const validation = await validateParams(params);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: validation.error || 'Invalid parameters',
          suggestion: validation.suggestion || 'Check your parameters and try again',
        },
      };
    }

    // Determine which query pattern to use (T031)
    const pattern = determineQueryPattern(params);

    // Execute query (T031)
    let results: Array<TeamPeriodPerformanceRow | PeriodWinRankingRow | TwoPlusRegPeriodsRow>;

    try {
      results = await executeQuery(pattern, params);
    } catch (error) {
      // Query execution error - provide context for LLM retry (T032)
      return {
        success: false,
        error: {
          type: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Query execution failed',
          details: error,
          suggestion: 'Try adjusting your query parameters. Make sure all required fields are provided.',
        },
      };
    }

    // Handle empty results
    if (results.length === 0) {
      return {
        success: false,
        error: {
          type: 'QUERY_ERROR',
          message: 'No results found for the given filters',
          suggestion: 'Try expanding your date range or removing some filters',
        },
      };
    }

    // Check if results were limited
    const wasLimited = results.length === params.limit;

    // Build metadata (T033)
    const executionTime = Date.now() - startTime;
    const appliedFilters = getAppliedFilters(params);

    return {
      success: true,
      data: {
        results,
        count: results.length,
        query_metadata: {
          execution_time_ms: executionTime,
          was_limited: wasLimited,
          filters_applied: appliedFilters,
        },
      },
    };
  } catch (error) {
    // Database or unexpected error (T032)
    return {
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown database error',
        details: error,
        suggestion: 'Database connection may be unavailable. Please try again.',
      },
    };
  }
}

// Export tool definition for Vercel AI SDK
export const queryLinescoreToolDefinition = {
  description: 'Query NHL game and period data from the database. Use this when the user asks about team performance, period results, game history, or statistics. Translates user intent into SQL queries and returns results.',
  parameters: queryLinescoreToolSchema,
  execute: queryLinescoreData,
};
