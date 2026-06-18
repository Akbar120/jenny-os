'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function AgentsPage() {
  const [totalLeads, setTotalLeads] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await api.getStats();
        setTotalLeads(stats.total);
      } catch (err) {
        console.error('Failed to retrieve agent stats:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden max-w-6xl mx-auto w-full p-8 space-y-6">
      {/* Top Header */}
      <header className="shrink-0">
        <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Active Agents registry</h2>
        <p className="text-xs text-zinc-500 font-mono">Status registry of AI cognitive units available in Jenny OS</p>
      </header>

      {/* Agents Grid list */}
      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Agent Card 1: Lead Hunter */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-5">
          {/* Card Title & Icon */}
          <div className="flex justify-between items-start">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-zinc-950 font-extrabold text-xl select-none">
                LH
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Lead Hunter Agent</h3>
                <span className="text-[10px] font-mono text-zinc-500">Service Area: Intake & Qualifying</span>
              </div>
            </div>

            {/* Status Pulse */}
            <span className="flex items-center gap-1.5 px-2 py-0.5 border border-emerald-950 bg-emerald-950/20 text-emerald-400 text-[10px] font-mono rounded-full font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              ONLINE
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-zinc-400 leading-relaxed font-normal">
            Processes unstructured text content from manuals, posts, or transcripts. Formulates candidate classifications, extracts service fields, resolves channels, and computes qualifying scores using structured cognitive mapping.
          </p>

          {/* Model Attributes */}
          <div className="grid grid-cols-2 gap-4 border-y border-zinc-900/60 py-4 text-[11px] font-mono text-zinc-500">
            <div>
              <span>COGNITIVE ENGINE</span>
              <p className="text-zinc-300 font-semibold mt-0.5">gemma3:4b</p>
            </div>
            <div>
              <span>DEPLOYMENT MODE</span>
              <p className="text-zinc-300 font-semibold mt-0.5">Ollama Local API</p>
            </div>
            <div>
              <span>LEADS ANALYZED</span>
              <p className="text-zinc-300 font-semibold mt-0.5">
                {isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  totalLeads ?? 0
                )}
              </p>
            </div>
            <div>
              <span>MAX CONTEXT</span>
              <p className="text-zinc-300 font-semibold mt-0.5">8K Tokens</p>
            </div>
          </div>

          {/* Capability Details */}
          <div className="space-y-2">
            <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider">Functional Schema outputs</span>
            <ul className="space-y-1 text-xs text-zinc-400 font-normal">
              <li className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-cyan-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Intent validation (hire / promotion / opinion / other)</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-cyan-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Classification (UEFN / Roblox / Unity / Indie)</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-cyan-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Deduplication md5 matching</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Future Agent Placeholder Card */}
        <div className="bg-zinc-950/20 border border-zinc-900 border-dashed rounded-xl p-6 space-y-4 text-center py-12">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-850 flex items-center justify-center mx-auto text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-400">Future Agent Extension Slot</h4>
            <p className="text-[10px] text-zinc-600 mt-1 max-w-[220px] mx-auto leading-relaxed">
              New cognitive automation nodes (Outreach, Calendar Scheduler, CRM) can be loaded into this registry in future phases.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
