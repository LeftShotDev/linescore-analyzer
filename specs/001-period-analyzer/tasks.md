# Tasks: NHL Linescore Period Analyzer

**Input**: Design documents from `/specs/001-period-analyzer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT included as they were not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Next.js App Router structure: `app/`, `lib/`, `components/`
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize Next.js project with TypeScript and configure package.json with dependencies (next, react, @anthropic-ai/sdk, openai, @supabase/supabase-js, ai)
- [ ] T002 [P] Create environment variables template file .env.example with required keys
- [ ] T003 [P] Create base directory structure: app/, lib/, components/, tests/
- [ ] T004 [P] Configure TypeScript strict mode in tsconfig.json
- [ ] T005 [P] Create root layout in app/layout.tsx with basic HTML structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create Supabase client configuration in lib/supabase/client.ts
- [ ] T007 Create database schema SQL file in lib/supabase/schema.sql with teams, games, and period_results tables per data-model.md
- [ ] T008 Create database seed file for NHL teams in lib/supabase/seeds/teams.sql with all 32 teams
- [ ] T009 [P] Create Anthropic Claude configuration in lib/ai/claude-config.ts
- [ ] T010 [P] Create OpenAI GPT-4o configuration in lib/ai/openai-config.ts
- [ ] T011 [P] Create Vercel AI SDK provider setup in lib/ai/providers.ts integrating both LLMs
- [ ] T012 [P] Create NHL API client in lib/nhl-api/client.ts with fetch wrapper and retry logic
- [ ] T013 [P] Create NHL API TypeScript types in lib/nhl-api/types.ts for API responses
- [ ] T014 [P] Create base database query functions in lib/supabase/queries.ts for common operations
- [ ] T015 Create chat API route in app/api/chat/route.ts with Vercel AI SDK integration and tool calling setup

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 4 - Data Collection from NHL API (Priority: P1) 🎯 MVP

**Goal**: Fetch and store NHL game data from the API with validated period-by-period results

**Independent Test**: Point system at NHL API, trigger fetch for specific date range (e.g., 2025-01-01 to 2025-01-07), verify games are correctly stored in database with accurate period data and empty net goals tracked separately

### Implementation for User Story 4

- [ ] T016 [P] [US4] Create NHL API data transformer in lib/nhl-api/transformers.ts to convert API responses to database schema format
- [ ] T017 [P] [US4] Create period outcome calculation function in lib/nhl-api/transformers.ts implementing EN goal exclusion for period 3 per data-model.md
- [ ] T018 [P] [US4] Create two-plus regulation periods calculation function in lib/nhl-api/transformers.ts
- [ ] T019 [US4] Implement add_games_from_api tool in lib/tools/add-games.ts following contracts/add-games-tool.md specification
- [ ] T020 [US4] Add parameter validation to add_games_from_api tool (date range, season format, skipExisting flag)
- [ ] T021 [US4] Implement NHL API schedule fetching in add_games_from_api tool with rate limiting (2 req/sec)
- [ ] T022 [US4] Implement NHL API game feed fetching in add_games_from_api tool to get detailed linescore data
- [ ] T023 [US4] Implement empty net goal extraction from play-by-play data in add_games_from_api tool
- [ ] T024 [US4] Implement data validation before insertion in add_games_from_api tool (team existence, period completeness, goal consistency)
- [ ] T025 [US4] Implement database transaction logic for game insertion in add_games_from_api tool (games table + period_results table)
- [ ] T026 [US4] Implement error handling with partial success reporting in add_games_from_api tool
- [ ] T027 [US4] Register add_games_from_api tool with Vercel AI SDK in app/api/chat/route.ts

**Checkpoint**: Data collection tool is functional - database can now be populated with NHL games

---

## Phase 4: User Story 1 - Query Team Period Performance (Priority: P1) 🎯 MVP

**Goal**: Allow users to query period-by-period performance for specific teams and date ranges using natural language

**Independent Test**: Seed database with Carolina Hurricanes games from February 2025, type "Show me all Carolina Hurricanes games from February 2025 with period-by-period results" in chat, verify system displays table with period data

### Implementation for User Story 1

- [ ] T028 [P] [US1] Create SQL query builder functions in lib/supabase/queries.ts for team period performance pattern (Pattern 1 from contracts/query-tool.md)
- [ ] T029 [US1] Implement query_linescore_data tool in lib/tools/query-linescore.ts following contracts/query-tool.md specification
- [ ] T030 [US1] Add parameter validation to query_linescore_data tool (team code existence, date range validity, limit clamping)
- [ ] T031 [US1] Implement SQL generation for team period performance queries in query_linescore_data tool
- [ ] T032 [US1] Implement error handling with retry context in query_linescore_data tool per FR-013
- [ ] T033 [US1] Implement result formatting with metadata in query_linescore_data tool
- [ ] T034 [US1] Register query_linescore_data tool with Vercel AI SDK in app/api/chat/route.ts
- [ ] T035 [P] [US1] Create ChatInterface component in components/chat/ChatInterface.tsx as main container
- [ ] T036 [P] [US1] Create MessageList component in components/chat/MessageList.tsx to display conversation
- [ ] T037 [P] [US1] Create InputBox component in components/chat/InputBox.tsx for user input
- [ ] T038 [US1] Integrate ChatInterface into main page in app/page.tsx with proper state management
- [ ] T039 [US1] Add message streaming logic to ChatInterface component using Vercel AI SDK useChat hook
- [ ] T040 [US1] Add error display UI in MessageList component for handling query failures

**Checkpoint**: User Story 1 complete - users can query team period performance in natural language

---

## Phase 5: User Story 2 - Compare Period Win Statistics (Priority: P2)

**Goal**: Enable users to compare which teams won the most periods in a given time range

**Independent Test**: Seed database with multiple teams' games from January 2025, ask "Which teams won the most periods in January 2025?", verify system displays ranked list by period wins

### Implementation for User Story 2

- [ ] T041 [P] [US2] Add SQL query builder for period win rankings in lib/supabase/queries.ts (Pattern 2 from contracts/query-tool.md)
- [ ] T042 [US2] Extend query_linescore_data tool to support period outcome filtering and team aggregation
- [ ] T043 [US2] Add ranking logic with tie-breaking (alphabetical by team code) to query_linescore_data tool
- [ ] T044 [US2] Add result formatting for ranked lists in MessageList component
- [ ] T045 [US2] Add "no games found" graceful handling for empty date ranges in query_linescore_data tool

**Checkpoint**: User Story 2 complete - users can compare period win statistics across teams

---

## Phase 6: User Story 3 - Identify Teams Winning Multiple Periods (Priority: P3)

**Goal**: Test the hypothesis that teams winning 2+ regulation periods are more likely to succeed

**Independent Test**: Seed games where specific teams won 2+ regulation periods, ask "Show me teams that won 2 or more regulation periods in their games", verify system correctly identifies and displays them

### Implementation for User Story 3

- [ ] T046 [P] [US3] Add SQL query builder for two-plus regulation periods in lib/supabase/queries.ts (Pattern 3 from contracts/query-tool.md)
- [ ] T047 [US3] Extend query_linescore_data tool to support wonTwoPlusRegPeriods boolean filter
- [ ] T048 [US3] Add regulation period validation logic (periods 1-3 only) to query_linescore_data tool
- [ ] T049 [US3] Add game-level grouping with period win counts to query results
- [ ] T050 [US3] Add result formatting for hypothesis testing queries in MessageList component

**Checkpoint**: User Story 3 complete - hypothesis testing queries are functional

---

## Phase 7: Enhanced Analytics (calculate_period_stats tool)

**Goal**: Provide aggregated statistics and trend analysis beyond raw queries

**Independent Test**: Ask "Show me Carolina's period win percentage by period", verify system calculates and displays percentages for periods 1, 2, and 3

### Implementation for Enhanced Analytics

- [ ] T051 [P] Create calculate_period_stats tool in lib/tools/calculate-stats.ts following contracts/calculate-stats-tool.md specification
- [ ] T052 [P] Implement period win percentage calculation (stat type 1) in calculate_period_stats tool
- [ ] T053 [P] Implement regulation dominance calculation (stat type 2) in calculate_period_stats tool
- [ ] T054 [P] Implement period-by-period trend analysis (stat type 3) in calculate_period_stats tool
- [ ] T055 [P] Implement home vs away period comparison (stat type 4) in calculate_period_stats tool
- [ ] T056 [P] Implement monthly trend analysis (stat type 5) in calculate_period_stats tool
- [ ] T057 Add parameter validation and insufficient data handling to calculate_period_stats tool
- [ ] T058 Add interpretation generation logic for calculated statistics
- [ ] T059 Register calculate_period_stats tool with Vercel AI SDK in app/api/chat/route.ts
- [ ] T060 Add statistical result formatting in MessageList component with tables and trend indicators

**Checkpoint**: Enhanced analytics complete - users can request computed statistics beyond raw data

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T061 [P] Add loading states to ChatInterface component while LLM is processing
- [ ] T062 [P] Add error retry UI in ChatInterface for failed queries (two-tier error handling per FR-013)
- [ ] T063 [P] Add team code autocomplete suggestions in InputBox component
- [ ] T064 [P] Implement SQL injection prevention validation in all database queries (parameterized queries)
- [ ] T065 [P] Add structured logging throughout tool implementations for debugging
- [ ] T066 [P] Create README.md with setup instructions referencing quickstart.md
- [ ] T067 [P] Add TypeScript strict type checking validation across all modules
- [ ] T068 [P] Implement responsive design for chat interface (mobile viewport support)
- [ ] T069 [P] Add keyboard shortcuts (Enter to send, Shift+Enter for newline) to InputBox component
- [ ] T070 Validate period outcome calculation accuracy with sample data per SC-002 (100% accuracy requirement)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - **User Story 4 (P1)**: Can start after Foundational - No dependencies on other stories
  - **User Story 1 (P1)**: Can start after Foundational - Requires data in database (run US4 first recommended)
  - **User Story 2 (P2)**: Can start after Foundational - Extends US1 query tool
  - **User Story 3 (P3)**: Can start after Foundational - Extends US1 query tool
  - **Enhanced Analytics**: Can start after US1 query tool exists - Parallel to US2/US3
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 4 (P1)**: Independent - No dependencies on other stories (but needed to populate database)
- **User Story 1 (P1)**: Independent - Requires database to have data (run US4 first in practice)
- **User Story 2 (P2)**: Extends US1 query tool - Can integrate with existing tool
- **User Story 3 (P3)**: Extends US1 query tool - Can integrate with existing tool
- **Enhanced Analytics**: Separate tool - Independent of query tool but complementary

### Within Each User Story

- Infrastructure setup before tool implementation
- Tool parameter validation before query logic
- Database operations before result formatting
- Tool registration before UI integration
- Error handling throughout

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US4 and US1 can start in parallel
- Within each story, tasks marked [P] can run in parallel
- Enhanced Analytics tool (Phase 7) can be built in parallel with US2/US3

---

## Parallel Example: User Story 4

```bash
# Launch parallel tasks together (after Foundational complete):
Task: "Create NHL API data transformer in lib/nhl-api/transformers.ts"
Task: "Create period outcome calculation function in lib/nhl-api/transformers.ts"
Task: "Create two-plus regulation periods calculation function in lib/nhl-api/transformers.ts"
```

---

## Parallel Example: User Story 1

```bash
# Launch parallel tasks together:
Task: "Create SQL query builder functions in lib/supabase/queries.ts"
Task: "Create ChatInterface component in components/chat/ChatInterface.tsx"
Task: "Create MessageList component in components/chat/MessageList.tsx"
Task: "Create InputBox component in components/chat/InputBox.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 4 + 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T015) - CRITICAL
3. Complete Phase 3: User Story 4 - Data Collection (T016-T027)
4. Complete Phase 4: User Story 1 - Query Performance (T028-T040)
5. **STOP and VALIDATE**: Load sample games, test natural language queries
6. Deploy/demo if ready

**This is the recommended MVP scope** - provides complete end-to-end value (data loading + querying)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 4 → Test data loading independently
3. Add User Story 1 → Test querying independently → Deploy/Demo (MVP!)
4. Add User Story 2 → Test aggregation independently → Deploy/Demo
5. Add User Story 3 → Test hypothesis queries independently → Deploy/Demo
6. Add Enhanced Analytics → Test statistical calculations → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 4 (Data Collection)
   - Developer B: User Story 1 UI components (T035-T037)
   - Developer C: Enhanced Analytics tool setup (T051)
3. Integrate and test incrementally

---

## Task Summary

**Total Tasks**: 70 tasks
- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 10 tasks (BLOCKING)
- Phase 3 (US4 - P1): 12 tasks
- Phase 4 (US1 - P1): 13 tasks
- Phase 5 (US2 - P2): 5 tasks
- Phase 6 (US3 - P3): 5 tasks
- Phase 7 (Enhanced Analytics): 10 tasks
- Phase 8 (Polish): 10 tasks

**Parallel Opportunities**: 36 tasks marked [P] can run in parallel

**MVP Scope** (Recommended): Phases 1-4 (T001-T040) = 40 tasks
- Delivers: Data loading from NHL API + Natural language querying
- Validates: Core hypothesis infrastructure is in place
- Time Estimate: ~2-3 implementation sessions

**User Story Task Distribution**:
- US4 (Data Collection - P1): 12 tasks
- US1 (Query Performance - P1): 13 tasks
- US2 (Period Statistics - P2): 5 tasks
- US3 (Hypothesis Testing - P3): 5 tasks
- Enhanced Analytics: 10 tasks

**Independent Test Criteria Met**:
- ✅ US4: Can test data loading independently by fetching and validating games
- ✅ US1: Can test querying independently with seeded data
- ✅ US2: Can test aggregation independently with multi-team data
- ✅ US3: Can test hypothesis independently with sample games
- ✅ Analytics: Can test calculations independently with existing data

---

## Notes

- All tasks follow checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
- Each user story is independently completable and testable
- Tests NOT included as they were not requested in specification
- Constitution principles validated throughout (data integrity, tool architecture, period accuracy)
- Commit after completing each user story phase
- Stop at any checkpoint to validate story independently before proceeding
