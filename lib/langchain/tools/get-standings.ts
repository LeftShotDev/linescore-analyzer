// Tool: Get Standings
// Fetch current NHL standings from the NHL API

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const NHL_API_BASE_URL = 'https://api-web.nhle.com';

interface StandingsTeam {
  teamAbbrev: { default: string };
  teamName: { default: string };
  conferenceName: string;
  divisionName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  pointPctg: number;
  regulationWins: number;
  goalFor: number;
  goalAgainst: number;
  goalDifferential: number;
  streakCode: string;
  streakCount: number;
  wildcardSequence: number;
  conferenceSequence: number;
  divisionSequence: number;
  leagueSequence: number;
}

export const getStandingsTool = new DynamicStructuredTool({
  name: 'get_standings',
  description: `Fetch current NHL standings from the official NHL API.
    Use this tool to:
    - Get current league standings
    - See conference and division rankings
    - Compare official standings to period-based metrics
    - Check playoff positioning

    Returns live data from the NHL API, not stored database data.`,
  schema: z.object({
    groupBy: z.enum(['league', 'conference', 'division']).default('division')
      .describe('How to group the standings (default: division)'),
    date: z.string().optional()
      .describe('Get standings as of a specific date (YYYY-MM-DD). Defaults to current.'),
  }),
  func: async ({ groupBy = 'division', date }) => {
    try {
      // Fetch standings from NHL API
      const url = date
        ? `${NHL_API_BASE_URL}/v1/standings/${date}`
        : `${NHL_API_BASE_URL}/v1/standings/now`;

      console.log(`[get_standings] Fetching: ${url}`);

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`NHL API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const standings = data.standings as StandingsTeam[];

      if (!standings || standings.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No standings data available',
        });
      }

      // Process standings based on grouping
      const processTeam = (team: StandingsTeam) => ({
        code: team.teamAbbrev.default,
        name: team.teamName.default,
        conference: team.conferenceName,
        division: team.divisionName,
        gamesPlayed: team.gamesPlayed,
        record: `${team.wins}-${team.losses}-${team.otLosses}`,
        points: team.points,
        pointsPct: (team.pointPctg * 100).toFixed(1) + '%',
        regulationWins: team.regulationWins,
        goalDiff: team.goalDifferential,
        streak: `${team.streakCode}${team.streakCount}`,
        divisionRank: team.divisionSequence,
        conferenceRank: team.conferenceSequence,
        leagueRank: team.leagueSequence,
        wildcardRank: team.wildcardSequence,
      });

      let result: any;

      if (groupBy === 'league') {
        // Sort by league rank
        const sorted = standings
          .sort((a, b) => a.leagueSequence - b.leagueSequence)
          .map(processTeam);

        result = {
          grouping: 'league',
          teams: sorted,
        };
      } else if (groupBy === 'conference') {
        // Group by conference
        const eastern = standings
          .filter(t => t.conferenceName === 'Eastern')
          .sort((a, b) => a.conferenceSequence - b.conferenceSequence)
          .map(processTeam);

        const western = standings
          .filter(t => t.conferenceName === 'Western')
          .sort((a, b) => a.conferenceSequence - b.conferenceSequence)
          .map(processTeam);

        result = {
          grouping: 'conference',
          Eastern: eastern,
          Western: western,
        };
      } else {
        // Group by division
        const divisions: Record<string, any[]> = {};

        for (const team of standings) {
          const divName = team.divisionName;
          if (!divisions[divName]) {
            divisions[divName] = [];
          }
          divisions[divName].push(team);
        }

        // Sort each division
        for (const div of Object.keys(divisions)) {
          divisions[div] = divisions[div]
            .sort((a, b) => a.divisionSequence - b.divisionSequence)
            .map(processTeam);
        }

        result = {
          grouping: 'division',
          ...divisions,
        };
      }

      // Add playoff line info
      const playoffTeams = standings
        .filter(t => t.conferenceSequence <= 8)
        .map(t => t.teamAbbrev.default);

      const wildcardTeams = standings
        .filter(t => t.wildcardSequence > 0 && t.wildcardSequence <= 2)
        .map(t => t.teamAbbrev.default);

      return JSON.stringify({
        success: true,
        as_of: date || 'current',
        standings: result,
        playoff_picture: {
          in_playoff_position: playoffTeams,
          wildcard_teams: wildcardTeams,
          total_playoff_teams: playoffTeams.length,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
