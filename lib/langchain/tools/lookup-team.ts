// Tool: Lookup Team
// Resolve various team name formats to official team data

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';

// Common team aliases and nicknames
const TEAM_ALIASES: Record<string, string> = {
  // Anaheim Ducks
  'ducks': 'ANA', 'anaheim': 'ANA', 'mighty ducks': 'ANA',
  // Arizona Coyotes (now Utah)
  'coyotes': 'ARI', 'arizona': 'ARI', 'yotes': 'ARI',
  // Boston Bruins
  'bruins': 'BOS', 'boston': 'BOS', 'bs': 'BOS',
  // Buffalo Sabres
  'sabres': 'BUF', 'buffalo': 'BUF',
  // Calgary Flames
  'flames': 'CGY', 'calgary': 'CGY',
  // Carolina Hurricanes
  'hurricanes': 'CAR', 'carolina': 'CAR', 'canes': 'CAR', 'jerks': 'CAR',
  // Chicago Blackhawks
  'blackhawks': 'CHI', 'chicago': 'CHI', 'hawks': 'CHI',
  // Colorado Avalanche
  'avalanche': 'COL', 'colorado': 'COL', 'avs': 'COL',
  // Columbus Blue Jackets
  'blue jackets': 'CBJ', 'columbus': 'CBJ', 'jackets': 'CBJ', 'cbj': 'CBJ',
  // Dallas Stars
  'stars': 'DAL', 'dallas': 'DAL',
  // Detroit Red Wings
  'red wings': 'DET', 'detroit': 'DET', 'wings': 'DET',
  // Edmonton Oilers
  'oilers': 'EDM', 'edmonton': 'EDM', 'oil': 'EDM',
  // Florida Panthers
  'panthers': 'FLA', 'florida': 'FLA', 'cats': 'FLA',
  // Los Angeles Kings
  'kings': 'LAK', 'los angeles': 'LAK', 'la kings': 'LAK', 'la': 'LAK',
  // Minnesota Wild
  'wild': 'MIN', 'minnesota': 'MIN',
  // Montreal Canadiens
  'canadiens': 'MTL', 'montreal': 'MTL', 'habs': 'MTL', 'canadians': 'MTL',
  // Nashville Predators
  'predators': 'NSH', 'nashville': 'NSH', 'preds': 'NSH',
  // New Jersey Devils
  'devils': 'NJD', 'new jersey': 'NJD', 'jersey': 'NJD',
  // New York Islanders
  'islanders': 'NYI', 'isles': 'NYI', 'ny islanders': 'NYI',
  // New York Rangers
  'rangers': 'NYR', 'new york rangers': 'NYR', 'ny rangers': 'NYR', 'blueshirts': 'NYR',
  // Ottawa Senators
  'senators': 'OTT', 'ottawa': 'OTT', 'sens': 'OTT',
  // Philadelphia Flyers
  'flyers': 'PHI', 'philadelphia': 'PHI', 'philly': 'PHI',
  // Pittsburgh Penguins
  'penguins': 'PIT', 'pittsburgh': 'PIT', 'pens': 'PIT',
  // San Jose Sharks
  'sharks': 'SJS', 'san jose': 'SJS',
  // Seattle Kraken
  'kraken': 'SEA', 'seattle': 'SEA',
  // St. Louis Blues
  'blues': 'STL', 'st louis': 'STL', 'st. louis': 'STL', 'saint louis': 'STL',
  // Tampa Bay Lightning
  'lightning': 'TBL', 'tampa bay': 'TBL', 'tampa': 'TBL', 'bolts': 'TBL',
  // Toronto Maple Leafs
  'maple leafs': 'TOR', 'toronto': 'TOR', 'leafs': 'TOR',
  // Utah Hockey Club
  'utah': 'UTA', 'utah hockey club': 'UTA', 'uhc': 'UTA',
  // Vancouver Canucks
  'canucks': 'VAN', 'vancouver': 'VAN', 'nucks': 'VAN',
  // Vegas Golden Knights
  'golden knights': 'VGK', 'vegas': 'VGK', 'knights': 'VGK', 'vgk': 'VGK',
  // Washington Capitals
  'capitals': 'WSH', 'washington': 'WSH', 'caps': 'WSH',
  // Winnipeg Jets
  'jets': 'WPG', 'winnipeg': 'WPG',
};

export const lookupTeamTool = new DynamicStructuredTool({
  name: 'lookup_team',
  description: `Resolve a team name, nickname, city, or abbreviation to the official team data.
    Use this tool to:
    - Convert nicknames to official team codes (e.g., "Canes" -> "CAR")
    - Get team info from city names (e.g., "Carolina" -> Carolina Hurricanes)
    - Validate team codes
    - Get team's division and conference

    Supports common nicknames and abbreviations for all 32 NHL teams.`,
  schema: z.object({
    query: z.string().describe('Team name, nickname, city, or abbreviation to look up'),
  }),
  func: async ({ query }) => {
    try {
      const normalizedQuery = query.toLowerCase().trim();

      // First, check if it's a direct team code (3 letters)
      if (normalizedQuery.length === 3) {
        const { data: team, error } = await supabase
          .from('teams')
          .select('*')
          .eq('team_code', normalizedQuery.toUpperCase())
          .single();

        if (team && !error) {
          return JSON.stringify({
            success: true,
            found: true,
            team: {
              code: team.team_code,
              name: team.team_name,
              division: team.division,
              conference: team.conference,
            },
            matched_by: 'team_code',
          });
        }
      }

      // Check aliases
      const aliasCode = TEAM_ALIASES[normalizedQuery];
      if (aliasCode) {
        const { data: team, error } = await supabase
          .from('teams')
          .select('*')
          .eq('team_code', aliasCode)
          .single();

        if (team && !error) {
          return JSON.stringify({
            success: true,
            found: true,
            team: {
              code: team.team_code,
              name: team.team_name,
              division: team.division,
              conference: team.conference,
            },
            matched_by: 'alias',
            alias_used: normalizedQuery,
          });
        }
      }

      // Try fuzzy matching on team name
      const { data: teams } = await supabase
        .from('teams')
        .select('*');

      if (teams) {
        // Search in team names
        const match = teams.find(t =>
          t.team_name.toLowerCase().includes(normalizedQuery) ||
          normalizedQuery.includes(t.team_name.toLowerCase().split(' ').pop() || '')
        );

        if (match) {
          return JSON.stringify({
            success: true,
            found: true,
            team: {
              code: match.team_code,
              name: match.team_name,
              division: match.division,
              conference: match.conference,
            },
            matched_by: 'name_search',
          });
        }
      }

      // No match found - return suggestions
      const suggestions = Object.entries(TEAM_ALIASES)
        .filter(([alias]) => alias.includes(normalizedQuery) || normalizedQuery.includes(alias))
        .slice(0, 5)
        .map(([alias, code]) => ({ alias, code }));

      return JSON.stringify({
        success: true,
        found: false,
        message: `No team found matching "${query}"`,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        hint: 'Try using the full team name, city, or common nickname',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
