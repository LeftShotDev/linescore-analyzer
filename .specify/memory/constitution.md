<!--
Sync Impact Report:
- Version change: Initial → 1.0.0
- Added principles:
  1. Data Accuracy & Integrity
  2. Tool-Driven Architecture
  3. Natural Language Interface
  4. Period Analysis Accuracy
  5. Extensibility & Future-Proofing
- Added sections:
  - Technical Stack Requirements
  - Development Workflow
  - Governance
- Templates requiring updates:
  ✅ constitution.md (created)
  ⚠ plan-template.md (pending validation)
  ⚠ spec-template.md (pending validation)
  ⚠ tasks-template.md (pending validation)
- Follow-up TODOs: None
-->

# NHL Linescore Period Analyzer Constitution

## Core Principles

### I. Data Accuracy & Integrity (NON-NEGOTIABLE)

All NHL game data MUST be:
- Scraped directly from the official NHL Public API
- Validated before insertion into the database
- Stored with complete metadata (date, teams, standings position)
- Tracked with empty net goals separately from regular scoring
- Auditable and verifiable against source

**Rationale**: The core hypothesis (teams winning 2+ periods predict playoff success) requires accurate period-by-period data. Any data corruption invalidates the analysis.

### II. Tool-Driven Architecture (NON-NEGOTIABLE)

The application MUST implement three distinct tools:
- `query_linescore_data` - Execute SELECT queries on linescore data
- `add_games_from_api` - Fetch and insert new games from NHL API
- `calculate_period_stats` - Compute period win/loss/tie aggregates

Each tool MUST:
- Validate input parameters before execution
- Return structured, predictable responses
- Handle errors gracefully with context for LLM retry
- Execute database operations via Supabase client only

**Rationale**: Separation of concerns ensures maintainability, testability, and allows the LLM to select the appropriate tool for each user intent.

### III. Natural Language Interface

User interactions MUST:
- Accept natural language queries (e.g., "Show Carolina Hurricanes games in February 2025")
- Hide SQL query generation from the user (clean UX)
- Translate user intent into appropriate tool calls via LLM
- Use session-based conversation (no persistence required)
- Implement two-tier error handling:
  1. Auto-retry once with error context
  2. If still failing, ask user to rephrase

**Rationale**: Non-technical users should interact with hockey data naturally without understanding SQL, databases, or technical implementation details.

### IV. Period Analysis Accuracy (NON-NEGOTIABLE)

Period outcome calculations (WIN/LOSS/TIE) MUST:
- Track goals for each period: 1st, 2nd, 3rd, OT, SO
- Store empty net goals separately
- Exclude empty net goals from 3rd period when determining period outcome
- Calculate whether a team won 2+ regulation periods per game
- Use official NHL team codes (3-letter: CAR, TBL, DAL, etc.)

**Rationale**: The empty net goal exclusion is critical to the hypothesis—it measures team performance when both teams have equal strength, not when the game is effectively decided.

### V. Extensibility & Future-Proofing

The system MUST be designed to:
- Support multiple seasons (past, current, future) with season identifier
- Allow addition of new analytical metrics without schema redesign
- Maintain backward compatibility for existing queries
- Use TypeScript for type safety and maintainability
- Separate concerns: data layer (Supabase), AI layer (LLM providers), presentation layer (Next.js)

**Rationale**: Starting with 2024-2025 season, but the application must accommodate historical analysis and future seasons as the dataset grows.

## Technical Stack Requirements

The application MUST use:
- **Frontend/Backend**: Next.js with TypeScript
- **Hosting**: Vercel with appropriate environment variables
- **Database**: Supabase (PostgreSQL) with proper indexing
- **LLM Providers**:
  - Anthropic Claude Sonnet 4.5 (primary - user-facing chat, SQL generation, tool calling)
  - OpenAI GPT-4o (secondary - data processing, batch operations)
- **AI SDK**: Vercel AI SDK for unified LLM interface
- **Data Source**: NHL Public API exclusively

Code organization MUST follow:
- `/app` - Next.js app directory structure
- `/app/api` - API routes for tool function handlers
- `/lib/supabase` - Supabase client configuration and queries
- `/lib/ai` - LLM provider configurations
- `/lib/tools` - Tool definitions and implementations
- `/lib/nhl-api` - NHL API scraping utilities
- `/components` - React components for chat interface

## Development Workflow

### Testing Requirements
- SQL generation MUST be tested with edge cases (date ranges, team codes, null values)
- Period outcome calculations MUST be validated with empty net goal scenarios
- Error handling and retry logic MUST be tested for LLM failures
- NHL API scraping MUST validate data integrity before insertion

### Data Scraping Protocol
- Rate limiting MUST be respected for NHL API requests
- Failed scrapes MUST be logged with error context
- Data validation MUST occur before database insertion
- Consider Vercel Cron Jobs for scheduled updates

### Code Quality Standards
- TypeScript strict mode enabled
- All database queries parameterized (no SQL injection)
- Environment variables for sensitive credentials
- Error boundaries for React components
- Structured logging for debugging

## Governance

This constitution supersedes all other development practices and documentation for the NHL Linescore Period Analyzer project.

### Amendment Process
1. Proposed changes MUST be documented with rationale
2. Impact on existing code MUST be assessed
3. Version increment MUST follow semantic versioning:
   - MAJOR: Breaking changes to tools, schema, or core principles
   - MINOR: New principles, tools, or non-breaking features
   - PATCH: Clarifications, typo fixes, documentation updates
4. All dependent templates and documentation MUST be updated

### Compliance & Review
- All pull requests MUST verify compliance with constitution principles
- Code reviews MUST validate tool implementation against specifications
- Database schema changes MUST maintain backward compatibility where possible
- New features MUST align with extensibility principle

### Runtime Development Guidance
For day-to-day development guidance and best practices, refer to `/CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: 2026-01-19 | **Last Amended**: 2026-01-19
