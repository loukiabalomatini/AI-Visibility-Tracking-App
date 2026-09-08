import { useState } from 'react';
import { AnalysisRun, PromptResult, BrandAnalysis, AIProviderId } from '../types';
import { PromptDetailModal } from './PromptDetailModal';
import { Search, Filter, ExternalLink, RefreshCw, Layers, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';

interface PromptResultsTableProps {
  run: AnalysisRun | null;
  targetBrand: string;
  competitors: string[];
  initialCategoryFilter?: string;
  initialProviderFilter?: AIProviderId | 'all';
  onRetryPrompt?: (promptId: string, provider?: AIProviderId) => Promise<void>;
  isRetryingPromptId?: string | null;
}

export function PromptResultsTable({
  run,
  targetBrand,
  competitors,
  initialCategoryFilter = 'All',
  initialProviderFilter = 'all',
  onRetryPrompt,
  isRetryingPromptId,
}: PromptResultsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter);
  const [providerFilter, setProviderFilter] = useState<AIProviderId | 'all'>(initialProviderFilter);
  const [brandStatusFilter, setBrandStatusFilter] = useState<
    'all' | 'target_mentioned' | 'target_recommended' | 'target_ranked'
  >('all');
  const [selectedPrompt, setSelectedPrompt] = useState<PromptResult | null>(null);

  if (!run || !run.promptResults || run.promptResults.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <Layers className="w-8 h-8 mx-auto text-slate-400 mb-2" />
        <h4 className="text-sm font-semibold text-slate-800">No prompt results found</h4>
        <p className="text-xs text-slate-500 mt-1">
          Run an analysis to inspect prompt responses and brand rankings across AI engines.
        </p>
      </div>
    );
  }

  const allCategories = ['All', ...Array.from(new Set(run.promptResults.map(p => p.category || 'General')))];

  // Group prompts by unique promptId for multi-engine overview
  const promptIdList = Array.from(new Set(run.promptResults.map(p => p.promptId)));

  // If filtered by single provider
  const filteredSingleProviderResults = run.promptResults.filter(prompt => {
    const prov = (prompt.provider || 'gemini').toLowerCase();
    if (providerFilter !== 'all' && prov !== providerFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = prompt.promptText.toLowerCase().includes(q);
      const matchCat = prompt.category?.toLowerCase().includes(q);
      if (!matchText && !matchCat) return false;
    }

    if (categoryFilter !== 'All' && prompt.category !== categoryFilter) {
      return false;
    }

    if (brandStatusFilter !== 'all') {
      const targetData = prompt.brands?.find(b => b.name.toLowerCase() === targetBrand.toLowerCase());
      if (brandStatusFilter === 'target_mentioned' && !targetData?.mentioned) return false;
      if (brandStatusFilter === 'target_recommended' && !targetData?.recommended) return false;
      if (
        brandStatusFilter === 'target_ranked' &&
        (targetData?.explicit_position === null || targetData?.explicit_position === undefined)
      )
        return false;
    }

    return true;
  });

  // Unique prompt rows for the grouped view
  const groupedPromptRows = promptIdList
    .map(pId => {
      const resultsForPrompt = run.promptResults.filter(p => p.promptId === pId);
      const first = resultsForPrompt[0];
      const gemini = resultsForPrompt.find(p => (p.provider || 'gemini').toLowerCase() === 'gemini');
      const claude = resultsForPrompt.find(p => (p.provider || 'gemini').toLowerCase() === 'claude');
      const openai = resultsForPrompt.find(p => (p.provider || 'gemini').toLowerCase() === 'openai');

      return {
        promptId: pId,
        promptText: first?.promptText || '',
        category: first?.category || 'General',
        gemini,
        claude,
        openai,
        allResults: resultsForPrompt,
      };
    })
    .filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = item.promptText.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        if (!matchText && !matchCat) return false;
      }

      if (categoryFilter !== 'All' && item.category !== categoryFilter) {
        return false;
      }

      if (brandStatusFilter !== 'all') {
        const hasMatch = item.allResults.some(r => {
          const target = r.brands?.find(b => b.name.toLowerCase() === targetBrand.toLowerCase());
          if (brandStatusFilter === 'target_mentioned') return target?.mentioned;
          if (brandStatusFilter === 'target_recommended') return target?.recommended;
          if (brandStatusFilter === 'target_ranked')
            return target?.explicit_position !== null && target?.explicit_position !== undefined;
          return true;
        });
        if (!hasMatch) return false;
      }

      return true;
    });

  const renderBrandCell = (brand: BrandAnalysis | undefined, isTarget: boolean) => {
    if (!brand || !brand.mentioned) {
      return <span className="text-slate-400 font-medium text-xs px-2 py-0.5 rounded">—</span>;
    }

    if (brand.explicit_position !== null && brand.explicit_position !== undefined) {
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
            isTarget
              ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
              : 'bg-purple-100 text-purple-800 border-purple-200'
          }`}
          title={`Explicitly ranked #${brand.explicit_position} (Score: ${brand.score})`}
        >
          #{brand.explicit_position}
        </span>
      );
    }

    if (brand.recommended) {
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
            isTarget
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
          title="Explicitly recommended"
        >
          ★ Rec.
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
        title={`Mentioned in response (Score: ${brand.score})`}
      >
        Mentioned
      </span>
    );
  };

  const renderEngineSummaryBadge = (res?: PromptResult) => {
    if (!res) {
      return <span className="text-slate-400 text-[11px]">Not run</span>;
    }

    if (res.status === 'failed') {
      return (
        <span className="text-[10px] text-rose-600 font-medium px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
          Failed
        </span>
      );
    }

    const targetData = res.brands?.find(b => b.name.toLowerCase() === targetBrand.toLowerCase());

    // Top competitors mentioned
    const mentionedCompetitors = res.brands
      ?.filter(b => b.name.toLowerCase() !== targetBrand.toLowerCase() && b.mentioned)
      .sort((a, b) => (a.explicit_position ?? 99) - (b.explicit_position ?? 99))
      .slice(0, 2);

    let targetSummary = 'Not mentioned';
    let targetClass = 'text-slate-400';

    if (targetData?.mentioned) {
      if (targetData.explicit_position) {
        targetSummary = `#${targetData.explicit_position}`;
        targetClass = 'text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200';
      } else if (targetData.recommended) {
        targetSummary = '★ Recommended';
        targetClass = 'text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200';
      } else {
        targetSummary = 'Mentioned';
        targetClass = 'text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100';
      }
    }

    return (
      <div className="space-y-1 text-left">
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] font-semibold text-slate-800">{targetBrand}:</span>
          <span className={`text-[11px] ${targetClass}`}>{targetSummary}</span>
        </div>
        {mentionedCompetitors && mentionedCompetitors.length > 0 && (
          <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
            {mentionedCompetitors.map(c => `${c.name} ${c.explicit_position ? `#${c.explicit_position}` : ''}`).join(' | ')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="prompt-results-table-card" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Table Filter Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="prompt-search-input"
                type="text"
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center space-x-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                id="category-filter-select"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div className="hidden lg:flex items-center space-x-1 border-l border-slate-200 pl-2">
              <button
                onClick={() => setBrandStatusFilter('all')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  brandStatusFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setBrandStatusFilter('target_mentioned')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  brandStatusFilter === 'target_mentioned'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {targetBrand} Mentioned
              </button>
              <button
                onClick={() => setBrandStatusFilter('target_recommended')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  brandStatusFilter === 'target_recommended'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {targetBrand} Recommended
              </button>
              <button
                onClick={() => setBrandStatusFilter('target_ranked')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  brandStatusFilter === 'target_ranked'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {targetBrand} #Ranked
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center space-x-2">
            <span>
              {providerFilter === 'all'
                ? `Showing ${groupedPromptRows.length} unique prompts`
                : `Showing ${filteredSingleProviderResults.length} responses for ${providerFilter.toUpperCase()}`}
            </span>
          </div>
        </div>

        {/* Engine Filter Bar (Section 12: View all providers together or filter by provider) */}
        <div className="flex items-center space-x-2 pt-2 border-t border-slate-200/60 text-xs">
          <span className="font-semibold text-slate-600 flex items-center gap-1 mr-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            Engine View:
          </span>
          <div className="flex items-center space-x-1.5 bg-slate-200/60 p-0.5 rounded-lg">
            <button
              onClick={() => setProviderFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${
                providerFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Engines (Side-by-Side)
            </button>
            <button
              onClick={() => setProviderFilter('gemini')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${
                providerFilter === 'gemini'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Google Gemini
            </button>
            <button
              onClick={() => setProviderFilter('claude')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${
                providerFilter === 'claude'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Anthropic Claude
            </button>
            <button
              onClick={() => setProviderFilter('openai')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${
                providerFilter === 'openai'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              OpenAI ChatGPT
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: All Engines Side-by-Side Grouped Table */}
      {providerFilter === 'all' ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left select-none">
              <tr>
                <th scope="col" className="py-3 px-4 min-w-[280px]">
                  Prompt
                </th>
                <th scope="col" className="py-3 px-3 min-w-[100px]">
                  Category
                </th>
                <th scope="col" className="py-3 px-3 min-w-[200px] border-l border-slate-200">
                  <div className="flex items-center space-x-1.5 text-indigo-900 font-bold">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>Google Gemini</span>
                  </div>
                </th>
                <th scope="col" className="py-3 px-3 min-w-[200px] border-l border-slate-200">
                  <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Anthropic Claude</span>
                  </div>
                </th>
                <th scope="col" className="py-3 px-3 min-w-[200px] border-l border-slate-200">
                  <div className="flex items-center space-x-1.5 text-emerald-900 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>OpenAI ChatGPT</span>
                  </div>
                </th>
                <th scope="col" className="py-3 px-3 text-right">
                  Inspect
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {groupedPromptRows.map(row => {
                const sampleResult = row.gemini || row.claude || row.openai || row.allResults[0];

                return (
                  <tr
                    key={row.promptId}
                    onClick={() => setSelectedPrompt(sampleResult)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* Prompt Text */}
                    <td className="py-3 px-4">
                      <div className="text-slate-900 font-medium group-hover:text-indigo-600 transition-colors">
                        "{row.promptText}"
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                        {row.category}
                      </span>
                    </td>

                    {/* Gemini Column */}
                    <td className="py-3 px-3 border-l border-slate-100 bg-indigo-50/10">
                      {renderEngineSummaryBadge(row.gemini)}
                    </td>

                    {/* Claude Column */}
                    <td className="py-3 px-3 border-l border-slate-100 bg-amber-50/10">
                      {renderEngineSummaryBadge(row.claude)}
                    </td>

                    {/* OpenAI Column */}
                    <td className="py-3 px-3 border-l border-slate-100 bg-emerald-50/10">
                      {renderEngineSummaryBadge(row.openai)}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedPrompt(sampleResult)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 font-semibold text-xs inline-flex items-center space-x-1"
                        title="Inspect full raw responses across all engines"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW 2: Single Provider Detailed Brand Columns */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left select-none">
              <tr>
                <th scope="col" className="py-3 px-4 min-w-[280px]">
                  Prompt
                </th>
                <th scope="col" className="py-3 px-3 min-w-[110px]">
                  Category
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 min-w-[120px] text-center bg-indigo-50/70 border-x border-indigo-100 text-indigo-950 font-bold"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>{targetBrand}</span>
                    <span className="text-[9px] uppercase px-1 py-0.2 bg-indigo-600 text-white rounded font-bold">
                      Target
                    </span>
                  </div>
                </th>
                {competitors.map(comp => (
                  <th key={comp} scope="col" className="py-3 px-3 min-w-[110px] text-center text-slate-700">
                    {comp}
                  </th>
                ))}
                <th scope="col" className="py-3 px-3 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredSingleProviderResults.map(prompt => {
                const targetBrandAnalysis = prompt.brands?.find(
                  b => b.name.toLowerCase() === targetBrand.toLowerCase()
                );
                const isRetrying = isRetryingPromptId === prompt.promptId;

                return (
                  <tr
                    key={`${prompt.promptId}-${prompt.provider}`}
                    onClick={() => setSelectedPrompt(prompt)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-start space-x-2">
                        <span className="text-slate-900 font-medium group-hover:text-indigo-600 transition-colors">
                          "{prompt.promptText}"
                        </span>
                      </div>
                      {prompt.error && (
                        <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                          Error: {prompt.error}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                        {prompt.category || 'General'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap bg-indigo-50/30 border-x border-indigo-100/60">
                      {renderBrandCell(targetBrandAnalysis, true)}
                    </td>

                    {competitors.map(comp => {
                      const bAnalysis = prompt.brands?.find(b => b.name.toLowerCase() === comp.toLowerCase());
                      return (
                        <td key={comp} className="py-3 px-3 text-center whitespace-nowrap">
                          {renderBrandCell(bAnalysis, false)}
                        </td>
                      );
                    })}

                    <td className="py-3 px-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1.5">
                        {onRetryPrompt && (
                          <button
                            onClick={() => onRetryPrompt(prompt.promptId, prompt.provider)}
                            disabled={isRetrying}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Retry this prompt"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin text-indigo-600' : ''}`} />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPrompt(prompt)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Inspect full AI response & extracted data"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal with Side-by-Side & Per-Engine Views */}
      <PromptDetailModal
        promptResult={selectedPrompt}
        allRunResults={run.promptResults}
        targetBrand={targetBrand}
        onClose={() => setSelectedPrompt(null)}
        onRetryPrompt={onRetryPrompt}
        isRetrying={Boolean(selectedPrompt && isRetryingPromptId === selectedPrompt.promptId)}
      />
    </div>
  );
}
