import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ model: 'mock-model' }))),
  generateObject: vi.fn(),
  getAuthenticatedAIContext: vi.fn(),
  getUserAIKeys: vi.fn(),
  consumeDailyAIUsage: vi.fn(),
  refundDailyAIUsage: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({ createOpenAI: mocks.createOpenAI }));
vi.mock('ai', () => ({ generateObject: mocks.generateObject }));
vi.mock('./user-ai-keys.server', () => ({
  getAuthenticatedAIContext: mocks.getAuthenticatedAIContext,
  getUserAIKeys: mocks.getUserAIKeys,
  consumeDailyAIUsage: mocks.consumeDailyAIUsage,
  refundDailyAIUsage: mocks.refundDailyAIUsage,
}));

import { structuredAI } from './learning-ai.server';

const schema = z.object({ answer: z.string() });
const supabase = {};

describe('structuredAI quota accounting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['GEMINI_API_KEY'] = 'shared-gemini-key';
    process.env['OPENROUTER_API_KEY'] = '';
    mocks.getAuthenticatedAIContext.mockResolvedValue({ userId: 'user-1', supabase });
    mocks.getUserAIKeys.mockResolvedValue({});
    mocks.consumeDailyAIUsage.mockResolvedValue(1);
    mocks.generateObject.mockResolvedValue({ object: { answer: 'correct' } });
  });

  it('charges one unit when generation succeeds', async () => {
    const result = await structuredAI(schema, 'instruction', 'prompt', []);
    expect(result.output.answer).toBe('correct');
    expect(result.quotaCharged).toBe(true);
    expect(mocks.consumeDailyAIUsage).toHaveBeenCalledTimes(1);
    expect(mocks.refundDailyAIUsage).not.toHaveBeenCalled();
  });

  it('refunds when every shared provider fails', async () => {
    process.env['OPENROUTER_API_KEY'] = 'shared-openrouter-key';
    mocks.generateObject.mockRejectedValue(new Error('provider unavailable'));
    await expect(structuredAI(schema, 'instruction', 'prompt', [])).rejects.toThrow(
      'StudySmartly could not generate a valid response right now.',
    );
    expect(mocks.consumeDailyAIUsage).toHaveBeenCalledTimes(1);
    expect(mocks.refundDailyAIUsage).toHaveBeenCalledTimes(1);
  });

  it('does not charge or refund a personal-key user', async () => {
    mocks.getUserAIKeys.mockResolvedValue({ gemini: 'personal-key' });
    const result = await structuredAI(schema, 'instruction', 'prompt', []);
    expect(result.quotaCharged).toBe(false);
    expect(mocks.consumeDailyAIUsage).not.toHaveBeenCalled();
    expect(mocks.refundDailyAIUsage).not.toHaveBeenCalled();
  });

  it('charges only once across a multi-call operation when later calls skip', async () => {
    const first = await structuredAI(schema, 'instruction', 'first pass', []);
    const second = await structuredAI(schema, 'instruction', 'second pass', [], first.runId, { charge: 'skip' });
    expect(first.quotaCharged).toBe(true);
    expect(second.quotaCharged).toBe(false);
    expect(mocks.consumeDailyAIUsage).toHaveBeenCalledTimes(1);
  });
});
