import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

function validateBrandAuditJSON(jsonStr: string, trackedBrands: string[]) {
  let cleaned = (jsonStr || '').trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.brands)) {
    throw new Error('Gemini brand audit did not return the expected brands array.');
  }

  return trackedBrands.map((brandName) => {
    const item = parsed.brands.find((b: any) =>
      b && typeof b.name === 'string' && b.name.trim().toLowerCase() === brandName.trim().toLowerCase()
    );
    if (!item) {
      return {
        name: brandName,
        mentioned: false,
        recommended: false,
        explicit_position: null,
        mention_order: null,
        context: 'Not mentioned in answer',
      };
    }
    return {
      name: brandName,
      mentioned: Boolean(item.mentioned),
      recommended: Boolean(item.recommended),
      explicit_position: Number.isInteger(item.explicit_position) && item.explicit_position >= 1 ? item.explicit_position : null,
      mention_order: Number.isInteger(item.mention_order) && item.mention_order >= 1 ? item.mention_order : null,
      context: typeof item.context === 'string' ? item.context : '',
    };
  });
}

async function runGemini(prompt: string, trackedBrands: string[], model: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in Vercel Environment Variables.');

  const ai = new GoogleGenAI({ apiKey });
  const selectedModel = model || 'gemini-2.5-flash';

  // Use one Gemini request per prompt. The previous implementation made a
  // second Gemini call solely to audit the first response, which made each
  // serverless invocation unnecessarily slow and could leave the UI pending.
  const requestPrompt = `Answer this user question naturally and accurately:\n\n${prompt}\n\nAfter answering, identify whether each tracked brand below was mentioned or recommended in your answer. If the answer explicitly ranks a brand, provide its rank. Also provide the order in which mentioned brands first appear. Return ONLY valid JSON matching the requested schema.\n\nTracked brands: ${JSON.stringify(trackedBrands)}`;

  const response = await ai.models.generateContent({
    model: selectedModel,
    contents: requestPrompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING },
          brands: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                mentioned: { type: Type.BOOLEAN },
                recommended: { type: Type.BOOLEAN },
                explicit_position: { type: Type.INTEGER, nullable: true },
                mention_order: { type: Type.INTEGER, nullable: true },
                context: { type: Type.STRING },
              },
              required: ['name', 'mentioned', 'recommended', 'context'],
            },
          },
        },
        required: ['answer', 'brands'],
      },
    },
  });

  const rawJson = response.text || '';
  if (!rawJson.trim()) throw new Error('Gemini returned an empty response.');

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${rawJson.slice(0, 300)}`);
  }

  if (!parsed || typeof parsed.answer !== 'string' || !Array.isArray(parsed.brands)) {
    throw new Error('Gemini returned an unexpected response structure.');
  }

  return {
    rawResponse: parsed.answer,
    rawAnalysisJson: JSON.stringify(parsed, null, 2),
    brands: validateBrandAuditJSON(JSON.stringify({ brands: parsed.brands }), trackedBrands),
    model: selectedModel,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { run, promptId, provider = 'gemini' } = req.body || {};

    if (String(provider).toLowerCase() !== 'gemini') {
      return res.status(400).json({
        error: `Only Gemini is currently enabled in this Vercel execution endpoint. Provider received: ${provider}`,
      });
    }

    // Vercel serverless functions have a read-only filesystem and are stateless.
    // The complete run is supplied by the browser instead of being loaded from
    // data/tracker_store.json.
    if (!run || typeof run !== 'object' || !run.id) {
      return res.status(400).json({ error: 'Run data is required.' });
    }

    const currentPrompt = Array.isArray(run.promptResults)
      ? run.promptResults.find((p: any) =>
          p.promptId === promptId && String(p.provider || 'gemini').toLowerCase() === 'gemini'
        )
      : null;

    if (!currentPrompt) return res.status(404).json({ error: `Prompt not found: ${promptId}` });

    const trackedBrands = [run.targetBrand, ...(run.competitors || [])].filter(Boolean);
    currentPrompt.status = 'processing';

    const result = await runGemini(currentPrompt.promptText, trackedBrands, currentPrompt.model);
    currentPrompt.rawResponse = result.rawResponse;
    currentPrompt.rawAnalysisJson = result.rawAnalysisJson;
    currentPrompt.brands = result.brands.map((b: any) => ({
      ...b,
      score:
        b.explicit_position === 1 ? 1 :
        b.explicit_position === 2 ? 0.8 :
        b.explicit_position === 3 ? 0.6 :
        b.explicit_position === 4 ? 0.4 :
        b.explicit_position === 5 ? 0.2 :
        b.mentioned ? 0.3 : 0,
    }));
    currentPrompt.model = result.model;
    currentPrompt.status = 'completed';
    delete currentPrompt.error;
    currentPrompt.timestamp = new Date().toISOString();

    const updatedPromptResults = run.promptResults.map((p: any) =>
      p.promptId === promptId && String(p.provider || 'gemini').toLowerCase() === 'gemini'
        ? currentPrompt
        : p
    );

    const completedPrompts = updatedPromptResults.filter((p: any) => p.status === 'completed').length;
    const failedPrompts = updatedPromptResults.filter((p: any) => p.status === 'failed').length;
    const status = completedPrompts + failedPrompts === updatedPromptResults.length
      ? (completedPrompts > 0 ? 'completed' : 'failed')
      : 'running';

    return res.status(200).json({
      success: true,
      promptResult: currentPrompt,
      runProgress: {
        ...run,
        completedPrompts,
        failedPrompts,
        status,
        promptResults: updatedPromptResults,
        brandMetrics: run.brandMetrics || {},
        providerMetrics: run.providerMetrics || {},
      },
    });
  } catch (error: any) {
    console.error('EXECUTE PROMPT ERROR:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to execute prompt',
      details: error?.stack || String(error),
    });
  }
}
