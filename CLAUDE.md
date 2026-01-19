# NHL Linescore Period Analyzer

## Project Overview
A chat-based NHL analytics application that analyzes period-by-period performance to identify trends and predict playoff success. The core hypothesis: teams that win 2 or more individual periods in regulation are more likely to win games and succeed in playoffs (when facing the same opponent 4-7 consecutive times).

## Tech Stack
- **Frontend/Backend**: Next.js (TypeScript)
- **Hosting**: Vercel
- **Database**: Supabase (PostgreSQL)
- **LLM Providers**:
  - Anthropic Claude Sonnet 4.5 (primary - user chat interface)
  - OpenAI GPT-4o (secondary - data gathering/processing)
- **AI SDK**: Vercel AI SDK (supports both providers)
- **Data Source**: NHL Public API

## Core Features

### 1. Data Collection & Storage
- Scrape NHL API for game data (starting with 2024-2025 season)
- Store period-by-period linescores for each team
- Track empty net goals separately
- Record game metadata: date, teams, standings position
- Support multiple seasons (past, current, future)

### 2. Period Analysis Tracking
For each game period (1st, 2nd, 3rd, OT, SO), track:
- Goals scored by each team
- Empty net goals (separate from period totals)
- Period outcome per team: WIN, LOSS, or TIE
  - **Important**: Exclude empty net goals from 3rd period when calculating period outcome
- Whether team won 2+ periods in regulation

### 3. Chat Interface with Tool Calling
- Natural language query interface
- LLM translates user questions into database queries
- SQL queries hidden from user (clean UX)
- Session-based conversation (no persistence)
- Error handling:
  1. Auto-retry once with error context
  2. If still failing, ask user to rephrase

### 4. Specific Tools
Create dedicated tools for:
- `query_linescore_data` - Execute SELECT queries on linescore data
- `add_games_from_api` - Fetch and insert new games from NHL API
- `calculate_period_stats` - Compute period win/loss/tie aggregates

## Database Schema

### Teams Table
- `team_code` (VARCHAR(3), PK) - Official NHL codes (CAR, TBL, DAL, etc.)
- `team_name` (VARCHAR)
- `division` (VARCHAR)
- `conference` (VARCHAR)

### Games Table
- `game_id` (VARCHAR, PK) - NHL API game ID
- `game_date` (DATE)
- `season` (VARCHAR) - e.g., "2024-2025"
- `home_team_code` (VARCHAR(3), FK)
- `away_team_code` (VARCHAR(3), FK)
- `game_type` (VARCHAR) - Regular season, Playoff
- `home_team_standing` (INTEGER) - Conference standing at time of game
- `away_team_standing` (INTEGER) - Conference standing at time of game

### Period Results Table
- `id` (UUID, PK)
- `game_id` (VARCHAR, FK)
- `team_code` (VARCHAR(3), FK)
- `period_number` (INTEGER) - 1, 2, 3, 4 (OT), 5 (SO)
- `period_type` (VARCHAR) - REGULATION, OT, SO
- `goals_for` (INTEGER) - Goals scored by team
- `goals_against` (INTEGER) - Goals scored by opponent
- `empty_net_goals` (INTEGER) - EN goals scored by team
- `period_outcome` (VARCHAR) - WIN, LOSS, TIE
  - Calculated excluding EN goals from 3rd period
- `won_two_plus_regulation_periods` (BOOLEAN) - For game overall

## Example User Interactions

**User**: "Display all individual period results and cumulative results from Carolina Hurricanes games for the month of February 2025."

**Tool Execution** (hidden from user):
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
WHERE pr.team_code = 'CAR'
  AND g.game_date >= '2025-02-01'
  AND g.game_date <= '2025-02-28'
ORDER BY g.game_date, pr.period_number;
```

**User**: "Which teams won the most periods in January 2025?"

**Tool Execution**:
```sql
SELECT
  pr.team_code,
  COUNT(*) as periods_won
FROM period_results pr
JOIN games g ON pr.game_id = g.game_id
WHERE pr.period_outcome = 'WIN'
  AND g.game_date >= '2025-01-01'
  AND g.game_date <= '2025-01-31'
GROUP BY pr.team_code
ORDER BY periods_won DESC;
```

## Development Guidelines

### Code Organization
- `/app` - Next.js app directory
- `/app/api` - API routes for tool functions
- `/lib/supabase` - Supabase client configuration
- `/lib/ai` - LLM provider configurations (Claude, OpenAI)
- `/lib/tools` - Tool definitions and implementations
- `/lib/nhl-api` - NHL API scraping utilities
- `/components` - React components for chat interface

### Tool Implementation
Each tool should:
1. Validate input parameters
2. Execute database operations via Supabase client
3. Return structured responses
4. Handle errors gracefully with context for LLM retry

### Data Scraping
- Use NHL API endpoints for game data
- Schedule regular updates (consider Vercel Cron Jobs)
- Handle rate limiting appropriately
- Validate data before insertion

### LLM Usage Strategy
- **Anthropic Claude Sonnet 4.5**: Primary model for user-facing chat, SQL generation, tool calling
- **OpenAI GPT-4o**: Secondary for data processing, batch operations, API scraping logic
- Use Vercel AI SDK's unified interface for both

## Testing Considerations
- Test SQL generation with edge cases
- Validate period outcome calculations (especially EN goal exclusion)
- Test error handling and retry logic
- Verify data integrity from NHL API scraping

## Future Enhancements (Not Initial Scope)
- Historical aggregates and trend analysis
- Visualizations and charts
- Playoff prediction models
- Head-to-head matchup analysis
- User accounts and saved queries
- Real-time game updates

## Active Technologies
- TypeScript (latest stable) with Next.js 14+ (001-period-analyzer)
- Supabase (PostgreSQL) with three tables: teams, games, period_results (001-period-analyzer)

## Recent Changes
- 001-period-analyzer: Added TypeScript (latest stable) with Next.js 14+
