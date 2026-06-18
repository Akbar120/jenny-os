'use client';

import { Lead } from '../types';

interface LeadCardProps {
  lead: Lead;
  isSelected: boolean;
  onClick: () => void;
}

export default function LeadCard({ lead, isSelected, onClick }: LeadCardProps) {
  const formattedDate = new Date(lead.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-emerald-400 border-emerald-950 bg-emerald-950/20';
    if (score >= 4) return 'text-cyan-400 border-cyan-950 bg-cyan-950/20';
    return 'text-zinc-400 border-zinc-900 bg-zinc-900/30';
  };

  const getStatusColor = (status: string) => {
    if (status === 'QUALIFIED') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (status === 'DISQUALIFIED') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-zinc-800 text-zinc-400 border-zinc-700/30';
  };

  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 select-none ${
        isSelected
          ? 'bg-zinc-900 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.03)]'
          : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium bg-zinc-800 text-zinc-300 tracking-wider">
            {lead.intent}
          </span>
          {lead.target_service && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium bg-cyan-950/20 text-cyan-400 border border-cyan-900/30 tracking-wider overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">
              {lead.target_service}
            </span>
          )}
          {lead.platform && !lead.target_service && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium bg-zinc-900 text-zinc-400 tracking-wider overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]">
              {lead.platform}
            </span>
          )}
        </div>
        <span className={`text-[10px] font-mono border rounded px-1.5 font-bold shrink-0 ${getScoreColor(lead.relevance_score ?? lead.lead_score)}`}>
          Match: {lead.relevance_score ?? lead.lead_score}/10
        </span>
      </div>

      <p className="text-sm text-zinc-300 font-normal line-clamp-2 leading-relaxed mb-3">
        {lead.raw_content}
      </p>

      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
        <span>{formattedDate}</span>
        <span className={`border px-2 py-0.5 rounded ${getStatusColor(lead.status)}`}>
          {lead.status}
        </span>
      </div>
    </div>
  );
}
