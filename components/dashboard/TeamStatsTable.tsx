'use client';

interface TeamRecord {
  wins: number;
  losses: number;
  otLosses: number;
}

interface TeamData {
  teamCode: string;
  teamName: string;
  conference?: string;
  division?: string;
  record: TeamRecord;
  points: number;
  periodsWon: number;
  periodsLost: number;
  periodsTied: number;
  goodWins: number;
  badWins: number;
  difference: number;
}

interface TeamStatsTableProps {
  data: TeamData[];
  viewMode: 'playoffs' | 'schedule' | 'full-stats';
  isLoading?: boolean;
}

// Team color mapping for team abbreviations
const teamColors: Record<string, string> = {
  COL: 'bg-blue-600',
  TBL: 'bg-blue-500',
  EDM: 'bg-orange-500',
  CAR: 'bg-red-600',
  DAL: 'bg-green-600',
  ANA: 'bg-yellow-500',
  BOS: 'bg-yellow-600',
  TOR: 'bg-blue-700',
  NYR: 'bg-blue-400',
  FLA: 'bg-red-500',
  VGK: 'bg-gray-700',
  MIN: 'bg-green-500',
  // Add more team colors as needed
};

function getTeamColor(teamCode: string): string {
  return teamColors[teamCode] || 'bg-gray-500';
}

export function TeamStatsTable({ data, viewMode, isLoading }: TeamStatsTableProps) {
  if (viewMode !== 'playoffs') {
    return (
      <div className="p-6 text-center text-gray-500">
        {viewMode === 'schedule'
          ? 'Schedule view coming soon...'
          : 'Full stats view coming soon...'}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 text-sm">
          <svg className="w-8 h-8 mx-auto mb-3 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-gray-600 font-medium">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 text-sm">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 font-medium mb-1">No team data available</p>
          <p className="text-gray-500 text-xs">Use the chat to query and analyze NHL data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Conference
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Division
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Record
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Points
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                Periods Won
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                Periods Lost
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                Periods Tied
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                Good Wins
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">
                Bad Wins
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-100">
                Difference
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((team, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 h-8 w-8 rounded flex items-center justify-center text-white text-xs font-bold ${getTeamColor(team.teamCode)}`}>
                      {team.teamCode}
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">
                        {team.teamName}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  {team.conference || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  {team.division || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {team.record.wins === 0 && team.record.losses === 0 && team.record.otLosses === 0
                    ? '-'
                    : `${team.record.wins} - ${team.record.losses} - ${team.record.otLosses}`}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                  {team.points === 0 ? '-' : team.points.toFixed(1)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-50 text-gray-700">
                  {team.periodsWon === 0 ? '-' : team.periodsWon}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-50 text-gray-700">
                  {team.periodsLost === 0 ? '-' : team.periodsLost}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-50 text-gray-700">
                  {team.periodsTied === 0 ? '-' : team.periodsTied}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-green-50 text-green-700 font-semibold">
                  {team.goodWins === 0 ? '-' : team.goodWins}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-red-50 text-red-700 font-semibold">
                  {team.badWins === 0 ? '-' : team.badWins}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-100 text-gray-900 font-bold">
                  {team.goodWins === 0 && team.badWins === 0 ? '-' : team.difference > 0 ? `+${team.difference}` : team.difference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
