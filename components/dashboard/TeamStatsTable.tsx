'use client';

import { useState, useMemo } from 'react';

type SortField = 'rank' | 'teamName' | 'conference' | 'division' | 'record' | 'points' |
  'periodsWon' | 'periodsLost' | 'periodsTied' | 'goodWins' | 'badWins' | 'difference';
type SortDirection = 'asc' | 'desc';

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
  rank?: number;
  rankScore?: number;
}

interface TeamStatsTableProps {
  data: TeamData[];
  viewMode: 'playoffs' | 'schedule' | 'full-stats';
  isLoading?: boolean;
}

// Team color mapping for team abbreviations (hex colors)
const teamColors: Record<string, string> = {
  ANA: '#F47A38',
  BOS: '#FFB81C',
  BUF: '#003087',
  CGY: '#D2001C',
  CAR: '#CE1126',
  CHI: '#CF0A2C',
  COL: '#6F263D',
  CBJ: '#002654',
  DAL: '#006847',
  DET: '#CE1126',
  EDM: '#FF4C00',
  FLA: '#C8102E',
  LAK: '#111111',
  MIN: '#154734',
  MTL: '#AF1E2D',
  NSH: '#FFB81C',
  NJD: '#CE1126',
  NYI: '#00539B',
  NYR: '#0038A8',
  OTT: '#C52032',
  PHI: '#F74902',
  PIT: '#FCB514',
  SJS: '#006D75',
  SEA: '#001628',
  STL: '#002F87',
  TBL: '#002868',
  TOR: '#00205B',
  UTA: '#6CACE4',
  VAN: '#00205B',
  VGK: '#B4975A',
  WSH: '#C8102E',
  WPG: '#041E42',
};

function getTeamColor(teamCode: string): string {
  return teamColors[teamCode] || '#6B7280';
}

export function TeamStatsTable({ data, viewMode, isLoading }: TeamStatsTableProps) {
  const [sortField, setSortField] = useState<SortField>('goodWins');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // Default to descending for numeric fields, ascending for text
      setSortDirection(['teamName', 'conference', 'division'].includes(field) ? 'asc' : 'desc');
    }
  };

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'rank':
          aVal = a.rank || 0;
          bVal = b.rank || 0;
          break;
        case 'teamName':
          aVal = a.teamName?.toLowerCase() || '';
          bVal = b.teamName?.toLowerCase() || '';
          break;
        case 'conference':
          aVal = a.conference?.toLowerCase() || '';
          bVal = b.conference?.toLowerCase() || '';
          break;
        case 'division':
          aVal = a.division?.toLowerCase() || '';
          bVal = b.division?.toLowerCase() || '';
          break;
        case 'record':
          aVal = a.record.wins;
          bVal = b.record.wins;
          break;
        case 'points':
          aVal = a.points;
          bVal = b.points;
          break;
        case 'periodsWon':
          aVal = a.periodsWon;
          bVal = b.periodsWon;
          break;
        case 'periodsLost':
          aVal = a.periodsLost;
          bVal = b.periodsLost;
          break;
        case 'periodsTied':
          aVal = a.periodsTied;
          bVal = b.periodsTied;
          break;
        case 'goodWins':
          aVal = a.goodWins;
          bVal = b.goodWins;
          break;
        case 'badWins':
          aVal = a.badWins;
          bVal = b.badWins;
          break;
        case 'difference':
          aVal = a.difference;
          bVal = b.difference;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [data, sortField, sortDirection]);

  const SortHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-[#888] uppercase tracking-wider cursor-pointer hover:bg-[#2a2a2a] select-none transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className={sortField === field ? 'text-[#3ecf8e]' : 'text-[#555]'}>
          {sortField === field ? (
            sortDirection === 'asc' ? '↑' : '↓'
          ) : (
            <span className="opacity-0 group-hover:opacity-50">↕</span>
          )}
        </span>
      </div>
    </th>
  );

  if (viewMode !== 'playoffs') {
    return (
      <div className="p-12 text-center text-[#888]">
        {viewMode === 'schedule'
          ? 'Schedule view coming soon...'
          : 'Full stats view coming soon...'}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="text-[#888] text-sm">
          <svg className="w-8 h-8 mx-auto mb-3 text-[#3ecf8e] animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-[#ccc] font-medium">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-[#888] text-sm">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-[#ccc] font-medium mb-1">No team data available</p>
          <p className="text-[#888] text-xs">Use the chat to query and analyze NHL data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-[#232323] border-b border-[#2e2e2e]">
          <tr>
            <SortHeader field="rank" className="text-center">
              Rank
            </SortHeader>
            <SortHeader field="teamName">
              Team
            </SortHeader>
            <SortHeader field="conference">
              Conf
            </SortHeader>
            <SortHeader field="division">
              Division
            </SortHeader>
            <SortHeader field="record">
              Record
            </SortHeader>
            <SortHeader field="points">
              Pts
            </SortHeader>
            <SortHeader field="periodsWon" className="text-center">
              P Won
            </SortHeader>
            <SortHeader field="periodsLost" className="text-center">
              P Lost
            </SortHeader>
            <SortHeader field="periodsTied" className="text-center">
              P Tied
            </SortHeader>
            <SortHeader field="goodWins" className="text-center">
              Good W
            </SortHeader>
            <SortHeader field="badWins" className="text-center">
              Bad W
            </SortHeader>
            <SortHeader field="difference" className="text-center">
              Diff
            </SortHeader>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2e2e2e]">
          {sortedData.map((team, idx) => (
            <tr key={idx} className="hover:bg-[#232323] transition-colors">
              <td className="px-4 py-3 whitespace-nowrap text-center">
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-[#3ecf8e]">{team.rank || idx + 1}</span>
                  {team.rankScore !== undefined && (
                    <span className="text-[10px] text-[#888]">{team.rankScore}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center">
                  <div
                    className="flex-shrink-0 h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: getTeamColor(team.teamCode) }}
                  >
                    {team.teamCode}
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-white">
                      {team.teamName}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-[#ccc]">
                {team.conference || '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-[#ccc]">
                {team.division || '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-white font-mono">
                {team.record.wins === 0 && team.record.losses === 0 && team.record.otLosses === 0
                  ? '-'
                  : `${team.record.wins}-${team.record.losses}-${team.record.otLosses}`}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-white">
                {team.points === 0 ? '-' : team.points}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-[#ccc]">
                {team.periodsWon === 0 ? '-' : team.periodsWon}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-[#ccc]">
                {team.periodsLost === 0 ? '-' : team.periodsLost}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-[#ccc]">
                {team.periodsTied === 0 ? '-' : team.periodsTied}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-[#3ecf8e] font-semibold">
                {team.goodWins === 0 ? '-' : team.goodWins}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-[#f87171] font-semibold">
                {team.badWins === 0 ? '-' : team.badWins}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold">
                <span className={team.difference > 0 ? 'text-[#3ecf8e]' : team.difference < 0 ? 'text-[#f87171]' : 'text-[#888]'}>
                  {team.goodWins === 0 && team.badWins === 0 ? '-' : team.difference > 0 ? `+${team.difference}` : team.difference}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
