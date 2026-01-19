# Tool Contract: calculate_period_stats

**Purpose**: Compute aggregated statistics across periods and games to answer analytical questions about team performance trends.

**Constitution Alignment**: Tool-Driven Architecture Principle II

## Tool Definition

```typescript
{
  name: "calculate_period_stats",
  description: "Calculate aggregated period statistics for teams such as win percentages, period dominance, and trends. Use this for analytical questions requiring computed metrics rather than raw data queries.",
  parameters: {
    type: "object",
    properties: {
      teamCode: {
        type: "string",
        description: "NHL team 3-letter code. Required for team-specific calculations. Use null for all-teams comparison.",
        pattern: "^[A-Z]{3}$|^null$"
      },
      statType: {
        type: "string",
        description: "Type of statistic to calculate",
        enum: [
          "period_win_percentage",      // % of periods won per period number
          "regulation_dominance",        // % of games with 2+ regulation period wins
          "period_by_period_trend",      // Performance trend across periods 1-3
          "home_vs_away_periods",        // Period performance home vs away
          "monthly_trend"                // Period performance by month
        ]
      },
      startDate: {
        type: "string",
        description: "Start date for calculation window in YYYY-MM-DD format",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      endDate: {
        type: "string",
        description: "End date for calculation window in YYYY-MM-DD format",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      groupBy: {
        type: "string",
        description: "How to group results: 'team', 'period', 'month', or 'game_type'",
        enum: ["team", "period", "month", "game_type"]
      },
      season: {
        type: "string",
        description: "Filter to specific season (e.g., '2024-2025'). Optional.",
        pattern: "^\\d{4}-\\d{4}$"
      }
    },
    required: ["statType"]
  }
}
```

## Input Validation

### Pre-execution Checks

1. **Team Code**: If provided, verify it exists in `teams` table
2. **Date Range**: If both provided, ensure `startDate <= endDate`
3. **Stat Type**: Must be one of the defined enum values
4. **Group By**: Must be valid grouping option
5. **Season**: If provided, validate format

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

## Calculation Types

### 1. Period Win Percentage

**Description**: Calculate the percentage of periods won for each period number (1st, 2nd, 3rd).

**Use Case**: "How well does Carolina perform in the 1st period vs 3rd period?"

**Calculation**:
```typescript
for each period_number in [1, 2, 3]:
  wins = COUNT(period_outcome = 'WIN')
  total = COUNT(*)
  win_percentage = (wins / total) * 100
```

**SQL Implementation**:
```sql
SELECT
  pr.period_number,
  COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END) as wins,
  COUNT(*) as total_periods,
  ROUND(
    COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END)::numeric /
    COUNT(*)::numeric * 100,
    2
  ) as win_percentage
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
WHERE pr.team_code = $1
  AND pr.period_number <= 3  -- Regulation only
  AND g.game_date BETWEEN $2 AND $3
GROUP BY pr.period_number
ORDER BY pr.period_number;
```

**Output**:
```json
{
  "stat_type": "period_win_percentage",
  "team_code": "CAR",
  "data": [
    {
      "period_number": 1,
      "wins": 45,
      "total_periods": 80,
      "win_percentage": 56.25
    },
    {
      "period_number": 2,
      "wins": 38,
      "total_periods": 80,
      "win_percentage": 47.50
    },
    {
      "period_number": 3,
      "wins": 52,
      "total_periods": 80,
      "win_percentage": 65.00
    }
  ]
}
```

---

### 2. Regulation Dominance

**Description**: Calculate the percentage of games where the team won 2 or more regulation periods.

**Use Case**: "How often does Tampa Bay win 2+ regulation periods?"

**Calculation**:
```typescript
games_with_2plus_wins = COUNT(DISTINCT game_id WHERE won_two_plus_reg_periods = true)
total_games = COUNT(DISTINCT game_id)
dominance_percentage = (games_with_2plus_wins / total_games) * 100
```

**SQL Implementation**:
```sql
SELECT
  pr.team_code,
  t.team_name,
  COUNT(DISTINCT CASE WHEN pr.won_two_plus_reg_periods = true THEN pr.game_id END) as games_with_2plus_wins,
  COUNT(DISTINCT pr.game_id) as total_games,
  ROUND(
    COUNT(DISTINCT CASE WHEN pr.won_two_plus_reg_periods = true THEN pr.game_id END)::numeric /
    COUNT(DISTINCT pr.game_id)::numeric * 100,
    2
  ) as dominance_percentage
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
JOIN teams t ON pr.team_code = t.team_code
WHERE g.game_date BETWEEN $1 AND $2
  AND (pr.team_code = $3 OR $3 IS NULL)  -- All teams if teamCode is null
GROUP BY pr.team_code, t.team_name
ORDER BY dominance_percentage DESC;
```

**Output**:
```json
{
  "stat_type": "regulation_dominance",
  "data": [
    {
      "team_code": "BOS",
      "team_name": "Boston Bruins",
      "games_with_2plus_wins": 48,
      "total_games": 82,
      "dominance_percentage": 58.54
    },
    {
      "team_code": "CAR",
      "team_name": "Carolina Hurricanes",
      "games_with_2plus_wins": 45,
      "total_games": 82,
      "dominance_percentage": 54.88
    }
  ]
}
```

---

### 3. Period by Period Trend

**Description**: Track performance trend across periods within games (are teams stronger in later periods?).

**Use Case**: "Does Colorado get stronger as the game goes on?"

**Calculation**:
```typescript
for each period in [1, 2, 3]:
  calculate win_percentage
  calculate average_goal_differential = AVG(goals_for - goals_against)
```

**SQL Implementation**:
```sql
SELECT
  pr.period_number,
  COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END) as wins,
  COUNT(*) as total_periods,
  ROUND(AVG(pr.goals_for - pr.goals_against), 2) as avg_goal_differential,
  ROUND(
    COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END)::numeric /
    COUNT(*)::numeric * 100,
    2
  ) as win_percentage
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
WHERE pr.team_code = $1
  AND pr.period_number <= 3
  AND g.game_date BETWEEN $2 AND $3
GROUP BY pr.period_number
ORDER BY pr.period_number;
```

**Output**:
```json
{
  "stat_type": "period_by_period_trend",
  "team_code": "COL",
  "data": [
    {
      "period_number": 1,
      "wins": 38,
      "total_periods": 82,
      "avg_goal_differential": -0.15,
      "win_percentage": 46.34,
      "trend": "weak_start"
    },
    {
      "period_number": 2,
      "wins": 44,
      "total_periods": 82,
      "avg_goal_differential": 0.12,
      "win_percentage": 53.66,
      "trend": "improving"
    },
    {
      "period_number": 3,
      "wins": 51,
      "total_periods": 82,
      "avg_goal_differential": 0.45,
      "win_percentage": 62.20,
      "trend": "strong_finish"
    }
  ],
  "interpretation": "Team shows improvement across periods, strongest in 3rd period"
}
```

---

### 4. Home vs Away Periods

**Description**: Compare period performance at home vs away games.

**Use Case**: "Does New Jersey perform better in periods at home or away?"

**Calculation**:
```typescript
for location in ['home', 'away']:
  for period in [1, 2, 3]:
    calculate win_percentage
```

**SQL Implementation**:
```sql
SELECT
  CASE
    WHEN pr.team_code = g.home_team_code THEN 'home'
    ELSE 'away'
  END as location,
  pr.period_number,
  COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END) as wins,
  COUNT(*) as total_periods,
  ROUND(
    COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END)::numeric /
    COUNT(*)::numeric * 100,
    2
  ) as win_percentage
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
WHERE pr.team_code = $1
  AND pr.period_number <= 3
  AND g.game_date BETWEEN $2 AND $3
GROUP BY location, pr.period_number
ORDER BY location, pr.period_number;
```

**Output**:
```json
{
  "stat_type": "home_vs_away_periods",
  "team_code": "NJD",
  "data": {
    "home": [
      {
        "period_number": 1,
        "wins": 25,
        "total_periods": 41,
        "win_percentage": 60.98
      },
      ...
    ],
    "away": [
      {
        "period_number": 1,
        "wins": 18,
        "total_periods": 41,
        "win_percentage": 43.90
      },
      ...
    ]
  },
  "summary": {
    "home_advantage": "+17.08% period win rate at home"
  }
}
```

---

### 5. Monthly Trend

**Description**: Track period performance by month to identify hot/cold streaks.

**Use Case**: "How has Vegas performed by month this season?"

**Calculation**:
```typescript
for each month:
  calculate period_win_percentage
  calculate regulation_dominance_percentage
  calculate total_games
```

**SQL Implementation**:
```sql
SELECT
  TO_CHAR(g.game_date, 'YYYY-MM') as month,
  COUNT(DISTINCT CASE WHEN pr.won_two_plus_reg_periods = true THEN pr.game_id END) as games_with_2plus_wins,
  COUNT(DISTINCT pr.game_id) as total_games,
  COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END) as period_wins,
  COUNT(*) as total_periods,
  ROUND(
    COUNT(CASE WHEN pr.period_outcome = 'WIN' THEN 1 END)::numeric /
    COUNT(*)::numeric * 100,
    2
  ) as period_win_percentage
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
WHERE pr.team_code = $1
  AND pr.period_number <= 3
  AND g.game_date BETWEEN $2 AND $3
GROUP BY month
ORDER BY month;
```

**Output**:
```json
{
  "stat_type": "monthly_trend",
  "team_code": "VGK",
  "data": [
    {
      "month": "2024-10",
      "games_with_2plus_wins": 8,
      "total_games": 13,
      "period_wins": 22,
      "total_periods": 39,
      "period_win_percentage": 56.41
    },
    {
      "month": "2024-11",
      "games_with_2plus_wins": 12,
      "total_games": 14,
      "period_wins": 27,
      "total_periods": 42,
      "period_win_percentage": 64.29
    }
  ],
  "trend_direction": "improving"
}
```

---

## Output Format

### Success Response

```typescript
{
  success: true,
  data: {
    stat_type: string,
    team_code?: string,
    date_range?: {
      start: string,
      end: string
    },
    data: any,                         // Structure varies by stat_type
    interpretation?: string,           // Optional human-readable insight
    calculation_metadata: {
      total_games_analyzed: number,
      total_periods_analyzed: number,
      execution_time_ms: number
    }
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR" | "INSUFFICIENT_DATA" | "DATABASE_ERROR",
    message: string,
    suggestion: string
  }
}
```

## Error Handling

### Common Errors

| Error Type | Cause | Suggestion |
|------------|-------|------------|
| INSUFFICIENT_DATA | < 5 games in date range | "Need at least 5 games for reliable statistics. Expand date range." |
| INVALID_STAT_TYPE | Unknown stat type | "Valid types: period_win_percentage, regulation_dominance, ..." |
| NO_DATA | No period results found | "No games found for this team/date range. Check filters." |

## Performance Expectations

- Simple calculations (single team, single stat): < 500ms
- Complex calculations (all teams, multiple stats): < 2000ms
- Monthly trends (full season): < 1000ms

## Security

- **Read-only**: Only SELECT queries, no writes
- **SQL Injection Prevention**: Parameterized queries for all inputs
- **Resource Limits**: Maximum 10,000 periods analyzed per calculation

## Testing Requirements

Unit tests must validate:
1. Period win percentage calculation accuracy
2. Regulation dominance calculation (2+ period wins)
3. Trend detection logic
4. Home vs away differentiation
5. Monthly grouping correctness
6. Handling of insufficient data

Integration tests must validate:
7. End-to-end calculation against real database
8. Performance within 2-second timeout
9. Accurate interpretation generation
10. Error handling for edge cases (no data, single game, etc.)
