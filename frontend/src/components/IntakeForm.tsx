'use client';

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Lead, Mission } from '../types';

interface IntakeFormProps {
  onAnalyzeSuccess: (lead: Lead) => void;
  missions: Mission[];
}

export default function IntakeForm({ onAnalyzeSuccess, missions }: IntakeFormProps) {
  const [content, setContent] = useState('');
  const [selectedMissionId, setSelectedMissionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const activeMissions = missions.filter(m => m.is_active);
    if (activeMissions.length > 0 && !selectedMissionId) {
      setSelectedMissionId(activeMissions[0].id);
    }
  }, [missions, selectedMissionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMissionId) {
      setError('Please create and select an active campaign mission first.');
      return;
    }
    if (!content.trim() || content.trim().length <= 10) {
      setError('Intake content must be longer than 10 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.analyzeLead(content, selectedMissionId);
      setContent('');
      onAnalyzeSuccess(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeMissions = missions.filter(m => m.is_active);

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 space-y-4 shadow-sm">
      {/* Campaign selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="intake-mission" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Target Campaign <span className="text-red-500">*</span>
          </label>
          {selectedMissionId && (
            <span className="text-[9px] font-mono text-cyan-500 uppercase tracking-wider">
              ✓ mission selected
            </span>
          )}
        </div>
        {activeMissions.length === 0 ? (
          <div className="flex items-center gap-2 bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-amber-400 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="text-xs text-amber-400">
              No active campaigns.{' '}
              <a href="/missions" className="underline hover:text-amber-300">Create one first →</a>
            </span>
          </div>
        ) : (
          <select
            id="intake-mission"
            value={selectedMissionId}
            onChange={(e) => { setSelectedMissionId(e.target.value); setError(null); }}
            disabled={isLoading}
            className={`w-full bg-zinc-900 border rounded-lg px-3.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500 disabled:opacity-50 transition duration-200 ${
              !selectedMissionId ? 'border-amber-800/50' : 'border-zinc-800'
            }`}
          >
            <option value="">— Select a campaign —</option>
            {activeMissions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.mission_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label htmlFor="intake-content" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
          New Lead Intake
        </label>
        <textarea
          id="intake-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste raw email, job post, discord message, or text here to run lead analysis..."
          disabled={isLoading}
          rows={4}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 transition duration-200 resize-none font-sans"
        />
      </div>

      {error && (
        <div className="flex gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 font-mono">Min 10 characters required</span>
        <button
          type="submit"
          disabled={isLoading || !content.trim() || content.trim().length <= 10 || !selectedMissionId}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-zinc-950 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed select-none shadow"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-zinc-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
              </svg>
              <span>Run AI Agent</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
