import { useState } from 'react';
import { PromptResult, BrandAnalysis, AIProviderId } from '../types';
import { X, Copy, Check, FileText, Code2, AlertCircle, RefreshCw, ArrowDown, ShieldCheck, Columns, Cpu } from 'lucide-react';

interface PromptDetailModalProps {
  promptResult: PromptResult | null;
  allRunResults?: PromptResult[];
  targetBrand: string;
  onClose: () => void;
  onRetryPrompt?: (promptId: string, provider?: AIProviderId) => void;
  isRetrying?: boolean;
}

export function PromptDetailModal({
  promptResult,
  allRunResults = [],
  targetBrand,
  onClose,
  onRetryPrompt,
  isRetrying,
}: PromptDetailModalProps) {
  // Find all sibling results for this prompt across providers
  const siblingResults = promptResult
    ? allRunResults.filter(p => p.promptId === promptResult.promptId)
    : [];

  const availableResults = siblingResults.length > 0 ? siblingResults : (promptResult ? [promptResult] : []);

  const [activeProvider, setActiveProvider] = useState<AIProviderId | 'side_by_side'>(
    promptResult?.provider || 'gemini'
  );
  const [activeView, setActiveView] = useState<'validation' | 'response' | 'json'>('validation');
  const [copied, setCopied] = useState(false);

  if (!promptResult) return null;

  // Selected single result
  const currentResult =
    activeProvider === 'side_by_side'
      ? availableResults[0] || promptResult
      : availableResults.find(r => (r.provider || 'gemini').toLowerCase() === activeProvider) || promptResult;

  const handleCopy = (textToCopy?: string) => {
    navigator.clipboard.writeText(textToCopy || currentResult.rawResponse || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreExplanation = (brand: BrandAnalysis) => {
    if (brand.explicit_position !== null && brand.explicit_position !== undefined) {
      if (brand.explicit_position === 1) return '#1 Explicit Rank → 1.0 pts';
      if (brand.explicit_position === 2) return '#2 Explicit Rank → 0.8 pts';
      if (brand.explicit_position === 3) return '#3 Explicit Rank → 0.6 pts';
      if (brand.explicit_position === 4) return '#4 Explicit Rank → 0.4 pts';
      if (brand.explicit_position === 5) return '#5 Explicit Rank → 0.2 pts';
      return `#${brand.explicit_position} Explicit Rank → ${brand.score} pts`;
    }
    if (brand.mentioned) {
      return 'Mentioned without explicit ranking → 0.3 pts';
    }
    return 'Not mentioned in answer → 0.0 pts';
  };

  const providerNames: Record<AIProviderId, string> = {
    gemini: 'Google Gemini',
    claude: 'Anthropic Claude',
    openai: 'OpenAI ChatGPT',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex-1 pr-4">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                {promptResult.category}
              </span>
              <span className="text-xs text-slate-500 font-mono">ID: {promptResult.promptId}</span>
              {currentResult.model && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                  Model: {currentResult.model}
                </span>
              )}
              {currentResult.durationMs !== undefined && (
                <span className="text-[11px] text-slate-400">
                  {Math.round(currentResult.durationMs / 100) / 10}s
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              "{promptResult.promptText}"
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {onRetryPrompt && (
              <button
                onClick={() => onRetryPrompt(promptResult.promptId, activeProvider === 'side_by_side' ? undefined : activeProvider)}
                disabled={isRetrying}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 disabled:opacity-50 transition-colors shadow-xs"
                title="Re-query AI engine and re-audit this prompt"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Retrying...' : 'Re-run'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Engine Switcher Bar (Section 16: Select provider or view all three side-by-side) */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1">
            <span className="text-xs font-bold text-slate-700 mr-2 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              Engine:
            </span>

            <button
              onClick={() => setActiveProvider('side_by_side')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeProvider === 'side_by_side'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>Side-by-Side (All 3)</span>
            </button>

            {(['gemini', 'claude', 'openai'] as AIProviderId[]).map(pId => {
              const res = availableResults.find(r => (r.provider || 'gemini').toLowerCase() === pId);
              const isSelected = activeProvider === pId;
              const isConfigured = res !== undefined;

              return (
                <button
                  key={pId}
                  onClick={() => setActiveProvider(pId)}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${pId === 'gemini' ? 'bg-indigo-400' : pId === 'claude' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span>{providerNames[pId]}</span>
                  {res?.status === 'completed' && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>

          {activeProvider !== 'side_by_side' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveView('validation')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeView === 'validation' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pipeline Verification
              </button>
              <button
                onClick={() => setActiveView('response')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeView === 'response' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Raw Text
              </button>
              <button
                onClick={() => setActiveView('json')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeView === 'json' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Structured JSON
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Side-by-Side Comparison View */}
          {activeProvider === 'side_by_side' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['gemini', 'claude', 'openai'] as AIProviderId[]).map(pId => {
                  const res = availableResults.find(r => (r.provider || 'gemini').toLowerCase() === pId);
                  const targetData = res?.brands?.find(b => b.name.toLowerCase() === targetBrand.toLowerCase());

                  return (
                    <div
                      key={pId}
                      className="border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between overflow-hidden"
                    >
                      {/* Provider Header */}
                      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{providerNames[pId]}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{res?.model || 'default'}</span>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            res?.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : res?.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {res?.status || 'Not executed'}
                        </span>
                      </div>

                      {/* Brand Extraction Highlights */}
                      <div className="p-4 space-y-3 flex-1">
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-indigo-950">{targetBrand}</span>
                            <span className="font-mono font-bold text-indigo-700">
                              Score: {targetData?.score ?? 0}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-indigo-800 flex items-center gap-2">
                            <span>
                              {targetData?.mentioned
                                ? targetData.explicit_position
                                  ? `#${targetData.explicit_position} Explicit Rank`
                                  : targetData.recommended
                                  ? '★ Recommended'
                                  : 'Mentioned'
                                : 'Not mentioned'}
                            </span>
                          </div>
                          {targetData?.context && (
                            <p className="mt-1.5 text-[10px] italic text-indigo-900/80 line-clamp-2">
                              "{targetData.context}"
                            </p>
                          )}
                        </div>

                        {/* Raw response snippet */}
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Response Excerpt:
                          </span>
                          <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-[11px]">
                            {res?.rawResponse || res?.error || 'No response captured.'}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
                        <button
                          onClick={() => handleCopy(res?.rawResponse)}
                          className="text-[11px] text-slate-600 hover:text-slate-900 font-medium"
                        >
                          Copy Text
                        </button>
                        <button
                          onClick={() => setActiveProvider(pId)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          Detailed Audit →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Single Provider Detailed 5-Step Verification View */
            <div className="space-y-6">
              {currentResult.error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">{providerNames[activeProvider]} Execution Failure: </span>
                    {currentResult.error}
                  </div>
                </div>
              )}

              {/* 1. VALIDATION / DEBUG VIEW */}
              {activeView === 'validation' && (
                <div className="space-y-6">
                  {/* Step 1: Raw AI Response */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          RAW {providerNames[activeProvider].toUpperCase()} RESPONSE
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Model: {currentResult.model || 'default'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 leading-relaxed font-sans max-h-48 overflow-y-auto bg-white p-3.5 rounded-lg border border-slate-200 whitespace-pre-wrap selection:bg-indigo-100">
                      {currentResult.rawResponse || 'No response captured.'}
                    </div>
                  </div>

                  {/* Transition arrow */}
                  <div className="flex justify-center -my-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-500 shadow-xs">
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Step 2: Extracted Analysis & Individual Brand Scores */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          EXTRACTED ANALYSIS & INDIVIDUAL BRAND SCORES
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {providerNames[activeProvider]} Brand Audit
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentResult.brands?.map(brand => {
                        const isTarget = brand.name.toLowerCase() === targetBrand.toLowerCase();
                        return (
                          <div
                            key={brand.name}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isTarget
                                ? 'bg-indigo-50/70 border-indigo-300 shadow-xs ring-1 ring-indigo-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-xs font-bold text-slate-900">{brand.name}</span>
                                {isTarget && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-600 text-white uppercase tracking-wider">
                                    Target Brand
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-indigo-700 font-mono">
                                Score: {brand.score}
                              </span>
                            </div>

                            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Mentioned:</span>
                                <span className={`font-semibold ${brand.mentioned ? 'text-emerald-700' : 'text-slate-500'}`}>
                                  {brand.mentioned ? 'Yes' : 'No'}
                                </span>
                              </div>

                              <div>
                                <span className="text-slate-400 block text-[10px]">Recommended:</span>
                                <span className={`font-semibold ${brand.recommended ? 'text-emerald-700' : 'text-slate-500'}`}>
                                  {brand.recommended ? '★ Yes' : 'No'}
                                </span>
                              </div>

                              <div>
                                <span className="text-slate-400 block text-[10px]">Explicit Position:</span>
                                <span className="font-semibold text-slate-800">
                                  {brand.explicit_position !== null ? `#${brand.explicit_position}` : 'None'}
                                </span>
                              </div>

                              <div>
                                <span className="text-slate-400 block text-[10px]">Mention Order:</span>
                                <span className="font-semibold text-slate-800">
                                  {brand.mention_order !== null ? `#${brand.mention_order}` : 'N/A'}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                              <span>Rule applied:</span>
                              <span className="font-medium text-slate-700">{getScoreExplanation(brand)}</span>
                            </div>

                            {brand.context && (
                              <div className="mt-2 p-2 rounded bg-slate-100/60 text-slate-600 text-[11px] italic border border-slate-200/40">
                                "{brand.context}"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Transition arrow */}
                  <div className="flex justify-center -my-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-500 shadow-xs">
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Step 3: Aggregated Contribution */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          PROMPT CONTRIBUTION TO {providerNames[activeProvider].toUpperCase()} SCORE
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Category: {currentResult.category}
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5 leading-relaxed">
                      <p>
                        In this prompt, <strong>{targetBrand}</strong> received a response score of{' '}
                        <strong className="text-indigo-700">
                          {currentResult.brands?.find(b => b.name.toLowerCase() === targetBrand.toLowerCase())?.score ?? 0}
                        </strong>{' '}
                        on {providerNames[activeProvider]}.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        The engine's visibility score averages all individual prompt scores for this provider and scales them to 0-100.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Full Raw AI Response View */}
              {activeView === 'response' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap selection:bg-indigo-100">
                  {currentResult.rawResponse || 'No response captured.'}
                </div>
              )}

              {/* 3. Raw Structured JSON View */}
              {activeView === 'json' && (
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono">
                  <pre>
                    {currentResult.rawAnalysisJson
                      ? currentResult.rawAnalysisJson
                      : JSON.stringify(
                          {
                            promptId: currentResult.promptId,
                            provider: currentResult.provider,
                            promptText: currentResult.promptText,
                            category: currentResult.category,
                            model: currentResult.model,
                            brands: currentResult.brands,
                          },
                          null,
                          2
                        )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={() => handleCopy()}
            className="flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1 rounded-md hover:bg-slate-200/60 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Active Response'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
