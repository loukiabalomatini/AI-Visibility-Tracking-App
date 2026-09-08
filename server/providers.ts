import { GoogleGenAI, Type } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface BrandAuditItem {
  name: string;
  mentioned: boolean;
  recommended: boolean;
  explicit_position: number | null;
  mention_order: number | null;
  context: string;
}

export interface AIProvider {
  id: string;
  name: string;
  defaultModel: string;
  isConfigured(): boolean;
  getApiKeyName(): string;
  getMaskedKey(): string | null;
  getConnectionStatus(): 'not_configured' | 'connected' | 'failed';
  setConnectionStatus(status: 'not_configured' | 'connected' | 'failed', error?: string): void;
  getLastTestedAt(): string | null;
  getLastError(): string | null;
  testConnection(): Promise<{ success: boolean; message?: string; error?: string }>;
  generateText(prompt: string, modelOverride?: string): Promise<{ text: string; model: string }>;
  auditBrands(
    promptText: string,
    rawResponse: string,
    trackedBrands: string[],
    modelOverride?: string
  ): Promise<{ brands: BrandAuditItem[]; rawAnalysisJson: string; model: string }>;
}

export function maskApiKey(key?: string | null): string | null {
  if (!key || !key.trim()) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 4) {
    return '••••••••';
  }
  const lastFour = trimmed.slice(-4);
  return `••••••••••••${lastFour}`;
}

export function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Unknown connection error';
  let cleaned = String(msg);

  // Try extracting human-readable message from JSON payloads or Google/Anthropic/OpenAI error strings
  if (cleaned.includes('{') && cleaned.includes('}')) {
    try {
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed?.error?.message) {
          cleaned = `${parsed.error.code ? `[${parsed.error.code}] ` : ''}${parsed.error.message}`;
        } else if (typeof parsed?.error === 'string') {
          cleaned = parsed.error;
        } else if (parsed?.message) {
          cleaned = parsed.message;
        }
      }
    } catch {
      // Keep as-is if parsing fails
    }
  }

  const keysToRedact = [
    process.env.GEMINI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.OPENAI_API_KEY,
  ].filter((k): k is string => Boolean(k && k.trim().length > 3));

  for (const key of keysToRedact) {
    cleaned = cleaned.replaceAll(key, '[REDACTED_API_KEY]');
  }

  // Redact potential API key tokens
  cleaned = cleaned.replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_API_KEY]');
  cleaned = cleaned.replace(/AIza[a-zA-Z0-9_-]{20,}/g, '[REDACTED_API_KEY]');

  return cleaned.trim();
}

// Strict validation of the brand extraction JSON per user specification
export function validateBrandAuditJSON(jsonStr: string, trackedBrands: string[]): BrandAuditItem[] {
  let cleaned = jsonStr.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.trim());
  } catch (err: any) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new Error(`Failed to parse brand analysis JSON: ${err.message}. Raw output was: ${jsonStr.slice(0, 150)}...`);
      }
    } else {
      throw new Error(`Failed to parse brand analysis JSON: ${err.message}. Raw output was: ${jsonStr.slice(0, 150)}...`);
    }
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.brands)) {
    throw new Error('Analysis response is missing the required "brands" array in JSON');
  }

  const results: BrandAuditItem[] = [];

  for (const brandName of trackedBrands) {
    const item = parsed.brands.find(
      (b: any) => b && typeof b.name === 'string' && b.name.trim().toLowerCase() === brandName.trim().toLowerCase()
    );

    if (!item) {
      results.push({
        name: brandName,
        mentioned: false,
        recommended: false,
        explicit_position: null,
        mention_order: null,
        context: 'Not mentioned in answer',
      });
      continue;
    }

    const mentioned = Boolean(item.mentioned);
    const recommended = Boolean(item.recommended);

    let explicitPos: number | null = null;
    if (item.explicit_position !== null && item.explicit_position !== undefined) {
      const pos = Number(item.explicit_position);
      if (Number.isInteger(pos) && pos >= 1) {
        explicitPos = pos;
      }
    }

    let mentionOrder: number | null = null;
    if (item.mention_order !== null && item.mention_order !== undefined) {
      const order = Number(item.mention_order);
      if (Number.isInteger(order) && order >= 1) {
        mentionOrder = order;
      }
    }

    results.push({
      name: brandName,
      mentioned,
      recommended,
      explicit_position: explicitPos,
      mention_order: mentionOrder,
      context: typeof item.context === 'string' ? item.context : '',
    });
  }

  return results;
}

// 1. Google Gemini Provider
export class GeminiProvider implements AIProvider {
  id = 'gemini';
  name = 'Google Gemini';
  defaultModel = 'gemini-flash-latest';

  private connectionStatus: 'not_configured' | 'connected' | 'failed' = 'not_configured';
  private lastTestedAt: string | null = null;
  private lastError: string | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  }

  getApiKeyName(): string {
    return 'GEMINI_API_KEY';
  }

  getMaskedKey(): string | null {
    return maskApiKey(process.env.GEMINI_API_KEY);
  }

  getConnectionStatus(): 'not_configured' | 'connected' | 'failed' {
    if (!this.isConfigured()) return 'not_configured';
    return this.connectionStatus;
  }

  setConnectionStatus(status: 'not_configured' | 'connected' | 'failed', error?: string): void {
    this.connectionStatus = status;
    this.lastError = error ? sanitizeErrorMessage(error) : null;
    this.lastTestedAt = new Date().toISOString();
  }

  getLastTestedAt(): string | null {
    return this.lastTestedAt;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.isConfigured()) {
      this.connectionStatus = 'not_configured';
      this.lastError = 'GEMINI_API_KEY is not configured';
      return { success: false, error: this.lastError };
    }
    try {
      const res = await this.callWithModelFallback({
        contents: 'Respond with the single word: OK',
      });
      if (res.text) {
        this.connectionStatus = 'connected';
        this.lastTestedAt = new Date().toISOString();
        this.lastError = null;
        return { success: true, message: `Successfully connected to Google Gemini API (model: ${res.model})` };
      }
      this.connectionStatus = 'connected';
      this.lastTestedAt = new Date().toISOString();
      this.lastError = null;
      return { success: true, message: 'Successfully connected to Google Gemini API' };
    } catch (err: any) {
      this.connectionStatus = 'failed';
      this.lastTestedAt = new Date().toISOString();
      this.lastError = sanitizeErrorMessage(err?.message || 'Connection to Gemini API failed');
      return { success: false, error: this.lastError };
    }
  }

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        'GEMINI_API_KEY is not configured in server environment secrets. Please set your Gemini API key in Settings > Secrets.'
      );
    }
    return new GoogleGenAI({ apiKey });
  }

  private async callWithModelFallback(params: {
    contents: string;
    config?: any;
    modelOverride?: string;
  }): Promise<{ text: string; model: string }> {
    const ai = this.getClient();
    const candidateModels = params.modelOverride
      ? [params.modelOverride, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite']
      : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];

    let lastError: any = null;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: params.contents,
            config: params.config,
          });

          return {
            text: response.text || '',
            model,
          };
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.statusCode;
          const isTransient = status === 429 || status === 503 || status === 500;
          if (isTransient && attempt < 2) {
            await new Promise(r => setTimeout(r, 1200 * attempt));
            continue;
          }
          break; // try next candidate model
        }
      }
    }

    throw new Error(
      lastError?.message || 'Failed to call Gemini API across available models'
    );
  }

  async generateText(prompt: string, modelOverride?: string): Promise<{ text: string; model: string }> {
    return this.callWithModelFallback({
      contents: prompt,
      modelOverride,
    });
  }

  async auditBrands(
    promptText: string,
    rawResponse: string,
    trackedBrands: string[],
    modelOverride?: string
  ): Promise<{ brands: BrandAuditItem[]; rawAnalysisJson: string; model: string }> {
    const auditPrompt = `You are an AI brand visibility auditor.
Analyze the following AI-generated response to the question: "${promptText}".
Audit whether and how each of these specific brands is mentioned: ${JSON.stringify(trackedBrands)}.

Raw AI Response:
"""
${rawResponse}
"""

Rules:
1. For every brand in the list:
   - "name": Exact brand name as given in the list
   - "mentioned": boolean (true if mentioned anywhere in the response, false otherwise)
   - "recommended": boolean (true if recommended, endorsed, or highlighted as a top pick; false if merely listed neutrally or factually)
   - "explicit_position": integer or null. IMPORTANT: If the response explicitly ranks brands with numbers (#1, 1., First, etc.), use that integer position. If there is NO explicit numbered ranking (e.g. natural prose or standard unranked bullets), you MUST set explicit_position to null. Do NOT invent or assume a ranking.
   - "mention_order": integer or null. 1-indexed order of first mention relative to the other tracked brands. If not mentioned, null.
   - "context": short 1-2 sentence quote or explanation of why the brand was classified this way.

Return valid JSON adhering strictly to the schema.`;

    const result = await this.callWithModelFallback({
      contents: auditPrompt,
      modelOverride,
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

    const validatedBrands = validateBrandAuditJSON(result.text, trackedBrands);

    return {
      brands: validatedBrands,
      rawAnalysisJson: result.text,
      model: result.model,
    };
  }
}

// 2. Anthropic Claude Provider
export class ClaudeProvider implements AIProvider {
  id = 'claude';
  name = 'Anthropic Claude';
  defaultModel = 'claude-3-5-sonnet-20241022';

  private connectionStatus: 'not_configured' | 'connected' | 'failed' = 'not_configured';
  private lastTestedAt: string | null = null;
  private lastError: string | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0);
  }

  getApiKeyName(): string {
    return 'ANTHROPIC_API_KEY';
  }

  getMaskedKey(): string | null {
    return maskApiKey(process.env.ANTHROPIC_API_KEY);
  }

  getConnectionStatus(): 'not_configured' | 'connected' | 'failed' {
    if (!this.isConfigured()) return 'not_configured';
    return this.connectionStatus;
  }

  setConnectionStatus(status: 'not_configured' | 'connected' | 'failed', error?: string): void {
    this.connectionStatus = status;
    this.lastError = error ? sanitizeErrorMessage(error) : null;
    this.lastTestedAt = new Date().toISOString();
  }

  getLastTestedAt(): string | null {
    return this.lastTestedAt;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.isConfigured()) {
      this.connectionStatus = 'not_configured';
      this.lastError = 'ANTHROPIC_API_KEY is not configured';
      return { success: false, error: this.lastError };
    }
    try {
      const client = this.getClient();
      const res = await client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Respond with the single word: OK' }],
      });
      if (res.content && res.content.length > 0) {
        this.connectionStatus = 'connected';
        this.lastTestedAt = new Date().toISOString();
        this.lastError = null;
        return { success: true, message: 'Successfully connected to Anthropic Claude API' };
      }
      this.connectionStatus = 'connected';
      this.lastTestedAt = new Date().toISOString();
      this.lastError = null;
      return { success: true, message: 'Successfully connected to Anthropic Claude API' };
    } catch (err: any) {
      this.connectionStatus = 'failed';
      this.lastTestedAt = new Date().toISOString();
      this.lastError = sanitizeErrorMessage(err?.message || 'Connection to Anthropic Claude API failed');
      return { success: false, error: this.lastError };
    }
  }

  private getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        'ANTHROPIC_API_KEY is not configured in server environment secrets. Please configure ANTHROPIC_API_KEY in AI Studio Settings > Secrets.'
      );
    }
    return new Anthropic({ apiKey: apiKey.trim() });
  }

  async generateText(prompt: string, modelOverride?: string): Promise<{ text: string; model: string }> {
    const client = this.getClient();
    const model = modelOverride?.trim() || this.defaultModel;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      return {
        text,
        model: response.model || model,
      };
    } catch (err: any) {
      throw new Error(`Claude request failed: ${err.message || err}`);
    }
  }

  async auditBrands(
    promptText: string,
    rawResponse: string,
    trackedBrands: string[],
    modelOverride?: string
  ): Promise<{ brands: BrandAuditItem[]; rawAnalysisJson: string; model: string }> {
    const client = this.getClient();
    const model = modelOverride?.trim() || this.defaultModel;

    const auditPrompt = `You are an AI brand visibility auditor.
Analyze the following AI-generated response to the question: "${promptText}".
Audit whether and how each of these specific brands is mentioned: ${JSON.stringify(trackedBrands)}.

Raw AI Response:
"""
${rawResponse}
"""

Rules:
1. For every brand in the list:
   - "name": Exact brand name as given in the list
   - "mentioned": boolean (true if mentioned anywhere in the response, false otherwise)
   - "recommended": boolean (true if recommended, endorsed, or highlighted as a top pick; false if merely listed neutrally or factually)
   - "explicit_position": integer or null. IMPORTANT: If the response explicitly ranks brands with numbers (#1, 1., First, etc.), use that integer position. If there is NO explicit numbered ranking (e.g. natural prose or standard unranked bullets), you MUST set explicit_position to null. Do NOT invent or assume a ranking.
   - "mention_order": integer or null. 1-indexed order of first mention relative to the other tracked brands. If not mentioned, null.
   - "context": short 1-2 sentence quote or explanation of why the brand was classified this way.

Return ONLY a valid JSON object matching this structure:
{
  "brands": [
    {
      "name": "Nimbata",
      "mentioned": false,
      "recommended": false,
      "explicit_position": null,
      "mention_order": null,
      "context": "..."
    }
  ]
}`;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: auditPrompt }],
      });

      const rawJson = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      const validatedBrands = validateBrandAuditJSON(rawJson, trackedBrands);

      return {
        brands: validatedBrands,
        rawAnalysisJson: rawJson,
        model: response.model || model,
      };
    } catch (err: any) {
      throw new Error(`Claude brand audit failed: ${err.message || err}`);
    }
  }
}

// 3. OpenAI ChatGPT Provider
export class OpenAIProvider implements AIProvider {
  id = 'openai';
  name = 'OpenAI ChatGPT';
  defaultModel = 'gpt-4o';

  private connectionStatus: 'not_configured' | 'connected' | 'failed' = 'not_configured';
  private lastTestedAt: string | null = null;
  private lastError: string | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
  }

  getApiKeyName(): string {
    return 'OPENAI_API_KEY';
  }

  getMaskedKey(): string | null {
    return maskApiKey(process.env.OPENAI_API_KEY);
  }

  getConnectionStatus(): 'not_configured' | 'connected' | 'failed' {
    if (!this.isConfigured()) return 'not_configured';
    return this.connectionStatus;
  }

  setConnectionStatus(status: 'not_configured' | 'connected' | 'failed', error?: string): void {
    this.connectionStatus = status;
    this.lastError = error ? sanitizeErrorMessage(error) : null;
    this.lastTestedAt = new Date().toISOString();
  }

  getLastTestedAt(): string | null {
    return this.lastTestedAt;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.isConfigured()) {
      this.connectionStatus = 'not_configured';
      this.lastError = 'OPENAI_API_KEY is not configured';
      return { success: false, error: this.lastError };
    }
    try {
      const client = this.getClient();
      const res = await client.chat.completions.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Respond with the single word: OK' }],
      });
      if (res.choices && res.choices.length > 0) {
        this.connectionStatus = 'connected';
        this.lastTestedAt = new Date().toISOString();
        this.lastError = null;
        return { success: true, message: 'Successfully connected to OpenAI API' };
      }
      this.connectionStatus = 'connected';
      this.lastTestedAt = new Date().toISOString();
      this.lastError = null;
      return { success: true, message: 'Successfully connected to OpenAI API' };
    } catch (err: any) {
      this.connectionStatus = 'failed';
      this.lastTestedAt = new Date().toISOString();
      this.lastError = sanitizeErrorMessage(err?.message || 'Connection to OpenAI API failed');
      return { success: false, error: this.lastError };
    }
  }

  private getClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        'OPENAI_API_KEY is not configured in server environment secrets. Please configure OPENAI_API_KEY in AI Studio Settings > Secrets.'
      );
    }
    return new OpenAI({ apiKey: apiKey.trim() });
  }

  async generateText(prompt: string, modelOverride?: string): Promise<{ text: string; model: string }> {
    const client = this.getClient();
    const model = modelOverride?.trim() || this.defaultModel;

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.choices[0]?.message?.content || '';

      return {
        text,
        model: response.model || model,
      };
    } catch (err: any) {
      throw new Error(`OpenAI request failed: ${err.message || err}`);
    }
  }

  async auditBrands(
    promptText: string,
    rawResponse: string,
    trackedBrands: string[],
    modelOverride?: string
  ): Promise<{ brands: BrandAuditItem[]; rawAnalysisJson: string; model: string }> {
    const client = this.getClient();
    const model = modelOverride?.trim() || this.defaultModel;

    const auditPrompt = `You are an AI brand visibility auditor.
Analyze the following AI-generated response to the question: "${promptText}".
Audit whether and how each of these specific brands is mentioned: ${JSON.stringify(trackedBrands)}.

Raw AI Response:
"""
${rawResponse}
"""

Rules:
1. For every brand in the list:
   - "name": Exact brand name as given in the list
   - "mentioned": boolean (true if mentioned anywhere in the response, false otherwise)
   - "recommended": boolean (true if recommended, endorsed, or highlighted as a top pick; false if merely listed neutrally or factually)
   - "explicit_position": integer or null. IMPORTANT: If the response explicitly ranks brands with numbers (#1, 1., First, etc.), use that integer position. If there is NO explicit numbered ranking (e.g. natural prose or standard unranked bullets), you MUST set explicit_position to null. Do NOT invent or assume a ranking.
   - "mention_order": integer or null. 1-indexed order of first mention relative to the other tracked brands. If not mentioned, null.
   - "context": short 1-2 sentence quote or explanation of why the brand was classified this way.

Return ONLY a valid JSON object matching this structure:
{
  "brands": [
    {
      "name": "Nimbata",
      "mentioned": false,
      "recommended": false,
      "explicit_position": null,
      "mention_order": null,
      "context": "..."
    }
  ]
}`;

    try {
      const response = await client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: auditPrompt }],
      });

      const rawJson = response.choices[0]?.message?.content || '';
      const validatedBrands = validateBrandAuditJSON(rawJson, trackedBrands);

      return {
        brands: validatedBrands,
        rawAnalysisJson: rawJson,
        model: response.model || model,
      };
    } catch (err: any) {
      throw new Error(`OpenAI brand audit failed: ${err.message || err}`);
    }
  }
}

// Provider registry for extensible multi-provider architecture
export class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.register(new GeminiProvider());
    this.register(new ClaudeProvider());
    this.register(new OpenAIProvider());
  }

  register(provider: AIProvider) {
    this.providers.set(provider.id.toLowerCase(), provider);
  }

  get(providerId: string = 'gemini'): AIProvider {
    const provider = this.providers.get(providerId.toLowerCase());
    if (!provider) {
      throw new Error(
        `AI Provider "${providerId}" is not registered. Supported providers: ${Array.from(this.providers.keys()).join(', ')}`
      );
    }
    return provider;
  }

  list(): {
    id: string;
    name: string;
    defaultModel: string;
    configured: boolean;
    apiKeyName: string;
    maskedKey: string | null;
    connectionStatus: 'not_configured' | 'connected' | 'failed';
    lastTestedAt: string | null;
    lastError: string | null;
  }[] {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      defaultModel: p.defaultModel,
      configured: p.isConfigured(),
      apiKeyName: p.getApiKeyName(),
      maskedKey: p.getMaskedKey(),
      connectionStatus: p.getConnectionStatus(),
      lastTestedAt: p.getLastTestedAt(),
      lastError: p.getLastError(),
    }));
  }

  setProviderKey(providerId: string, apiKey: string) {
    const provider = this.get(providerId);
    const envVar = provider.getApiKeyName();
    process.env[envVar] = apiKey.trim();
    provider.setConnectionStatus('not_configured');
  }
}

export const providerRegistry = new ProviderRegistry();

// Test any configured providers so connection status is accurate
export async function initializeConfiguredProviders(registry: ProviderRegistry = providerRegistry): Promise<void> {
  const providers = registry.list();
  for (const prov of providers) {
    if (prov.configured) {
      try {
        const instance = registry.get(prov.id);
        await instance.testConnection();
      } catch {
        // testConnection records failure state internally
      }
    }
  }
}
