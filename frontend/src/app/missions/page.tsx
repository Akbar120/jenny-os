'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Mission, MissionPerformance, SettingsPayload } from '../../types';

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [performance, setPerformance] = useState<Record<string, MissionPerformance>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [missionName, setMissionName] = useState('');
  const [targetService, setTargetService] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [communities, setCommunities] = useState<any[]>([]);
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<Set<string>>(new Set());
  const [usedFallback, setUsedFallback] = useState(false);
  const [scoreThreshold, setScoreThreshold] = useState(7);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);

  const fetchPerformance = useCallback(async (missionList: Mission[]) => {
    const results = await Promise.allSettled(
      missionList.map((m) => api.getMissionPerformance(m.id))
    );
    const map: Record<string, MissionPerformance> = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        map[missionList[i].id] = result.value;
      }
    });
    setPerformance(map);
  }, []);

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMissions();
      setMissions(data);
      setError(null);
      // Fetch performance in parallel after missions are loaded
      await fetchPerformance(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load missions.');
    } finally {
      setLoading(false);
    }
  }, [fetchPerformance]);

  useEffect(() => {
    fetchMissions();
    const loadSettings = async () => {
      try {
        const data = await api.getSettings();
        setSettings(data);
      } catch (err) {
        console.error("Failed to load settings in MissionsPage:", err);
      }
    };
    loadSettings();
  }, [fetchMissions]);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const updated = await api.updateMission(id, { is_active: !currentStatus });
      setMissions((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_active: updated.is_active } : m))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update mission status.');
    }
  };

  const handleCloseModal = () => {
    setIsOpen(false);
    setStep(1);
    setMissionName('');
    setTargetService('');
    setKeywords([]);
    setCustomKeyword('');
    setCommunities([]);
    setSelectedCommunityIds(new Set());
    setScoreThreshold(7);
    setSubmitError(null);
  };

  const handleGenerateStrategy = async () => {
    if (!targetService.trim()) {
      setSubmitError('Target service is required.');
      return;
    }
    setLoadingSuggestions(true);
    setSubmitError(null);
    try {
      const data = await api.suggestMissionDetails(targetService);
      setKeywords(data.keywords);
      setCommunities(data.communities);
      setUsedFallback(data.used_fallback);
      // Auto-select all active (reddit) communities by default
      const defaultSelected = new Set<string>();
      data.communities.forEach((comm: any) => {
        if (comm.platform === 'reddit') {
          defaultSelected.add(comm.id);
        }
      });
      setSelectedCommunityIds(defaultSelected);
      setStep(2);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to generate campaign suggestions.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddKeyword = () => {
    const trimmed = customKeyword.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
      setCustomKeyword('');
    }
  };

  const handleRemoveKeyword = (indexToRemove: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleToggleCommunity = (id: string) => {
    setSelectedCommunityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const selectedList = communities.filter((c) => selectedCommunityIds.has(c.id));
    const activeSelectedCount = selectedList.filter((c) => c.platform === 'reddit').length;

    if (keywords.length === 0) {
      setSubmitError('At least one keyword is required.');
      setSubmitting(false);
      return;
    }

    if (activeSelectedCount === 0) {
      setSubmitError('At least one active source is required.');
      setSubmitting(false);
      return;
    }

    const initialSources = selectedList.map((comm) => ({
      platform: comm.platform,
      name: comm.name,
      url: comm.url || null,
    }));

    try {
      const newMission = await api.createMission({
        mission_name: missionName,
        target_service: targetService,
        keywords,
        score_threshold: scoreThreshold,
        initial_sources: initialSources,
      });

      const newMissions = [...missions, newMission];
      setMissions(newMissions);
      await fetchPerformance(newMissions);

      handleCloseModal();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create mission.');
      setSubmitting(false);
    }
  };

  const selectedList = communities.filter((c) => selectedCommunityIds.has(c.id));
  const activeSelectedCount = selectedList.filter((c) => c.platform === 'reddit').length;
  const isValid = keywords.length >= 1 && activeSelectedCount >= 1;

  const redditCommunities = communities.filter((c) => c.platform === 'reddit');
  const otherCommunities = communities.filter((c) => c.platform !== 'reddit');

  return (
    <div className="flex-1 flex flex-col p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Missions Registry
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure dynamic campaigns, target services, and qualification thresholds.
          </p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-semibold px-5 py-2.5 rounded-lg shadow-lg hover:shadow-cyan-500/10 transition-all duration-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Mission
        </button>
      </div>

      {/* Loading and Error States */}
      {loading && missions.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      ) : missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-xl h-64">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
            className="w-12 h-12 text-zinc-600 mb-4 animate-pulse"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 21m0 0-.813-5.096M9 21h8.25m-17.25 0h1.5m14.25-8.25h1.5m-17.25 0h1.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-zinc-300">No Active Missions</h3>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm">
            Create a mission with custom target keywords and thresholds to begin scoring incoming leads.
          </p>
          <button
            onClick={() => setIsOpen(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition-all duration-200"
          >
            Create your first mission &rarr;
          </button>
        </div>
      ) : (
        /* Missions Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {missions.map((mission) => {
            const keywordsList = Array.isArray(mission.keywords)
              ? mission.keywords
              : JSON.parse(mission.keywords || '[]');

            const perf = performance[mission.id];

            return (
              <div
                key={mission.id}
                className="group bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 hover:border-cyan-500/30 rounded-xl p-6 flex flex-col justify-between shadow-md hover:shadow-cyan-500/5 transition-all duration-300 relative overflow-hidden"
              >
                {/* Decorative faint glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full filter blur-xl group-hover:bg-cyan-500/10 transition-all duration-300 pointer-events-none"></div>

                <div>
                  {/* Header: Title and Toggle */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-semibold text-zinc-100 group-hover:text-cyan-400 transition-colors duration-200 leading-snug">
                        {mission.mission_name}
                      </h3>
                      <span className="text-[10px] text-zinc-500 font-mono tracking-wider">
                        ID: {mission.id.substring(0, 8)}...
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleActive(mission.id, mission.is_active)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        mission.is_active ? 'bg-cyan-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                          mission.is_active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Target Service & Threshold */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Target Service:</span>
                      <span className="text-cyan-400 font-medium">{mission.target_service}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Threshold:</span>
                      <span className="text-zinc-300 font-mono font-semibold">
                        {mission.score_threshold}/10
                      </span>
                    </div>
                    {/* Faux Progress Bar for Threshold */}
                    <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${mission.score_threshold * 10}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Keywords pills */}
                  <div className="border-t border-zinc-900 pt-4 mb-4">
                    <span className="text-[10px] text-zinc-500 block mb-2 font-mono uppercase tracking-wider">
                      Keywords
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {keywordsList.map((kw: string, i: number) => {
                        const isTop = perf?.top_keywords?.includes(kw);
                        return (
                          <span
                            key={i}
                            className={`text-[10px] px-2.5 py-1 rounded-md transition-all border ${
                              isTop
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 font-semibold'
                                : 'bg-zinc-950 text-zinc-500 border-zinc-800/80'
                            }`}
                          >
                            {kw}
                            {isTop && (
                              <span className="ml-1 text-cyan-400/60">✦</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* ─── Mission Performance ─── */}
                  <div className="border-t border-zinc-900 pt-4">
                    <span className="text-[10px] text-zinc-500 block mb-3 font-mono uppercase tracking-wider">
                      Mission Performance
                    </span>
                    {perf ? (
                      <div className="grid grid-cols-3 gap-2">
                        {/* Total Leads */}
                        <div className="bg-zinc-950/60 rounded-lg p-2.5 text-center border border-zinc-800/60">
                          <div className="text-lg font-bold text-zinc-100 leading-none">
                            {perf.total_leads}
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-1 uppercase tracking-wide">
                            Total
                          </div>
                        </div>
                        {/* Qualified */}
                        <div className="bg-zinc-950/60 rounded-lg p-2.5 text-center border border-zinc-800/60">
                          <div className="text-lg font-bold text-emerald-400 leading-none">
                            {perf.qualified_leads}
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-1 uppercase tracking-wide">
                            Qualified
                          </div>
                        </div>
                        {/* Qualification Rate */}
                        <div className="bg-zinc-950/60 rounded-lg p-2.5 text-center border border-zinc-800/60">
                          <div
                            className={`text-lg font-bold leading-none ${
                              perf.qualification_rate >= 50
                                ? 'text-emerald-400'
                                : perf.qualification_rate >= 25
                                ? 'text-amber-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            {perf.qualification_rate}%
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-1 uppercase tracking-wide">
                            Rate
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Skeleton while loading */
                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="bg-zinc-950/60 rounded-lg p-2.5 border border-zinc-800/60 animate-pulse h-12"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Timestamp */}
                <div className="text-[10px] text-zinc-600 font-mono mt-6 border-t border-zinc-900/60 pt-3 flex justify-between">
                  <span>Created At</span>
                  <span>{new Date(mission.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm transition-all duration-300 animate-fadeIn">
          {/* Modal Box */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-slideUp">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  {step === 1 ? 'Create New Mission' : 'Review Campaign Strategy'}
                </h2>
                {step === 2 && (
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    Target: {targetService}
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateMission} className="flex flex-col flex-1 overflow-hidden">
              {step === 1 ? (
                <div className="p-6 space-y-4 overflow-y-auto">
                  {submitError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                      {submitError}
                    </div>
                  )}

                  {(!settings?.model_name?.trim() || !settings?.ollama_url?.trim()) && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-450 p-3.5 rounded-lg text-xs flex items-start gap-2.5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-amber-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                      <div>
                        <span className="font-semibold block mb-0.5">Model not configured</span>
                        <span className="text-[10px] text-zinc-400 leading-relaxed block">Please select and configure a Model (Ollama URL & Model Name) first in Settings to use the Strategy Generator.</span>
                      </div>
                    </div>
                  )}

                  {/* Mission Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="mName" className="text-xs text-zinc-400 font-medium block">
                      Mission Name
                    </label>
                    <input
                      type="text"
                      id="mName"
                      required
                      value={missionName}
                      onChange={(e) => setMissionName(e.target.value)}
                      placeholder="e.g. 3D Character Artist Leads"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-cyan-500 transition-all duration-200"
                    />
                  </div>

                  {/* Target Service */}
                  <div className="space-y-1.5">
                    <label htmlFor="tService" className="text-xs text-zinc-400 font-medium block">
                      Target Service Requested
                    </label>
                    <input
                      type="text"
                      id="tService"
                      required
                      value={targetService}
                      onChange={(e) => setTargetService(e.target.value)}
                      placeholder="e.g. 3D Character Artist"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-cyan-500 transition-all duration-200"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Entering a target service will automatically query the intelligence system to suggest relevant keywords and matching communities.
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4 mt-6 shrink-0">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-medium px-4 py-2 rounded-lg text-sm transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateStrategy}
                      disabled={loadingSuggestions || !missionName.trim() || !targetService.trim() || !settings?.model_name?.trim() || !settings?.ollama_url?.trim()}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-semibold px-4 py-2 rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
                    >
                      {loadingSuggestions ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-950"></div>
                          Generating Strategy...
                        </>
                      ) : (
                        'Generate Strategy'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {submitError && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                        {submitError}
                      </div>
                    )}

                    {/* Keywords Section */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-400 font-medium block">
                            Target Keywords
                          </label>
                          {usedFallback && (
                            <div className="flex items-center gap-1.5 text-amber-400 text-[10px] bg-amber-500/5 px-2.5 py-0.5 rounded border border-amber-500/20 shadow-inner" title="Offline dictionary used because Ollama was unreachable">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-amber-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                              </svg>
                              <span>Local fallback used</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">{keywords.length} active</span>
                      </div>

                      {/* Add Keyword Form */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add custom keyword..."
                          value={customKeyword}
                          onChange={(e) => setCustomKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddKeyword();
                            }
                          }}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-100 text-xs focus:outline-none focus:border-cyan-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleAddKeyword}
                          className="bg-zinc-850 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs transition-all font-medium"
                        >
                          Add
                        </button>
                      </div>

                      {/* Keywords pills container */}
                      <div className="flex flex-wrap gap-1.5 bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/60 min-h-12">
                        {keywords.length === 0 ? (
                          <span className="text-xs text-zinc-600 italic">No keywords. Add at least one.</span>
                        ) : (
                          keywords.map((kw, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-zinc-900 text-zinc-300 border border-zinc-800 pl-2.5 pr-1 py-1 rounded-md flex items-center gap-1 hover:border-zinc-700 group transition-all"
                            >
                              <span>{kw}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveKeyword(idx)}
                                className="text-zinc-500 hover:text-red-400 p-0.5 rounded transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Communities Section */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-400 font-medium block">
                          Discovered Communities
                        </label>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {selectedList.length} selected ({activeSelectedCount} active)
                        </span>
                      </div>

                      {communities.length === 0 ? (
                        <div className="bg-zinc-950/40 p-4 rounded-lg border border-zinc-800/60 text-center">
                          <span className="text-xs text-zinc-500 italic">No matching communities found in registry.</span>
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                          {/* Active Sources (Reddit) */}
                          {redditCommunities.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">
                                Active Scraper Sources (Reddit)
                              </span>
                              <div className="grid grid-cols-1 gap-2">
                                {redditCommunities.map((comm) => {
                                  const isChecked = selectedCommunityIds.has(comm.id);
                                  return (
                                    <div
                                      key={comm.id}
                                      onClick={() => handleToggleCommunity(comm.id)}
                                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 flex items-center gap-3 select-none ${
                                        isChecked
                                          ? 'bg-cyan-500/5 border-cyan-500/30 shadow-cyan-500/5'
                                          : 'bg-zinc-950/40 border-zinc-850 hover:border-zinc-800/80'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by parent onClick
                                        className="w-4 h-4 rounded border-zinc-800 text-cyan-500 focus:ring-0 focus:ring-offset-0 focus:outline-none accent-cyan-500 cursor-pointer"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className={`text-xs font-semibold ${isChecked ? 'text-cyan-400' : 'text-zinc-300'}`}>
                                            {comm.display_name || comm.name}
                                          </span>
                                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-mono">
                                            Active
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">
                                          {comm.description || 'Reddit community feed'}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Registry Only Sources (Discord, Job Boards, etc) */}
                          {otherCommunities.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">
                                Registry Only / suggested sources
                              </span>
                              <div className="grid grid-cols-1 gap-2">
                                {otherCommunities.map((comm) => {
                                  const isChecked = selectedCommunityIds.has(comm.id);
                                  return (
                                    <div
                                      key={comm.id}
                                      onClick={() => handleToggleCommunity(comm.id)}
                                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 flex items-center gap-3 select-none ${
                                        isChecked
                                          ? 'bg-zinc-850/30 border-zinc-700'
                                          : 'bg-zinc-950/20 border-zinc-900/60 hover:border-zinc-850/80 opacity-60 hover:opacity-80'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by parent onClick
                                        className="w-4 h-4 rounded border-zinc-900 text-zinc-600 focus:ring-0 focus:ring-offset-0 focus:outline-none accent-zinc-500 cursor-pointer"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className={`text-xs font-medium ${isChecked ? 'text-zinc-200' : 'text-zinc-400'}`}>
                                            {comm.display_name || comm.name}
                                          </span>
                                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider text-amber-500/80 bg-amber-500/5 border-amber-500/10 font-mono">
                                            Registry Only
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-600 mt-0.5 line-clamp-1">
                                          {comm.description || `${comm.platform} community - scraping soon`}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Score Threshold slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label htmlFor="mThreshold" className="text-zinc-400 font-medium">
                          Relevance Score Threshold
                        </label>
                        <span className="text-cyan-400 font-mono font-bold">{scoreThreshold}/10</span>
                      </div>
                      <input
                        type="range"
                        id="mThreshold"
                        min="0"
                        max="10"
                        step="1"
                        value={scoreThreshold}
                        onChange={(e) => setScoreThreshold(Number(e.target.value))}
                        className="w-full h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                        <span>0 (Any match)</span>
                        <span>10 (Strict)</span>
                      </div>
                    </div>

                    {/* Validation Warnings */}
                    {!isValid && (
                      <p className="text-xs text-amber-500 font-medium bg-amber-500/5 px-3 py-2.5 rounded-lg border border-amber-500/10 text-center animate-pulse">
                        Select at least 1 keyword and 1 active source to save this mission.
                      </p>
                    )}
                  </div>

                  {/* Sticky Footer */}
                  <div className="flex items-center justify-between gap-3 border-t border-zinc-800 p-6 bg-zinc-900 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setSubmitError(null);
                      }}
                      className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-medium px-4 py-2 rounded-lg text-sm transition-all duration-200"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !isValid}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-semibold px-5 py-2 rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-cyan-500/10"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-950"></div>
                          Saving...
                        </>
                      ) : (
                        'Save Mission'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
