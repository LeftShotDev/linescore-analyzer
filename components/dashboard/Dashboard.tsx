'use client';

import { useState, useEffect } from 'react';
import { TeamStatsTable } from './TeamStatsTable';
import { DashboardControls } from './DashboardControls';
import { ChatInterface } from '../chat/ChatInterface';

export function Dashboard() {
	const [selectedViewMode, setSelectedViewMode] = useState<'playoffs' | 'schedule' | 'full-stats'>('playoffs');
	const [conferenceFilter, setConferenceFilter] = useState<'all' | 'eastern' | 'western'>('all');
	const [divisionFilter, setDivisionFilter] = useState<'all' | 'metropolitan' | 'atlantic' | 'central' | 'pacific'>('all');
	const [seasonFilter, setSeasonFilter] = useState<string>('');
	const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
	const [teamData, setTeamData] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Fetch team stats from the database
	useEffect(() => {
		const fetchTeamStats = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams();
				if (seasonFilter) {
					params.set('season', seasonFilter);
				}
				const url = `/api/team-stats${params.toString() ? `?${params.toString()}` : ''}`;
				const response = await fetch(url);
				const data = await response.json();

				if (data.teamStats) {
					setTeamData(data.teamStats);
				}
				if (data.seasons) {
					setAvailableSeasons(data.seasons);
				}
				// Use the active season from API (defaults to most recent)
				if (data.activeSeason && !seasonFilter) {
					setSeasonFilter(data.activeSeason);
				}
			} catch (error) {
				console.error('Error fetching team stats:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchTeamStats();
	}, [seasonFilter]);

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
		<div className="flex h-screen bg-[#171717]">
			<div className="flex w-full">
				{/* Main Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{/* Top Section with Controls */}
					<div className="bg-[#1c1c1c] border-b border-[#2e2e2e] px-8 py-6">
						<div className="flex items-center justify-between mb-6">
							<div>
								<div className="flex items-center gap-3">
									<div className="p-2 bg-[#3ecf8e]/10 rounded-lg">
										<svg className="w-5 h-5 text-[#3ecf8e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
										</svg>
									</div>
									<div>
										<h1 className="text-xl font-semibold text-white">NHL Analytics Dashboard</h1>
										<p className="text-sm text-[#888] mt-0.5">Comprehensive team statistics and playoff predictions</p>
									</div>
								</div>
							</div>
						</div>

						<DashboardControls
							selectedViewMode={selectedViewMode}
							setSelectedViewMode={setSelectedViewMode}
							conferenceFilter={conferenceFilter}
							setConferenceFilter={setConferenceFilter}
							divisionFilter={divisionFilter}
							setDivisionFilter={setDivisionFilter}
							seasonFilter={seasonFilter}
							setSeasonFilter={setSeasonFilter}
							availableSeasons={availableSeasons}
							selectedTeamsCount={selectedTeamsCount}
						/>
					</div>

					{/* Data Table */}
					<div className="flex-1 overflow-auto bg-[#171717] p-6">
						<div className="bg-[#1c1c1c] rounded-lg border border-[#2e2e2e] overflow-hidden">
							<TeamStatsTable data={filteredData} viewMode={selectedViewMode} isLoading={isLoading} />
						</div>
					</div>
				</div>

				{/* Right Panel - Chat Interface */}
				<div className="w-[400px] border-l border-[#2e2e2e] bg-[#1c1c1c] flex flex-col overflow-hidden">
					<ChatInterface />
				</div>
			</div>
		</div>
	);
}
