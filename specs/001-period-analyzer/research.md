# Research & Technology Decisions

**Feature**: NHL Linescore Period Analyzer
**Date**: 2026-01-19
**Phase**: 0 - Research

## Technology Stack Decisions

### 1. Frontend Framework: Next.js 14+ (App Router)

**Decision**: Use Next.js with App Router for the full-stack application.

**Rationale**:
- Server and client components enable optimal rendering strategy for chat interface
- Built-in API routes eliminate need for separate backend server
- Vercel deployment integration is seamless (hosting requirement per CLAUDE.md)
- React Server Components reduce client bundle size for better performance
- TypeScript support is first-class
- App Router provides modern file-based routing with layouts

**Alternatives Considered**:
- **Pure React SPA + Express**: Rejected because it requires managing two separate deployments and doesn't leverage server components for performance
- **Remix**: Rejected because team familiarity with Next.js and Vercel ecosystem integration
- **Svelte/SvelteKit**: Rejected due to smaller ecosystem for AI SDK integrations

### 2. AI Integration: Vercel AI SDK

**Decision**: Use Vercel AI SDK as the unified interface for both Claude and OpenAI.

**Rationale**:
- Single API for multiple LLM providers (Claude Sonnet 4.5 and GPT-4o)
- Built-in streaming support for chat responses
- Tool calling abstraction works consistently across providers
- Automatic request/response formatting
- Error handling and retry logic built-in
- Tight integration with Next.js and Vercel hosting

**Alternatives Considered**:
- **LangChain**: Rejected due to complexity overhead for this use case (three simple tools)
- **Direct SDK usage**: Rejected because maintaining two different SDK patterns increases code complexity
- **OpenAI SDK only**: Rejected because constitution specifies using both Claude and OpenAI

### 3. Database: Supabase (PostgreSQL)

**Decision**: Use Supabase hosted PostgreSQL with official JavaScript client.

**Rationale**:
- PostgreSQL provides relational integrity for teams, games, and period results
- Supabase offers generous free tier for MVP
- Built-in connection pooling and edge function support
- JavaScript/TypeScript client is well-maintained
- Supports complex queries needed for period aggregations
- Real-time subscriptions available for future enhancements

**Alternatives Considered**:
- **PlanetScale (MySQL)**: Rejected because PostgreSQL has better support for complex queries and JSON fields
- **MongoDB**: Rejected because relational data (teams, games, periods) fits poorly into document model
- **Prisma + Vercel Postgres**: Rejected to avoid ORM overhead for straightforward SQL queries

### 4. Testing Framework: Vitest + Playwright

**Decision**: Vitest for unit tests, Playwright for integration tests.

**Rationale**:
- Vitest is fast, has built-in TypeScript support, and works well with Next.js
- Playwright enables end-to-end testing of chat flows across browsers
- Both have excellent DX (developer experience) with hot reload and debugging
- Vitest mocking capabilities are essential for testing NHL API calls
- Playwright can test tool execution in realistic browser environment

**Alternatives Considered**:
- **Jest**: Rejected because Vitest is faster and has better ESM support
- **Cypress**: Rejected in favor of Playwright's multi-browser support and better API testing

### 5. NHL API Client: Custom Fetch Wrapper

**Decision**: Build custom NHL API client using native fetch with retry logic.

**Rationale**:
- NHL API is RESTful and straightforward (no complex auth)
- Native fetch is sufficient for GET requests
- Custom wrapper allows fine-grained control over rate limiting (FR-016)
- Retry logic needed for reliability (constitution requirement)
- Type safety via TypeScript interfaces for NHL response data
- No need for heavy HTTP client library overhead

**Alternatives Considered**:
- **Axios**: Rejected due to unnecessary bundle size for simple GET requests
- **ky**: Rejected because native fetch with custom retry is simpler and more maintainable

## Data Architecture Decisions

### 6. Database Schema Strategy

**Decision**: Three-table normalized design (teams, games, period_results).

**Rationale**:
- Teams table eliminates redundant team data across games
- Games table stores game-level metadata once (not per team)
- Period_results table has one row per team per period (denormalized for query performance)
- Empty net goals column allows exclusion from period outcome calculation (FR-008)
- Season field on games table enables future multi-season queries (FR-011)
- Indexing on team_code + game_date enables fast queries for User Story 1

**Alternatives Considered**:
- **Single games table with embedded JSON**: Rejected because querying nested JSON for period stats is complex and slow
- **Fully denormalized (all data in period_results)**: Rejected due to excessive redundancy

### 7. Period Outcome Calculation Strategy

**Decision**: Calculate period outcomes at data insertion time, store as enum (WIN/LOSS/TIE).

**Rationale**:
- Pre-computed outcomes eliminate calculation overhead on every query
- Empty net goal exclusion logic runs once during insertion (data accuracy)
- Period outcome queries become simple WHERE clauses
- Enum type ensures data integrity at database level
- Constitution requires 100% accuracy on period calculations (SC-002)

**Alternatives Considered**:
- **Calculate on query**: Rejected because it introduces risk of calculation bugs and impacts query performance
- **Database view**: Rejected because period outcome logic (EN goal exclusion) is complex and error-prone in SQL

## API Design Decisions

### 8. Tool Calling Architecture

**Decision**: Three independent tools with Zod schema validation.

**Rationale**:
- Constitution mandates exactly three tools (Tool-Driven Architecture principle)
- Zod provides runtime type validation for tool parameters
- Each tool is independently testable
- Clear separation of concerns: query vs. insert vs. calculate
- LLM can select appropriate tool based on user intent
- Tool responses are structured JSON for consistent parsing

**Alternatives Considered**:
- **Single universal tool**: Rejected because it violates constitution requirement for three distinct tools
- **Five+ specialized tools**: Rejected as over-engineering (YAGNI principle)

### 9. Error Handling Strategy

**Decision**: Two-tier retry with context propagation to LLM.

**Rationale**:
- Constitution requires auto-retry once, then ask user (FR-013)
- Error context sent back to LLM enables self-correction (e.g., SQL syntax errors)
- Vercel AI SDK supports error handling in tool execution
- User rephrasing as fallback prevents infinite retry loops
- Logging all errors enables debugging and monitoring

**Alternatives Considered**:
- **Unlimited retries**: Rejected due to risk of infinite loops and poor UX
- **No retry, immediate user prompt**: Rejected because 80% auto-recovery is required (SC-005)

## NHL API Integration Decisions

### 10. NHL API Endpoints

**Decision**: Use NHL Stats API v1 endpoints for game data.

**Rationale**:
- Public API, no authentication required
- Game endpoint provides linescore with period-by-period goals
- Team endpoint provides official 3-letter codes
- Standings endpoint available for team rankings
- Schedule endpoint enables date range queries

**API Endpoints**:
- `/api/v1/schedule?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Get games by date range
- `/api/v1/game/{gameId}/feed/live` - Get detailed game data including linescore
- `/api/v1/teams` - Get all teams with official codes
- `/api/v1/standings` - Get current standings

**Alternatives Considered**:
- **NHL.com web scraping**: Rejected due to fragility and rate limiting concerns
- **Third-party NHL APIs**: Rejected to maintain data source integrity per constitution

## Deployment & Environment Decisions

### 11. Environment Variables

**Decision**: Use `.env.local` for development, Vercel env vars for production.

**Rationale**:
- Next.js has built-in environment variable support
- Sensitive keys (Supabase, Anthropic, OpenAI) never committed to git
- Vercel dashboard provides secure environment variable management
- `.env.example` documents required variables for team onboarding

**Required Environment Variables**:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
NHL_API_BASE_URL=https://statsapi.web.nhl.com/api/v1
```

**Alternatives Considered**:
- **Hardcoded API keys**: Rejected for obvious security reasons
- **AWS Secrets Manager**: Rejected as overkill for MVP with Vercel hosting

## Summary

All technology decisions align with:
- Constitution requirements (five core principles)
- CLAUDE.md tech stack specifications
- Functional requirements from spec.md
- Performance and scale targets

No NEEDS CLARIFICATION items remain. Ready to proceed to Phase 1 (data model and contracts design).
