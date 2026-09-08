import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server.ts';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const app = await createApp();
    return app(req, res);
  } catch (error: any) {
    console.error('API handler error:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error',
    });
  }
}
