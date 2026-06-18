'use client';

import { Lead } from '../types';

interface LeadDetailProps {
  lead: Lead | null;
}

export default function LeadDetail({ lead }: LeadDetailProps) {
  if (!lead) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500 border border-zinc-900 border-dashed rounded-xl bg-zinc-950/20">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 text-zinc-600 mb-3 animate-pulse">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 2.24a18.9 18.9 0 0 1-3.178-.266c-1.13-.134-1.96-1.103-1.96-2.238V5.25a2.25 2.25 0 0 1 2.25-2.25h1.371a3.001 3.001 0 0 1 3.228 3.228v.481c0 .034-.002.067-.005.1Z" />
        </svg>
        <p className="text-sm font-medium text-zinc-400">No Lead Selected</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-[240px] leading-relaxed">
          Select a lead from the panel on the left to view comprehensive agent analysis and scoring.
        </p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-emerald-400';
    if (score >= 4) return 'text-cyan-400';
    return 'text-zinc-400';
  };

  const getStatusColor = (status: string) => {
    if (status === 'QUALIFIED') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    if (status === 'DISQUALIFIED') return 'bg-red-500/10 text-red-400 border-red-500/25';
    return 'bg-zinc-800 text-zinc-400 border-zinc-700/30';
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-6 h-full overflow-y-auto shadow-sm">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <span className="text-[10px] font-mono text-zinc-500 block mb-1">LEAD ID: {lead.id}</span>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2.5">
            Agent Assessment
            <span className={`text-xs border px-2.5 py-0.5 rounded font-mono ${getStatusColor(lead.status)}`}>
              {lead.status}
            </span>
          </h2>
        </div>
        {/* Big Circular/Box Score */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center min-w-[75px]">
          <span className={`block text-2xl font-bold leading-none ${getScoreColor(lead.relevance_score ?? lead.lead_score)}`}>
            {lead.relevance_score ?? lead.lead_score}
          </span>
          <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase mt-1 block">Match</span>
        </div>
      </div>

      {/* Grid Metadata */}
      <div className="grid grid-cols-2 gap-4 bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-4 text-xs font-normal">
        <div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Intent classification</span>
          <p className="font-semibold text-zinc-200 capitalize mt-0.5">{lead.intent}</p>
        </div>
        <div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Confidence level</span>
          <p className="font-semibold text-zinc-200 mt-0.5">{(lead.confidence * 100).toFixed(0)}%</p>
        </div>
        
        {lead.target_service ? (
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">Target Service</span>
            <p className="font-semibold text-cyan-400 mt-0.5">{lead.target_service}</p>
          </div>
        ) : (
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">Service required</span>
            <p className="font-semibold text-zinc-200 capitalize mt-0.5">{lead.service_required || 'None detected'}</p>
          </div>
        )}

        {lead.relevance_score !== undefined ? (
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">Relevance match</span>
            <p className="font-semibold text-zinc-200 mt-0.5">
              {lead.service_match ? `Yes (Score: ${lead.relevance_score}/10)` : 'No (Score: 0/10)'}
            </p>
          </div>
        ) : (
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">Platform</span>
            <p className="font-semibold text-zinc-200 mt-0.5">{lead.platform || 'None detected'}</p>
          </div>
        )}
      </div>

      {/* Reasoning Bullets */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Agent Reasoning</h3>
        <ul className="space-y-2">
          {lead.reasoning.map((item, index) => (
            <li key={index} className="flex gap-2.5 text-sm text-zinc-300 items-start">
              <span className="text-cyan-400 font-bold select-none mt-0.5">•</span>
              <span className="leading-relaxed font-normal">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Raw Content scrollable box */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Raw Input Text</h3>
        <div className="bg-zinc-900/50 border border-zinc-900 rounded-lg p-4 max-h-60 overflow-y-auto text-xs text-zinc-400 font-normal leading-relaxed whitespace-pre-wrap font-sans">
          {lead.raw_content}
        </div>
      </div>
    </div>
  );
}
