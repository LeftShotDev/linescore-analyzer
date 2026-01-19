# Quickstart Guide: NHL Linescore Period Analyzer

**Last Updated**: 2026-01-19
**Target Audience**: Developers setting up the application for the first time

## Prerequisites

Before starting, ensure you have:

- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**: Latest stable version
- **Git**: For version control
- **Supabase Account**: Free tier sufficient for MVP
- **Anthropic API Key**: For Claude Sonnet 4.5
- **OpenAI API Key**: For GPT-4o

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd sprint-5-tool-calling

# Install dependencies
npm install

# Or with yarn
yarn install
```

## Step 2: Environment Setup

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# LLM API Keys
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here

# NHL API (public, no auth needed)
NHL_API_BASE_URL=https://statsapi.web.nhl.com/api/v1
```

### Getting Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Navigate to **Settings → API**
3. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### Getting Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to **API Keys**
3. Create a new key → `ANTHROPIC_API_KEY`

### Getting OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to **API Keys**
3. Create a new key → `OPENAI_API_KEY`

## Step 3: Database Setup

Run the database schema creation script in your Supabase project:

```bash
# The schema file is located at: lib/supabase/schema.sql
# You can run it via Supabase Dashboard → SQL Editor
```

Or use the Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Verify Database Tables

After running the schema, verify these tables exist in Supabase:
- `teams` (32 rows for NHL teams)
- `games` (empty initially)
- `period_results` (empty initially)

## Step 4: Seed NHL Teams

Populate the `teams` table with official NHL teams:

```bash
npm run seed:teams

# Or manually via Supabase SQL Editor using the teams seed file
# lib/supabase/seeds/teams.sql
```

This will insert all 32 NHL teams with their official codes, divisions, and conferences.

## Step 5: Load Initial Game Data

Use the chat interface or API to load game data:

### Option A: Via Chat Interface (Recommended)

1. Start the development server (see Step 6)
2. In the chat, type: "Load all games from January 2025"
3. The system will use the `add_games_from_api` tool to fetch and store games

### Option B: Via API Script

```bash
# Run the data loading script
npm run load:games -- --start 2025-01-01 --end 2025-01-31
```

## Step 6: Run Development Server

Start the Next.js development server:

```bash
npm run dev

# Or with yarn
yarn dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Step 7: Verify Installation

### Test 1: Chat Interface Loads

1. Open [http://localhost:3000](http://localhost:3000)
2. Verify the chat interface renders
3. Type "Hello" - you should get a response from the LLM

### Test 2: Query Period Data

In the chat, type:

```
Show me Carolina Hurricanes games from January 2025
```

Expected: Table of games with period-by-period results

### Test 3: Add New Games

In the chat, type:

```
Load games from February 1-7, 2025
```

Expected: Confirmation message with number of games added

### Test 4: Calculate Statistics

In the chat, type:

```
Which teams won the most periods in January 2025?
```

Expected: Ranked list of teams by period wins

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Watch mode (for TDD)
npm run test:watch
```

### Code Quality

```bash
# TypeScript type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### Database Migrations

When schema changes are needed:

```bash
# Create a new migration
supabase migration new add_new_field

# Edit the migration file in supabase/migrations/

# Apply migration
supabase db push
```

## Troubleshooting

### Issue: "Invalid API Key" Error

**Solution**: Verify your `.env.local` has correct API keys and restart the dev server.

### Issue: Database Connection Failed

**Solution**:
1. Check Supabase project is running (not paused due to inactivity)
2. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
3. Check firewall/network settings

### Issue: NHL API Rate Limiting

**Solution**: The app automatically handles rate limiting with retries. If persistent, wait 1 minute and try again.

### Issue: Empty Net Goals Not Calculated

**Solution**: Re-run the game import with `skipExisting=false` to recalculate existing games.

### Issue: Period Outcomes Incorrect

**Solution**:
1. Verify `lib/supabase/schema.sql` was run correctly
2. Check that period outcome calculation logic matches `data-model.md`
3. Re-import games to recalculate

## Project Structure Reference

```
sprint-5-tool-calling/
├── app/
│   ├── api/chat/route.ts          # Chat endpoint with tool calling
│   ├── page.tsx                    # Main chat UI
│   └── layout.tsx                  # Root layout
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Supabase client
│   │   ├── schema.sql              # Database schema
│   │   └── queries.ts              # Query functions
│   ├── ai/
│   │   ├── claude-config.ts        # Claude Sonnet 4.5 setup
│   │   ├── openai-config.ts        # GPT-4o setup
│   │   └── providers.ts            # Vercel AI SDK config
│   ├── tools/
│   │   ├── query-linescore.ts      # Query tool
│   │   ├── add-games.ts            # Add games tool
│   │   └── calculate-stats.ts      # Calculate stats tool
│   └── nhl-api/
│       ├── client.ts               # NHL API client
│       └── transformers.ts         # Data transformers
├── components/
│   └── chat/
│       ├── ChatInterface.tsx       # Main chat component
│       ├── MessageList.tsx         # Message display
│       └── InputBox.tsx            # User input
├── tests/
│   ├── unit/                       # Unit tests
│   └── integration/                # Integration tests
├── .env.local                      # Environment variables (git-ignored)
└── .env.example                    # Environment template
```

## Next Steps

After successful setup:

1. **Explore User Stories**: Try queries from `specs/001-period-analyzer/spec.md`
2. **Run Tests**: Ensure all tests pass with `npm test`
3. **Review Constitution**: Read `.specify/memory/constitution.md` for development principles
4. **Implement Tasks**: Follow `specs/001-period-analyzer/tasks.md` for implementation order

## Getting Help

- **Documentation**: See `specs/001-period-analyzer/` for detailed specs
- **Constitution**: `.specify/memory/constitution.md` for core principles
- **Tool Contracts**: `specs/001-period-analyzer/contracts/` for tool specifications
- **Issues**: Check GitHub issues or create a new one

## Common Commands

```bash
# Development
npm run dev                  # Start dev server
npm test                     # Run all tests
npm run type-check           # TypeScript validation

# Database
npm run seed:teams           # Seed NHL teams
npm run db:reset             # Reset database (WARNING: deletes all data)

# Data Loading
npm run load:games -- --start YYYY-MM-DD --end YYYY-MM-DD

# Deployment
vercel --prod                # Deploy to Vercel
```

## Performance Benchmarks

Expected performance on MVP:
- Chat response time: < 3 seconds
- Query execution: < 500ms for typical queries
- Game import: ~2 seconds per game
- Page load: < 2 seconds (First Contentful Paint)

If performance degrades:
1. Check database indexes (see `data-model.md`)
2. Verify Supabase connection pooling
3. Review LLM API latency in logs
4. Consider caching frequently accessed queries

---

**Ready to build!** You now have a working NHL Linescore Period Analyzer. Start querying period data in natural language and test the core hypothesis: teams winning 2+ regulation periods succeed in playoffs.
