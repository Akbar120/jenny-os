import { Lead, Log, Stats, SettingsPayload, Mission, MissionCreate, MissionUpdate, MissionPerformance, Source, SourceCreate, SourceUpdate, SyncResult } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let errorDetail = 'API Request failed';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || JSON.stringify(errorJson);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  async analyzeLead(content: string, mission_id: string): Promise<Lead> {
    return fetchJson<Lead>(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      body: JSON.stringify({ content, mission_id }),
    });
  },

  async getLeads(
    limit: number = 50,
    offset: number = 0,
    mission_id?: string,
    status?: string
  ): Promise<Lead[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (mission_id) params.append('mission_id', mission_id);
    if (status) params.append('status', status);
    return fetchJson<Lead[]>(`${BASE_URL}/api/leads?${params.toString()}`, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  async getLead(id: string): Promise<Lead> {
    return fetchJson<Lead>(`${BASE_URL}/api/leads/${id}`, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  async getStats(mission_id?: string): Promise<Stats> {
    const url = mission_id ? `${BASE_URL}/api/stats?mission_id=${mission_id}` : `${BASE_URL}/api/stats`;
    return fetchJson<Stats>(url, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  async getLogs(limit: number = 100, offset: number = 0): Promise<Log[]> {
    return fetchJson<Log[]>(`${BASE_URL}/api/logs?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  async getSettings(): Promise<SettingsPayload> {
    return fetchJson<SettingsPayload>(`${BASE_URL}/api/settings`, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  async updateSettings(payload: SettingsPayload): Promise<SettingsPayload> {
    return fetchJson<SettingsPayload>(`${BASE_URL}/api/settings`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // Missions Endpoints
  async getMissions(): Promise<Mission[]> {
    return fetchJson<Mission[]>(`${BASE_URL}/api/missions`, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  async createMission(payload: MissionCreate): Promise<Mission> {
    return fetchJson<Mission>(`${BASE_URL}/api/missions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMission(id: string, payload: MissionUpdate): Promise<Mission> {
    return fetchJson<Mission>(`${BASE_URL}/api/missions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getMissionPerformance(mission_id: string): Promise<MissionPerformance> {
    return fetchJson<MissionPerformance>(`${BASE_URL}/api/missions/${mission_id}/performance`, {
      method: 'GET',
      next: { revalidate: 0 },
    });
  },

  async suggestMissionDetails(targetService: string): Promise<{ keywords: string[], used_fallback: boolean, communities: any[] }> {
    const params = new URLSearchParams({ target_service: targetService });
    // Note: endpoint renamed to /suggest-details to fix FastAPI route conflict
    return fetchJson<{ keywords: string[], used_fallback: boolean, communities: any[] }>(`${BASE_URL}/api/missions/suggest-details?${params.toString()}`, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  async scoutSubreddits(mission_id: string): Promise<{
    mission_id: string;
    mission_name: string;
    keywords: string[];
    suggestions: Array<{
      id: string;
      platform: string;
      name: string;
      display_name: string;
      description: string;
      url: string;
      score: number;
      already_added: boolean;
    }>;
  }> {
    return fetchJson(`${BASE_URL}/api/sources/scout?mission_id=${mission_id}`, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  // Sources Client Endpoints
  async getSources(mission_id?: string): Promise<Source[]> {
    const url = mission_id ? `${BASE_URL}/api/sources?mission_id=${mission_id}` : `${BASE_URL}/api/sources`;
    return fetchJson<Source[]>(url, {
      method: 'GET',
      next: { revalidate: 0 }
    });
  },

  async createSource(payload: SourceCreate): Promise<Source> {
    return fetchJson<Source>(`${BASE_URL}/api/sources`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateSource(id: string, payload: SourceUpdate): Promise<Source> {
    return fetchJson<Source>(`${BASE_URL}/api/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async syncSource(id: string): Promise<SyncResult> {
    return fetchJson<SyncResult>(`${BASE_URL}/api/sources/${id}/sync`, {
      method: 'POST',
    });
  },

  // Full Sweep Run Endpoints
  async triggerRun(): Promise<{ run_id: string; status: string; total_sources: number; message: string }> {
    return fetchJson(`${BASE_URL}/api/runs/trigger`, { method: 'POST' });
  },

  async getCurrentRun(): Promise<{ status: string; run: { run_id: string; status: string; total_sources: number; sources_done: number; leads_qualified: number; leads_skipped: number; progress_pct: number; started_at: string } | null }> {
    return fetchJson(`${BASE_URL}/api/runs/status`, { method: 'GET' });
  },

  async getRunHistory(): Promise<Array<{ run_id: string; status: string; triggered_by: string; started_at: string; completed_at: string; total_sources: number; sources_done: number; leads_qualified: number; leads_skipped: number; had_errors: boolean }>> {
    return fetchJson(`${BASE_URL}/api/runs`, { method: 'GET' });
  },
};
