-- NHL Linescore Period Analyzer Database Schema
-- Constitution Principle I: Data Accuracy & Integrity
-- This schema implements the three-entity model from data-model.md

-- Enable UUID extension for period_results primary key
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TEAMS TABLE
-- =============================================================================
-- Represents all 32 NHL teams with official identifiers
CREATE TABLE teams (
  team_code VARCHAR(3) PRIMARY KEY CHECK (team_code ~ '^[A-Z]{3}$'),
  team_name VARCHAR(100) NOT NULL UNIQUE,
  division VARCHAR(50),
  conference VARCHAR(20) CHECK (conference IN ('Eastern', 'Western') OR conference IS NULL),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for team name lookups (when users use full names instead of codes)
CREATE INDEX idx_teams_name ON teams(team_name);

COMMENT ON TABLE teams IS 'NHL teams with official 3-letter codes';
COMMENT ON COLUMN teams.team_code IS 'Official NHL 3-letter code (e.g., CAR, TBL, DAL)';

-- =============================================================================
-- GAMES TABLE
-- =============================================================================
-- Represents a single NHL game with metadata and participating teams
CREATE TABLE games (
  game_id VARCHAR(20) PRIMARY KEY,
  game_date DATE NOT NULL,
  season VARCHAR(9) NOT NULL CHECK (season ~ '^\d{4}-\d{4}$'),
  home_team_code VARCHAR(3) NOT NULL REFERENCES teams(team_code),
  away_team_code VARCHAR(3) NOT NULL REFERENCES teams(team_code),
  game_type VARCHAR(20) NOT NULL,
  home_team_standing INTEGER CHECK (home_team_standing BETWEEN 1 AND 16 OR home_team_standing IS NULL),
  away_team_standing INTEGER CHECK (away_team_standing BETWEEN 1 AND 16 OR away_team_standing IS NULL),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure a team cannot play itself
  CONSTRAINT different_teams CHECK (home_team_code != away_team_code)
);

-- Indexes for common query patterns from User Stories
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_season ON games(season);
CREATE INDEX idx_games_home_team_date ON games(home_team_code, game_date);
CREATE INDEX idx_games_away_team_date ON games(away_team_code, game_date);

COMMENT ON TABLE games IS 'NHL games with metadata and team information';
COMMENT ON COLUMN games.game_id IS 'NHL API game ID (e.g., 2025020767)';
COMMENT ON COLUMN games.season IS 'Season identifier (e.g., 2024-2025)';

-- =============================================================================
-- PERIOD_RESULTS TABLE
-- =============================================================================
-- Represents the outcome of a single period for a specific team in a game
-- Each period generates TWO rows: one for each team
CREATE TABLE period_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id VARCHAR(20) NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  team_code VARCHAR(3) NOT NULL REFERENCES teams(team_code),
  period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 5),
  period_type VARCHAR(15) NOT NULL CHECK (period_type IN ('REGULATION', 'OT', 'SO')),
  goals_for INTEGER NOT NULL DEFAULT 0 CHECK (goals_for >= 0),
  goals_against INTEGER NOT NULL DEFAULT 0 CHECK (goals_against >= 0),
  empty_net_goals INTEGER NOT NULL DEFAULT 0 CHECK (empty_net_goals >= 0),
  period_outcome VARCHAR(4) NOT NULL CHECK (period_outcome IN ('WIN', 'LOSS', 'TIE')),
  won_two_plus_reg_periods BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure empty net goals don't exceed total goals
  CONSTRAINT en_goals_valid CHECK (empty_net_goals <= goals_for),

  -- Prevent duplicate period entries for same team in same game
  CONSTRAINT unique_team_period UNIQUE (game_id, team_code, period_number)
);

-- Indexes for User Story query patterns
CREATE INDEX idx_period_results_team ON period_results(team_code);
CREATE INDEX idx_period_results_outcome ON period_results(period_outcome);
CREATE INDEX idx_period_results_two_plus ON period_results(won_two_plus_reg_periods);
CREATE INDEX idx_period_results_team_game ON period_results(team_code, game_id);

COMMENT ON TABLE period_results IS 'Period-by-period results for each team';
COMMENT ON COLUMN period_results.period_number IS '1=1st, 2=2nd, 3=3rd, 4=OT, 5=SO';
COMMENT ON COLUMN period_results.empty_net_goals IS 'EN goals scored by this team (tracked separately per Constitution Principle IV)';
COMMENT ON COLUMN period_results.period_outcome IS 'WIN/LOSS/TIE calculated with EN goals excluded from period 3';
COMMENT ON COLUMN period_results.won_two_plus_reg_periods IS 'True if team won 2+ regulation periods in this game (core hypothesis)';

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to calculate period outcome (excluding empty net goals from period 3)
-- Constitution Principle IV: Period Analysis Accuracy
CREATE OR REPLACE FUNCTION calculate_period_outcome(
  p_period_number INTEGER,
  p_goals_for INTEGER,
  p_goals_against INTEGER,
  p_empty_net_goals INTEGER
) RETURNS VARCHAR(4) AS $$
DECLARE
  adjusted_goals_for INTEGER;
BEGIN
  -- Special case: Exclude empty net goals from 3rd period (FR-008)
  IF p_period_number = 3 THEN
    adjusted_goals_for := p_goals_for - p_empty_net_goals;
  ELSE
    adjusted_goals_for := p_goals_for;
  END IF;

  IF adjusted_goals_for > p_goals_against THEN
    RETURN 'WIN';
  ELSIF adjusted_goals_for < p_goals_against THEN
    RETURN 'LOSS';
  ELSE
    RETURN 'TIE';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_period_outcome IS 'Calculate period outcome with EN goal exclusion for period 3';

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Enable RLS for all tables (Supabase best practice)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_results ENABLE ROW LEVEL SECURITY;

-- Public read access policies (data is public NHL information)
CREATE POLICY "Enable read access for all users" ON teams FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON games FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON period_results FOR SELECT USING (true);

-- Write access requires service role (only server-side tools can insert)
CREATE POLICY "Enable insert for service role only" ON teams FOR INSERT WITH CHECK (false);
CREATE POLICY "Enable insert for service role only" ON games FOR INSERT WITH CHECK (false);
CREATE POLICY "Enable insert for service role only" ON period_results FOR INSERT WITH CHECK (false);

COMMENT ON POLICY "Enable read access for all users" ON teams IS 'NHL team data is public';
COMMENT ON POLICY "Enable insert for service role only" ON teams IS 'Only add_games_from_api tool can insert';
