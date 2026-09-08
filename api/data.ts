import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_CONFIG = {
  targetBrand: 'Nimbata',
  competitors: ['CallRail', 'WhatConverts', 'CallTrackingMetrics', 'Invoca'],
  prompts: [
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
  ],
  providerModels: {
    gemini: 'gemini-flash-latest',
    claude: 'claude-3-5-sonnet-20241022',
    openai: 'gpt-4o',
  },
  enabledProviders: ['gemini'],
};

function providerStatus(id: string, name: string, apiKeyName: string, configured: boolean) {
  return {
    id,
    name,
    configured,
    apiKeyName,
    connectionStatus: configured ? 'configured' : 'not_configured',
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const claudeConfigured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  return res.status(200).json({
    config: DEFAULT_CONFIG,
    runs: [],
    apiKeyConfigured: geminiConfigured,
    providersStatus: {
      gemini: providerStatus('gemini', 'Google Gemini', 'GEMINI_API_KEY', geminiConfigured),
      claude: providerStatus('claude', 'Anthropic Claude', 'ANTHROPIC_API_KEY', claudeConfigured),
      openai: providerStatus('openai', 'OpenAI ChatGPT', 'OPENAI_API_KEY', openaiConfigured),
    },
  });
}
