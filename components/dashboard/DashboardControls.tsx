'use client';

interface DashboardControlsProps {
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
    <div className="flex items-center gap-6 flex-wrap">
      {/* Season Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[#888]">Season</label>
        <div className="relative">
          <select
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="appearance-none bg-[#232323] border border-[#2e2e2e] rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e]"
          >
            {availableSeasons.map((season) => (
              <option key={season} value={season}>
                {formatSeasonLabel(season)}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Conference Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[#888]">Conference</label>
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
            className="appearance-none bg-[#232323] border border-[#2e2e2e] rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e]"
          >
            <option value="all">All</option>
            <option value="eastern">Eastern</option>
            <option value="western">Western</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Division Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[#888]">Division</label>
        <div className="relative">
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value as any)}
            className="appearance-none bg-[#232323] border border-[#2e2e2e] rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#3ecf8e] focus:border-[#3ecf8e]"
          >
            <option value="all">All</option>
            {(conferenceFilter === 'all' ? allDivisions : conferenceDivisions[conferenceFilter]).map((division) => (
              <option key={division.value} value={division.value}>
                {division.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="w-px h-6 bg-[#2e2e2e]" />

      {/* Teams Count Display */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#888]">{selectedTeamsCount} teams</span>
      </div>
    </div>
  );
}
