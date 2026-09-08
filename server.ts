import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  providerRegistry,
  initializeConfiguredProviders,
  sanitizeErrorMessage,
  maskApiKey,
} from './server/providers';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'tracker_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Default Configuration
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

const DEFAULT_ENABLED_PROVIDERS = ['gemini'];

// Compute metrics according to exact user specifications
function calculateRunMetrics(promptResults: any[], targetBrand: string, competitors: string[]) {
  const allBrands = [targetBrand, ...competitors];
  const completedResults = promptResults.filter(p => p.status === 'completed');
  const total = completedResults.length;

  const metricsMap: Record<string, any> = {};

  for (const brand of allBrands) {
    if (total === 0) {
      metricsMap[brand] = {
        brandName: brand,
        isTarget: brand.toLowerCase() === targetBrand.toLowerCase(),
        visibilityScore: 0,
        mentionRate: 0,
        recommendationRate: 0,
        explicitPositionCount: 0,
        averagePosition: null,
        totalMentions: 0,
        totalRecommended: 0,
        categoryScores: {},
      };
      continue;
    }

    let totalScore = 0;
    let mentionCount = 0;
    let recommendCount = 0;
    const explicitPositions: number[] = [];
    const categoryTotals: Record<string, { sumScore: number; count: number }> = {};

    for (const res of completedResults) {
      const category = res.category || 'General';
      if (!categoryTotals[category]) {
        categoryTotals[category] = { sumScore: 0, count: 0 };
      }
      categoryTotals[category].count += 1;

      const brandItem = res.brands?.find((b: any) => b.name.toLowerCase() === brand.toLowerCase());
      if (brandItem && brandItem.mentioned) {
        mentionCount += 1;
        if (brandItem.recommended) recommendCount += 1;
        if (brandItem.explicit_position !== null && brandItem.explicit_position !== undefined) {
          explicitPositions.push(brandItem.explicit_position);
        }
        totalScore += brandItem.score || 0;
        categoryTotals[category].sumScore += brandItem.score || 0;
      }
    }

    const visibilityScore = Math.round((totalScore / total) * 100 * 10) / 10;
    const mentionRate = Math.round((mentionCount / total) * 100);
    const recommendationRate = Math.round((recommendCount / total) * 100);
    const averagePosition =
      explicitPositions.length > 0
        ? Math.round((explicitPositions.reduce((a, b) => a + b, 0) / explicitPositions.length) * 10) / 10
        : null;

    const categoryScores: Record<string, number> = {};
    for (const cat in categoryTotals) {
      const c = categoryTotals[cat];
      categoryScores[cat] = Math.round((c.sumScore / c.count) * 100);
    }

    metricsMap[brand] = {
      brandName: brand,
      isTarget: brand.toLowerCase() === targetBrand.toLowerCase(),
      visibilityScore,
      mentionRate,
      recommendationRate,
      explicitPositionCount: explicitPositions.length,
      averagePosition,
      totalMentions: mentionCount,
      totalRecommended: recommendCount,
      categoryScores,
    };
  }

  return metricsMap;
}

// Compute metrics broken down by individual AI provider (engine)
function calculateProviderMetrics(promptResults: any[], targetBrand: string, competitors: string[]) {
  const providers = ['gemini', 'claude', 'openai'];
  const providerMetrics: Record<string, Record<string, any>> = {};

  for (const prov of providers) {
    const provResults = promptResults.filter((p: any) => (p.provider || 'gemini').toLowerCase() === prov);
    providerMetrics[prov] = calculateRunMetrics(provResults, targetBrand, competitors);
  }

  return providerMetrics;
}

// Calculate individual score for a brand in a single response
function calculateBrandItemScore(item: { mentioned: boolean; explicit_position: number | null }) {
  if (item.explicit_position !== null && item.explicit_position !== undefined) {
    if (item.explicit_position === 1) return 1.0;
    if (item.explicit_position === 2) return 0.8;
    if (item.explicit_position === 3) return 0.6;
    if (item.explicit_position === 4) return 0.4;
    if (item.explicit_position === 5) return 0.2;
    return Math.max(0.1, 0.2 - (item.explicit_position - 5) * 0.05);
  }
  if (item.mentioned) {
    return 0.3;
  }
  return 0;
}

function getProvidersStatusMap() {
  const list = providerRegistry.list();
  const map: Record<string, any> = {};
  for (const p of list) {
    map[p.id] = p;
  }
  return map;
}

function updateEnvFile(keyName: string, keyValue: string) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf-8');
    }
    const lines = content.split('\n');
    let found = false;
    const newLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${keyName}=`)) {
        found = true;
        return `${keyName}=${keyValue}`;
      }
      return line;
    });
    if (!found) {
      newLines.push(`${keyName}=${keyValue}`);
    }
    fs.writeFileSync(envPath, newLines.join('\n').trim() + '\n', 'utf-8');
  } catch (err) {
    // Non-fatal if environment filesystem is read-only
    console.error(`Notice: Could not write to .env file: ${(err as any)?.message}`);
  }
}

// In-memory data store with serialized async file persistence
let inMemoryStore: { config: any; runs: any[] } | null = null;
let saveQueuePromise: Promise<void> = Promise.resolve();

function loadStore(): { config: any; runs: any[] } {
  if (inMemoryStore) {
    return inMemoryStore;
  }

  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (data.config && Array.isArray(data.runs)) {
        // Migration/upgrade for existing store
        if (!data.config.providerModels) {
          data.config.providerModels = { ...DEFAULT_PROVIDER_MODELS };
        }
        if (!data.config.enabledProviders) {
          data.config.enabledProviders = [...DEFAULT_ENABLED_PROVIDERS];
        }

        // Upgrade existing runs
        for (const run of data.runs) {
          if (!run.providerMetrics && run.promptResults) {
            run.providerMetrics = calculateProviderMetrics(
              run.promptResults,
              run.targetBrand || DEFAULT_BRAND,
              run.competitors || DEFAULT_COMPETITORS
            );
          }
          if (run.promptResults) {
            for (const pr of run.promptResults) {
              if (!pr.provider) {
                pr.provider = 'gemini';
              }
            }
          }
        }

        inMemoryStore = data;
        return inMemoryStore;
      }
    }
  } catch (err) {
    console.error('Error loading store file, falling back to defaults:', err);
  }

  inMemoryStore = {
    config: {
      targetBrand: DEFAULT_BRAND,
      competitors: DEFAULT_COMPETITORS,
      prompts: DEFAULT_PROMPTS,
      providerModels: { ...DEFAULT_PROVIDER_MODELS },
      enabledProviders: [...DEFAULT_ENABLED_PROVIDERS],
    },
    runs: [],
  };
  saveStore(inMemoryStore);
  return inMemoryStore;
}

function saveStore(data: any): Promise<void> {
  inMemoryStore = data;
  saveQueuePromise = saveQueuePromise.then(async () => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write store file:', err);
    }
  });
  return saveQueuePromise;
}

export async function createApp() {
  const app = express();
  app.use(express.json());

  // API Endpoints FIRST

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const providersStatus = getProvidersStatusMap();
    res.json({
      status: 'ok',
      apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
      providersStatus,
    });
  });

  // Providers status overview and list
  app.get('/api/providers/status', (req, res) => {
    const list = providerRegistry.list();
    const map = getProvidersStatusMap();
    res.json({
      providers: list,
      providersStatus: map,
    });
  });

  // Save/configure an AI provider API key securely on the server
  app.post('/api/providers/:providerId/key', (req, res) => {
    const { providerId } = req.params;
    const { apiKey } = req.body;

    const normalizedId = (providerId || '').toLowerCase().trim();
    const allowed = ['gemini', 'claude', 'openai'];
    if (!allowed.includes(normalizedId)) {
      res.status(400).json({ error: `Invalid provider ID: ${providerId}` });
      return;
    }

    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      res.status(400).json({ error: 'A non-empty API key is required.' });
      return;
    }

    try {
      const provider = providerRegistry.get(normalizedId);
      const envName = provider.getApiKeyName();
      const trimmedKey = apiKey.trim();

      // Update process.env runtime safely
      process.env[envName] = trimmedKey;
      provider.setConnectionStatus('not_configured');

      // Update local .env file (git-ignored) for container restarts
      updateEnvFile(envName, trimmedKey);

      const statusMap = getProvidersStatusMap();
      const updatedProvider = statusMap[normalizedId];

      res.json({
        success: true,
        message: `API key saved securely for ${provider.name}.`,
        provider: updatedProvider,
        providersStatus: statusMap,
      });
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err?.message || 'Failed to save API key');
      res.status(500).json({ error: sanitized });
    }
  });

  // Test connection directly against the real provider API
  app.post('/api/providers/:providerId/test', async (req, res) => {
    const { providerId } = req.params;
    const normalizedId = (providerId || '').toLowerCase().trim();
    const allowed = ['gemini', 'claude', 'openai'];
    if (!allowed.includes(normalizedId)) {
      res.status(400).json({ error: `Invalid provider ID: ${providerId}` });
      return;
    }

    try {
      const provider = providerRegistry.get(normalizedId);
      if (!provider.isConfigured()) {
        res.status(400).json({
          success: false,
          connectionStatus: 'not_configured',
          error: `No API key configured for ${provider.name}. Please enter your key or configure ${provider.getApiKeyName()} in server secrets.`,
          provider: providerRegistry.list().find(p => p.id === normalizedId),
        });
        return;
      }

      const testResult = await provider.testConnection();
      const statusMap = getProvidersStatusMap();
      const updatedProvider = statusMap[normalizedId];

      res.json({
        success: testResult.success,
        connectionStatus: updatedProvider?.connectionStatus || (testResult.success ? 'connected' : 'failed'),
        message: testResult.message,
        error: testResult.error,
        provider: updatedProvider,
        providersStatus: statusMap,
      });
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err?.message || 'Connection test failed');
      res.status(500).json({
        success: false,
        connectionStatus: 'failed',
        error: sanitized,
      });
    }
  });

  // 1. GET /api/data - fetch all data (config + runs) + API key status & provider statuses
  app.get('/api/data', (req, res) => {
    const store = loadStore();
    const providersStatus = getProvidersStatusMap();
    const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    res.json({
      ...store,
      apiKeyConfigured,
      providersStatus,
    });
  });

  // 2. POST /api/setup - update target brand, competitors, prompts, providerModels, enabledProviders
  app.post('/api/setup', (req, res) => {
    const { targetBrand, competitors, prompts, providerModels, enabledProviders } = req.body;
    const store = loadStore();
    if (targetBrand && typeof targetBrand === 'string') {
      store.config.targetBrand = targetBrand.trim();
    }
    if (Array.isArray(competitors)) {
      store.config.competitors = competitors.map((c: string) => c.trim()).filter(Boolean);
    }
    if (Array.isArray(prompts)) {
      store.config.prompts = prompts;
    }
    if (providerModels && typeof providerModels === 'object') {
      store.config.providerModels = {
        ...store.config.providerModels,
        ...providerModels,
      };
    }
    if (Array.isArray(enabledProviders)) {
      store.config.enabledProviders = enabledProviders;
    }
    saveStore(store);
    res.json({ success: true, config: store.config });
  });

  // 3. POST /api/runs/create - create a new run instance across enabled providers
  app.post('/api/runs/create', (req, res) => {
    const { name, targetBrand, competitors, prompts, providers, providerModels } = req.body;
    const store = loadStore();

    const activeTarget = targetBrand || store.config.targetBrand;
    const activeCompetitors = competitors || store.config.competitors;
    const activePrompts = prompts || store.config.prompts.filter((p: any) => p.enabled !== false);
    const activeProviders =
      Array.isArray(providers) && providers.length > 0
        ? providers
        : store.config.enabledProviders || ['gemini', 'claude', 'openai'];
    const activeProviderModels = {
      ...DEFAULT_PROVIDER_MODELS,
      ...(store.config.providerModels || {}),
      ...(providerModels || {}),
    };

    const newRunId = `run-${Date.now()}`;

    // Create prompt results for each prompt across each enabled provider
    const promptResults: any[] = [];
    for (const p of activePrompts) {
      for (const prov of activeProviders) {
        const provInstance = providerRegistry.get(prov);
        const modelName = activeProviderModels[prov] || provInstance.defaultModel;
        promptResults.push({
          runId: newRunId,
          promptId: p.id,
          provider: prov,
          promptText: p.text,
          category: p.category || 'General',
          model: modelName,
          rawResponse: '',
          brands: [],
          status: 'pending',
        });
      }
    }

    const newRun = {
      id: newRunId,
      timestamp: new Date().toISOString(),
      name: name || `Multi-Engine Analysis #${store.runs.length + 1}`,
      targetBrand: activeTarget,
      competitors: activeCompetitors,
      totalPrompts: promptResults.length,
      completedPrompts: 0,
      failedPrompts: 0,
      model: activeProviderModels.gemini || 'gemini-flash-latest',
      enabledProviders: activeProviders,
      providerModels: activeProviderModels,
      status: 'running',
      promptResults,
      brandMetrics: calculateRunMetrics([], activeTarget, activeCompetitors),
      providerMetrics: calculateProviderMetrics([], activeTarget, activeCompetitors),
    };

    store.runs.unshift(newRun);
    saveStore(store);

    res.json({ success: true, run: newRun });
  });

  // 4. POST /api/runs/execute-prompt - executes a single prompt against a specific provider with real validation
  app.post('/api/runs/execute-prompt', async (req, res) => {
    const { runId, promptId, provider: requestedProvider } = req.body;
    const targetProvider = (requestedProvider || 'gemini').toLowerCase();

    const store = loadStore();
    const run = store.runs.find(r => r.id === runId);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const promptIdx = run.promptResults.findIndex(
      (p: any) => p.promptId === promptId && (p.provider || 'gemini').toLowerCase() === targetProvider
    );

    if (promptIdx === -1) {
      return res.status(404).json({
        error: `Prompt observation for promptId="${promptId}" and provider="${targetProvider}" not found in run`,
      });
    }

    const currentPrompt = run.promptResults[promptIdx];
    const targetBrand = run.targetBrand;
    const competitors = run.competitors;
    const allBrands = [targetBrand, ...competitors];

    let aiProvider: any;
    try {
      aiProvider = providerRegistry.get(targetProvider);
    } catch (e: any) {
      currentPrompt.status = 'failed';
      currentPrompt.error = e.message;
      await saveStore(store);
      return res.status(400).json({ error: e.message, promptResult: currentPrompt });
    }

    // Check API Key configuration for the specific provider
    if (!aiProvider.isConfigured()) {
      currentPrompt.status = 'failed';
      currentPrompt.error = `${aiProvider.name} is not configured: ${aiProvider.getApiKeyName()} is missing in server environment. Please configure ${aiProvider.getApiKeyName()} in AI Studio Settings > Secrets.`;
      currentPrompt.durationMs = 0;
      currentPrompt.timestamp = new Date().toISOString();

      run.completedPrompts = run.promptResults.filter((p: any) => p.status === 'completed').length;
      run.failedPrompts = run.promptResults.filter((p: any) => p.status === 'failed').length;
      run.brandMetrics = calculateRunMetrics(run.promptResults, targetBrand, competitors);
      run.providerMetrics = calculateProviderMetrics(run.promptResults, targetBrand, competitors);

      const allFinished = run.promptResults.every((p: any) => p.status === 'completed' || p.status === 'failed');
      if (allFinished) {
        run.status = run.completedPrompts > 0 ? 'completed' : 'failed';
      }

      await saveStore(store);

      return res.status(400).json({
        error: currentPrompt.error,
        apiKeyMissing: true,
        provider: targetProvider,
        promptResult: currentPrompt,
        runProgress: {
          completedPrompts: run.completedPrompts,
          failedPrompts: run.failedPrompts,
          totalPrompts: run.totalPrompts,
          status: run.status,
          brandMetrics: run.brandMetrics,
          providerMetrics: run.providerMetrics,
        },
      });
    }

    currentPrompt.status = 'processing';
    const startTime = Date.now();

    try {
      // Step 1: Send exact user prompt to the provider API
      const rawResult = await aiProvider.generateText(currentPrompt.promptText, currentPrompt.model);
      const rawResponse = rawResult.text || '';
      currentPrompt.rawResponse = rawResponse;
      currentPrompt.model = rawResult.model;
      currentPrompt.runId = run.id;

      // Step 2: Audit brands strictly from the provider's response
      const auditResult = await aiProvider.auditBrands(
        currentPrompt.promptText,
        rawResponse,
        allBrands,
        currentPrompt.model
      );
      currentPrompt.rawAnalysisJson = auditResult.rawAnalysisJson;

      // Step 3: Compute individual directional scores for each brand in this response
      const scoredBrands = auditResult.brands.map((brandItem: any) => {
        const score = calculateBrandItemScore(brandItem);
        return {
          ...brandItem,
          score,
        };
      });

      currentPrompt.brands = scoredBrands;
      currentPrompt.status = 'completed';
      currentPrompt.error = undefined;
      currentPrompt.durationMs = Date.now() - startTime;
      currentPrompt.timestamp = new Date().toISOString();

      // Update run overall progress
      run.completedPrompts = run.promptResults.filter((p: any) => p.status === 'completed').length;
      run.failedPrompts = run.promptResults.filter((p: any) => p.status === 'failed').length;
      run.brandMetrics = calculateRunMetrics(run.promptResults, targetBrand, competitors);
      run.providerMetrics = calculateProviderMetrics(run.promptResults, targetBrand, competitors);

      const allFinished = run.promptResults.every((p: any) => p.status === 'completed' || p.status === 'failed');
      if (allFinished) {
        run.status = run.failedPrompts > 0 ? (run.completedPrompts > 0 ? 'completed' : 'failed') : 'completed';
      }

      await saveStore(store);

      res.json({
        success: true,
        promptResult: currentPrompt,
        runProgress: {
          completedPrompts: run.completedPrompts,
          failedPrompts: run.failedPrompts,
          totalPrompts: run.totalPrompts,
          status: run.status,
          brandMetrics: run.brandMetrics,
          providerMetrics: run.providerMetrics,
        },
      });
    } catch (apiError: any) {
      console.error(`Error processing prompt "${currentPrompt.promptText}" on ${targetProvider}:`, apiError);
      currentPrompt.status = 'failed';
      currentPrompt.error = apiError.message || `${aiProvider.name} query failed`;
      currentPrompt.durationMs = Date.now() - startTime;
      currentPrompt.timestamp = new Date().toISOString();

      run.failedPrompts = run.promptResults.filter((p: any) => p.status === 'failed').length;
      run.completedPrompts = run.promptResults.filter((p: any) => p.status === 'completed').length;
      run.brandMetrics = calculateRunMetrics(run.promptResults, targetBrand, competitors);
      run.providerMetrics = calculateProviderMetrics(run.promptResults, targetBrand, competitors);

      const allFinished = run.promptResults.every((p: any) => p.status === 'completed' || p.status === 'failed');
      if (allFinished) {
        run.status = run.completedPrompts > 0 ? 'completed' : 'failed';
      }

      await saveStore(store);

      res.status(500).json({
        error: currentPrompt.error,
        promptResult: currentPrompt,
        runProgress: {
          completedPrompts: run.completedPrompts,
          failedPrompts: run.failedPrompts,
          totalPrompts: run.totalPrompts,
          status: run.status,
          brandMetrics: run.brandMetrics,
          providerMetrics: run.providerMetrics,
        },
      });
    }
  });

  // 5. POST /api/runs/cancel - cancel an in-progress run
  app.post('/api/runs/cancel', (req, res) => {
    const { runId } = req.body;
    const store = loadStore();
    const run = store.runs.find(r => r.id === runId);
    if (run && run.status === 'running') {
      run.status = 'cancelled';
      saveStore(store);
    }
    res.json({ success: true, run });
  });

  // 6. DELETE /api/runs/:runId - delete a specific run
  app.delete('/api/runs/:runId', (req, res) => {
    const { runId } = req.params;
    const store = loadStore();
    store.runs = store.runs.filter(r => r.id !== runId);
    saveStore(store);
    res.json({ success: true });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

// Run as a normal server locally
if (!process.env.VERCEL) {
  createApp().then(app => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);

      initializeConfiguredProviders().catch(err => {
        console.error(
          'Note on initial provider verification:',
          (err as any)?.message || err
        );
      });
    });
  });
}
