# NHL Period Analyzer - Technical Spec

---

## Overview

This document outlines the requirements for the NHL Linescore Period Analyzer, a chat-based application that allows users to query period-by-period NHL game data in natural language. The system translates user questions into SQL via an LLM, executes those queries against a Supabase database, and returns a data table alongside a plain-English summary. The core hypothesis driving the product: teams that win 2 or more regulation periods in a game are more likely to win future matchups — a leading indicator for playoff series success.

---

## Business Requirements

### Data Collection
- System must ingest game data from the 2025-2026 NHL season via the NHL Public API
- Ingestion must process games in batches of 100 at a time to avoid rate limits and timeouts
- Each game must store a period-by-period linescore for both teams
- Empty net goals must be tracked separately from regulation goals
- System must record whether each team won, lost, or tied each individual period
- Period outcomes (WIN/LOSS/TIE) must exclude empty net goals from the calculation for all periods
- System must flag per team per game whether that team won 2 or more regulation periods (independently — both teams can be flagged true)

### Chat Interface
- Users must be able to ask questions in natural language
- SQL queries must never be visible to the user
- Results must be displayed as a data table with a brief LLM-written narrative summary above it
- The system must auto-retry a failed query once with the error context before asking the user to rephrase
- Users must be able to ask follow-up questions within the same session (conversational context)
- Session data is not persisted between page loads

### Data Management
- A server-side script or API route must be available to trigger batch ingestion manually
- No admin UI is required for ingestion
- Database must support querying by team, date range, season, period number, and outcome

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE teams (
  team_code VARCHAR(3) PRIMARY KEY,
  team_name VARCHAR NOT NULL,
  division VARCHAR,
  conference VARCHAR
);

CREATE TABLE games (
  game_id VARCHAR PRIMARY KEY,
  game_date DATE NOT NULL,
  season VARCHAR NOT NULL,
  home_team_code VARCHAR(3) NOT NULL REFERENCES teams(team_code),
  away_team_code VARCHAR(3) NOT NULL REFERENCES teams(team_code),
  game_type VARCHAR NOT NULL,
  home_team_standing INTEGER,
  away_team_standing INTEGER
);

CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_season ON games(season);
CREATE INDEX idx_games_home_team ON games(home_team_code);
CREATE INDEX idx_games_away_team ON games(away_team_code);

CREATE TABLE period_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR NOT NULL REFERENCES games(game_id),
  team_code VARCHAR(3) NOT NULL REFERENCES teams(team_code),
  period_number INTEGER NOT NULL,
  period_type VARCHAR NOT NULL,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  empty_net_goals INTEGER NOT NULL DEFAULT 0,
  period_outcome VARCHAR NOT NULL,
  won_two_plus_regulation_periods BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_period_results_game ON period_results(game_id);
CREATE INDEX idx_period_results_team ON period_results(team_code);
CREATE INDEX idx_period_results_outcome ON period_results(period_outcome);
```

**Period outcome calculation rule**: `period_outcome` is determined by comparing `goals_for - empty_net_goals` vs `goals_against - empty_net_goals` for all period types.

**`won_two_plus_regulation_periods`**: Set true per team per game if that team has `period_outcome = 'WIN'` for 2 or more periods where `period_type = 'REGULATION'`. Both home and away teams can have this flag set to `true` in the same game.

### API Endpoints

#### POST /api/chat
Accepts a user message and conversation history, returns an LLM response with optional tool call results.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Which teams won the most periods in January 2025?" }
  ]
}
```

**Response:**
- Success (200): `{ "response": "...", "table": [...] | null }`
- Error (500): `{ "error": "..." }`

#### POST /api/ingest
Triggers batch ingestion of NHL games. Accepts optional season and batch parameters.

**Request Body:**
```json
{
  "season": "20252026",
  "startBatch": 0,
  "batchSize": 100
}
```

**Response:**
- Success (200): `{ "inserted": 100, "skipped": 5, "nextBatch": 100 }`
- Error (500): `{ "error": "..." }`

#### GET /api/ingest/status
Returns ingestion progress for a given season.

**Response:**
- Success (200): `{ "season": "20252026", "gamesIngested": 1000, "totalGames": 1312 }`

### User Interface Requirements

#### Chat Interface (/)

- Full-page chat layout with message history scroll area and fixed input bar at bottom
- Message bubbles: user messages right-aligned, assistant messages left-aligned
- When a query returns tabular data, render a sortable data table below the narrative summary
- Loading state shown while LLM is processing
- Error state shown inline if retry fails — prompt user to rephrase
- No authentication required
- Session context held in React state only (no persistence)

---

## Implementation Phases

> **This is a refactor, not a greenfield build.** The NHL API client, Supabase client, chat components, tool definitions, and backfill script already exist. Each phase audits what's there, fixes gaps, and extends — it does not recreate from scratch.

> **Data preservation rule**: 2024-2025 season data already in Supabase must not be touched. All new ingestion targets `season = '20252026'` only. No DELETE, TRUNCATE, or migration should affect rows where `season = '2024-2025'`.

---

### Phase 1: Audit & Schema Verification - ⏳ PLANNED

**Objective**: Confirm existing schema, Supabase connection, and RLS policies are correct and match the spec. Identify any gaps before ingestion.

**Tasks**:
1. Audit existing `teams`, `games`, `period_results` tables against spec schema
2. Verify indexes exist as specified
3. Confirm unique constraint on `(game_id, team_code, period_number)` — add if missing
4. Verify `won_two_plus_regulation_periods` column exists on `period_results`
5. Spot-check that 2024-2025 data is present and intact before proceeding

**Deliverables**:
- Schema matches spec (migrations applied if needed, 2024-2025 data untouched)

---

### Phase 2: 2025-2026 Season Ingestion - ⏳ PLANNED

**Objective**: Batch ingestion of 2025-2026 season using the existing NHL API client and backfill script patterns. 100 games per batch.

**Tasks**:
1. Audit `lib/nhl-api/transformers.ts` — fix period outcome logic if EN goals are not excluded from all periods (currently may only exclude from 3rd period)
2. Audit `scripts/backfill-period-results.ts` — extend to accept `--season 2025-2026` and process in 100-game batches with offset resumption
3. Verify `won_two_plus_regulation_periods` is computed independently per team per game
4. Update or add `POST /api/ingest` and `GET /api/ingest/status` routes to support season parameter and batch offset
5. Run full ingestion of 2025-2026 season — scoped to that season only
6. Spot-check 5-10 games against NHL.com to verify accuracy

**Deliverables**:
- Updated ingestion script supporting 2025-2026 in 100-game batches
- `POST /api/ingest` route with batch offset support
- 2025-2026 data populated; 2024-2025 data verified unchanged

---

### Phase 3: LLM Tool Calling & Chat API - ⏳ PLANNED

**Objective**: Audit and fix the existing chat API and tool implementations. The tools and API route already exist — this phase ensures they work correctly end-to-end.

**Tasks**:
1. Audit `lib/tools/` (`query-linescore.ts`, `calculate-period-stats.ts`, `add-games.ts`) — verify against spec
2. Audit `lib/langchain/` agent — confirm or replace with direct Vercel AI SDK tool calling if LangChain is causing issues
3. Audit `lib/ai/claude-config.ts` and `lib/ai/openai-config.ts` — ensure Claude Sonnet 4.5 and GPT-4o are wired correctly
4. Verify system prompt documents the schema and enforces SELECT-only queries
5. Implement auto-retry: on SQL error, append error to conversation and re-invoke once; if still failing, return user-facing rephrase prompt
6. Confirm SQL is never surfaced in response text

**Deliverables**:
- Working `POST /api/chat` with tool calling loop
- Three tools verified against live database
- Auto-retry logic confirmed

---

### Phase 4: Chat UI Audit - ⏳ PLANNED

**Objective**: Audit existing chat components and fix gaps. The components exist — this phase ensures UX matches spec.

**Tasks**:
1. Audit `components/chat/ChatInterface.tsx`, `MessageList.tsx`, `InputBox.tsx`, `DataTable.tsx`
2. Confirm table + narrative summary rendering
3. Confirm SQL is hidden from all message output
4. Confirm loading and error states are implemented
5. Confirm session conversational context is maintained within a page session

**Deliverables**:
- End-to-end chat flow verified in browser
- Table + summary rendering confirmed
- Error and loading states working

---

## Technical Implementation Details

### Key Files

- `lib/nhl-api/client.ts` — NHL Public API wrapper (schedule, linescore, boxscore endpoints)
- `lib/nhl-api/ingest.ts` — Batch ingestion logic with upsert and outcome calculation
- `lib/supabase/client.ts` — Supabase client (server-side and browser-side)
- `lib/ai/claude.ts` — Anthropic Claude Sonnet 4.5 client via Vercel AI SDK
- `lib/ai/openai.ts` — OpenAI GPT-4o client for data processing tasks
- `lib/tools/queryLinescoreData.ts` — Tool: execute SELECT queries
- `lib/tools/calculatePeriodStats.ts` — Tool: aggregate period stats
- `lib/tools/addGamesFromApi.ts` — Tool: trigger ingestion
- `app/api/chat/route.ts` — Chat API route
- `app/api/ingest/route.ts` — Ingestion trigger API route
- `components/ChatInterface.tsx` — Main chat UI
- `components/DataTable.tsx` — Query results table

### Implementation Patterns

**Period outcome calculation** (applies to all period types):
```ts
const adjustedGoalsFor = goals_for - empty_net_goals;
const adjustedGoalsAgainst = goals_against - (opponent_empty_net_goals ?? 0);
const outcome = adjustedGoalsFor > adjustedGoalsAgainst ? 'WIN'
  : adjustedGoalsFor < adjustedGoalsAgainst ? 'LOSS'
  : 'TIE';
```

**Batch ingestion pattern**:
```ts
const BATCH_SIZE = 100;
for (let offset = 0; offset < totalGames; offset += BATCH_SIZE) {
  const batch = games.slice(offset, offset + BATCH_SIZE);
  await upsertBatch(batch);
}
```

**Tool calling retry pattern**:
- On tool call error, append error message to conversation and re-invoke Claude once
- If second attempt also fails, return a user-facing message asking them to rephrase

### Important Notes

- NHL API season code format: `"20252026"` (not `"2025-2026"`)
- `won_two_plus_regulation_periods` is computed at ingestion time and stored — not derived at query time
- EN goal detection uses `goalModifier === 'empty-net'` from the landing API — **do not use `situationCode`** (e.g. `1551` for 5v5 also ends in '1', which incorrectly flags all goals as EN)
- EN goals for the *opponent* are needed to calculate adjusted `goals_against`; the NHL landing API provides both sides' goals per period
- The `query_linescore_data` tool must only allow SELECT statements — validate before executing
- Supabase RLS should allow the service role key full access; the anon key should be read-only on all three tables

### Known Data Limitation

**2024-2025 season P3 outcomes** — the backfill script ran with a two-part bug: (a) `situationCode.slice(-1) === '1'` incorrectly flagged all goals as EN, and (b) EN adjustment was only applied to `goals_for` in P3. The combined effect: all P3 goals were treated as EN, making P3 outcomes incorrect for any game where goals were scored in P3 — they show TIE when they should show WIN or LOSS. P1 and P2 outcomes are correct (adjustment was not applied to those periods). Per the data preservation rule, 2024-2025 data will not be re-ingested. The 2025-2026 season was re-ingested with both bugs fixed.

---

## Success Criteria

- [ ] 2025-2026 season games are fully ingested into Supabase with correct period outcomes
- [ ] `won_two_plus_regulation_periods` is accurate for both teams in every game
- [ ] User can ask "Which teams won the most periods in March 2026?" and get a correct table + summary
- [ ] SQL is never visible in the chat UI
- [ ] Failed queries auto-retry once before prompting user to rephrase
- [ ] Follow-up questions within a session maintain conversational context
- [ ] Data table is sortable by column
- [ ] Ingestion can be re-run without creating duplicate records

---

## Troubleshooting Guide

### Duplicate records on re-ingestion

**Problem**: Running ingestion twice creates duplicate rows in `period_results`
**Cause**: INSERT instead of UPSERT being used
**Solution**: Use Supabase `.upsert()` with `onConflict: 'game_id, team_code, period_number'` — add a unique constraint on those three columns

### NHL API rate limiting

**Problem**: Ingestion fails partway through with 429 errors
**Cause**: NHL API throttling rapid sequential requests
**Solution**: Add a 200ms delay between batch requests; implement exponential backoff on 429

### Tool calling loops

**Problem**: Claude enters an infinite tool-calling loop without returning a response
**Cause**: No `maxSteps` limit set on the AI SDK `streamText` call
**Solution**: Set `maxSteps: 5` in the Vercel AI SDK call to cap tool iterations

---

## Future Enhancements

- Historical data for 2023-2024 and 2024-2025 seasons
- Head-to-head period win analysis between two specific teams
- Trend visualizations (charts, sparklines)
- Playoff prediction model based on regular-season period win rate
- Real-time game updates via webhooks or polling during live games
- Vercel Cron Job for nightly automated ingestion

---

## Dependencies

### External Dependencies

- NHL Public API (`api-web.nhle.com`) - Game schedule and linescore data
- Anthropic Claude Sonnet 4.5 - User-facing chat and SQL generation
- OpenAI GPT-4o - Data processing and batch operations
- Supabase - PostgreSQL database and client SDK
- Vercel - Hosting and serverless functions

### Internal Dependencies

- Vercel AI SDK (`ai`) - Unified interface for Claude and OpenAI, tool calling, `useChat` hook
- `@supabase/supabase-js` - Database client
- `@ai-sdk/anthropic` - Anthropic provider for Vercel AI SDK
- `@ai-sdk/openai` - OpenAI provider for Vercel AI SDK

### Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

---

## Risks and Mitigation

### Technical Risks

- **Risk**: NHL Public API structure changes or becomes unavailable
- **Mitigation**: Abstract all API calls behind `/lib/nhl-api/client.ts`; document the specific endpoints used so alternatives can be swapped in

- **Risk**: Claude generates invalid SQL that breaks at runtime
- **Mitigation**: Validate that queries are SELECT-only before execution; auto-retry with error context once; strict system prompt with schema documentation

- **Risk**: Ingestion of a full season (1,312+ games) hits Vercel's 10-second function timeout
- **Mitigation**: Expose ingestion as a paginated endpoint; caller advances the `startBatch` offset; can be driven from a local script outside of Vercel

### User Experience Risks

- **Risk**: LLM returns a verbose summary that obscures the key data
- **Mitigation**: System prompt instructs Claude to keep summaries to 2-3 sentences; table is always rendered separately

---

## Notes for AI Agents

When updating this spec:
1. Update phase status markers as work progresses
2. Add implementation details under "Technical Implementation Details" as code is written
3. Mark success criteria as complete when features work
4. Add troubleshooting entries when bugs are found and fixed
5. Keep all sections current — remove outdated information
6. Use code references format: `filepath:line-number` when citing code
7. Add an entry to the Change Log for every update

---

## Current Status

**Last Updated**: 2026-06-05
**Current Phase**: Pre-implementation — spec finalized
**Status**: ⏳ PLANNED
**Next Steps**: Begin Phase 1 — project setup and Supabase schema

---

## Change Log

### [2026-06-05 00:00] - Initial spec created

- **Section**: All
- **Change**: Document created from template based on kickoff brief and clarification Q&A. Covers 2025-2026 season only, single-season ingestion, Claude + OpenAI dual-LLM setup, hidden SQL, table+summary result display, batch ingestion via API route only.
