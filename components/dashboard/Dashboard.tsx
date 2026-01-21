'use client';

import { useState, useEffect } from 'react';
import { TeamStatsTable } from './TeamStatsTable';
import { DashboardControls } from './DashboardControls';
import { ChatInterface } from '../chat/ChatInterface';

export function Dashboard() {
  const [selectedViewMode, setSelectedViewMode] = useState<'playoffs' | 'schedule' | 'full-stats'>('playoffs');
  const [conferenceFilter, setConferenceFilter] = useState<'all' | 'eastern' | 'western'>('all');
  const [divisionFilter, setDivisionFilter] = useState<'all' | 'metropolitan' | 'atlantic' | 'central' | 'pacific'>('all');
  const [teamData, setTeamData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch teams from the database on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams');
        const data = await response.json();

        if (data.teams) {
          // Transform database teams to match the table format
          const transformedTeams = data.teams.map((team: any) => ({
            teamCode: team.team_code,
            teamName: team.team_name,
            conference: team.conference,
            division: team.division,
            record: { wins: 0, losses: 0, otLosses: 0 },
            points: 0,
            periodsWon: 0,
            periodsLost: 0,
            periodsTied: 0,
            goodWins: 0,
            badWins: 0,
            difference: 0,
          }));
          setTeamData(transformedTeams);
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, []);

  // Filter data based on conference and division
  const filteredData = teamData.filter((team) => {
    let passesConferenceFilter = true;
    let passesDivisionFilter = true;

    if (conferenceFilter !== 'all') {
      passesConferenceFilter = team.conference?.toLowerCase() === conferenceFilter;
    }

    if (divisionFilter !== 'all') {
      passesDivisionFilter = team.division?.toLowerCase() === divisionFilter;
    }

    return passesConferenceFilter && passesDivisionFilter;
  });

  const selectedTeamsCount = filteredData.length;

  return (
    <div className="flex h-screen bg-gray-50 justify-center">
      <div className="flex w-full max-w-[1440px]">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Section with Controls */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h1 className="text-xl font-semibold text-gray-900">NHL Analytics Dashboard</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1">Comprehensive team statistics and playoff predictions.</p>
            </div>
          </div>

          <DashboardControls
            selectedViewMode={selectedViewMode}
            setSelectedViewMode={setSelectedViewMode}
            conferenceFilter={conferenceFilter}
            setConferenceFilter={setConferenceFilter}
            divisionFilter={divisionFilter}
            setDivisionFilter={setDivisionFilter}
            selectedTeamsCount={selectedTeamsCount}
          />
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto bg-white">
          <TeamStatsTable data={filteredData} viewMode={selectedViewMode} isLoading={isLoading} />
        </div>
      </div>

        {/* Right Panel - Chat Interface */}
        <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
