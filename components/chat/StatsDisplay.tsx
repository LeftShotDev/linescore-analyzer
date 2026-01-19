'use client';

interface PeriodStats {
  period_number: number;
  games_played: number;
  wins: number;
  losses: number;
  ties: number;
  win_percentage: number;
  avg_goals_for: number;
  avg_goals_against: number;
  goal_differential: number;
}

interface OverallStats {
  total_games: number;
  total_periods: number;
  period_stats: PeriodStats[];
  regulation_periods_won_2_plus: {
    count: number;
    percentage: number;
  };
  first_period_performance: {
    wins: number;
    win_percentage: number;
    correlation_with_game_wins: number;
  };
}

interface StatsDisplayProps {
  stats: OverallStats;
  teamCode?: string;
}

export function StatsDisplay({ stats, teamCode }: StatsDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">
            Total Games
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-1">
            {stats.total_games}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs font-medium text-green-600 uppercase tracking-wide">
            Won 2+ Reg Periods
          </div>
          <div className="text-2xl font-bold text-green-900 mt-1">
            {stats.regulation_periods_won_2_plus.percentage.toFixed(1)}%
          </div>
          <div className="text-xs text-green-700 mt-1">
            {stats.regulation_periods_won_2_plus.count} games
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="text-xs font-medium text-purple-600 uppercase tracking-wide">
            1st Period Win%
          </div>
          <div className="text-2xl font-bold text-purple-900 mt-1">
            {stats.first_period_performance.win_percentage.toFixed(1)}%
          </div>
          <div className="text-xs text-purple-700 mt-1">
            {stats.first_period_performance.wins} wins
          </div>
        </div>
      </div>

      {/* Period-by-Period Stats Table */}
      <div className="overflow-x-auto">
        <div className="text-sm font-semibold text-gray-700 mb-2">
          Period-by-Period Performance
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                GP
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                W-L-T
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Win %
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg GF
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg GA
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Goal Diff
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stats.period_stats.map((period) => (
              <tr key={period.period_number} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                  Period {period.period_number}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap text-gray-900">
                  {period.games_played}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap text-gray-700">
                  {period.wins}-{period.losses}-{period.ties}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center space-x-2">
                    <span className="font-semibold text-gray-900">
                      {period.win_percentage.toFixed(1)}%
                    </span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${period.win_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap text-gray-900">
                  {period.avg_goals_for.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap text-gray-900">
                  {period.avg_goals_against.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span
                    className={`font-semibold ${
                      period.goal_differential > 0
                        ? 'text-green-600'
                        : period.goal_differential < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {period.goal_differential > 0 ? '+' : ''}
                    {period.goal_differential}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key Insights */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-700 mb-2">
          Key Insights
        </div>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start">
            <svg
              className="w-4 h-4 text-blue-600 mr-2 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              Won 2+ regulation periods in{' '}
              <strong>{stats.regulation_periods_won_2_plus.percentage.toFixed(1)}%</strong>{' '}
              of games ({stats.regulation_periods_won_2_plus.count} games)
            </span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-4 h-4 text-blue-600 mr-2 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              First period win percentage:{' '}
              <strong>{stats.first_period_performance.win_percentage.toFixed(1)}%</strong>
            </span>
          </li>
          {stats.period_stats.length > 0 && (() => {
            const bestPeriod = stats.period_stats.reduce((best, current) =>
              current.win_percentage > best.win_percentage ? current : best
            );
            return (
              <li className="flex items-start">
                <svg
                  className="w-4 h-4 text-blue-600 mr-2 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  Strongest period: <strong>Period {bestPeriod.period_number}</strong> with{' '}
                  {bestPeriod.win_percentage.toFixed(1)}% win rate
                </span>
              </li>
            );
          })()}
        </ul>
      </div>
    </div>
  );
}
