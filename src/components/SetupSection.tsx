import { useState } from 'react';
import { PromptItem, AIProviderId, ProviderStatusInfo } from '../types';
import { Plus, Trash2, Edit2, Check, RotateCcw, Building2, Users, HelpCircle, Save } from 'lucide-react';
import { AIProviderConfig } from './AIProviderConfig';

interface SetupSectionProps {
  targetBrand: string;
  competitors: string[];
  prompts: PromptItem[];
  providersStatus?: Record<AIProviderId, ProviderStatusInfo>;
  onSaveSetup: (updated: {
    targetBrand: string;
    competitors: string[];
    prompts: PromptItem[];
  }) => Promise<void>;
  onRefreshProviders?: () => Promise<void>;
  isSaving: boolean;
}

const DEFAULT_CATEGORIES = [
  'Commercial',
  'Comparison',
  'Healthcare',
  'Multi-location',
  'Educational',
  'Agency',
  'General',
];

export function SetupSection({
  targetBrand: initialTarget,
  competitors: initialCompetitors,
  prompts: initialPrompts,
  providersStatus,
  onSaveSetup,
  onRefreshProviders,
  isSaving,
}: SetupSectionProps) {
  const [targetBrand, setTargetBrand] = useState(initialTarget);
  const [competitors, setCompetitors] = useState<string[]>(initialCompetitors);
  const [newCompetitor, setNewCompetitor] = useState('');
  const [prompts, setPrompts] = useState<PromptItem[]>(initialPrompts);

  // New prompt input state
  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptCategory, setNewPromptCategory] = useState('Commercial');
  const [customCategory, setCustomCategory] = useState('');

  // Editing state for an existing prompt
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingCategory, setEditingCategory] = useState('');

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Competitor Handlers
  const handleAddCompetitor = () => {
    const trimmed = newCompetitor.trim();
    if (!trimmed) return;
    if (competitors.some(c => c.toLowerCase() === trimmed.toLowerCase())) return;
    setCompetitors([...competitors, trimmed]);
    setNewCompetitor('');
    setHasUnsavedChanges(true);
  };

  const handleRemoveCompetitor = (name: string) => {
    setCompetitors(competitors.filter(c => c !== name));
    setHasUnsavedChanges(true);
  };

  // Prompt Handlers
  const handleAddPrompt = () => {
    const trimmed = newPromptText.trim();
    if (!trimmed) return;
    const cat = (newPromptCategory === 'Custom' ? customCategory.trim() : newPromptCategory) || 'General';
    const newP: PromptItem = {
      id: `p-${Date.now()}`,
      text: trimmed,
      category: cat,
      enabled: true,
    };
    setPrompts([...prompts, newP]);
    setNewPromptText('');
    setCustomCategory('');
    setHasUnsavedChanges(true);
  };

  const handleDeletePrompt = (id: string) => {
    setPrompts(prompts.filter(p => p.id !== id));
    setHasUnsavedChanges(true);
  };

  const handleTogglePrompt = (id: string) => {
    setPrompts(
      prompts.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
    setHasUnsavedChanges(true);
  };

  const startEditPrompt = (p: PromptItem) => {
    setEditingPromptId(p.id);
    setEditingText(p.text);
    setEditingCategory(p.category);
  };

  const saveEditPrompt = () => {
    if (!editingPromptId) return;
    setPrompts(
      prompts.map(p =>
        p.id === editingPromptId
          ? { ...p, text: editingText.trim() || p.text, category: editingCategory.trim() || p.category }
          : p
      )
    );
    setEditingPromptId(null);
    setHasUnsavedChanges(true);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset to the 10 initial default prompts and core competitors?')) {
      const defaultP: PromptItem[] = [
        { id: 'p1', text: 'What is call tracking?', category: 'Educational', enabled: true },
        { id: 'p2', text: 'What is call tracking software?', category: 'Commercial', enabled: true },
        { id: 'p3', text: 'What is the best call tracking software?', category: 'Commercial', enabled: true },
        { id: 'p4', text: 'What is the best call tracking software for agencies?', category: 'Commercial', enabled: true },
        { id: 'p5', text: 'What is the best call tracking software for Google Ads?', category: 'Commercial', enabled: true },
        { id: 'p6', text: 'What are the best alternatives to CallRail?', category: 'Comparison', enabled: true },
        { id: 'p7', text: 'What are the best CallRail competitors?', category: 'Comparison', enabled: true },
        { id: 'p8', text: 'What is the best call tracking software for healthcare?', category: 'Healthcare', enabled: true },
        { id: 'p9', text: 'What is the best call tracking software for multi-location businesses?', category: 'Multi-location', enabled: true },
        { id: 'p10', text: 'How can I know which ads generate phone calls?', category: 'Educational', enabled: true },
      ];
      setTargetBrand('Nimbata');
      setCompetitors(['CallRail', 'WhatConverts', 'CallTrackingMetrics', 'Invoca']);
      setPrompts(defaultP);
      setHasUnsavedChanges(true);
    }
  };

  const handleSave = async () => {
    await onSaveSetup({
      targetBrand: targetBrand.trim() || 'Nimbata',
      competitors,
      prompts,
    });
    setHasUnsavedChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div id="setup-section" className="space-y-6 max-w-4xl mx-auto">
      {/* Save Status Banner */}
      {hasUnsavedChanges && (
        <div className="sticky top-20 z-20 bg-indigo-600 text-white p-3.5 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in">
          <div className="text-xs font-semibold">
            You have unsaved setup configuration changes.
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Setup saved successfully to persistent storage!</span>
        </div>
      )}

      {/* AI Provider Configuration Subsection */}
      <AIProviderConfig
        initialProvidersStatus={providersStatus}
        onStatusChange={onRefreshProviders}
      />

      {/* Brand & Competitors Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Tracked Brand & Competitors</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify your main brand and the competitor names to track in AI answers
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {/* Target Brand Input */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Your Target Brand Name
            </label>
            <div className="max-w-md">
              <input
                id="target-brand-input"
                type="text"
                value={targetBrand}
                onChange={e => {
                  setTargetBrand(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="w-full text-xs font-semibold text-indigo-900 bg-indigo-50/50 border border-indigo-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Nimbata"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              This brand will be the primary subject analyzed in metrics and dashboards.
            </p>
          </div>

          {/* Competitors List */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Competitor Brands ({competitors.length})
            </label>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {competitors.map(comp => (
                <span
                  key={comp}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200"
                >
                  <span>{comp}</span>
                  <button
                    onClick={() => handleRemoveCompetitor(comp)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                    title={`Remove ${comp}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Add Competitor Input */}
            <div className="flex items-center space-x-2 max-w-md">
              <input
                id="new-competitor-input"
                type="text"
                value={newCompetitor}
                onChange={e => setNewCompetitor(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCompetitor()}
                placeholder="Add competitor name..."
                className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleAddCompetitor}
                className="flex items-center space-x-1 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Prompts Management Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Monitored Prompts ({prompts.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These user queries are sent to Gemini to measure brand visibility and recommendation rank
            </p>
          </div>

          <button
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset 10 Defaults</span>
          </button>
        </div>

        {/* Add New Prompt Box */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
          <h3 className="text-xs font-bold text-slate-800">Add New Prompt</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <input
                id="new-prompt-input"
                type="text"
                placeholder="e.g. What is the best call tracking software for SMBs?"
                value={newPromptText}
                onChange={e => setNewPromptText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPrompt()}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={newPromptCategory}
                onChange={e => setNewPromptCategory(e.target.value)}
                className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {DEFAULT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="Custom">+ Custom Category</option>
              </select>

              <button
                id="add-prompt-btn"
                onClick={handleAddPrompt}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {newPromptCategory === 'Custom' && (
            <div className="max-w-xs">
              <input
                type="text"
                placeholder="Enter custom category name..."
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Prompts List Table */}
        <div className="mt-5 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600 text-left">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">Active</th>
                <th className="py-2.5 px-3">Prompt Query</th>
                <th className="py-2.5 px-3 w-32">Category</th>
                <th className="py-2.5 px-3 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {prompts.map((p, idx) => {
                const isEditing = editingPromptId === p.id;
                return (
                  <tr key={p.id} className={!p.enabled ? 'opacity-50 bg-slate-50/50' : 'hover:bg-slate-50/60'}>
                    {/* Active toggle */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.enabled !== false}
                        onChange={() => handleTogglePrompt(p.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                    </td>

                    {/* Prompt Text / Edit */}
                    <td className="py-2.5 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingText}
                          onChange={e => setEditingText(e.target.value)}
                          className="w-full text-xs px-2 py-1 border border-indigo-300 rounded focus:outline-none"
                        />
                      ) : (
                        <span className="font-medium text-slate-900">{p.text}</span>
                      )}
                    </td>

                    {/* Category / Edit */}
                    <td className="py-2.5 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingCategory}
                          onChange={e => setEditingCategory(e.target.value)}
                          className="w-full text-xs px-2 py-1 border border-indigo-300 rounded focus:outline-none"
                        />
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {p.category}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      {isEditing ? (
                        <button
                          onClick={saveEditPrompt}
                          className="p-1 text-emerald-600 hover:text-emerald-800"
                          title="Save edit"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => startEditPrompt(p)}
                            className="p-1 text-slate-400 hover:text-indigo-600"
                            title="Edit prompt"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePrompt(p.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete prompt"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Action */}
        <div className="mt-5 flex justify-end">
          <button
            id="setup-save-bottom-btn"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
