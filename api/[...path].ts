import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server.ts';

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!appPromise) appPromise = createApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error('API handler error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
