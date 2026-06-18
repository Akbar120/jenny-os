'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Lead, Mission } from '../../types';
import IntakeForm from '../../components/IntakeForm';
import LeadCard from '../../components/LeadCard';
import LeadDetail from '../../components/LeadDetail';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = async (missionId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeMissionId = missionId !== undefined ? missionId : selectedMissionId;
      const queryId = activeMissionId === 'all' ? undefined : activeMissionId;
      
      const [leadsData, missionsData] = await Promise.all([
        api.getLeads(50, 0, queryId),
        api.getMissions()
      ]);
      
      setLeads(leadsData);
      setMissions(missionsData);
      
      // Auto-select lead if none is selected
      if (leadsData.length > 0) {
        setSelectedLead(leadsData[0]);
      } else {
        setSelectedLead(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve leads.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleAnalyzeSuccess = (newLead: Lead) => {
    // If the active filter is 'all' or matches the new lead's mission_id, prepend it
    if (selectedMissionId === 'all' || selectedMissionId === newLead.mission_id) {
      const exists = leads.find((l) => l.id === newLead.id);
      if (!exists) {
        setLeads((prev) => [newLead, ...prev]);
      }
    }
    setSelectedLead(newLead);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-900 px-8 flex items-center justify-between shrink-0 bg-zinc-950/20">
        <div>
          <h2 className="text-md font-semibold text-zinc-100">Leads Hub</h2>
          <p className="text-xs text-zinc-500 font-mono">Manage, analyze, and qualify incoming prospects</p>
        </div>
        <button
          onClick={() => loadLeads()}
          className="border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition duration-200 cursor-pointer select-none flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh List
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6 bg-zinc-900/10">
        {/* Left Column: Intake + List */}
        <div className="w-[420px] flex flex-col h-full gap-4 shrink-0">
          <IntakeForm onAnalyzeSuccess={handleAnalyzeSuccess} missions={missions} />

          {/* Leads scroll list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Leads Inbox ({leads.length})
              </span>
              
              {/* Mission Selector Filter */}
              <select
                aria-label="Campaign Selection Filter"
                value={selectedMissionId}
                onChange={(e) => {
                  setSelectedMissionId(e.target.value);
                  loadLeads(e.target.value);
                }}
                className="bg-zinc-950 border border-zinc-900 text-[10px] font-mono text-zinc-400 rounded-md px-2 py-1 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">ALL CAMPAIGNS</option>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.mission_name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {isLoading && leads.length === 0 ? (
              // Loading Skeleton list
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="border border-zinc-900/60 rounded-xl p-4 bg-zinc-950/40 animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 w-16 bg-zinc-800 rounded"></div>
                    <div className="h-4 w-12 bg-zinc-800 rounded"></div>
                  </div>
                  <div className="h-3.5 w-full bg-zinc-800 rounded"></div>
                  <div className="h-3.5 w-2/3 bg-zinc-800 rounded"></div>
                  <div className="flex justify-between">
                    <div className="h-3 w-20 bg-zinc-800 rounded"></div>
                    <div className="h-3 w-16 bg-zinc-800 rounded"></div>
                  </div>
                </div>
              ))
            ) : error && leads.length === 0 ? (
              <div className="text-center py-12 border border-zinc-900 rounded-xl bg-zinc-950/20">
                <p className="text-sm text-red-400 font-medium">Error Loading Leads</p>
                <p className="text-xs text-zinc-500 mt-1">{error}</p>
                <button
                  onClick={() => loadLeads()}
                  className="mt-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 select-none"
                >
                  Retry
                </button>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16 border border-zinc-900 rounded-xl bg-zinc-950/20 text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 mx-auto text-zinc-700 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v2.3a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25v-2.3m16.5 0c0-.52-.39-.97-.94-1.03l-2.73-.3a2.233 2.233 0 0 0-1.62.53l-1.3 1.05a2.25 2.25 0 0 1-3 0l-1.3-1.05a2.233 2.233 0 0 0-1.62-.53l-2.73.3c-.55.06-.94.5-.94 1.03m16.5 0a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25m16.5 0V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v8.15" />
                </svg>
                <p className="text-xs">No leads analyzed yet.</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Use the intake form above to add your first lead.</p>
              </div>
            ) : (
              leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isSelected={selectedLead?.id === lead.id}
                  onClick={() => setSelectedLead(lead)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: Sticky Detail Panel */}
        <div className="flex-1 h-full min-w-0">
          <LeadDetail lead={selectedLead} />
        </div>
      </div>
    </div>
  );
}
