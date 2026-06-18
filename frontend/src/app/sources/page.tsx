'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import { Mission, Source, SyncResult } from '../../types';

export default function SourcesPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-source sync states
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showSyncResultModal, setShowSyncResultModal] = useState(false);

  // Full sweep run states
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<{
    sources_done: number;
    total_sources: number;
    leads_qualified: number;
    leads_skipped: number;
    progress_pct: number;
  } | null>(null);
  const [lastRunResult, setLastRunResult] = useState<{
    leads_qualified: number;
    leads_skipped: number;
    completed_at: string;
  } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Add source modal state
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [limit, setLimit] = useState(25);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [missionsData, sourcesData] = await Promise.all([
        api.getMissions(),
        api.getSources(),
      ]);
      setMissions(missionsData);
      setSources(sourcesData);
      setError(null);
      if (missionsData.length > 0) {
        setSelectedMissionId(missionsData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load page data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getCurrentRun();
        if (data.status === 'RUNNING' && data.run) {
          setRunProgress(data.run);
        } else {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setIsRunning(false);
          setRunProgress(null);
          // Load last run result to show the result banner
          const history = await api.getRunHistory();
          if (history.length > 0) {
            const last = history[0];
            setLastRunResult({
              leads_qualified: last.leads_qualified,
              leads_skipped: last.leads_skipped,
              completed_at: last.completed_at,
            });
          }
          // Refresh sources list to update last_synced_at
          const sourcesData = await api.getSources();
          setSources(sourcesData);
        }
      } catch {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setIsRunning(false);
      }
    }, 2000);
  }, []);

  useEffect(() => {
    fetchData();
    // On mount: check if a run is already in progress
    api.getCurrentRun().then((data) => {
      if (data.status === 'RUNNING' && data.run) {
        setIsRunning(true);
        setRunProgress(data.run);
        startPolling();
      }
    }).catch(() => {});
  }, [fetchData, startPolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleRunAgent = async () => {
    setRunError(null);
    setLastRunResult(null);
    try {
      await api.triggerRun();
      setIsRunning(true);
      setRunProgress({ sources_done: 0, total_sources: 0, leads_qualified: 0, leads_skipped: 0, progress_pct: 0 });
      startPolling();
    } catch (err: any) {
      setRunError(err.message || 'Failed to start run.');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const updated = await api.updateSource(id, { is_active: !currentStatus });
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: updated.is_active } : s))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update source status.');
    }
  };

  const handleSyncSource = async (id: string) => {
    setSyncingId(id);
    setSyncResult(null);
    try {
      const result = await api.syncSource(id);
      setSyncResult(result);
      setShowSyncResultModal(true);
      const sourcesData = await api.getSources();
      setSources(sourcesData);
    } catch (err: any) {
      alert(err.message || 'Sync failed.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMissionId) {
      setSubmitError('Please select a campaign/mission.');
      return;
    }
    if (!subreddit.trim()) {
      setSubmitError('Subreddit name is required.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const newSource = await api.createSource({
        mission_id: selectedMissionId,
        source_type: 'reddit',
        config: {
          subreddit: subreddit.trim().replace(/^r\//i, ''),
          limit,
        },
      });
      setSources((prev) => [...prev, newSource]);
      setSubreddit('');
      setLimit(25);
      setIsOpen(false);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create source connector.');
    } finally {
      setSubmitting(false);
    }
  };

  const getMissionName = (missionId: string) => {
    return missions.find((m) => m.id === missionId)?.mission_name || 'Unknown Campaign';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen text-zinc-300">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Source Connectors
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure external feeds and channels to automatically ingest and qualify leads.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {/* ▶ Run Agent — full sweep */}
          <button
            id="btn-run-agent"
            onClick={handleRunAgent}
            disabled={isRunning || sources.length === 0}
            className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-sm rounded-lg shadow-lg active:scale-[0.98] transition-all duration-200 ${
              isRunning
                ? 'bg-emerald-950/40 border border-emerald-700/40 text-emerald-400 cursor-wait'
                : sources.length === 0
                ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 hover:shadow-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
                Run Agent
              </>
            )}
          </button>

          {/* + Add Source Connector */}
          <button
            id="btn-add-source-connector"
            onClick={() => setIsOpen(true)}
            disabled={missions.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 text-zinc-950 font-semibold text-sm rounded-lg shadow-lg hover:shadow-cyan-500/10 active:scale-[0.98] transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Source
          </button>
        </div>
      </div>

      {/* ── Run Error Banner ── */}
      {runError && (
        <div className="p-4 rounded-xl border border-rose-900/30 bg-rose-950/10 text-rose-400 text-sm flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          {runError}
        </div>
      )}

      {/* ── Live Progress Bar — visible while RUNNING ── */}
      {isRunning && runProgress && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              Agent Running — Full Sweep in Progress
            </div>
            <span className="text-emerald-400/70 font-mono text-xs">
              {runProgress.sources_done} / {runProgress.total_sources || '?'} sources
            </span>
          </div>
          <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.max(4, runProgress.progress_pct)}%` }}
            />
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-500 font-mono">
            <span>🟢 Qualified so far: <span className="text-emerald-400 font-bold">{runProgress.leads_qualified}</span></span>
            <span>⏭ Skipped (dupes): {runProgress.leads_skipped ?? 0}</span>
          </div>
        </div>
      )}

      {/* ── Last Run Result Banner — visible after COMPLETED ── */}
      {!isRunning && lastRunResult && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">Sweep Complete</p>
              <p className="text-xs text-zinc-500 font-mono">
                {new Date(lastRunResult.completed_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 font-mono">
            <div className="text-center">
              <span className="block text-2xl font-bold text-emerald-400">{lastRunResult.leads_qualified}</span>
              <span className="text-[10px] text-zinc-500 uppercase">Qualified Leads</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-bold text-zinc-500">{lastRunResult.leads_skipped}</span>
              <span className="text-[10px] text-zinc-500 uppercase">Skipped (dupes)</span>
            </div>
          </div>
          <button
            onClick={() => setLastRunResult(null)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors ml-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Main Content: Source Cards ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-cyan-500 animate-spin" />
          <p className="text-sm text-zinc-500 font-mono">LOADING CONNECTIONS...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl border border-red-900/30 bg-red-950/10 text-red-400 flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <div>
            <h3 className="font-semibold text-red-200">Error Loading Data</h3>
            <p className="text-sm text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-20 border border-zinc-900 rounded-2xl bg-zinc-950/40 backdrop-blur-md flex flex-col items-center justify-center p-8">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-zinc-300">No active connectors</h3>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
            {missions.length === 0
              ? 'Please create a Mission first under the Missions section before configuring source connectors.'
              : 'Add a new source connector like Reddit to start automatically fetching posts and checking for leads.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sources.map((src) => {
            const isSyncing = syncingId === src.id;
            return (
              <div
                key={src.id}
                className="border border-zinc-900 rounded-2xl bg-zinc-950/40 backdrop-blur-md hover:border-zinc-800 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Card Header */}
                <div className="p-6 border-b border-zinc-900 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM9.555 7.168A1 1 0 0 0 8 8v4a1 1 0 0 0 1.555.832l3-2a1 1 0 0 0 0-1.664l-3-2Z" clipRule="evenodd" />
                      </svg>
                      {src.source_type}
                    </span>
                    <h3 className="font-semibold text-zinc-200 mt-2">r/{src.config.subreddit}</h3>
                    <p className="text-xs text-zinc-500 font-medium">
                      Campaign: <span className="text-zinc-400">{getMissionName(src.mission_id)}</span>
                    </p>
                  </div>

                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggleActive(src.id, src.is_active)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      src.is_active ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                        src.is_active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Card Details */}
                <div className="p-6 space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="bg-zinc-900/30 border border-zinc-900 p-2.5 rounded-lg">
                      <span className="text-zinc-500 block text-[10px] uppercase mb-0.5">Sync Count</span>
                      <span className="text-zinc-300 text-sm font-semibold">{src.sync_count} runs</span>
                    </div>
                    <div className="bg-zinc-900/30 border border-zinc-900 p-2.5 rounded-lg">
                      <span className="text-zinc-500 block text-[10px] uppercase mb-0.5">Post Limit</span>
                      <span className="text-zinc-300 text-sm font-semibold">{src.config.limit} posts</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Last Sync:</span>
                      <span className="text-zinc-400">
                        {src.last_synced_at ? new Date(src.last_synced_at).toLocaleString() : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Sync Status:</span>
                      {src.last_sync_status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Success
                        </span>
                      ) : src.last_sync_status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                          Failed
                        </span>
                      ) : (
                        <span className="text-zinc-500">Never Synced</span>
                      )}
                    </div>
                    {src.last_error && (
                      <div className="p-2.5 mt-2 rounded bg-rose-950/15 border border-rose-900/20 text-rose-400/90 text-[11px] leading-relaxed max-h-20 overflow-y-auto font-mono">
                        {src.last_error}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: individual Sync Now */}
                <div className="p-6 border-t border-zinc-900 bg-zinc-950/20">
                  <button
                    onClick={() => handleSyncSource(src.id)}
                    disabled={isSyncing || !src.is_active}
                    className={`w-full py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 border select-none transition-all duration-200 ${
                      !src.is_active
                        ? 'border-zinc-900 bg-zinc-900/10 text-zinc-600 cursor-not-allowed'
                        : isSyncing
                        ? 'border-zinc-800 bg-zinc-900/50 text-cyan-400/80 cursor-wait'
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/80 hover:text-zinc-100 active:scale-[0.98]'
                    }`}
                  >
                    {isSyncing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Sync This Source
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Per-Source Sync Result Modal ── */}
      {showSyncResultModal && syncResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">Sync Completed</h3>
                <p className="text-xs text-zinc-500 font-mono">SOURCE SYNC SUCCESSFUL</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl text-center">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono mb-1">Leads Added</span>
                <span className="text-2xl font-bold text-cyan-400">{syncResult.added}</span>
              </div>
              <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl text-center">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono mb-1">Skipped (Dupes)</span>
                <span className="text-2xl font-bold text-zinc-400">{syncResult.skipped}</span>
              </div>
            </div>

            {syncResult.errors.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] text-rose-400 uppercase font-mono font-bold">Errors occurred:</span>
                <div className="p-3 bg-rose-950/15 border border-rose-900/20 rounded-lg text-rose-300 text-xs font-mono max-h-32 overflow-y-auto space-y-1">
                  {syncResult.errors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSyncResultModal(false)}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 rounded-lg font-medium text-sm transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Add Source Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">Add Reddit Connector</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Stream posts automatically into a specific campaign.</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSource} className="space-y-4">
              {submitError && (
                <div className="p-3 text-xs bg-rose-950/10 border border-rose-900/30 text-rose-400 rounded-lg">
                  {submitError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">Target Campaign/Mission</label>
                <select
                  value={selectedMissionId}
                  onChange={(e) => setSelectedMissionId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-zinc-200 text-sm focus:outline-none focus:border-cyan-500 transition-all font-medium"
                >
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.mission_name} ({m.target_service})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">Subreddit Name</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm text-zinc-500 font-semibold select-none">r/</span>
                  <input
                    type="text"
                    required
                    value={subreddit}
                    onChange={(e) => setSubreddit(e.target.value)}
                    placeholder="gamedev"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-4 py-2.5 text-zinc-200 text-sm focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>
                <p className="text-[10px] text-zinc-500">
                  Target public subreddits (e.g. `gamedev`, `robloxdev`, `UnrealEngine`).
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-zinc-400">
                  <label>Max Ingestion Limit (per sync)</label>
                  <span className="text-cyan-400">{limit} posts</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-850 hover:bg-zinc-900/50 text-zinc-400 rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Create Connector'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
