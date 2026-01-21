// TypeScript types for NHL API responses
// Based on NHL Web API (api-web.nhle.com)
// Legacy types maintained for backward compatibility with transformers

// ============================================================================
// NEW API TYPES (api-web.nhle.com)
// ============================================================================

export interface NewNHLTeam {
  id: number;
  abbrev: string; // 3-letter code
  commonName: {
    default: string;
  };
  placeName: {
    default: string;
  };
  logo: string;
}

export interface NewNHLPeriodDescriptor {
  number: number;
  periodType: string; // "REG", "OT", "SO"
  maxRegulationPeriods: number;
}

export interface NewNHLGame {
  id: number; // Game ID (e.g., 2024020705)
  season: number; // e.g., 20242025
  gameType: number; // 2 = regular season, 3 = playoffs
  gameDate: string; // YYYY-MM-DD
  venue: {
    default: string;
  };
  startTimeUTC: string;
  gameState: string; // "OFF", "LIVE", "FUT", "FINAL"
  gameScheduleState: string;
  awayTeam: NewNHLTeam & {
    score?: number;
  };
  homeTeam: NewNHLTeam & {
    score?: number;
  };
  periodDescriptor: NewNHLPeriodDescriptor;
  gameOutcome?: {
    lastPeriodType: string;
  };
}

export interface NewNHLScheduleResponse {
  gameWeek: Array<{
    date: string;
    dayAbbrev: string;
    numberOfGames: number;
    games: NewNHLGame[];
  }>;
  oddsPartners: any[];
  preSeasonStartDate: string;
  regularSeasonStartDate: string;
  regularSeasonEndDate: string;
  playoffEndDate: string;
  numberOfGames: number;
}

export interface NewNHLPlay {
  eventId: number;
  periodDescriptor: NewNHLPeriodDescriptor;
  timeInPeriod: string;
  timeRemaining: string;
  situationCode: string;
  homeTeamDefendingSide: string;
  typeCode: number; // 505 = goal, etc.
  typeDescKey: string; // "goal", "shot", etc.
  sortOrder: number;
  details?: {
    eventOwnerTeamId?: number;
    scoringPlayerId?: number;
    scoringPlayerTotal?: number;
    assist1PlayerId?: number;
    assist1PlayerTotal?: number;
    assist2PlayerId?: number;
    assist2PlayerTotal?: number;
    awayScore?: number;
    homeScore?: number;
    goalieInNetId?: number;
    shotType?: string;
    reason?: string;
  };
}

export interface NewNHLPlayByPlayResponse {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  venue: { default: string };
  startTimeUTC: string;
  gameState: string;
  gameScheduleState: string;
  awayTeam: NewNHLTeam & { score: number };
  homeTeam: NewNHLTeam & { score: number };
  periodDescriptor: NewNHLPeriodDescriptor;
  gameOutcome?: {
    lastPeriodType: string;
  };
  plays: NewNHLPlay[];
  // ... other fields we may not need
}

// ============================================================================
// LEGACY API TYPES (statsapi.web.nhl.com) - for backward compatibility
// ============================================================================

export interface NHLTeam {
  id: number;
  name: string;
  abbreviation: string; // 3-letter code
  teamName: string;
  locationName: string;
  division: {
    id: number;
    name: string;
  };
  conference: {
    id: number;
    name: string;
  };
}

export interface NHLPeriod {
  periodType: string; // "REGULAR" | "OVERTIME" | "SHOOTOUT"
  num: number; // 1, 2, 3, 4, 5
  ordinalNum: string; // "1st", "2nd", "3rd", "OT", "SO"
  startTime: string;
  endTime: string;
  home: {
    goals: number;
    shotsOnGoal: number;
    rinkSide: string;
  };
  away: {
    goals: number;
    shotsOnGoal: number;
    rinkSide: string;
  };
}

export interface NHLLinescore {
  currentPeriod: number;
  currentPeriodOrdinal: string;
  currentPeriodTimeRemaining: string;
  periods: NHLPeriod[];
  shootoutInfo?: {
    away: {
      scores: number;
      attempts: number;
    };
    home: {
      scores: number;
      attempts: number;
    };
  };
  teams: {
    home: {
      team: NHLTeam;
      goals: number;
      shotsOnGoal: number;
      goaliePulled: boolean;
      numSkaters: number;
    };
    away: {
      team: NHLTeam;
      goals: number;
      shotsOnGoal: number;
      goaliePulled: boolean;
      numSkaters: number;
    };
  };
  powerPlayStrength: string;
  hasShootout: boolean;
  intermissionInfo?: {
    intermissionTimeRemaining: number;
    intermissionTimeElapsed: number;
    inIntermission: boolean;
  };
}

export interface NHLPlay {
  result: {
    event: string;
    eventCode: string;
    eventTypeId: string; // "GOAL", "SHOT", etc.
    description: string;
    secondaryType?: string;
    strength?: {
      code: string;
      name: string;
    };
    gameWinningGoal?: boolean;
    emptyNet?: boolean;
  };
  about: {
    eventIdx: number;
    eventId: number;
    period: number;
    periodType: string;
    ordinalNum: string;
    periodTime: string;
    periodTimeRemaining: string;
    dateTime: string;
    goals: {
      away: number;
      home: number;
    };
  };
  coordinates?: {
    x: number;
    y: number;
  };
  team?: {
    id: number;
    name: string;
    triCode: string;
  };
}

export interface NHLGameData {
  gamePk: number; // Game ID
  gameDate: string; // ISO 8601 datetime
  season: string; // "20242025"
  gameType: string; // "R" (regular), "P" (playoffs)
  status: {
    abstractGameState: string; // "Live", "Final", "Preview"
    codedGameState: string;
    detailedState: string;
    statusCode: string;
    startTimeTBD: boolean;
  };
  teams: {
    away: {
      team: NHLTeam;
      score: number;
    };
    home: {
      team: NHLTeam;
      score: number;
    };
  };
  venue: {
    name: string;
    link: string;
  };
}

export interface NHLGameFeed {
  gamePk: number;
  gameData: NHLGameData;
  liveData: {
    plays: {
      allPlays: NHLPlay[];
      scoringPlays: number[];
      penaltyPlays: number[];
      playsByPeriod: Array<{
        startIndex: number;
        plays: number[];
        endIndex: number;
      }>;
      currentPlay: NHLPlay;
    };
    linescore: NHLLinescore;
    boxscore: any; // Complex nested structure, can be expanded if needed
    decisions: {
      winner?: any;
      loser?: any;
      firstStar?: any;
      secondStar?: any;
      thirdStar?: any;
    };
  };
}

export interface NHLScheduleGame {
  gamePk: number;
  gameType: string;
  season: string;
  gameDate: string;
  status: {
    abstractGameState: string;
    codedGameState: string;
    detailedState: string;
    statusCode: string;
  };
  teams: {
    away: {
      team: NHLTeam;
      score?: number;
    };
    home: {
      team: NHLTeam;
      score?: number;
    };
  };
  venue: {
    name: string;
  };
  content: {
    link: string;
  };
}

export interface NHLScheduleDate {
  date: string;
  totalItems: number;
  totalEvents: number;
  totalGames: number;
  totalMatches: number;
  games: NHLScheduleGame[];
}

export interface NHLScheduleResponse {
  copyright: string;
  totalItems: number;
  totalEvents: number;
  totalGames: number;
  totalMatches: number;
  dates: NHLScheduleDate[];
}

export interface NHLTeamsResponse {
  copyright: string;
  teams: NHLTeam[];
}

export interface NHLStandingsRecord {
  standingsType: string;
  league: {
    id: number;
    name: string;
  };
  division?: {
    id: number;
    name: string;
  };
  conference?: {
    id: number;
    name: string;
  };
  teamRecords: Array<{
    team: NHLTeam;
    leagueRecord: {
      wins: number;
      losses: number;
      ot: number;
      type: string;
    };
    regulationWins: number;
    goalsAgainst: number;
    goalsScored: number;
    points: number;
    divisionRank: string;
    conferenceRank: string;
    leagueRank: string;
    wildCardRank: string;
    row: number;
    gamesPlayed: number;
    streak: {
      streakType: string;
      streakNumber: number;
      streakCode: string;
    };
  }>;
}

export interface NHLStandingsResponse {
  copyright: string;
  records: NHLStandingsRecord[];
}
