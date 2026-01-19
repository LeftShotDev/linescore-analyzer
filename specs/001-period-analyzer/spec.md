# Feature Specification: NHL Linescore Period Analyzer

**Feature Branch**: `001-period-analyzer`
**Created**: 2026-01-19
**Status**: Draft
**Input**: Build NHL Linescore Period Analyzer - a chat-based analytics application with tool calling for analyzing period-by-period NHL game performance

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Query Team Period Performance (Priority: P1)

A hockey analyst wants to review how the Carolina Hurricanes performed period-by-period during February 2025 to identify patterns in their play. They open the application and type in natural language: "Show me all Carolina Hurricanes games from February 2025 with period-by-period results." The system displays a table showing each game with goals scored in each period, empty net goals, and whether they won, lost, or tied each period.

**Why this priority**: This is the core value proposition - allowing users to query historical period data in natural language. Without this, the application has no functionality.

**Independent Test**: Can be fully tested by seeding the database with sample NHL game data for Carolina Hurricanes in February 2025, then verifying that the chat interface correctly translates the natural language query and displays accurate period-by-period results.

**Acceptance Scenarios**:

1. **Given** the database contains Carolina Hurricanes games from February 2025, **When** user asks "Display all individual period results from Carolina Hurricanes games for February 2025", **Then** system shows all games with period numbers, goals for/against, empty net goals, and period outcomes
2. **Given** a user types a query with ambiguous date format, **When** the system cannot confidently parse the date, **Then** system asks user to clarify the date range
3. **Given** a user asks about a team that doesn't exist in the database, **When** the query is processed, **Then** system responds with "No data found for that team" and suggests valid team codes

---

### User Story 2 - Compare Period Win Statistics (Priority: P2)

A hockey bettor wants to identify which teams are most consistent at winning individual periods (regardless of game outcome) to inform their betting strategy. They ask: "Which teams won the most periods in January 2025?" The system displays a ranked list of teams by total periods won, showing the team code and count.

**Why this priority**: This adds analytical value beyond simple data retrieval - aggregating and ranking teams by period performance. It validates the hypothesis that period wins matter.

**Independent Test**: Can be independently tested with a dataset containing multiple teams and games from January 2025, verifying that the system correctly counts period wins per team and ranks them appropriately.

**Acceptance Scenarios**:

1. **Given** the database contains games from multiple teams in January 2025, **When** user asks "Which teams won the most periods in January 2025?", **Then** system displays teams ranked by period wins with counts
2. **Given** multiple teams are tied for period wins, **When** ranking is displayed, **Then** tied teams are shown with the same rank and listed alphabetically by team code
3. **Given** user specifies a date range with no games, **When** query is executed, **Then** system responds "No games found in that date range"

---

### User Story 3 - Identify Teams Winning Multiple Periods (Priority: P3)

A playoff predictor wants to test the hypothesis that teams winning 2 or more regulation periods are more likely to succeed. They ask: "Show me all teams that won 2 or more regulation periods in their last 10 games." The system displays teams meeting this criteria with game details and the count of how many times they achieved this.

**Why this priority**: This directly tests the core hypothesis of the application - that winning 2+ regulation periods predicts playoff success. It's valuable for advanced analysis but requires the foundational query capabilities first.

**Independent Test**: Can be independently tested by seeding games where specific teams won 2+ regulation periods, then verifying the system correctly identifies and counts these occurrences.

**Acceptance Scenarios**:

1. **Given** database contains recent games for all teams, **When** user asks about teams winning 2+ regulation periods, **Then** system shows teams with game dates and period win details
2. **Given** a team wins periods 1 and 2 but loses period 3, **When** calculating regulation period wins, **Then** system correctly identifies this as winning 2+ regulation periods
3. **Given** a team wins via shootout after losing all regulation periods, **When** counting regulation period wins, **Then** system correctly shows 0 regulation periods won (OT/SO don't count)

---

### User Story 4 - Data Collection from NHL API (Priority: P1)

A system administrator wants to populate the database with current season data without manual entry. They trigger a data import process that fetches game data from the NHL Public API for the 2024-2025 season, validates it, and stores period-by-period results with proper empty net goal tracking.

**Why this priority**: Without data, the entire application is useless. This is a foundational requirement that must work before any queries can be performed. It's P1 because it runs parallel to User Story 1 - both are required for MVP.

**Independent Test**: Can be independently tested by pointing the system at the NHL API, triggering a fetch for a specific date range, and verifying that games are correctly stored in the database with accurate period data and empty net goal separation.

**Acceptance Scenarios**:

1. **Given** the NHL API is accessible, **When** system fetches games for a specific date, **Then** all games are stored with correct period scores, empty net goals, and team standings
2. **Given** the API returns a game with empty net goals in the 3rd period, **When** storing period results, **Then** empty net goals are stored separately and excluded from period outcome calculation
3. **Given** the API request fails or times out, **When** system attempts to fetch data, **Then** system logs the error, retries once, and if still failing, notifies the user without crashing

---

### Edge Cases

- What happens when a user asks about a team using full name instead of 3-letter code (e.g., "Carolina Hurricanes" vs "CAR")?
- How does the system handle games that go to multiple overtimes or shootouts?
- What happens when the NHL API changes its data format or structure?
- How does the system handle queries spanning seasons (e.g., "games from December 2024 to February 2025")?
- What happens if empty net goal data is missing from the API response?
- How does the system handle special characters or typos in team names?
- What happens when a user asks a completely unrelated question (e.g., "What's the weather?")?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept natural language queries about NHL game and period data via a chat interface
- **FR-002**: System MUST translate natural language queries into appropriate tool calls using LLM (Claude Sonnet 4.5)
- **FR-003**: System MUST hide SQL generation from users and display only natural language responses
- **FR-004**: System MUST implement three distinct tools:
  - `query_linescore_data` - Execute SELECT queries on period data
  - `add_games_from_api` - Fetch and insert games from NHL Public API
  - `calculate_period_stats` - Compute period win/loss/tie aggregates
- **FR-005**: System MUST fetch game data from NHL Public API and validate before insertion
- **FR-006**: System MUST store period-by-period results for each team in each game
- **FR-007**: System MUST track empty net goals separately from regular period goals
- **FR-008**: System MUST calculate period outcomes (WIN/LOSS/TIE) excluding empty net goals from 3rd period
- **FR-009**: System MUST track whether a team won 2 or more regulation periods per game
- **FR-010**: System MUST use official NHL 3-letter team codes (CAR, TBL, DAL, etc.)
- **FR-011**: System MUST support queries across multiple seasons with season identifier (e.g., "2024-2025")
- **FR-012**: System MUST store game metadata: date, teams involved, team standings at time of game
- **FR-013**: System MUST implement two-tier error handling:
  - Auto-retry failed queries once with error context sent to LLM
  - If still failing, ask user to rephrase the question
- **FR-014**: System MUST maintain session-based conversation without persisting chat history
- **FR-015**: System MUST validate all data from NHL API before database insertion
- **FR-016**: System MUST handle rate limiting from NHL API appropriately
- **FR-017**: System MUST support date range queries (specific dates, months, seasons)
- **FR-018**: System MUST support team-specific queries and multi-team comparisons
- **FR-019**: System MUST distinguish between regulation periods (1, 2, 3) and overtime/shootout (4, 5)

### Key Entities

- **Team**: Represents an NHL team with official 3-letter code, full name, division, and conference
- **Game**: Represents a single NHL game with unique ID, date, season, participating teams, game type, and team standings at time of game
- **Period Result**: Represents the outcome of a single period for a specific team in a game, including goals scored, goals against, empty net goals, and calculated period outcome (WIN/LOSS/TIE)
- **Season**: Identifier for NHL season (e.g., "2024-2025") used to organize and query multi-year data

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can ask questions in natural language and receive accurate period data without understanding SQL or database structure
- **SC-002**: System correctly calculates period outcomes with 100% accuracy when excluding empty net goals from 3rd period comparisons
- **SC-003**: System fetches and stores game data from NHL API with complete period-by-period information for at least the 2024-2025 season
- **SC-004**: Users receive responses to queries within 5 seconds for typical date range queries (single team, single month)
- **SC-005**: System successfully retries and recovers from at least 80% of failed queries without user intervention
- **SC-006**: System accurately identifies teams that won 2 or more regulation periods in any queried game set
- **SC-007**: Chat interface responds to ambiguous queries by asking clarifying questions rather than returning errors
- **SC-008**: System handles date range queries spanning multiple months or seasons without data loss or incorrect filtering

## Assumptions *(optional)*

- NHL Public API will remain accessible and maintain backward-compatible data structure
- Official NHL team codes will remain stable (no team relocations during 2024-2025 season)
- Empty net goal data is consistently available in NHL API responses
- Users have basic knowledge of NHL teams (know team names or can learn 3-letter codes)
- Session-based conversation (no login/authentication required for MVP)
- Single-user application (no multi-user concurrency concerns for MVP)
- Data scraping frequency is not specified - assuming manual/on-demand initially with future automation
- Team standings data is available from NHL API or can be derived from win/loss records
- Browser-based chat interface is acceptable (no mobile native app required)
- English language only for natural language queries

## Out of Scope *(optional)*

- Real-time game updates (live scores during games)
- User authentication and personalized accounts
- Saved queries or conversation history persistence
- Data visualization (charts, graphs, heat maps)
- Playoff prediction models or advanced statistical analysis
- Historical data beyond available API (pre-2020 seasons)
- Head-to-head matchup analysis tools
- Player-level statistics (focuses only on team period results)
- Mobile native applications (iOS/Android)
- Multi-language support
- Export functionality (PDF, CSV reports)
- Email notifications or alerts

## Dependencies *(optional)*

- NHL Public API availability and stability
- Supabase cloud hosting for PostgreSQL database
- Vercel cloud hosting for Next.js application
- Anthropic Claude API access (Sonnet 4.5 model)
- OpenAI API access (GPT-4o model)
- Vercel AI SDK for unified LLM integration
- Internet connectivity for API access during data fetching
