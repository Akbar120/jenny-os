'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SettingsPayload, AIProvider } from '../../types';

// ─── Provider metadata ────────────────────────────────────────────────────────
type ProviderMeta = {
  label: string;
  icon: string;
  color: string;
  needsApiKey: boolean;
  needsOllamaUrl: boolean;
  defaultModel: string;
  modelPlaceholder: string;
  modelHint: string;
  apiKeyLabel: string;
  apiKeyHint: string;
  docsUrl: string;
};

const PROVIDERS: Record<AIProvider, ProviderMeta> = {
  ollama: {
    label: 'Ollama (Local)',
    icon: '🦙',
    color: 'border-emerald-700 bg-emerald-950/20',
    needsApiKey: false,
    needsOllamaUrl: true,
    defaultModel: 'gemma3:4b',
    modelPlaceholder: 'e.g. gemma3:4b, llama3.2:3b, mistral',
    modelHint: 'Tag of the Ollama model you have pulled locally (run ollama list to check).',
    apiKeyLabel: '',
    apiKeyHint: '',
    docsUrl: 'https://ollama.com/library',
  },
  openai: {
    label: 'OpenAI',
    icon: '⬛',
    color: 'border-zinc-600 bg-zinc-900/40',
    needsApiKey: true,
    needsOllamaUrl: false,
    defaultModel: 'gpt-4o-mini',
    modelPlaceholder: 'e.g. gpt-4o-mini, gpt-4o, gpt-3.5-turbo',
    modelHint: 'OpenAI model ID. gpt-4o-mini is fast and cheap; gpt-4o is most capable.',
    apiKeyLabel: 'OpenAI API Key',
    apiKeyHint: 'Starts with sk-... — get it from platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs/models',
  },
  openrouter: {
    label: 'OpenRouter',
    icon: '🔀',
    color: 'border-violet-800 bg-violet-950/20',
    needsApiKey: true,
    needsOllamaUrl: false,
    defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
    modelPlaceholder: 'e.g. meta-llama/llama-3.1-8b-instruct:free',
    modelHint: 'Full model slug from openrouter.ai/models — many free models available.',
    apiKeyLabel: 'OpenRouter API Key',
    apiKeyHint: 'Starts with sk-or-... — get it from openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/models',
  },
  anthropic: {
    label: 'Anthropic Claude',
    icon: '🔶',
    color: 'border-orange-800 bg-orange-950/20',
    needsApiKey: true,
    needsOllamaUrl: false,
    defaultModel: 'claude-3-haiku-20240307',
    modelPlaceholder: 'e.g. claude-3-haiku-20240307, claude-3-5-sonnet-20241022',
    modelHint: 'Claude model ID. Haiku is fastest and cheapest; Sonnet is most capable.',
    apiKeyLabel: 'Anthropic API Key',
    apiKeyHint: 'Starts with sk-ant-... — get it from console.anthropic.com/keys',
    docsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
  },
  google: {
    label: 'Google Gemini',
    icon: '✦',
    color: 'border-blue-800 bg-blue-950/20',
    needsApiKey: true,
    needsOllamaUrl: false,
    defaultModel: 'gemini-1.5-flash',
    modelPlaceholder: 'e.g. gemini-1.5-flash, gemini-1.5-pro',
    modelHint: 'Gemini model name. Flash is fast; Pro is more capable.',
    apiKeyLabel: 'Google AI Studio API Key',
    apiKeyHint: 'Get it from aistudio.google.com/app/apikey — free tier available.',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
  },
};

// ─── Default form state ───────────────────────────────────────────────────────
const DEFAULT_FORM: SettingsPayload = {
  ai_provider: 'ollama',
  model_name: 'gemma3:4b',
  ai_api_key: '',
  ollama_url: 'http://localhost:11434',
  score_threshold: 7,
  reddit_client_id: '',
  reddit_client_secret: '',
};

export default function SettingsPage() {
  const [formData, setFormData] = useState<SettingsPayload>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const meta = PROVIDERS[formData.ai_provider];

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getSettings();
        setFormData({
          ai_provider: (settings.ai_provider as AIProvider) || 'ollama',
          model_name: settings.model_name || 'gemma3:4b',
          ai_api_key: settings.ai_api_key || '',
          ollama_url: settings.ollama_url || 'http://localhost:11434',
          score_threshold: settings.score_threshold ?? 7,
          reddit_client_id: settings.reddit_client_id || '',
          reddit_client_secret: settings.reddit_client_secret || '',
        });
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Failed to load settings.' });
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // When provider changes, set the default model for that provider
  const handleProviderChange = (provider: AIProvider) => {
    setFormData((prev) => ({
      ...prev,
      ai_provider: provider,
      model_name: PROVIDERS[provider].defaultModel,
      ai_api_key: '',
    }));
    setShowApiKey(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    if (formData.score_threshold < 0 || formData.score_threshold > 10) {
      setMessage({ type: 'error', text: 'Score threshold must be between 0 and 10.' });
      setIsSaving(false);
      return;
    }

    if (meta.needsApiKey && !formData.ai_api_key?.trim()) {
      setMessage({ type: 'error', text: `${meta.apiKeyLabel} is required for ${meta.label}.` });
      setIsSaving(false);
      return;
    }

    if (meta.needsOllamaUrl && !formData.ollama_url?.trim()) {
      setMessage({ type: 'error', text: 'Ollama URL is required for local Ollama provider.' });
      setIsSaving(false);
      return;
    }

    try {
      await api.updateSettings(formData);
      setMessage({ type: 'success', text: `Settings saved! Jenny OS will now use ${meta.label} (${formData.model_name}).` });
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update settings.' });
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
    <div className="flex-1 flex flex-col h-full overflow-y-auto max-w-2xl mx-auto w-full p-8 space-y-6">
      {/* Header */}
      <header className="shrink-0">
        <h2 className="text-xl font-bold text-zinc-100 tracking-tight">System Settings</h2>
        <p className="text-xs text-zinc-500 font-mono">Configure Jenny OS brain model and runtime environment</p>
      </header>

      {/* ── Section 1: AI Brain ── */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2 pb-1 border-b border-zinc-900">
          <span className="text-base">🧠</span>
          <h3 className="text-sm font-semibold text-zinc-200">AI Brain Configuration</h3>
          <span className="ml-auto text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Keyword Generator</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Alert Banner */}
          {message && (
            <div className={`flex gap-2.5 border rounded-lg p-4 text-xs ${
              message.type === 'success'
                ? 'bg-emerald-950/25 border-emerald-900 text-emerald-400'
                : 'bg-red-950/25 border-red-900 text-red-400'
            }`}>
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

          {/* Provider Selector — Card Grid */}
          <div className="space-y-2">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              AI Provider
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(PROVIDERS) as AIProvider[]).map((provider) => {
                const p = PROVIDERS[provider];
                const isSelected = formData.ai_provider === provider;
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleProviderChange(provider)}
                    className={`
                      flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all duration-150 select-none
                      ${isSelected
                        ? `${p.color} border-opacity-80 text-zinc-100`
                        : 'border-zinc-900 bg-zinc-950/30 text-zinc-500 hover:border-zinc-800 hover:text-zinc-400'
                      }
                    `}
                  >
                    <span className="text-base leading-none">{p.icon}</span>
                    <div>
                      <div className={`text-[10px] font-semibold leading-tight ${isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>
                        {p.label}
                      </div>
                      {isSelected && (
                        <div className="text-[9px] font-mono text-emerald-400 mt-0.5">● ACTIVE</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="model-name" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Model Name
              </label>
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-cyan-600 hover:text-cyan-400 underline"
              >
                Browse models →
              </a>
            </div>
            <input
              type="text"
              id="model-name"
              value={formData.model_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, model_name: e.target.value }))}
              placeholder={meta.modelPlaceholder}
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200 font-mono"
            />
            <span className="text-[10px] text-zinc-500 block">{meta.modelHint}</span>
          </div>

          {/* Ollama URL — only shown for Ollama provider */}
          {meta.needsOllamaUrl && (
            <div className="space-y-1.5">
              <label htmlFor="ollama-url" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Ollama Server URL
              </label>
              <input
                type="url"
                id="ollama-url"
                value={formData.ollama_url || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, ollama_url: e.target.value }))}
                placeholder="http://localhost:11434"
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200 font-mono"
              />
              <span className="text-[10px] text-zinc-500 block">HTTP URL of your local Ollama server.</span>
            </div>
          )}

          {/* API Key — only shown for cloud providers */}
          {meta.needsApiKey && (
            <div className="space-y-1.5">
              <label htmlFor="ai-api-key" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                {meta.apiKeyLabel} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  id="ai-api-key"
                  value={formData.ai_api_key || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ai_api_key: e.target.value }))}
                  placeholder="Paste your API key here..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 pr-10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label={showApiKey ? 'Hide key' : 'Show key'}
                >
                  {showApiKey ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
              <span className="text-[10px] text-zinc-500 block">{meta.apiKeyHint}</span>
            </div>
          )}

          {/* Score Threshold */}
          <div className="space-y-2 pt-2 border-t border-zinc-900">
            <label htmlFor="score-threshold" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
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
              <span>10 (Strict filter)</span>
            </div>
            <span className="text-[10px] text-zinc-500 block">
              Leads scoring at or above this value will be <strong>QUALIFIED</strong>. Others → <strong>DISQUALIFIED</strong>.
            </span>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-zinc-900 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-zinc-950 text-xs font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed select-none"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Section 2: Reddit API ── */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2 pb-1 border-b border-zinc-900">
          <span className="text-base">🔗</span>
          <h3 className="text-sm font-semibold text-zinc-200">Reddit API Credentials</h3>
          <span className="ml-auto text-[9px] font-mono text-zinc-500 uppercase">Optional</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reddit-client-id" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Reddit Client ID
            </label>
            <input
              type="text"
              id="reddit-client-id"
              value={formData.reddit_client_id || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, reddit_client_id: e.target.value }))}
              placeholder="14-character alphanumeric string"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200"
            />
            <span className="text-[10px] text-zinc-500 block">
              From your Reddit App Preferences — App type must be &quot;script&quot;.
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reddit-client-secret" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Reddit Client Secret
            </label>
            <input
              type="password"
              id="reddit-client-secret"
              value={formData.reddit_client_secret || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, reddit_client_secret: e.target.value }))}
              placeholder="27-character secret string"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition duration-200"
            />
            <span className="text-[10px] text-zinc-500 block">
              If set, Jenny OS uses OAuth to bypass public Reddit rate limits.
            </span>
          </div>

          <div className="pt-3 border-t border-zinc-900 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-zinc-950 text-xs font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed select-none"
            >
              {isSaving ? 'Saving...' : 'Save Credentials'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
