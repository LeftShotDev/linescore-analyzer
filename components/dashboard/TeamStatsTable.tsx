'use client';

interface TeamRecord {
  wins: number;
  losses: number;
  otLosses: number;
}

interface TeamData {
  teamCode: string;
  teamName: string;
  record: TeamRecord;
  points: number;
  playoffs: number;
  divisionFinal: number;
  conferenceFinal: number;
  stanleyCupFinal: number;
  stanleyCup: number;
}

interface TeamStatsTableProps {
  data: TeamData[];
  viewMode: 'playoffs' | 'schedule' | 'full-stats';
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

export function TeamStatsTable({ data, viewMode }: TeamStatsTableProps) {
  if (viewMode !== 'playoffs') {
    return (
      <div className="p-6 text-center text-gray-500">
        {viewMode === 'schedule'
          ? 'Schedule view coming soon...'
          : 'Full stats view coming soon...'}
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
                Record
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Points
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                Playoffs
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                Division Final
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                Conference Final
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                Stanley Cup Final
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-100">
                Stanley Cup
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
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {team.record.wins} - {team.record.losses} - {team.record.otLosses}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                  {team.points.toFixed(1)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-50">
                  {team.playoffs.toFixed(1)}%
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-50">
                  {team.divisionFinal.toFixed(1)}%
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-50">
                  {team.conferenceFinal.toFixed(1)}%
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-50">
                  {team.stanleyCupFinal.toFixed(1)}%
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center bg-blue-100">
                  {team.stanleyCup.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
