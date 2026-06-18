export interface Lead {
  id: string;
  content_hash: string;
  raw_content: string;
  intent: 'hire' | 'opinion' | 'promotion' | 'other';
  service_required: string | null;
  platform: string | null;
  lead_score: number;          // 0–10 integer
  lead_quality: 'low' | 'medium' | 'high';
  confidence: number;          // 0.0–1.0 float
  reasoning: string[];         // parsed from JSON — always array, never string
  status: 'NEW' | 'QUALIFIED' | 'DISQUALIFIED';
  created_at: string;          // ISO 8601 UTC
  
  // New fields
  mission_id: string | null;
  target_service: string | null;
  service_match: boolean;
  relevance_score: number;
  source_post_id?: string | null;
  source_url?: string | null;
}

export interface Mission {
  id: string;
  mission_name: string;
  target_service: string;
  keywords: string[];
  score_threshold: number;
  is_active: boolean;
  created_at: string;
}

export interface MissionPerformance {
  mission_id: string;
  total_leads: number;
  qualified_leads: number;
  qualification_rate: number;   // percentage, e.g. 41.7
  top_keywords: string[];       // top 3 most-matched keywords
}

export interface InitialSource {
  platform: string;
  name: string;
  url?: string | null;
}

export interface MissionCreate {
  mission_name: string;
  target_service: string;
  keywords: string[];
  score_threshold: number;
  initial_sources?: InitialSource[];
}

export interface MissionUpdate {
  mission_name?: string;
  target_service?: string;
  keywords?: string[];
  score_threshold?: number;
  is_active?: boolean;
}

export interface Log {
  id: number;
  timestamp: string;           // ISO 8601 UTC
  event: string;               // named event constant
  lead_id: string | null;
  details: any;                // parsed JSON object
}

export interface Stats {
  total: number;
  qualified: number;
  rejected: number;
}

export interface AnalyzeRequest {
  content: string;
  mission_id: string;
}

export interface AnalyzeResponse {
  lead: Lead;
}

export type AIProvider = 'ollama' | 'openai' | 'openrouter' | 'anthropic' | 'google';

export interface SettingsPayload {
  ai_provider: AIProvider;
  model_name: string;
  ai_api_key?: string;          // Required for cloud providers; blank for Ollama
  ollama_url?: string;          // Required for Ollama; ignored for cloud
  score_threshold: number;      // 0–10
  reddit_client_id?: string;
  reddit_client_secret?: string;
}


export interface Source {
  id: string;
  mission_id: string;
  source_type: 'reddit';
  config: {
    subreddit: string;
    limit: number;
  };
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: 'SUCCESS' | 'FAILED' | null;
  last_error: string | null;
  sync_count: number;
  created_at: string;
}

export interface SourceCreate {
  mission_id: string;
  source_type: 'reddit';
  config: {
    subreddit: string;
    limit: number;
  };
}

export interface SourceUpdate {
  is_active?: boolean;
  config?: {
    subreddit: string;
    limit: number;
  };
}

export interface SyncResult {
  added: number;
  skipped: number;
  errors: string[];
}
