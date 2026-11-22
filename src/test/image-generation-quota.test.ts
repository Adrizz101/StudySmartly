import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeImage: vi.fn(),
  chargeDailyImageUsage: vi.fn(),
  refundDailyImageUsage: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock('@/lib/image-auth.server', () => ({
  authorizeImage: mocks.authorizeImage,
  chargeDailyImageUsage: mocks.chargeDailyImageUsage,
  refundDailyImageUsage: mocks.refundDailyImageUsage,
}));
vi.mock('@/lib/image-gateway.server', () => ({ generateImage: mocks.generateImage }));

import { handleGenerateImagePost } from '@/routes/api/generate-image';

const supabase = {};
const requestId = 'request-unique-1';
const request = () => new Request('https://studysmartly.test/api/generate-image', {
  method: 'POST',
  headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json', 'X-Image-Request-Id': requestId },
  body: JSON.stringify({ prompt: 'A clear educational illustration', consent: true, stream: true }),
});
const imageStream = () => new ReadableStream<Uint8Array>({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('data: {"b64_json":"abc123"}\n\n'));
    controller.close();
  },
});

describe('image generation quota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    mocks.authorizeImage.mockResolvedValue({ userId: 'user-1', supabase });
    mocks.chargeDailyImageUsage.mockResolvedValue(1);
    mocks.generateImage.mockResolvedValue(new Response(imageStream(), { status: 200 }));
  });

  it('blocks the sixth image request before calling OpenAI', async () => {
    mocks.chargeDailyImageUsage.mockResolvedValue(-1);
    const response = await handleGenerateImagePost(request());
    expect(response.status).toBe(429);
    expect(await response.text()).toContain("today's image limit (5)");
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it('refunds the image unit when OpenAI returns a failure status', async () => {
    mocks.generateImage.mockResolvedValue(new Response('provider failed', { status: 503 }));
    const response = await handleGenerateImagePost(request());
    expect(response.status).toBe(503);
    expect(mocks.refundDailyImageUsage).toHaveBeenCalledWith(supabase, requestId);
  });

  it('does not count a repeated request ID twice or call OpenAI twice', async () => {
    const first = await handleGenerateImagePost(request());
    await first.text();
    mocks.chargeDailyImageUsage.mockResolvedValue(0);
    const replay = await handleGenerateImagePost(request());
    expect(replay.status).toBe(409);
    expect(mocks.generateImage).toHaveBeenCalledTimes(1);
  });

  it('refunds when a successful HTTP response contains no image payload', async () => {
    mocks.generateImage.mockResolvedValue(new Response('event: heartbeat\ndata: {}\n\n', { status: 200 }));
    const response = await handleGenerateImagePost(request());
    await response.text();
    expect(mocks.refundDailyImageUsage).toHaveBeenCalledWith(supabase, requestId);
  });
});
