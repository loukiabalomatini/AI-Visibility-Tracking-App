export type AIProviderId = 'gemini' | 'claude' | 'openai';

export interface PromptItem {
  id: string;
  text: string;
  category: string;
  enabled: boolean;
}

export interface BrandAnalysis {
  name: string;
  mentioned: boolean;
  recommended: boolean;
  explicit_position: number | null;
  mention_order: number | null;
  context: string;
  score: number;
}

export interface PromptResult {
  runId?: string;
  promptId: string;
  provider?: AIProviderId; // 'gemini' | 'claude' | 'openai'
  promptText: string;
  category: string;
  model?: string;
  rawResponse: string;
  rawAnalysisJson?: string;
  brands: BrandAnalysis[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  durationMs?: number;
  timestamp?: string;
}

export interface BrandMetrics {
  brandName: string;
  isTarget: boolean;
  visibilityScore: number; // 0-100
  mentionRate: number; // 0-100 percentage
  recommendationRate: number; // 0-100 percentage
  explicitPositionCount: number;
  averagePosition: number | null;
  totalMentions: number;
  totalRecommended: number;
  categoryScores: Record<string, number>; // category -> score (0-100)
}

export interface AnalysisRun {
  id: string;
  timestamp: string;
  name?: string;
  targetBrand: string;
  competitors: string[];
  totalPrompts: number;
  completedPrompts: number;
  failedPrompts: number;
  model: string;
  enabledProviders?: AIProviderId[];
  providerModels?: Record<string, string>;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'partial';
  promptResults: PromptResult[];
  brandMetrics: Record<string, BrandMetrics>;
  providerMetrics?: Record<string, Record<string, BrandMetrics>>; // provider -> brand -> metrics
}

export interface TrackerConfig {
  targetBrand: string;
  competitors: string[];
  prompts: PromptItem[];
  providerModels?: Record<string, string>;
  enabledProviders?: AIProviderId[];
}

export type ProviderConnectionStatus = 'not_configured' | 'connected' | 'failed';

export interface ProviderStatusInfo {
  id: AIProviderId;
  name: string;
  defaultModel: string;
  configured: boolean;
  apiKeyName: string;
  maskedKey?: string | null;
  connectionStatus: ProviderConnectionStatus;
  lastTestedAt?: string | null;
  lastError?: string | null;
}

export interface TrackerData {
  config: TrackerConfig;
  runs: AnalysisRun[];
  apiKeyConfigured?: boolean;
  providersStatus?: Record<AIProviderId, ProviderStatusInfo>;
}
