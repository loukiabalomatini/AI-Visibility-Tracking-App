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

  const response = await ai.models.generateContent({
    model: selectedModel,
    contents: prompt,
  });

  const rawResponse = response.text || '';
  if (!rawResponse.trim()) throw new Error('Gemini returned an empty response.');

  const auditPrompt = `You are an AI brand visibility auditor.\nAnalyze the following AI-generated response to the question: "${prompt}".\nAudit these brands: ${JSON.stringify(trackedBrands)}.\n\nRaw AI response:\n"""\n${rawResponse}\n"""\n\nReturn ONLY valid JSON with a top-level "brands" array. For every tracked brand provide:\n- name: exact brand name\n- mentioned: boolean\n- recommended: boolean\n- explicit_position: integer or null. Only use a number when the answer explicitly ranks the brand.\n- mention_order: integer or null\n- context: short explanation.`;

  const audit = await ai.models.generateContent({
    model: selectedModel,
    contents: auditPrompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
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
        required: ['brands'],
      },
    },
  });

  const rawAnalysisJson = audit.text || '';
  if (!rawAnalysisJson.trim()) throw new Error('Gemini returned an empty brand audit response.');

  return {
    rawResponse,
    rawAnalysisJson,
    brands: validateBrandAuditJSON(rawAnalysisJson, trackedBrands),
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
    // The complete run is therefore supplied by the browser instead of being
    // loaded from data/tracker_store.json.
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
    currentPrompt.error = undefined;
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
