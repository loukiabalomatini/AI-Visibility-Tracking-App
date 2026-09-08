import { useState, useEffect } from 'react';
import {
  AIProviderId,
  ProviderStatusInfo,
  ProviderConnectionStatus,
} from '../types';
import {
  fetchProvidersStatus,
  saveProviderKey,
  testProviderConnection,
} from '../api';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Key,
  Sparkles,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Lock,
} from 'lucide-react';

interface AIProviderConfigProps {
  initialProvidersStatus?: Record<AIProviderId, ProviderStatusInfo>;
  onStatusChange?: () => void;
}

interface ProviderMeta {
  id: AIProviderId;
  displayName: string;
  cardTitle: string;
  apiKeyName: string;
  defaultModel: string;
  description: string;
  placeholder: string;
  badgeBg: string;
}

const PROVIDER_METAS: ProviderMeta[] = [
  {
    id: 'gemini',
    displayName: 'Gemini',
    cardTitle: 'Google Gemini',
    apiKeyName: 'GEMINI_API_KEY',
    defaultModel: 'gemini-flash-latest',
    description: 'Fast Google reasoning engine for brand sentiment & explicit position tracking.',
    placeholder: 'AIzaSy...',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'claude',
    displayName: 'Claude',
    cardTitle: 'Anthropic Claude',
    apiKeyName: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-sonnet-20241022',
    description: 'Nuanced brand attribution and competitive context analysis.',
    placeholder: 'sk-ant-api03-...',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    cardTitle: 'OpenAI ChatGPT',
    apiKeyName: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    description: 'Direct ChatGPT conversational recommendation benchmarking.',
    placeholder: 'sk-proj-...',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
];

export function AIProviderConfig({ initialProvidersStatus, onStatusChange }: AIProviderConfigProps) {
  // Provider data map
  const [providersMap, setProvidersMap] = useState<Record<AIProviderId, ProviderStatusInfo>>(() => {
    if (initialProvidersStatus) return initialProvidersStatus;
    // Sensible initial fallbacks while loading
    return {
      gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        defaultModel: 'gemini-flash-latest',
        configured: false,
        apiKeyName: 'GEMINI_API_KEY',
        connectionStatus: 'not_configured',
      },
      claude: {
        id: 'claude',
        name: 'Anthropic Claude',
        defaultModel: 'claude-3-5-sonnet-20241022',
        configured: false,
        apiKeyName: 'ANTHROPIC_API_KEY',
        connectionStatus: 'not_configured',
      },
      openai: {
        id: 'openai',
        name: 'OpenAI ChatGPT',
        defaultModel: 'gpt-4o',
        configured: false,
        apiKeyName: 'OPENAI_API_KEY',
        connectionStatus: 'not_configured',
      },
    };
  });

  // Ephemeral inputs while typing (cleared immediately upon save)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({
    gemini: '',
    claude: '',
    openai: '',
  });

  const [isSavingKey, setIsSavingKey] = useState<Record<string, boolean>>({
    gemini: false,
    claude: false,
    openai: false,
  });

  const [isTestingKey, setIsTestingKey] = useState<Record<string, boolean>>({
    gemini: false,
    claude: false,
    openai: false,
  });

  const [feedbacks, setFeedbacks] = useState<
    Record<string, { type: 'success' | 'error'; message: string } | null>
  >({
    gemini: null,
    claude: null,
    openai: null,
  });

  // Load latest provider statuses from server on mount
  useEffect(() => {
    let isMounted = true;
    fetchProvidersStatus()
      .then(res => {
        if (isMounted && res.providersStatus) {
          setProvidersMap(res.providersStatus);
        }
      })
      .catch(err => {
        console.error('Failed to load initial provider statuses:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshStatus = async () => {
    try {
      const res = await fetchProvidersStatus();
      if (res.providersStatus) {
        setProvidersMap(res.providersStatus);
      }
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to refresh provider status:', err);
    }
  };

  const handleSaveKey = async (providerId: AIProviderId) => {
    const rawKey = (keyInputs[providerId] || '').trim();
    if (!rawKey) return;

    setIsSavingKey(prev => ({ ...prev, [providerId]: true }));
    setFeedbacks(prev => ({ ...prev, [providerId]: null }));

    try {
      const res = await saveProviderKey(providerId, rawKey);
      // Clear key input immediately so it is not retained in memory
      setKeyInputs(prev => ({ ...prev, [providerId]: '' }));

      if (res.providersStatus) {
        setProvidersMap(res.providersStatus);
      }

      setFeedbacks(prev => ({
        ...prev,
        [providerId]: {
          type: 'success',
          message: 'Key saved securely on server. Click "Test Connection" to verify.',
        },
      }));

      onStatusChange?.();
    } catch (err: any) {
      setFeedbacks(prev => ({
        ...prev,
        [providerId]: {
          type: 'error',
          message: err.message || 'Failed to save API key',
        },
      }));
    } finally {
      setIsSavingKey(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTestConnection = async (providerId: AIProviderId) => {
    setIsTestingKey(prev => ({ ...prev, [providerId]: true }));
    setFeedbacks(prev => ({ ...prev, [providerId]: null }));

    try {
      // If user typed a key but hasn't clicked Save yet, save it first
      const pendingKey = (keyInputs[providerId] || '').trim();
      if (pendingKey) {
        await saveProviderKey(providerId, pendingKey);
        setKeyInputs(prev => ({ ...prev, [providerId]: '' }));
      }

      const res = await testProviderConnection(providerId);

      if (res.providersStatus) {
        setProvidersMap(res.providersStatus);
      } else if (res.provider) {
        setProvidersMap(prev => ({ ...prev, [providerId]: res.provider! }));
      }

      if (res.connectionStatus === 'connected') {
        setFeedbacks(prev => ({
          ...prev,
          [providerId]: {
            type: 'success',
            message: res.message || 'Connection verified successfully.',
          },
        }));
      } else if (res.connectionStatus === 'failed') {
        setFeedbacks(prev => ({
          ...prev,
          [providerId]: {
            type: 'error',
            message: res.error || 'Connection failed. Please verify your API key and permissions.',
          },
        }));
      } else {
        setFeedbacks(prev => ({
          ...prev,
          [providerId]: {
            type: 'error',
            message: res.error || 'Provider key is not configured.',
          },
        }));
      }

      onStatusChange?.();
    } catch (err: any) {
      setFeedbacks(prev => ({
        ...prev,
        [providerId]: {
          type: 'error',
          message: err.message || 'Connection test failed',
        },
      }));
    } finally {
      setIsTestingKey(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const isTestingAny = Object.values(isTestingKey).some(Boolean);

  const handleTestAll = async () => {
    for (const meta of PROVIDER_METAS) {
      const current = providersMap[meta.id];
      if (current?.configured || keyInputs[meta.id]?.trim()) {
        await handleTestConnection(meta.id);
      }
    }
  };

  const renderStatusBadge = (status: ProviderConnectionStatus = 'not_configured') => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Connected</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Connection Failed</span>
          </span>
        );
      case 'not_configured':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Not Configured</span>
          </span>
        );
    }
  };

  return (
    <div id="ai-provider-configuration-section" className="space-y-6">
      {/* 1. TOP OVERVIEW: AI Providers */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span>AI Provider Configuration</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure credentials for Gemini, Claude, and OpenAI to benchmark brand visibility across engines
            </p>
          </div>

          <button
            id="test-all-providers-btn"
            onClick={handleTestAll}
            disabled={isTestingAny}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 border border-indigo-200 rounded-lg transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingAny ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isTestingAny ? 'Testing All Engines...' : 'Test All Connections'}</span>
          </button>
        </div>

        {/* Top Status Overview Box */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">AI Providers</h3>
            <span className="text-[11px] text-slate-500 font-medium">Real-time Connection Status</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROVIDER_METAS.map(meta => {
              const info = providersMap[meta.id];
              const status = info?.connectionStatus || (info?.configured ? 'connected' : 'not_configured');
              return (
                <div
                  key={meta.id}
                  id={`provider-overview-${meta.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900">{meta.displayName}</span>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{meta.apiKeyName}</p>
                  </div>
                  <div>{renderStatusBadge(status)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. THREE SEPARATE PROVIDER CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PROVIDER_METAS.map(meta => {
          const info = providersMap[meta.id];
          const isConfigured = Boolean(info?.configured);
          const maskedKey = info?.maskedKey;
          const status = info?.connectionStatus || (isConfigured ? 'connected' : 'not_configured');
          const isSaving = isSavingKey[meta.id];
          const isTesting = isTestingKey[meta.id];
          const feedback = feedbacks[meta.id];
          const inputValue = keyInputs[meta.id] || '';

          return (
            <div
              key={meta.id}
              id={`provider-card-${meta.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
            >
              {/* Card Header */}
              <div className="space-y-3 pb-3 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>{meta.cardTitle}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{meta.description}</p>
                  </div>
                  <div className="shrink-0">{renderStatusBadge(status)}</div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                  <span className="font-semibold">Secret Variable:</span>
                  <span className="font-mono font-bold text-indigo-700">{meta.apiKeyName}</span>
                </div>
              </div>

              {/* Card Body: Key Configuration */}
              <div className="space-y-3 flex-1">
                {/* Masked Representation */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Current Key State
                  </label>
                  {isConfigured && maskedKey ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="text-slate-500 font-medium">Configured:</span>
                      <span className="font-mono text-slate-900 font-bold tracking-wider">
                        {maskedKey}
                      </span>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                      No key configured in server environment
                    </div>
                  )}
                </div>

                {/* Masked Password Input */}
                <div>
                  <label
                    htmlFor={`api-key-input-${meta.id}`}
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    {isConfigured ? 'Replace API Key' : 'API Key'}
                  </label>
                  <div className="relative">
                    <input
                      id={`api-key-input-${meta.id}`}
                      type="password"
                      autoComplete="off"
                      value={inputValue}
                      onChange={e =>
                        setKeyInputs(prev => ({
                          ...prev,
                          [meta.id]: e.target.value,
                        }))
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter' && inputValue.trim()) {
                          handleSaveKey(meta.id);
                        }
                      }}
                      placeholder={isConfigured ? 'Enter new key to replace...' : meta.placeholder}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Input is masked. Once saved, keys are never displayed in plain text.
                  </p>
                </div>

                {/* Feedback Notification Box */}
                {feedback && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] border ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <div className="flex items-start space-x-1.5">
                      {feedback.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span className="leading-snug break-words">{feedback.message}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer: Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <button
                    id={`save-key-btn-${meta.id}`}
                    onClick={() => handleSaveKey(meta.id)}
                    disabled={isSaving || !inputValue.trim()}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Save Key</span>
                      </>
                    )}
                  </button>

                  <button
                    id={`test-connection-btn-${meta.id}`}
                    onClick={() => handleTestConnection(meta.id)}
                    disabled={isTesting || (!isConfigured && !inputValue.trim())}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-300 disabled:border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 text-center">
                  Model: <span className="font-mono text-slate-600">{meta.defaultModel}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Best Practices Callout */}
      <div className="p-4 bg-slate-100/80 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-2">
        <div className="flex items-center space-x-2 text-slate-900 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Credential Security & Server-Side Execution</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          API credentials are strictly handled on the server side and never exposed to client browsers, React state,
          local storage, or network response payloads. Each AI engine request is routed securely:
          <code className="mx-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-indigo-600 font-mono text-[10px]">
            Browser → Server → AI Provider API
          </code>.
        </p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          You can also configure these keys directly in your Google AI Studio environment via{' '}
          <strong>Settings &gt; Secrets</strong> using the variable names{' '}
          <span className="font-mono font-semibold text-slate-700">GEMINI_API_KEY</span>,{' '}
          <span className="font-mono font-semibold text-slate-700">ANTHROPIC_API_KEY</span>, and{' '}
          <span className="font-mono font-semibold text-slate-700">OPENAI_API_KEY</span>.
        </p>
      </div>
    </div>
  );
}
