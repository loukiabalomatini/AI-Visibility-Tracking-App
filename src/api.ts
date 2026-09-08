import {
  TrackerData,
  TrackerConfig,
  AnalysisRun,
  PromptItem,
  AIProviderId,
  ProviderStatusInfo,
  ProviderConnectionStatus,
} from './types';

export async function fetchTrackerData(): Promise<TrackerData> {
  const res = await fetch('/api/data');
  if (!res.ok) {
    throw new Error('Failed to load tracker data');
  }
  return res.json();
}

export async function fetchProvidersStatus(): Promise<{
  providers: ProviderStatusInfo[];
  providersStatus: Record<AIProviderId, ProviderStatusInfo>;
}> {
  const res = await fetch('/api/providers/status');
  if (!res.ok) {
    throw new Error('Failed to fetch provider status');
  }
  return res.json();
}

export async function saveProviderKey(
  providerId: AIProviderId,
  apiKey: string
): Promise<{
  success: boolean;
  message: string;
  provider: ProviderStatusInfo;
  providersStatus: Record<AIProviderId, ProviderStatusInfo>;
}> {
  const res = await fetch(`/api/providers/${providerId}/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save API key');
  }
  return data;
}

export async function testProviderConnection(
  providerId: AIProviderId
): Promise<{
  success: boolean;
  connectionStatus: ProviderConnectionStatus;
  message?: string;
  error?: string;
  provider?: ProviderStatusInfo;
  providersStatus?: Record<AIProviderId, ProviderStatusInfo>;
}> {
  const res = await fetch(`/api/providers/${providerId}/test`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  return {
    success: Boolean(data.success),
    connectionStatus: data.connectionStatus || (data.success ? 'connected' : 'failed'),
    message: data.message,
    error: data.error,
    provider: data.provider,
    providersStatus: data.providersStatus,
  };
}

export async function updateSetup(config: {
  targetBrand?: string;
  competitors?: string[];
  prompts?: PromptItem[];
  providerModels?: Record<string, string>;
  enabledProviders?: AIProviderId[];
}): Promise<{ success: boolean; config: TrackerConfig }> {
  const res = await fetch('/api/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to save setup');
  }
  return res.json();
}

export async function createAnalysisRun(params: {
  name?: string;
  targetBrand: string;
  competitors: string[];
  prompts: PromptItem[];
  providers?: AIProviderId[];
  providerModels?: Record<string, string>;
}): Promise<{ success: boolean; run: AnalysisRun }> {
  const res = await fetch('/api/runs/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create analysis run');
  }
  return res.json();
}

export async function executePrompt(
  run: AnalysisRun,
  promptId: string,
  provider: AIProviderId = 'gemini'
): Promise<any> {
  const res = await fetch('/api/runs/execute-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run, promptId, provider }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to execute prompt on ${provider}`);
  }
  return data;
}

export async function cancelRun(runId: string): Promise<void> {
  await fetch('/api/runs/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId }),
  });
}

export async function deleteRun(runId: string): Promise<void> {
  await fetch(`/api/runs/${runId}`, {
    method: 'DELETE',
  });
}
