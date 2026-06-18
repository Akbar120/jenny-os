'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SettingsPayload } from '../../types';

export default function SettingsPage() {
  const [formData, setFormData] = useState<SettingsPayload>({
    ollama_url: 'http://localhost:11434',
    model_name: 'gemma3:4b',
    score_threshold: 7,
    reddit_client_id: '',
    reddit_client_secret: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getSettings();
        setFormData({
          ollama_url: settings.ollama_url || 'http://localhost:11434',
          model_name: settings.model_name || 'gemma3:4b',
          score_threshold: settings.score_threshold ?? 7,
          reddit_client_id: settings.reddit_client_id || '',
          reddit_client_secret: settings.reddit_client_secret || '',
        });
      } catch (err: any) {
        setMessage({
          type: 'error',
          text: err.message || 'Failed to load system settings from backend.',
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    // Enforce range validators client-side
    if (formData.score_threshold < 0 || formData.score_threshold > 10) {
      setMessage({ type: 'error', text: 'Score threshold must be an integer between 0 and 10.' });
      setIsSaving(false);
      return;
    }

    try {
      const updated = await api.updateSettings(formData);
      setFormData({
        ollama_url: updated.ollama_url || '',
        model_name: updated.model_name || '',
        score_threshold: updated.score_threshold ?? 7,
        reddit_client_id: updated.reddit_client_id || '',
        reddit_client_secret: updated.reddit_client_secret || '',
      });
      setMessage({
        type: 'success',
        text: 'Settings saved successfully! Runtime configs updated dynamically.',
      });
      // Clear success message after 4s
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to update system settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <svg className="animate-spin h-5 w-5 mr-3 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs font-mono">Loading Configs...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden max-w-2xl mx-auto w-full p-8 space-y-6">
      {/* Top Header */}
      <header className="shrink-0">
        <h2 className="text-xl font-bold text-zinc-100 tracking-tight">System Settings</h2>
        <p className="text-xs text-zinc-500 font-mono">Configure runtime environment values for Lead Hunter Agent</p>
      </header>

      {/* Settings Form Card */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div
              className={`flex gap-2.5 border rounded-lg p-4 text-xs ${
                message.type === 'success'
                  ? 'bg-emerald-950/25 border-emerald-900 text-emerald-400'
                  : 'bg-red-950/25 border-red-900 text-red-400'
              }`}
            >
              {message.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Field 1: Ollama Endpoint */}
          <div className="space-y-2">
            <label htmlFor="ollama-url" className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
              Ollama API Endpoint URL
            </label>
            <input
              type="url"
              id="ollama-url"
              value={formData.ollama_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, ollama_url: e.target.value }))}
              placeholder="e.g. http://localhost:11434"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200"
            />
            <span className="text-[10px] text-zinc-500 block leading-relaxed">
              HTTP URL of your local Ollama server hosting the cognitive model.
            </span>
          </div>

          {/* Field 2: Model Tag name */}
          <div className="space-y-2">
            <label htmlFor="model-name" className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
              Active LLM Model Tag
            </label>
            <input
              type="text"
              id="model-name"
              value={formData.model_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, model_name: e.target.value }))}
              placeholder="e.g. gemma3:4b"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200"
            />
            <span className="text-[10px] text-zinc-500 block leading-relaxed">
              Ollama model tag to trigger. In Phase C this must match the pulled model tag (e.g. <code>gemma3:4b</code>).
            </span>
          </div>

          {/* Field 3: Score Threshold */}
          <div className="space-y-2">
            <label htmlFor="score-threshold" className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
              Qualification Score Threshold ({formData.score_threshold}/10)
            </label>
            <input
              type="range"
              id="score-threshold"
              min="0"
              max="10"
              step="1"
              value={formData.score_threshold}
              onChange={(e) => setFormData((prev) => ({ ...prev, score_threshold: parseInt(e.target.value) }))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 px-0.5">
              <span>0 (Auto-qualify all)</span>
              <span>5</span>
              <span>10 (Brutal quality filter)</span>
            </div>
            <span className="text-[10px] text-zinc-500 block leading-relaxed">
              Leads scoring at or above this value will be classified as <strong>QUALIFIED</strong>. Others will be marked <strong>DISQUALIFIED</strong>.
            </span>
          </div>

          {/* Reddit Client Credentials Section */}
          <div className="pt-6 border-t border-zinc-900 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Reddit API Credentials (Optional)</h3>
            
            {/* Field 4: Reddit Client ID */}
            <div className="space-y-2">
              <label htmlFor="reddit-client-id" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Reddit Client ID
              </label>
              <input
                type="text"
                id="reddit-client-id"
                value={formData.reddit_client_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, reddit_client_id: e.target.value }))}
                placeholder="e.g. 14-character alphanumeric string"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200"
              />
              <span className="text-[10px] text-zinc-500 block leading-relaxed">
                The Client ID from your Reddit App Preferences (App type must be a &quot;script&quot;).
              </span>
            </div>

            {/* Field 5: Reddit Client Secret */}
            <div className="space-y-2">
              <label htmlFor="reddit-client-secret" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Reddit Client Secret
              </label>
              <input
                type="password"
                id="reddit-client-secret"
                value={formData.reddit_client_secret}
                onChange={(e) => setFormData((prev) => ({ ...prev, reddit_client_secret: e.target.value }))}
                placeholder="e.g. 27-character secret string"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200"
              />
              <span className="text-[10px] text-zinc-500 block leading-relaxed">
                The Client Secret from your Reddit App Preferences. If configured, Jenny OS will use OAuth to bypass public rate limits.
              </span>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-zinc-900 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-850 disabled:to-zinc-850 disabled:text-zinc-500 text-zinc-950 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed select-none"
            >
              {isSaving ? 'Saving Configurations...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
