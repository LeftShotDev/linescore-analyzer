# Tool Contract: add_games_from_api

**Purpose**: Fetch game data from NHL Public API and insert it into the database with validated period-by-period results and empty net goal tracking.

**Constitution Alignment**: Data Accuracy & Integrity Principle I, Tool-Driven Architecture Principle II

## Tool Definition

```typescript
{
  name: "add_games_from_api",
  description: "Fetch and store NHL game data from the official NHL API. Use this when the user wants to populate the database with new games, update current season data, or import specific date ranges. Validates data before insertion.",
  parameters: {
    type: "object",
    properties: {
      startDate: {
        type: "string",
        description: "Start date to fetch games from in YYYY-MM-DD format",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      endDate: {
        type: "string",
        description: "End date to fetch games until in YYYY-MM-DD format. Must be >= startDate and <= today.",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      season: {
        type: "string",
        description: "NHL season to fetch (e.g., '2024-2025'). Optional - if omitted, derives from dates.",
        pattern: "^\\d{4}-\\d{4}$"
      },
      skipExisting: {
        type: "boolean",
        description: "If true, skip games already in database. If false, update existing games. Default true.",
        default: true
      }
    },
    required: ["startDate", "endDate"]
  }
}
```

## Input Validation

### Pre-execution Checks

1. **Date Range**: Ensure `startDate <= endDate`
2. **Future Dates**: Reject `endDate` > today (cannot fetch future games)
3. **Date Range Size**: Warn if > 30 days (large dataset, may take time)
4. **Season Validation**: If provided, validate format "YYYY-YYYY" with consecutive years
5. **Season Derivation**: If not provided, derive from `startDate` (Oct-Apr spans two calendar years)

### Validation Errors

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR",
    message: string,
    field: string,
    suggestion: string
  }
}
```

## NHL API Integration

### API Endpoints Used

1. **Schedule Endpoint**: Get list of games in date range
   ```
   GET https://statsapi.web.nhl.com/api/v1/schedule?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   ```

2. **Game Feed Endpoint**: Get detailed game data including linescore
   ```
   GET https://statsapi.web.nhl.com/api/v1/game/{gameId}/feed/live
   ```

3. **Teams Endpoint**: Get team information (called once, cached)
   ```
   GET https://statsapi.web.nhl.com/api/v1/teams
   ```

### Rate Limiting Strategy (FR-016)

- **Max requests per second**: 2 requests/sec
- **Retry on 429**: Exponential backoff (1s, 2s, 4s)
- **Timeout**: 10 seconds per request
- **Batch processing**: Process games in chunks of 10

### Data Extraction

From NHL API game feed response, extract:

```typescript
{
  game: {
    gamePk: string,              // → games.game_id
    gameDate: string,            // → games.game_date
    season: string,              // → games.season
    gameType: string             // → games.game_type
  },
  teams: {
    home: {
      team: { triCode: string }, // → games.home_team_code
      // (standing derived from standings API)
    },
    away: {
      team: { triCode: string }, // → games.away_team_code
      // (standing derived from standings API)
    }
  },
  linescore: {
    periods: [{
      num: number,               // → period_results.period_number
      home: {
        goals: number,           // → period_results.goals_for (for home team)
        rinkSide: string
      },
      away: {
        goals: number,           // → period_results.goals_for (for away team)
        rinkSide: string
      }
    }]
  },
  // Empty net goals extracted from play-by-play data
  plays: {
    allPlays: [{
      result: {
        eventTypeId: string,     // "GOAL"
        emptyNet: boolean        // → period_results.empty_net_goals (count by period)
      },
      about: {
        period: number
      }
    }]
  }
}
```

## Data Transformation

### Period Outcome Calculation

For each period and each team:

```typescript
function transformPeriodData(
  teamCode: string,
  gameId: string,
  period: NHLPeriod,
  emptyNetGoals: number,
  opponentGoals: number
): PeriodResult {
  const goalsFor = period[teamCode].goals;
  const goalsAgainst = opponentGoals;

  // Special handling for period 3 (FR-008)
  const adjustedGoalsFor = period.num === 3
    ? goalsFor - emptyNetGoals
    : goalsFor;

  const periodOutcome =
    adjustedGoalsFor > goalsAgainst ? 'WIN' :
    adjustedGoalsFor < goalsAgainst ? 'LOSS' :
    'TIE';

  return {
    id: generateUUID(),
    game_id: gameId,
    team_code: teamCode,
    period_number: period.num,
    period_type: period.num <= 3 ? 'REGULATION' : period.num === 4 ? 'OT' : 'SO',
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    empty_net_goals: emptyNetGoals,
    period_outcome: periodOutcome,
    won_two_plus_reg_periods: false  // Calculated after all periods inserted
  };
}
```

### Two Plus Regulation Periods Calculation

After inserting all periods for a game:

```typescript
async function updateTwoPlusRegPeriods(gameId: string) {
  // For each team in this game
  for (const teamCode of [homeTeamCode, awayTeamCode]) {
    const regulationWins = await db
      .from('period_results')
      .select('period_outcome')
      .eq('game_id', gameId)
      .eq('team_code', teamCode)
      .lte('period_number', 3)  // Regulation only
      .eq('period_outcome', 'WIN');

    const wonTwoPlus = regulationWins.length >= 2;

    await db
      .from('period_results')
      .update({ won_two_plus_reg_periods: wonTwoPlus })
      .eq('game_id', gameId)
      .eq('team_code', teamCode);
  }
}
```

## Data Validation (FR-015)

Before inserting any game, validate:

1. **Team Codes Exist**: Both home and away teams must exist in `teams` table
2. **Period Completeness**: All regulation periods (1-3) must be present
3. **Goal Consistency**: For each period, home.goals_against must equal away.goals_for
4. **Empty Net Bounds**: Empty net goals cannot exceed total goals for that period
5. **Date Validity**: Game date is not in future
6. **Duplicate Prevention**: If `skipExisting=true`, check if game_id already exists

### Validation Failure Handling

- **Failed Validation**: Skip game, log error, continue with next game
- **Partial Success**: Some games succeed, some fail → return summary
- **Complete Failure**: All games fail validation → return error

## Database Transaction

Insert operations are wrapped in transaction to ensure consistency:

```typescript
async function insertGame(gameData: GameData) {
  const transaction = await db.transaction(async (tx) => {
    // 1. Insert into games table
    await tx.from('games').insert({
      game_id: gameData.gameId,
      game_date: gameData.date,
      season: gameData.season,
      home_team_code: gameData.homeTeam,
      away_team_code: gameData.awayTeam,
      game_type: gameData.gameType,
      home_team_standing: gameData.homeStanding,
      away_team_standing: gameData.awayStanding
    });

    // 2. Insert period results for both teams
    for (const periodResult of gameData.periodResults) {
      await tx.from('period_results').insert(periodResult);
    }

    // 3. Update won_two_plus_reg_periods flags
    await updateTwoPlusRegPeriods(gameData.gameId, tx);
  });

  return transaction;
}
```

## Output Format

### Success Response

```typescript
{
  success: true,
  data: {
    games_processed: number,        // Total games attempted
    games_inserted: number,         // Successfully inserted
    games_updated: number,          // Updated (if skipExisting=false)
    games_skipped: number,          // Skipped (already exist)
    games_failed: number,           // Failed validation
    date_range: {
      start: string,
      end: string
    },
    processing_time_ms: number,
    failures: Array<{              // Details of failed games
      game_id: string,
      date: string,
      error: string
    }>
  }
}
```

### Example Success Response

```json
{
  "success": true,
  "data": {
    "games_processed": 45,
    "games_inserted": 42,
    "games_updated": 0,
    "games_skipped": 3,
    "games_failed": 0,
    "date_range": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    },
    "processing_time_ms": 12450,
    "failures": []
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    type: "API_ERROR" | "VALIDATION_ERROR" | "DATABASE_ERROR" | "RATE_LIMIT",
    message: string,
    details?: any,
    suggestion: string
  }
}
```

## Error Handling

### NHL API Errors

| HTTP Status | Handling |
|-------------|----------|
| 404 | Game not found - skip and continue |
| 429 | Rate limited - exponential backoff retry (max 3 attempts) |
| 500/502/503 | Server error - retry once after 5 seconds |
| Timeout | Retry once, then skip game |

### Error Recovery (FR-013)

1. **API failure**: Retry with exponential backoff
2. **Validation failure**: Skip game, log details, continue
3. **Database error**: Roll back transaction, return error
4. **Partial success**: Continue processing, return summary with failures

## Performance Expectations

- **Single game**: ~2 seconds (API fetch + processing + insert)
- **Daily games** (~12 games): ~24 seconds
- **Monthly games** (~370 games): ~12 minutes
- **Rate limiting**: Ensures compliance with NHL API terms

## Security

- **Read-only API**: NHL API is public, no authentication needed
- **SQL Injection Prevention**: All inserts use parameterized queries
- **Input Sanitization**: All NHL API data validated before insertion
- **Transaction Safety**: Database rollback on any insertion failure

## Testing Requirements

Unit tests must validate:
1. Period outcome calculation with empty net goal exclusion
2. Two plus regulation periods calculation
3. Data transformation from NHL API format to database schema
4. Validation logic (team existence, goal consistency, etc.)
5. Error handling for malformed API responses

Integration tests must validate:
6. End-to-end game insertion from real NHL API
7. Transaction rollback on validation failure
8. Rate limiting compliance
9. Handling of already-existing games (skipExisting flag)
10. Empty net goal counting from play-by-play data
