import express from 'express';
import { providerRegistry, sanitizeErrorMessage } from './server/providers';

const DEFAULT_BRAND = 'Nimbata';
const DEFAULT_COMPETITORS = ['CallRail', 'WhatConverts', 'CallTrackingMetrics', 'Invoca'];
const DEFAULT_PROMPTS = [
  { id: 'p1', text: 'What is call tracking?', category: 'Educational', enabled: true },
  { id: 'p2', text: 'What is call tracking software?', category: 'Commercial', enabled: true },
  { id: 'p3', text: 'What is the best call tracking software?', category: 'Commercial', enabled: true },
  { id: 'p4', text: 'What is the best call tracking software for agencies?', category: 'Commercial', enabled: true },
  { id: 'p5', text: 'What is the best call tracking software for Google Ads?', category: 'Commercial', enabled: true },
  { id: 'p6', text: 'What are the best alternatives to CallRail?', category: 'Comparison', enabled: true },
  { id: 'p7', text: 'What are the best CallRail competitors?', category: 'Comparison', enabled: true },
  { id: 'p8', text: 'What is the best call tracking software for healthcare?', category: 'Use Case', enabled: true },
  { id: 'p9', text: 'What is the best call tracking software for multi-location businesses?', category: 'Use Case', enabled: true },
  { id: 'p10', text: 'How can I know which ads generate phone calls?', category: 'Problem', enabled: true },
];
const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  gemini: 'gemini-flash-latest',
  claude: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o',
};

function emptyMetrics(brands: string[]) {
  return Object.fromEntries(brands.map((brand, i) => [brand, {
    brandName: brand, isTarget: i === 0, visibilityScore: 0, mentionRate: 0,
    recommendationRate: 0, explicitPositionCount: 0, averagePosition: null,
    totalMentions: 0, totalRecommended: 0, categoryScores: {},
  }]));
}

function score(item: any) {
  const p = item.explicit_position;
  if (p != null) {
    if (p === 1) return 1;
    if (p === 2) return .8;
    if (p === 3) return .6;
    if (p === 4) return .4;
    if (p === 5) return .2;
    return Math.max(.1, .2 - (p - 5) * .05);
  }
  return item.mentioned ? .3 : 0;
}

function metrics(results: any[], target: string, competitors: string[]) {
  const brands = [target, ...competitors];
  const done = results.filter(r => r.status === 'completed');
  if (!done.length) return emptyMetrics(brands);
  return Object.fromEntries(brands.map(brand => {
    let total = 0, mentions = 0, recs = 0;
    const positions: number[] = [];
    for (const r of done) {
      const b = (r.brands || []).find((x: any) => x.name?.toLowerCase() === brand.toLowerCase());
      if (b?.mentioned) {
        mentions++;
        if (b.recommended) recs++;
        if (b.explicit_position != null) positions.push(b.explicit_position);
        total += b.score || 0;
      }
    }
    return [brand, {
      brandName: brand, isTarget: brand.toLowerCase() === target.toLowerCase(),
      visibilityScore: Math.round((total / done.length) * 100 * 10) / 10,
      mentionRate: Math.round((mentions / done.length) * 100),
      recommendationRate: Math.round((recs / done.length) * 100),
      explicitPositionCount: positions.length,
      averagePosition: positions.length ? Math.round((positions.reduce((a,b)=>a+b,0)/positions.length)*10)/10 : null,
      totalMentions: mentions, totalRecommended: recs, categoryScores: {},
    }];
  }));
}

function providerStatus() {
  return Object.fromEntries(providerRegistry.list().map(p => [p.id, p]));
}

let store: { config: any; runs: any[] } = {
  config: {
    targetBrand: DEFAULT_BRAND,
    competitors: DEFAULT_COMPETITORS,
    prompts: DEFAULT_PROMPTS,
    providerModels: { ...DEFAULT_PROVIDER_MODELS },
    enabledProviders: ['gemini'],
  },
  runs: [],
};

export function createServerlessApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()), providersStatus: providerStatus() });
  });

  app.get('/api/providers/status', (_req, res) => {
    res.json({ providers: providerRegistry.list(), providersStatus: providerStatus() });
  });

  app.get('/api/data', (_req, res) => {
    res.json({ ...store, apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()), providersStatus: providerStatus() });
  });

  app.post('/api/setup', (req, res) => {
    const { targetBrand, competitors, prompts, providerModels, enabledProviders } = req.body || {};
    if (typeof targetBrand === 'string' && targetBrand.trim()) store.config.targetBrand = targetBrand.trim();
    if (Array.isArray(competitors)) store.config.competitors = competitors.filter(Boolean);
    if (Array.isArray(prompts)) store.config.prompts = prompts;
    if (providerModels) store.config.providerModels = { ...store.config.providerModels, ...providerModels };
    if (Array.isArray(enabledProviders)) store.config.enabledProviders = enabledProviders;
    res.json({ success: true, config: store.config });
  });

  app.post('/api/runs/create', (req, res) => {
    try {
      const body = req.body || {};
      const target = body.targetBrand || store.config.targetBrand;
      const competitors = body.competitors || store.config.competitors;
      const prompts = body.prompts || store.config.prompts.filter((p:any) => p.enabled !== false);
      const providers = Array.isArray(body.providers) && body.providers.length ? body.providers.map((p:string)=>p.toLowerCase()) : ['gemini'];
      const models = { ...DEFAULT_PROVIDER_MODELS, ...store.config.providerModels, ...(body.providerModels || {}) };
      for (const id of providers) providerRegistry.get(id);
      const id = `run-${Date.now()}`;
      const promptResults = prompts.flatMap((p:any) => providers.map((provider:string) => ({
        runId: id, promptId: p.id, provider, promptText: p.text, category: p.category || 'General',
        model: models[provider] || providerRegistry.get(provider).defaultModel, rawResponse: '', brands: [], status: 'pending',
      })));
      const run = {
        id, timestamp: new Date().toISOString(), name: body.name || `Multi-Engine Analysis #${store.runs.length + 1}`,
        targetBrand: target, competitors, totalPrompts: promptResults.length, completedPrompts: 0, failedPrompts: 0,
        model: models.gemini, enabledProviders: providers, providerModels: models, status: 'running', promptResults,
        brandMetrics: metrics([], target, competitors), providerMetrics: {},
      };
      store.runs.unshift(run);
      res.json({ success: true, run });
    } catch (e:any) {
      res.status(500).json({ error: sanitizeErrorMessage(e?.message || 'Failed to create analysis run') });
    }
  });

  app.post('/api/runs/execute-prompt', async (req, res) => {
    const { runId, promptId, provider: requestedProvider = 'gemini' } = req.body || {};
    const providerId = String(requestedProvider).toLowerCase();
    const run = store.runs.find(r => r.id === runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    const idx = run.promptResults.findIndex((p:any) => p.promptId === promptId && p.provider === providerId);
    if (idx < 0) return res.status(404).json({ error: 'Prompt observation not found in run' });
    const current = run.promptResults[idx];
    try {
      const ai = providerRegistry.get(providerId);
      if (!ai.isConfigured()) {
        current.status = 'failed';
        current.error = `${ai.name} is not configured: ${ai.getApiKeyName()} is missing in Vercel environment variables.`;
        run.failedPrompts = run.promptResults.filter((p:any)=>p.status==='failed').length;
        run.status = run.failedPrompts === run.totalPrompts ? 'failed' : 'running';
        return res.status(400).json({ error: current.error, apiKeyMissing: true, provider: providerId, promptResult: current, runProgress: progress(run) });
      }
      current.status = 'processing';
      const started = Date.now();
      const raw = await ai.generateText(current.promptText, current.model);
      current.rawResponse = raw.text || '';
      current.model = raw.model;
      const audit = await ai.auditBrands(current.promptText, current.rawResponse, [run.targetBrand, ...run.competitors], current.model);
      current.rawAnalysisJson = audit.rawAnalysisJson;
      current.brands = audit.brands.map((b:any) => ({ ...b, score: score(b) }));
      current.status = 'completed';
      current.durationMs = Date.now() - started;
      current.timestamp = new Date().toISOString();
      run.completedPrompts = run.promptResults.filter((p:any)=>p.status==='completed').length;
      run.failedPrompts = run.promptResults.filter((p:any)=>p.status==='failed').length;
      run.brandMetrics = metrics(run.promptResults, run.targetBrand, run.competitors);
      run.status = run.completedPrompts + run.failedPrompts === run.totalPrompts ? 'completed' : 'running';
      res.json({ success: true, promptResult: current, runProgress: progress(run) });
    } catch (e:any) {
      current.status = 'failed';
      current.error = sanitizeErrorMessage(e?.message || 'Provider query failed');
      current.durationMs = 0;
      run.failedPrompts = run.promptResults.filter((p:any)=>p.status==='failed').length;
      run.completedPrompts = run.promptResults.filter((p:any)=>p.status==='completed').length;
      run.brandMetrics = metrics(run.promptResults, run.targetBrand, run.competitors);
      run.status = run.completedPrompts + run.failedPrompts === run.totalPrompts ? (run.completedPrompts ? 'completed' : 'failed') : 'running';
      res.status(500).json({ error: current.error, promptResult: current, runProgress: progress(run) });
    }
  });

  app.post('/api/runs/cancel', (req,res) => {
    const run = store.runs.find(r => r.id === req.body?.runId);
    if (run) run.status = 'cancelled';
    res.json({ success: true, run });
  });

  app.delete('/api/runs/:runId', (req,res) => {
    store.runs = store.runs.filter(r => r.id !== req.params.runId);
    res.json({ success: true });
  });

  return app;
}

function progress(run:any) {
  return {
    completedPrompts: run.completedPrompts, failedPrompts: run.failedPrompts,
    totalPrompts: run.totalPrompts, status: run.status,
    brandMetrics: run.brandMetrics, providerMetrics: run.providerMetrics,
  };
}
