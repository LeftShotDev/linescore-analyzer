'use client';

import { useState } from 'react';
import { TeamStatsTable } from './TeamStatsTable';
import { DashboardControls } from './DashboardControls';
import { ChatInterface } from '../chat/ChatInterface';

export function Dashboard() {
  const [selectedViewMode, setSelectedViewMode] = useState<'playoffs' | 'schedule' | 'full-stats'>('playoffs');
  const [teamFilter, setTeamFilter] = useState<'top-16' | 'all'>('all');
  const [selectedTeamsCount, setSelectedTeamsCount] = useState(32);

  // Mock data - in a real app, this would come from an API or database
  const mockTeamData = [
    {
      teamCode: 'COL',
      teamName: 'Colorado Avalanche',
      record: { wins: 59, losses: 13, otLosses: 10 },
      points: 128.7,
      playoffs: 99.8,
      divisionFinal: 96.6,
      conferenceFinal: 66.8,
      stanleyCupFinal: 47.8,
      stanleyCup: 47.8,
    },
    {
      teamCode: 'TBL',
      teamName: 'Tampa Bay Lightning',
      record: { wins: 54, losses: 22, otLosses: 6 },
      points: 113.9,
      playoffs: 99.7,
      divisionFinal: 85.2,
      conferenceFinal: 68.7,
      stanleyCupFinal: 30.2,
      stanleyCup: 30.2,
    },
    {
      teamCode: 'EDM',
      teamName: 'Edmonton Oilers',
      record: { wins: 51, losses: 25, otLosses: 7 },
      points: 108.5,
      playoffs: 94.6,
      divisionFinal: 67.0,
      conferenceFinal: 33.9,
      stanleyCupFinal: 7.9,
      stanleyCup: 7.9,
    },
    {
      teamCode: 'CAR',
      teamName: 'Carolina Hurricanes',
      record: { wins: 49, losses: 26, otLosses: 7 },
      points: 105.6,
      playoffs: 97.8,
      divisionFinal: 65.6,
      conferenceFinal: 38.4,
      stanleyCupFinal: 6.0,
      stanleyCup: 6.0,
    },
    {
      teamCode: 'DAL',
      teamName: 'Dallas Stars',
      record: { wins: 46, losses: 23, otLosses: 13 },
      points: 105.2,
      playoffs: 99.5,
      divisionFinal: 54.1,
      conferenceFinal: 15.8,
      stanleyCupFinal: 2.7,
      stanleyCup: 2.7,
    },
    {
      teamCode: 'BOS',
      teamName: 'Boston Bruins',
      record: { wins: 48, losses: 24, otLosses: 10 },
      points: 106.0,
      playoffs: 98.5,
      divisionFinal: 72.3,
      conferenceFinal: 45.2,
      stanleyCupFinal: 18.5,
      stanleyCup: 18.5,
    },
    {
      teamCode: 'TOR',
      teamName: 'Toronto Maple Leafs',
      record: { wins: 47, losses: 25, otLosses: 10 },
      points: 104.0,
      playoffs: 96.2,
      divisionFinal: 68.9,
      conferenceFinal: 42.1,
      stanleyCupFinal: 15.3,
      stanleyCup: 15.3,
    },
    {
      teamCode: 'NYR',
      teamName: 'New York Rangers',
      record: { wins: 45, losses: 27, otLosses: 10 },
      points: 100.0,
      playoffs: 89.3,
      divisionFinal: 58.7,
      conferenceFinal: 32.4,
      stanleyCupFinal: 9.8,
      stanleyCup: 9.8,
    },
    {
      teamCode: 'FLA',
      teamName: 'Florida Panthers',
      record: { wins: 44, losses: 28, otLosses: 10 },
      points: 98.0,
      playoffs: 85.6,
      divisionFinal: 52.3,
      conferenceFinal: 28.9,
      stanleyCupFinal: 7.2,
      stanleyCup: 7.2,
    },
    {
      teamCode: 'VGK',
      teamName: 'Vegas Golden Knights',
      record: { wins: 43, losses: 29, otLosses: 10 },
      points: 96.0,
      playoffs: 78.4,
      divisionFinal: 48.2,
      conferenceFinal: 25.6,
      stanleyCupFinal: 5.1,
      stanleyCup: 5.1,
    },
    {
      teamCode: 'MIN',
      teamName: 'Minnesota Wild',
      record: { wins: 42, losses: 30, otLosses: 10 },
      points: 94.0,
      playoffs: 72.1,
      divisionFinal: 42.8,
      conferenceFinal: 21.3,
      stanleyCupFinal: 3.8,
      stanleyCup: 3.8,
    },
    {
      teamCode: 'ANA',
      teamName: 'Anaheim Ducks',
      record: { wins: 39, losses: 37, otLosses: 6 },
      points: 84.1,
      playoffs: 31.9,
      divisionFinal: 7.1,
      conferenceFinal: 2.1,
      stanleyCupFinal: 0.1,
      stanleyCup: 0.1,
    },
  ];

  const filteredData = teamFilter === 'top-16'
    ? mockTeamData.slice(0, 16)
    : mockTeamData;

  return (
    <div className="flex h-screen bg-gray-50">
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
            teamFilter={teamFilter}
            setTeamFilter={setTeamFilter}
            selectedTeamsCount={selectedTeamsCount}
            setSelectedTeamsCount={setSelectedTeamsCount}
          />
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto bg-white">
          <TeamStatsTable data={filteredData} viewMode={selectedViewMode} />
        </div>
      </div>

      {/* Right Panel - Chat Interface */}
      <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
        <ChatInterface />
      </div>
    </div>
  );
}
