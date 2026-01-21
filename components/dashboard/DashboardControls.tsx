'use client';

interface DashboardControlsProps {
  selectedViewMode: 'playoffs' | 'schedule' | 'full-stats';
  setSelectedViewMode: (mode: 'playoffs' | 'schedule' | 'full-stats') => void;
  conferenceFilter: 'all' | 'eastern' | 'western';
  setConferenceFilter: (filter: 'all' | 'eastern' | 'western') => void;
  divisionFilter: 'all' | 'metropolitan' | 'atlantic' | 'central' | 'pacific';
  setDivisionFilter: (filter: 'all' | 'metropolitan' | 'atlantic' | 'central' | 'pacific') => void;
  selectedTeamsCount: number;
}

export function DashboardControls({
  selectedViewMode,
  setSelectedViewMode,
  conferenceFilter,
  setConferenceFilter,
  divisionFilter,
  setDivisionFilter,
  selectedTeamsCount,
}: DashboardControlsProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">View Mode</label>
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setSelectedViewMode('playoffs')}
            className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
              selectedViewMode === 'playoffs'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Playoffs
          </button>
          <button
            type="button"
            onClick={() => setSelectedViewMode('schedule')}
            className={`px-4 py-2 text-sm font-medium border-t border-b ${
              selectedViewMode === 'schedule'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={() => setSelectedViewMode('full-stats')}
            className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
              selectedViewMode === 'full-stats'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Full Stats
          </button>
        </div>
      </div>

      {/* Conference Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Conference</label>
        <div className="relative">
          <select
            value={conferenceFilter}
            onChange={(e) => setConferenceFilter(e.target.value as any)}
            className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Conferences</option>
            <option value="eastern">Eastern</option>
            <option value="western">Western</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Division Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Division</label>
        <div className="relative">
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value as any)}
            className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Divisions</option>
            <option value="metropolitan">Metropolitan</option>
            <option value="atlantic">Atlantic</option>
            <option value="central">Central</option>
            <option value="pacific">Pacific</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Teams Count Display */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Showing {selectedTeamsCount} teams</span>
      </div>
    </div>
  );
}
