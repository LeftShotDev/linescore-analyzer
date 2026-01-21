// NHL API data transformers
// Convert NHL API responses to database schema format
// Constitution Principle IV: Period Analysis Accuracy

import type {
  NHLGameFeed,
  NHLPlay,
  NHLScheduleGame,
  NHLPeriod,
} from './types';
import type { Game, PeriodResult } from '../supabase/queries';

/**
 * Calculate period outcome (WIN/LOSS/TIE)
 * Constitution Principle IV: Exclude empty net goals from period 3
 */
export function calculatePeriodOutcome(
  periodNumber: number,
  goalsFor: number,
  goalsAgainst: number,
  emptyNetGoals: number
): 'WIN' | 'LOSS' | 'TIE' {
  // Special case: Exclude empty net goals from 3rd period (FR-008)
  const adjustedGoalsFor = periodNumber === 3
    ? goalsFor - emptyNetGoals
    : goalsFor;

  if (adjustedGoalsFor > goalsAgainst) return 'WIN';
  if (adjustedGoalsFor < goalsAgainst) return 'LOSS';
  return 'TIE';
}

/**
 * Calculate if team won 2 or more regulation periods
 * Core hypothesis: teams winning 2+ regulation periods succeed in playoffs
 */
export function calculateWonTwoPlusRegPeriods(
  periodResults: Array<{ periodNumber: number; periodOutcome: 'WIN' | 'LOSS' | 'TIE' }>
): boolean {
  const regulationWins = periodResults
    .filter(p => p.periodNumber <= 3) // Only periods 1, 2, 3
    .filter(p => p.periodOutcome === 'WIN')
    .length;

  return regulationWins >= 2;
}

/**
 * Extract empty net goals from play-by-play data
 * Returns count of EN goals by period for each team
 */
export function extractEmptyNetGoals(
  plays: NHLPlay[],
  homeTeamId: number,
  awayTeamId: number
): Map<string, Map<number, number>> {
  // Map structure: teamId -> period -> EN goal count
  const enGoals = new Map<string, Map<number, number>>();

  // Initialize for both teams
  enGoals.set(homeTeamId.toString(), new Map());
  enGoals.set(awayTeamId.toString(), new Map());

  // Count empty net goals by period for each team
  for (const play of plays) {
    if (
      play.result.eventTypeId === 'GOAL' &&
      play.result.emptyNet === true &&
      play.team
    ) {
      const teamId = play.team.id.toString();
      const period = play.about.period;

      const teamMap = enGoals.get(teamId);
      if (teamMap) {
        teamMap.set(period, (teamMap.get(period) || 0) + 1);
      }
    }
  }

  return enGoals;
}

/**
 * Convert NHL season format (20242025) to database format (2024-2025)
 */
export function formatSeasonString(nhlSeason: string): string {
  if (nhlSeason.length === 8) {
    const year1 = nhlSeason.substring(0, 4);
    const year2 = nhlSeason.substring(4, 8);
    return `${year1}-${year2}`;
  }
  return nhlSeason; // Already formatted
}

/**
 * Convert NHL game type code to readable format
 */
export function formatGameType(gameTypeCode: string): string {
  switch (gameTypeCode) {
    case 'R':
      return 'Regular Season';
    case 'P':
      return 'Playoffs';
    case 'PR':
      return 'Preseason';
    case 'A':
      return 'All-Star';
    default:
      return gameTypeCode;
  }
}

/**
 * Transform NHL schedule game to database Game format
 * Used for initial game metadata before fetching full details
 */
export function transformScheduleGame(
  scheduleGame: NHLScheduleGame
): Omit<Game, 'home_team_standing' | 'away_team_standing'> {
  return {
    game_id: scheduleGame.gamePk.toString(),
    game_date: scheduleGame.gameDate.split('T')[0], // Extract YYYY-MM-DD
    season: formatSeasonString(scheduleGame.season),
    home_team_code: scheduleGame.teams.home.team.abbreviation,
    away_team_code: scheduleGame.teams.away.team.abbreviation,
    game_type: formatGameType(scheduleGame.gameType),
  };
}

/**
 * Calculate period summaries from play-by-play data
 * New API doesn't provide period summaries, so we calculate from goal events
 */
function calculatePeriodSummaries(
  plays: NHLPlay[],
  homeTeamId: number,
  awayTeamId: number
): NHLPeriod[] {
  // Group goal events by period
  const periodMap = new Map<number, {
    homeGoals: number;
    awayGoals: number;
    periodType: string;
  }>();

  // Filter for goal events and group by period
  const goalPlays = plays.filter(p => p.result.eventTypeId === 'GOAL' || p.result.event === 'goal');

  for (const play of goalPlays) {
    const period = play.about.period;
    const teamId = play.team?.id;

    if (!periodMap.has(period)) {
      periodMap.set(period, {
        homeGoals: 0,
        awayGoals: 0,
        periodType: play.about.periodType,
      });
    }

    const periodData = periodMap.get(period)!;
    if (teamId === homeTeamId) {
      periodData.homeGoals++;
    } else if (teamId === awayTeamId) {
      periodData.awayGoals++;
    }
  }

  // Build period summaries array
  const periods: NHLPeriod[] = [];
  const maxPeriod = Math.max(...Array.from(periodMap.keys()), 3); // At least 3 periods

  for (let i = 1; i <= maxPeriod; i++) {
    const data = periodMap.get(i) || { homeGoals: 0, awayGoals: 0, periodType: 'REGULAR' };

    periods.push({
      periodType: data.periodType,
      num: i,
      ordinalNum: i <= 3 ? `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : 'rd'}` : data.periodType,
      startTime: '',
      endTime: '',
      home: {
        goals: data.homeGoals,
        shotsOnGoal: 0,
        rinkSide: '',
      },
      away: {
        goals: data.awayGoals,
        shotsOnGoal: 0,
        rinkSide: '',
      },
    });
  }

  return periods;
}

/**
 * Transform NHL game feed to database Game and PeriodResult format
 * This is the main transformation function for complete game data
 */
export function transformGameFeed(
  gameFeed: NHLGameFeed,
  homeStanding?: number,
  awayStanding?: number
): {
  game: Game;
  periodResults: Array<Omit<PeriodResult, 'id'>>;
} {
  const { gameData, liveData } = gameFeed;
  const { linescore, plays } = liveData;

  // Extract team information
  const homeTeamCode = linescore.teams.home.team.abbreviation;
  const awayTeamCode = linescore.teams.away.team.abbreviation;
  const homeTeamId = linescore.teams.home.team.id;
  const awayTeamId = linescore.teams.away.team.id;

  // Extract empty net goals by period for each team
  const enGoals = extractEmptyNetGoals(plays.allPlays, homeTeamId, awayTeamId);

  // Transform game metadata
  const game: Game = {
    game_id: gameData.gamePk.toString(),
    game_date: gameData.gameDate.split('T')[0],
    season: formatSeasonString(gameData.season),
    home_team_code: homeTeamCode,
    away_team_code: awayTeamCode,
    game_type: formatGameType(gameData.gameType),
    home_team_standing: homeStanding || null,
    away_team_standing: awayStanding || null,
  };

  // Calculate period summaries from plays if not available in linescore
  const periods = linescore.periods && linescore.periods.length > 0
    ? linescore.periods
    : calculatePeriodSummaries(plays.allPlays, homeTeamId, awayTeamId);

  // Transform period results for both teams
  const periodResults: Array<Omit<PeriodResult, 'id'>> = [];

  for (const period of periods) {
    const periodNumber = period.num;
    const periodType = period.num <= 3 ? 'REGULATION' : period.num === 4 ? 'OT' : 'SO';

    // Get empty net goals for this period
    const homeEnGoals = enGoals.get(homeTeamId.toString())?.get(periodNumber) || 0;
    const awayEnGoals = enGoals.get(awayTeamId.toString())?.get(periodNumber) || 0;

    // Home team period result
    const homeOutcome = calculatePeriodOutcome(
      periodNumber,
      period.home.goals,
      period.away.goals,
      homeEnGoals
    );

    periodResults.push({
      game_id: game.game_id,
      team_code: homeTeamCode,
      period_number: periodNumber,
      period_type: periodType as 'REGULATION' | 'OT' | 'SO',
      goals_for: period.home.goals,
      goals_against: period.away.goals,
      empty_net_goals: homeEnGoals,
      period_outcome: homeOutcome,
      won_two_plus_reg_periods: false, // Calculated after all periods processed
    });

    // Away team period result
    const awayOutcome = calculatePeriodOutcome(
      periodNumber,
      period.away.goals,
      period.home.goals,
      awayEnGoals
    );

    periodResults.push({
      game_id: game.game_id,
      team_code: awayTeamCode,
      period_number: periodNumber,
      period_type: periodType as 'REGULATION' | 'OT' | 'SO',
      goals_for: period.away.goals,
      goals_against: period.home.goals,
      empty_net_goals: awayEnGoals,
      period_outcome: awayOutcome,
      won_two_plus_reg_periods: false, // Calculated after all periods processed
    });
  }

  // Calculate won_two_plus_reg_periods for both teams
  const homeRegulationPeriods = periodResults
    .filter(p => p.team_code === homeTeamCode)
    .map(p => ({ periodNumber: p.period_number, periodOutcome: p.period_outcome }));

  const awayRegulationPeriods = periodResults
    .filter(p => p.team_code === awayTeamCode)
    .map(p => ({ periodNumber: p.period_number, periodOutcome: p.period_outcome }));

  const homeWonTwoPlus = calculateWonTwoPlusRegPeriods(homeRegulationPeriods);
  const awayWonTwoPlus = calculateWonTwoPlusRegPeriods(awayRegulationPeriods);

  // Update won_two_plus_reg_periods flag
  for (const result of periodResults) {
    if (result.team_code === homeTeamCode) {
      result.won_two_plus_reg_periods = homeWonTwoPlus;
    } else {
      result.won_two_plus_reg_periods = awayWonTwoPlus;
    }
  }

  return { game, periodResults };
}

/**
 * Validate game data before insertion
 * Ensures data integrity per Constitution Principle I
 */
export function validateGameData(
  game: Game,
  periodResults: Array<Omit<PeriodResult, 'id'>>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate game data
  if (!game.game_id) {
    errors.push('Missing game_id');
  }

  if (!game.game_date || !/^\d{4}-\d{2}-\d{2}$/.test(game.game_date)) {
    errors.push('Invalid game_date format (must be YYYY-MM-DD)');
  }

  if (!game.season || !/^\d{4}-\d{4}$/.test(game.season)) {
    errors.push('Invalid season format (must be YYYY-YYYY)');
  }

  if (game.home_team_code === game.away_team_code) {
    errors.push('Home and away teams cannot be the same');
  }

  if (!/^[A-Z]{3}$/.test(game.home_team_code) || !/^[A-Z]{3}$/.test(game.away_team_code)) {
    errors.push('Invalid team code format (must be 3 uppercase letters)');
  }

  // Validate period results
  if (periodResults.length < 6) {
    // Minimum: 3 regulation periods × 2 teams
    errors.push(`Incomplete period data: expected at least 6 results, got ${periodResults.length}`);
  }

  // Check for regulation periods (1, 2, 3) for both teams
  const homeRegPeriods = periodResults
    .filter(p => p.team_code === game.home_team_code && p.period_number <= 3)
    .map(p => p.period_number);

  const awayRegPeriods = periodResults
    .filter(p => p.team_code === game.away_team_code && p.period_number <= 3)
    .map(p => p.period_number);

  if (homeRegPeriods.length < 3) {
    errors.push(`Missing regulation periods for home team: ${homeRegPeriods.join(', ')}`);
  }

  if (awayRegPeriods.length < 3) {
    errors.push(`Missing regulation periods for away team: ${awayRegPeriods.join(', ')}`);
  }

  // Validate goal consistency (home goals_for = away goals_against for each period)
  for (const period of periodResults.filter(p => p.team_code === game.home_team_code)) {
    const awayPeriod = periodResults.find(
      p => p.team_code === game.away_team_code && p.period_number === period.period_number
    );

    if (awayPeriod) {
      if (period.goals_for !== awayPeriod.goals_against) {
        errors.push(
          `Goal mismatch in period ${period.period_number}: ` +
          `home scored ${period.goals_for}, away conceded ${awayPeriod.goals_against}`
        );
      }

      if (period.goals_against !== awayPeriod.goals_for) {
        errors.push(
          `Goal mismatch in period ${period.period_number}: ` +
          `home conceded ${period.goals_against}, away scored ${awayPeriod.goals_for}`
        );
      }
    }
  }

  // Validate empty net goals don't exceed total goals
  for (const period of periodResults) {
    if (period.empty_net_goals > period.goals_for) {
      errors.push(
        `Empty net goals (${period.empty_net_goals}) exceed total goals (${period.goals_for}) ` +
        `for ${period.team_code} in period ${period.period_number}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
