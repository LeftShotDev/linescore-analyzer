# Tool Contract: query_linescore_data

**Purpose**: Execute SELECT queries against the period results database to answer user questions about NHL game and period performance.

**Constitution Alignment**: Tool-Driven Architecture Principle II

## Tool Definition

```typescript
{
  name: "query_linescore_data",
  description: "Query NHL game and period data from the database. Use this when the user asks about team performance, period results, game history, or statistics. Translates user intent into SQL queries and returns results.",
  parameters: {
    type: "object",
    properties: {
      teamCode: {
        type: "string",
        description: "NHL team 3-letter code (e.g., 'CAR', 'TBL', 'DAL'). Required for team-specific queries. Use null for multi-team queries.",
        pattern: "^[A-Z]{3}$|^null$"
      },
      startDate: {
        type: "string",
        description: "Start date for date range query in YYYY-MM-DD format. Required for date-based queries.",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      endDate: {
        type: "string",
        description: "End date for date range query in YYYY-MM-DD format. Must be >= startDate.",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      periodOutcome: {
        type: "string",
        description: "Filter by period outcome: 'WIN', 'LOSS', or 'TIE'. Use for queries about period wins/losses.",
        enum: ["WIN", "LOSS", "TIE", null]
      },
      wonTwoPlusRegPeriods: {
        type: "boolean",
        description: "Filter for teams that won 2 or more regulation periods. Use for hypothesis testing queries.",
      },
      season: {
        type: "string",
        description: "NHL season identifier in format 'YYYY-YYYY' (e.g., '2024-2025'). Optional.",
        pattern: "^\\d{4}-\\d{4}$"
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return. Default 100, max 1000.",
        minimum: 1,
        maximum: 1000
      }
    },
    required: []  // All parameters optional to support various query patterns
  }
}
```

## Input Validation

### Pre-execution Checks

1. **Team Code**: If provided, verify it exists in `teams` table. If not found, return error with list of valid team codes.
2. **Date Range**: If both `startDate` and `endDate` provided, ensure `startDate <=endDate`.
3. **Season Format**: If provided, validate pattern "YYYY-YYYY" where second year = first year + 1.
4. **Limit**: Clamp to range [1, 1000], default to 100 if not provided.

### Validation Errors

Return structured error if validation fails:

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR",
    message: string,  // Human-readable error
    field: string,    // Which parameter failed
    suggestion: string // How to fix (e.g., valid team codes)
  }
}
```

## SQL Generation Patterns

The tool translates parameters into SQL queries following these patterns:

### Pattern 1: Team Period Performance (User Story 1)

**Input**: `{ teamCode: "CAR", startDate: "2025-02-01", endDate: "2025-02-28" }`

**Generated SQL**:
```sql
SELECT
  g.game_date,
  g.home_team_code,
  g.away_team_code,
  pr.period_number,
  pr.goals_for,
  pr.goals_against,
  pr.empty_net_goals,
  pr.period_outcome
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
WHERE pr.team_code = $1
  AND g.game_date >= $2
  AND g.game_date <= $3
ORDER BY g.game_date ASC, pr.period_number ASC
LIMIT $4;
```

### Pattern 2: Period Win Rankings (User Story 2)

**Input**: `{ periodOutcome: "WIN", startDate: "2025-01-01", endDate: "2025-01-31" }`

**Generated SQL**:
```sql
SELECT
  pr.team_code,
  t.team_name,
  COUNT(*) as periods_won
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
JOIN teams t ON pr.team_code = t.team_code
WHERE pr.period_outcome = $1
  AND g.game_date >= $2
  AND g.game_date <= $3
GROUP BY pr.team_code, t.team_name
ORDER BY periods_won DESC, pr.team_code ASC
LIMIT $4;
```

### Pattern 3: Two Plus Regulation Periods (User Story 3)

**Input**: `{ wonTwoPlusRegPeriods: true, teamCode: "CAR" }`

**Generated SQL**:
```sql
SELECT
  g.game_date,
  pr.team_code,
  g.home_team_code,
  g.away_team_code,
  COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END) as regulation_periods_won
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
WHERE pr.won_two_plus_reg_periods = true
  AND pr.team_code = $1
  AND pr.period_number <= 3  -- Regulation periods only
GROUP BY g.game_date, pr.team_code, g.home_team_code, g.away_team_code
ORDER BY g.game_date DESC
LIMIT $2;
```

## Output Format

### Success Response

```typescript
{
  success: true,
  data: {
    results: Array<Record<string, any>>,  // Query result rows
    count: number,                         // Number of rows returned
    query_metadata: {
      execution_time_ms: number,
      was_limited: boolean,                // True if results hit limit
      filters_applied: string[]            // Which parameters were used
    }
  }
}
```

### Example Success Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "game_date": "2025-02-01",
        "home_team_code": "CAR",
        "away_team_code": "TBL",
        "period_number": 1,
        "goals_for": 2,
        "goals_against": 1,
        "empty_net_goals": 0,
        "period_outcome": "WIN"
      },
      ...
    ],
    "count": 45,
    "query_metadata": {
      "execution_time_ms": 123,
      "was_limited": false,
      "filters_applied": ["teamCode", "dateRange"]
    }
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    type: "QUERY_ERROR" | "VALIDATION_ERROR" | "DATABASE_ERROR",
    message: string,
    details?: any,              // Technical details for debugging
    suggestion: string          // How to fix (for LLM retry)
  }
}
```

## Error Handling

### Retry Strategy (Constitution FR-013)

1. **First attempt fails**: Tool returns error with `suggestion` field
2. **LLM retries automatically**: Uses `suggestion` to adjust parameters
3. **Second attempt fails**: Return error to user, ask them to rephrase

### Common Errors

| Error Type | Cause | Suggestion |
|------------|-------|------------|
| INVALID_TEAM_CODE | Team not in database | "Valid team codes: CAR, TBL, DAL, ..." |
| INVALID_DATE_RANGE | start > end | "Start date must be before or equal to end date" |
| NO_RESULTS | Query returned 0 rows | "No games found for these filters. Try expanding date range." |
| DATABASE_ERROR | Supabase connection | "Database temporarily unavailable. Please try again." |

## Performance Expectations

- Typical queries (single team, 1 month): < 200ms
- Complex aggregations (all teams, full season): < 1000ms
- Query timeout: 5000ms (5 seconds per SC-004)

## Security

- **SQL Injection Prevention**: All parameters use parameterized queries ($1, $2, etc.)
- **Read-only**: Tool can only execute SELECT statements
- **Row limiting**: Maximum 1000 rows per query to prevent memory issues
- **No arbitrary SQL**: Tool generates SQL internally, user cannot provide raw SQL

## Testing Requirements

Unit tests must validate:
1. SQL generation for all three user story patterns
2. Parameter validation (invalid team codes, date ranges)
3. Empty result handling
4. Limit clamping
5. Error message clarity for LLM retry

Integration tests must validate:
6. End-to-end query execution against real database
7. Result formatting matches contract
8. Performance within 5-second timeout
9. Retry logic with error context propagation
