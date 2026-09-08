import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const storePath = path.join(process.cwd(), 'data', 'tracker_store.json');
    const raw = fs.readFileSync(storePath, 'utf-8');
    const store = JSON.parse(raw);

    return res.status(200).json({
      ...store,
      apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      providersStatus: {
        gemini: {
          id: 'gemini',
          name: 'Google Gemini',
          configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
          apiKeyName: 'GEMINI_API_KEY',
          connectionStatus: Boolean(process.env.GEMINI_API_KEY?.trim()) ? 'configured' : 'not_configured',
        },
        claude: {
          id: 'claude',
          name: 'Anthropic Claude',
          configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
          apiKeyName: 'ANTHROPIC_API_KEY',
          connectionStatus: Boolean(process.env.ANTHROPIC_API_KEY?.trim()) ? 'configured' : 'not_configured',
        },
        openai: {
          id: 'openai',
          name: 'OpenAI ChatGPT',
          configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
          apiKeyName: 'OPENAI_API_KEY',
          connectionStatus: Boolean(process.env.OPENAI_API_KEY?.trim()) ? 'configured' : 'not_configured',
        },
      },
    });
  } catch (error) {
    console.error('API data load failed:', error);
    return res.status(500).json({
      error: 'Failed to load tracker data',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
