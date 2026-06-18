'use client';

import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Stats, Log, Mission } from '../types';
import StatCard from '../components/StatCard';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, qualified: 0, rejected: 0 });
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async (missionId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const targetId = missionId !== undefined ? missionId : selectedMissionId;
      const [statsData, logsData, missionsData] = await Promise.all([
        api.getStats(targetId || undefined),
        api.getLogs(10, 0), // get top 10 logs
        api.getMissions(),
      ]);
      setStats(statsData);
      setRecentLogs(logsData);
      setMissions(missionsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard statistics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleMissionChange = (missionId: string) => {
    setSelectedMissionId(missionId);
    loadDashboardData(missionId);
  };

  const formatLogMessage = (log: Log) => {
    const details = log.details;
    switch (log.event) {
      case 'LEAD_RECEIVED':
        return `Raw text intake received${details.mission_name ? ` for mission "${details.mission_name}"` : ''}.`;
      case 'LEAD_QUALIFIED':
        return `Prospect qualified: intent "${details.intent}" with relevance score ${details.relevance_score}/${10} (threshold: ${details.score_threshold}).`;
      case 'LEAD_DISQUALIFIED':
        return `Prospect disqualified: score ${details.relevance_score ?? details.lead_score}/${10} did not meet qualification threshold.`;
      case 'DUPLICATE_DETECTED':
        return `Duplicate lead intake submitted. Returned existing Lead ID.`;
      case 'MISSION_CREATED':
        return `New campaign mission "${details.mission_name}" successfully registered.`;
      case 'MISSION_UPDATED':
        return `Mission configuration updated: ${Object.keys(details.updates || {}).join(', ')}`;
      case 'VALIDATION_ERROR':
        return 'Pydantic output schema validation failed on agent response.';
      default:
        return typeof details === 'string' ? details : JSON.stringify(details);
    }
  };

  const getLogBadgeStyles = (event: string) => {
    switch (event) {
      case 'LEAD_RECEIVED':
        return 'text-blue-400 bg-blue-950/20 border-blue-950';
      case 'LEAD_QUALIFIED':
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-950';
      case 'LEAD_DISQUALIFIED':
        return 'text-zinc-400 bg-zinc-900/40 border-zinc-900';
      case 'DUPLICATE_DETECTED':
        return 'text-yellow-400 bg-yellow-950/20 border-yellow-950';
      case 'MISSION_CREATED':
      case 'MISSION_UPDATED':
        return 'text-cyan-400 bg-cyan-950/20 border-cyan-950';
      case 'VALIDATION_ERROR':
        return 'text-red-400 bg-red-950/20 border-red-950';
      default:
        return 'text-zinc-400 bg-zinc-900 border-zinc-850';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full p-8 space-y-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">System Status</h2>
          <p className="text-xs text-zinc-500 font-mono">Jenny OS Lead Hunter Agent execution board</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mission Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">Active Campaign:</span>
            <select
              aria-label="Active Campaign Mission Filter"
              value={selectedMissionId}
              onChange={(e) => handleMissionChange(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 transition duration-200"
            >
              <option value="">All Missions</option>
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.mission_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadDashboardData()}
            className="border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition duration-200 cursor-pointer select-none flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="flex gap-3 bg-red-950/20 border border-red-900/30 rounded-xl p-4 text-sm text-red-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="font-semibold">Dashboard loading failed</p>
            <p className="text-xs text-zinc-500 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Premium Empty State when no missions exist */}
      {!isLoading && missions.length === 0 && (
        <div className="relative overflow-hidden bg-gradient-to-tr from-zinc-900/40 to-zinc-900/10 border border-zinc-800 rounded-2xl p-8 backdrop-blur-md">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full filter blur-2xl pointer-events-none"></div>
          <div className="max-w-xl">
            <span className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase font-bold px-2 py-1 bg-cyan-950/30 border border-cyan-900/50 rounded">Getting Started</span>
            <h3 className="text-xl font-bold text-zinc-100 mt-4 leading-tight">Create your first outreach campaign</h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Jenny OS uses keyword density mapping configured in missions to qualify leads dynamically. You must set up a mission (e.g. for AI Developers, Copywriters, or Video Editors) before processing leads.
            </p>
            <Link
              href="/missions"
              className="inline-flex items-center gap-2 mt-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-semibold px-4 py-2 rounded-lg text-xs transition duration-200"
            >
              Go to Missions Registry &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Grid Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Leads"
          value={stats.total}
          subtitle="Total raw contents analyzed"
          isLoading={isLoading}
          accent="cyan"
        />
        <StatCard
          title="Qualified Leads"
          value={stats.qualified}
          subtitle="Hire requests above score threshold"
          isLoading={isLoading}
          accent="emerald"
        />
        <StatCard
          title="Disqualified"
          value={stats.rejected}
          subtitle="Non-hiring posts or low scores"
          isLoading={isLoading}
          accent="zinc"
        />
      </div>

      {/* Activity Feed & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Recent Activity Logs */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <h3 className="text-sm font-semibold text-zinc-100">Recent Activity Feed</h3>
            <Link href="/logs" className="text-xs text-cyan-400 hover:text-cyan-300 font-mono uppercase tracking-wider font-medium">
              View All Logs
            </Link>
          </div>

          <div className="space-y-4">
            {isLoading && recentLogs.length === 0 ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex gap-4 items-start animate-pulse animate-fadeIn">
                  <div className="h-5 w-24 bg-zinc-800 rounded"></div>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-full bg-zinc-800 rounded"></div>
                    <div className="h-3 w-1/3 bg-zinc-800 rounded"></div>
                  </div>
                </div>
              ))
            ) : recentLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">No recent activity logged.</p>
            ) : (
              recentLogs.map((log) => {
                const logTime = new Date(log.timestamp).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                return (
                  <div key={log.id} className="flex gap-4 items-start text-xs border-b border-zinc-900/50 pb-3 last:border-b-0 last:pb-0">
                    <span className="text-[10px] font-mono text-zinc-500 pt-0.5 select-none w-16 shrink-0">{logTime}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-medium ${getLogBadgeStyles(log.event)}`}>
                          {log.event}
                        </span>
                        {log.lead_id && (
                          <Link href="/leads" className="text-[9px] font-mono text-zinc-500 hover:text-cyan-400 transition-colors">
                            LEAD: {log.lead_id.slice(0, 8)}...
                          </Link>
                        )}
                      </div>
                      <p className="text-zinc-300 leading-relaxed font-normal">{formatLogMessage(log)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Agent Widget / Quick Link */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-semibold text-zinc-100 border-b border-zinc-900 pb-3">Agent Assessment Hub</h3>
          <div className="space-y-4 text-xs text-zinc-400 leading-relaxed font-normal">
            <p>
              The <strong>Lead Hunter Agent</strong> processes raw unstructured text, extracting service requirements, scores platforms, and evaluates intent quality dynamically.
            </p>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-lg p-3 space-y-1.5 font-mono text-[10px] text-zinc-500">
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-zinc-300">gemma3:4b</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-emerald-400">ACTIVE</span>
              </div>
              <div className="flex justify-between">
                <span>Active Missions:</span>
                <span className="text-zinc-300">{missions.length}</span>
              </div>
            </div>
            <Link
              href="/leads"
              className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 w-full text-center select-none"
            >
              Go to Intake Terminal
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
