# Data Model

**Feature**: NHL Linescore Period Analyzer
**Date**: 2026-01-19
**Phase**: 1 - Design

## Overview

The data model consists of three core entities: **Teams**, **Games**, and **Period Results**. This normalized design eliminates redundancy while optimizing for the query patterns in our user stories (team period performance, period win statistics, regulation period analysis).

## Entity Relationship Diagram

```
┌──────────────┐
│    Teams     │
│──────────────│
│ team_code PK │◄──┐
│ team_name    │   │
│ division     │   │
│ conference   │   │
└──────────────┘   │
                   │
                   │ home_team_code FK
                   │
┌─────────────────────────┐
│         Games           │
│─────────────────────────│
│ game_id PK              │◄─────┐
│ game_date               │      │
│ season                  │      │
│ home_team_code FK       ├──────┘
│ away_team_code FK       ├──┐
│ game_type               │  │
│ home_team_standing      │  │
│ away_team_standing      │  │ away_team_code FK
└─────────────────────────┘  │
                             │
                             │
                    ┌────────┴───────────────────┐
                    │    Period Results          │
                    │────────────────────────────│
                    │ id PK                      │
                    │ game_id FK                 │
                    │ team_code FK               │
                    │ period_number              │
                    │ period_type                │
                    │ goals_for                  │
                    │ goals_against              │
                    │ empty_net_goals            │
                    │ period_outcome             │
                    │ won_two_plus_reg_periods   │
                    └────────────────────────────┘
```

## Entities

### 1. Teams

Represents all 32 NHL teams with official identifiers and organizational structure.

**Fields**:
- `team_code` (VARCHAR(3), PRIMARY KEY): Official NHL 3-letter code (e.g., "CAR", "TBL", "DAL")
- `team_name` (VARCHAR(100), NOT NULL): Full team name (e.g., "Carolina Hurricanes")
- `division` (VARCHAR(50)): Division name (e.g., "Metropolitan", "Atlantic")
- `conference` (VARCHAR(20)): Conference name ("Eastern" or "Western")

**Constraints**:
- `team_code` must be uppercase, exactly 3 characters
- `team_name` must be unique
- No null values allowed except conference/division for historical teams

**Indexes**:
- PRIMARY KEY on `team_code`
- INDEX on `team_name` for lookups by full name

**Data Source**: NHL `/api/v1/teams` endpoint

---

### 2. Games

Represents a single NHL game with metadata and participating teams.

**Fields**:
- `game_id` (VARCHAR(20), PRIMARY KEY): NHL API game ID (e.g., "2025020767")
- `game_date` (DATE, NOT NULL): Date game was played (YYYY-MM-DD)
- `season` (VARCHAR(9), NOT NULL): Season identifier (e.g., "2024-2025")
- `home_team_code` (VARCHAR(3), FOREIGN KEY → teams.team_code, NOT NULL)
- `away_team_code` (VARCHAR(3), FOREIGN KEY → teams.team_code, NOT NULL)
- `game_type` (VARCHAR(20), NOT NULL): Game type ("Regular Season", "Playoffs")
- `home_team_standing` (INTEGER): Home team's conference standing at time of game (1-16)
- `away_team_standing` (INTEGER): Away team's conference standing at time of game (1-16)

**Constraints**:
- `home_team_code` ≠ `away_team_code` (team cannot play itself)
- `home_team_standing` and `away_team_standing` between 1-16 (if not null)
- `season` format validated: "YYYY-YYYY" where second year = first year + 1

**Indexes**:
- PRIMARY KEY on `game_id`
- INDEX on `game_date` (for date range queries - User Story 1)
- INDEX on `season` (for season-specific queries - FR-011)
- COMPOUND INDEX on `(home_team_code, game_date)` (optimizes team date range queries)
- COMPOUND INDEX on `(away_team_code, game_date)` (optimizes team date range queries)

**Data Source**: NHL `/api/v1/schedule` and `/api/v1/game/{gameId}/feed/live` endpoints

---

### 3. Period Results

Represents the outcome of a single period for a specific team in a game. Each period generates TWO rows: one for each team.

**Fields**:
- `id` (UUID, PRIMARY KEY): Unique identifier for this period result
- `game_id` (VARCHAR(20), FOREIGN KEY → games.game_id, NOT NULL)
- `team_code` (VARCHAR(3), FOREIGN KEY → teams.team_code, NOT NULL)
- `period_number` (INTEGER, NOT NULL): Period number (1, 2, 3, 4, 5)
  - 1 = 1st period
  - 2 = 2nd period
  - 3 = 3rd period
  - 4 = Overtime
  - 5 = Shootout
- `period_type` (VARCHAR(15), NOT NULL): Period type enum ("REGULATION", "OT", "SO")
- `goals_for` (INTEGER, NOT NULL, DEFAULT 0): Goals scored by this team in this period
- `goals_against` (INTEGER, NOT NULL, DEFAULT 0): Goals scored by opponent in this period
- `empty_net_goals` (INTEGER, NOT NULL, DEFAULT 0): Empty net goals scored by this team in this period
- `period_outcome` (VARCHAR(4), NOT NULL): Calculated outcome enum ("WIN", "LOSS", "TIE")
  - **Calculation**: Compare `goals_for` vs `goals_against`
  - **Special case**: For period 3, exclude `empty_net_goals` from `goals_for` before comparison (FR-008)
- `won_two_plus_reg_periods` (BOOLEAN, NOT NULL, DEFAULT FALSE): True if this team won 2+ regulation periods in this game

**Constraints**:
- `period_number` must be 1-5
- `period_type` must be one of: "REGULATION", "OT", "SO"
- `period_outcome` must be one of: "WIN", "LOSS", "TIE"
- UNIQUE constraint on `(game_id, team_code, period_number)` - prevent duplicate period entries
- `goals_for`, `goals_against`, `empty_net_goals` must be ≥ 0

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE INDEX on `(game_id, team_code, period_number)`
- INDEX on `team_code` (for team-specific queries)
- INDEX on `period_outcome` (for period win/loss queries - User Story 2)
- INDEX on `won_two_plus_reg_periods` (for hypothesis testing queries - User Story 3)
- COMPOUND INDEX on `(team_code, game_id)` (optimizes joins with games table)

**Data Source**: NHL `/api/v1/game/{gameId}/feed/live` linescore data

---

## Derived Fields & Calculations

### Period Outcome Calculation

The `period_outcome` field is calculated during data insertion according to this algorithm:

```typescript
function calculatePeriodOutcome(
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
```

**Rationale**: Empty net goals typically occur when the game is already decided, so they don't reflect equal-strength period performance (Constitution Principle IV).

### Won Two Plus Regulation Periods

The `won_two_plus_reg_periods` field is calculated per game after all regulation periods are inserted:

```typescript
function calculateWonTwoPlusRegPeriods(
  periodResults: Array<{ periodNumber: number, periodOutcome: string }>
): boolean {
  const regulationWins = periodResults
    .filter(p => p.periodNumber <= 3)  // Only periods 1, 2, 3
    .filter(p => p.periodOutcome === 'WIN')
    .length;

  return regulationWins >= 2;
}
```

**Rationale**: This is the core hypothesis field (FR-009) - teams winning 2+ regulation periods are predicted to succeed in playoffs.

---

## Validation Rules

### On Insert (add_games_from_api tool)

1. **Team Code Validation**: Both `home_team_code` and `away_team_code` must exist in `teams` table
2. **Game ID Uniqueness**: Reject duplicate `game_id` insertions
3. **Date Validation**: `game_date` must be valid date, not in future
4. **Season Format**: Validate "YYYY-YYYY" pattern with consecutive years
5. **Period Data Completeness**: All regulation periods (1-3) must be present before inserting game
6. **Empty Net Goals**: Cannot exceed total `goals_for` for that period
7. **Goals Consistency**: For each period, `team_A.goals_against` must equal `team_B.goals_for`

### On Query (query_linescore_data tool)

1. **Team Code**: Must match existing team in `teams` table
2. **Date Range**: Start date must be ≤ end date
3. **Period Number**: Must be 1-5 if specified
4. **Season Format**: Must match "YYYY-YYYY" pattern if specified

---

## Indexes Strategy

Indexes are designed to optimize the three primary query patterns:

### User Story 1: Team Period Performance by Date
```sql
-- Query pattern
WHERE team_code = 'CAR' AND game_date BETWEEN '2025-02-01' AND '2025-02-28'
-- Optimized by: (team_code, game_id) + games.game_date index
```

### User Story 2: Period Win Statistics Aggregation
```sql
-- Query pattern
WHERE period_outcome = 'WIN' AND game_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY team_code
-- Optimized by: period_outcome index + team_code index
```

### User Story 3: Two Plus Regulation Periods
```sql
-- Query pattern
WHERE won_two_plus_reg_periods = TRUE AND game_date > '2025-01-01'
-- Optimized by: won_two_plus_reg_periods index
```

---

## Data Volume Estimates

Based on 2024-2025 NHL season:
- **Teams**: 32 rows (static)
- **Games**: ~1,312 games per regular season
- **Period Results**: ~1,312 games × 2 teams × 3.5 periods avg = ~9,184 rows

Total database size estimate: < 10 MB for full season (text data is highly compressible)

---

## Schema Migration Strategy

Initial schema will be created via SQL file in `lib/supabase/schema.sql`. Future migrations will:
1. Add new columns with DEFAULT values (non-breaking)
2. Create new indexes as needed
3. Never drop columns (archive pattern for backward compatibility per Constitution Principle V)

---

## Summary

This three-table normalized model:
- ✅ Eliminates redundant team data
- ✅ Stores empty net goals separately (FR-007)
- ✅ Pre-calculates period outcomes with EN goal exclusion (FR-008)
- ✅ Tracks 2+ regulation period wins (FR-009)
- ✅ Supports multi-season queries (FR-011)
- ✅ Optimized indexes for all user story query patterns
- ✅ Maintains data integrity via foreign keys and constraints
- ✅ Extensible for future analytics without schema changes
