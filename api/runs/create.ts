import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, targetBrand, competitors, prompts, providers, providerModels } = req.body || {};

    const activeTarget = typeof targetBrand === 'string' ? targetBrand.trim() : '';
    const activeCompetitors = Array.isArray(competitors) ? competitors : [];
    const activePrompts = Array.isArray(prompts) ? prompts.filter((p: any) => p && p.enabled !== false) : [];
    const activeProviders = Array.isArray(providers) && providers.length > 0 ? providers : ['gemini'];

    if (!activeTarget || activePrompts.length === 0) {
      return res.status(400).json({
        error: 'Invalid analysis configuration: target brand and at least one prompt are required.',
      });
    }

    const supportedProviders = ['gemini', 'claude', 'openai'];
    for (const provider of activeProviders) {
      if (!supportedProviders.includes(String(provider).toLowerCase())) {
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
      }
    }

    const normalizedProviders = activeProviders.map((p: string) => String(p).toLowerCase());
    const models = {
      gemini: 'gemini-flash-latest',
      claude: 'claude-3-5-sonnet-20241022',
      openai: 'gpt-4o',
      ...(providerModels || {}),
    };

    const runId = `run-${Date.now()}`;
    const promptResults = activePrompts.flatMap((prompt: any) =>
      normalizedProviders.map((provider: string) => ({
        runId,
        promptId: prompt.id,
        provider,
        promptText: prompt.text,
        category: prompt.category || 'General',
        model: models[provider as keyof typeof models],
        rawResponse: '',
        brands: [],
        status: 'pending',
      }))
    );

    const run = {
      id: runId,
      timestamp: new Date().toISOString(),
      name: name || `Multi-Engine Analysis ${runId}`,
      targetBrand: activeTarget,
      competitors: activeCompetitors,
      totalPrompts: promptResults.length,
      completedPrompts: 0,
      failedPrompts: 0,
      model: models.gemini,
      enabledProviders: normalizedProviders,
      providerModels: models,
      status: 'running',
      promptResults,
      brandMetrics: {},
      providerMetrics: {},
    };

    // This endpoint intentionally does not persist the run yet. It only validates
    // the request and creates the run payload. Execution is handled separately.
    return res.status(200).json({ success: true, run });
  } catch (error: any) {
    console.error('CREATE RUN ERROR:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to create analysis run',
      details: error?.stack || String(error),
    });
  }
}
