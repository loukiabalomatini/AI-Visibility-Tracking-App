import {
  TrackerData,
  TrackerConfig,
  AnalysisRun,
  PromptItem,
  AIProviderId,
  ProviderStatusInfo,
  ProviderConnectionStatus,
} from './types';

const ACTIVE_RUN_KEY = 'ai-visibility-active-run';

function getLocalRun(): AnalysisRun | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalRun(run: AnalysisRun | null) {
  if (typeof window === 'undefined') return;
  try {
    if (run) window.localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(run));
    else window.localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    // Local storage is only used as client-side persistence for the stateless Vercel deployment.
  }
}

export async function fetchTrackerData(): Promise<TrackerData> {
  const res = await fetch('/api/data');
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.error || 'Failed to load tracker data');
  }

  // Vercel serverless functions cannot persist to the deployment filesystem.
  // Merge the active run kept in the browser into the server-provided config.
  const localRun = getLocalRun();
  if (localRun) {
    data.runs = [localRun, ...(data.runs || []).filter((r: AnalysisRun) => r.id !== localRun.id)];
  }

  return data;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create analysis run');
  }

  saveLocalRun(data.run);
  return data;
}

export async function executePrompt(
  runOrId: AnalysisRun | string,
  promptId: string,
  provider: AIProviderId = 'gemini'
): Promise<any> {
  const run = typeof runOrId === 'string' ? getLocalRun() : runOrId;
  if (!run) {
    throw new Error('Active run data is not available in this browser. Please start the analysis again.');
  }

  const res = await fetch('/api/runs/execute-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run, promptId, provider }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to execute prompt on ${provider}`);
  }

  if (data.runProgress) {
    saveLocalRun(data.runProgress);
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
  const localRun = getLocalRun();
  if (localRun?.id === runId) saveLocalRun(null);
}
