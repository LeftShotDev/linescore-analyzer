'use client';

interface DashboardControlsProps {
  selectedViewMode: 'playoffs' | 'schedule' | 'full-stats';
  setSelectedViewMode: (mode: 'playoffs' | 'schedule' | 'full-stats') => void;
  conferenceFilter: 'all' | 'eastern' | 'western';
  setConferenceFilter: (filter: 'all' | 'eastern' | 'western') => void;
  divisionFilter: 'all' | 'metropolitan' | 'atlantic' | 'central' | 'pacific';
  setDivisionFilter: (filter: 'all' | 'metropolitan' | 'atlantic' | 'central' | 'pacific') => void;
  seasonFilter: string;
  setSeasonFilter: (season: string) => void;
  availableSeasons: string[];
  selectedTeamsCount: number;
}

function formatSeasonLabel(season: string): string {
  // Convert "2024-2025" to "2024-25"
  if (season.includes('-')) {
    const [start, end] = season.split('-');
    return `${start}-${end.slice(-2)}`;
  }
  return season;
}

// Conference to divisions mapping
const conferenceDivisions: Record<string, { value: string; label: string }[]> = {
  eastern: [
    { value: 'metropolitan', label: 'Metropolitan' },
    { value: 'atlantic', label: 'Atlantic' },
  ],
  western: [
    { value: 'central', label: 'Central' },
    { value: 'pacific', label: 'Pacific' },
  ],
};

const allDivisions = [
  { value: 'metropolitan', label: 'Metropolitan' },
  { value: 'atlantic', label: 'Atlantic' },
  { value: 'central', label: 'Central' },
  { value: 'pacific', label: 'Pacific' },
];

export function DashboardControls({
  selectedViewMode,
  setSelectedViewMode,
  conferenceFilter,
  setConferenceFilter,
  divisionFilter,
  setDivisionFilter,
  seasonFilter,
  setSeasonFilter,
  availableSeasons,
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

      {/* Season Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Season</label>
        <div className="relative">
          <select
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {availableSeasons.map((season) => (
              <option key={season} value={season}>
                {formatSeasonLabel(season)}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Conference Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Conference</label>
        <div className="relative">
          <select
            value={conferenceFilter}
            onChange={(e) => {
              const newConference = e.target.value as 'all' | 'eastern' | 'western';
              setConferenceFilter(newConference);
              // Reset division if it's not valid for the new conference
              if (newConference !== 'all' && divisionFilter !== 'all') {
                const validDivisions = conferenceDivisions[newConference].map(d => d.value);
                if (!validDivisions.includes(divisionFilter)) {
                  setDivisionFilter('all');
                }
              }
            }}
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
            {(conferenceFilter === 'all' ? allDivisions : conferenceDivisions[conferenceFilter]).map((division) => (
              <option key={division.value} value={division.value}>
                {division.label}
              </option>
            ))}
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
