-- NHL Teams Seed Data
-- All 32 NHL teams with official 3-letter codes, divisions, and conferences
-- Data source: NHL Official Team Information (2024-2025 season)

INSERT INTO teams (team_code, team_name, division, conference) VALUES
  -- Atlantic Division (Eastern Conference)
  ('BOS', 'Boston Bruins', 'Atlantic', 'Eastern'),
  ('BUF', 'Buffalo Sabres', 'Atlantic', 'Eastern'),
  ('DET', 'Detroit Red Wings', 'Atlantic', 'Eastern'),
  ('FLA', 'Florida Panthers', 'Atlantic', 'Eastern'),
  ('MTL', 'Montreal Canadiens', 'Atlantic', 'Eastern'),
  ('OTT', 'Ottawa Senators', 'Atlantic', 'Eastern'),
  ('TBL', 'Tampa Bay Lightning', 'Atlantic', 'Eastern'),
  ('TOR', 'Toronto Maple Leafs', 'Atlantic', 'Eastern'),

  -- Metropolitan Division (Eastern Conference)
  ('CAR', 'Carolina Hurricanes', 'Metropolitan', 'Eastern'),
  ('CBJ', 'Columbus Blue Jackets', 'Metropolitan', 'Eastern'),
  ('NJD', 'New Jersey Devils', 'Metropolitan', 'Eastern'),
  ('NYI', 'New York Islanders', 'Metropolitan', 'Eastern'),
  ('NYR', 'New York Rangers', 'Metropolitan', 'Eastern'),
  ('PHI', 'Philadelphia Flyers', 'Metropolitan', 'Eastern'),
  ('PIT', 'Pittsburgh Penguins', 'Metropolitan', 'Eastern'),
  ('WSH', 'Washington Capitals', 'Metropolitan', 'Eastern'),

  -- Central Division (Western Conference)
  ('ARI', 'Arizona Coyotes', 'Central', 'Western'),
  ('CHI', 'Chicago Blackhawks', 'Central', 'Western'),
  ('COL', 'Colorado Avalanche', 'Central', 'Western'),
  ('DAL', 'Dallas Stars', 'Central', 'Western'),
  ('MIN', 'Minnesota Wild', 'Central', 'Western'),
  ('NSH', 'Nashville Predators', 'Central', 'Western'),
  ('STL', 'St. Louis Blues', 'Central', 'Western'),
  ('WPG', 'Winnipeg Jets', 'Central', 'Western'),

  -- Pacific Division (Western Conference)
  ('ANA', 'Anaheim Ducks', 'Pacific', 'Western'),
  ('CGY', 'Calgary Flames', 'Pacific', 'Western'),
  ('EDM', 'Edmonton Oilers', 'Pacific', 'Western'),
  ('LAK', 'Los Angeles Kings', 'Pacific', 'Western'),
  ('SEA', 'Seattle Kraken', 'Pacific', 'Western'),
  ('SJS', 'San Jose Sharks', 'Pacific', 'Western'),
  ('VAN', 'Vancouver Canucks', 'Pacific', 'Western'),
  ('VGK', 'Vegas Golden Knights', 'Pacific', 'Western')

ON CONFLICT (team_code) DO NOTHING;

-- Verify insertion
SELECT COUNT(*) as total_teams FROM teams;
