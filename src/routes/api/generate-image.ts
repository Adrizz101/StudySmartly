import { createFileRoute } from '@tanstack/react-router';
import { generateImage } from '@/lib/image-gateway.server';
import { authorizeImage, chargeDailyImageUsage, refundDailyImageUsage } from '@/lib/image-auth.server';

export async function handleGenerateImagePost(request: Request): Promise<Response> {
        const authorization = await authorizeImage(request);
        if (authorization instanceof Response) return authorization;

        const body = await request.json() as { prompt?: string; consent?: boolean; stream?: boolean };
        if (!body.prompt?.trim() || body.prompt.length > 1000 || body.consent !== true) {
          return new Response('A prompt of 1,000 characters or fewer and consent are required.', { status: 400 });
        }

        const requestId = request.headers.get('x-image-request-id')?.trim() ?? '';
        if (!requestId || requestId.length > 100) {
          return new Response('A valid image request ID is required.', { status: 400 });
        }

        const apiKey = process.env['OPENAI_API_KEY'];
        if (!apiKey) return new Response('AI image generation is not configured.', { status: 503 });

        let usageStatus: number;
        try {
          usageStatus = await chargeDailyImageUsage(authorization.supabase, requestId);
        } catch (error) {
          console.error('[Image Quota] Could not charge image usage:', error);
          return new Response('Could not verify your daily image usage. Please try again.', { status: 503 });
        }
        if (usageStatus < 0) {
          const dailyLimit = Math.abs(usageStatus);
          return new Response(`You've used today's image limit (${dailyLimit}). It resets at midnight UTC.`, { status: 429 });
        }
        if (usageStatus === 0) {
          return new Response('This image request was already processed. Start a new generation if you need another image.', { status: 409 });
        }

        let upstream: Response;
        try {
          upstream = await generateImage(
            { baseURL: 'https://api.openai.com', apiKey, model: 'gpt-image-1', format: 'openai' },
            body.prompt,
            body.stream !== false,
          );
        } catch (error) {
          await refundDailyImageUsage(authorization.supabase, requestId);
          console.error('[Image Generation] OpenAI request failed:', error);
          return new Response('Image generation failed. Please try again.', { status: 502 });
        }

        if (!upstream.ok) {
          await refundDailyImageUsage(authorization.supabase, requestId);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              'Content-Type': upstream.headers.get('content-type') ?? 'text/plain',
              'Cache-Control': 'no-store',
            },
          });
        }

        if (!upstream.body) {
          await refundDailyImageUsage(authorization.supabase, requestId);
          return new Response('Image generation returned no image.', { status: 502 });
        }

        // Inspect the stream while forwarding it. Streaming responses are charged
        // only after a completed image event; non-streaming retries need a b64_json.
        let sawImage = false;
        let tail = '';
        const decoder = new TextDecoder();
        const reader = upstream.body.getReader();
        const inspectedBody = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const chunk = await reader.read();
              if (chunk.done) {
                const finalText = tail + decoder.decode();
                if (body.stream === false && finalText.includes('"b64_json"')) sawImage = true;
                if (!sawImage) await refundDailyImageUsage(authorization.supabase, requestId);
                controller.close();
                return;
              }
              const text = tail + decoder.decode(chunk.value, { stream: true });
              if (body.stream === false) {
                if (text.includes('"b64_json"')) sawImage = true;
              } else if (
                text.includes('image_generation.completed') ||
                text.includes('image_edit.completed')
              ) {
                if (text.includes('"b64_json"')) sawImage = true;
              }
              tail = text.slice(-256);
              controller.enqueue(chunk.value);
            } catch (error) {
              if (!sawImage) await refundDailyImageUsage(authorization.supabase, requestId);
              controller.error(error);
            }
          },
          async cancel(reason) {
            await reader.cancel(reason).catch(() => {});
            if (!sawImage) await refundDailyImageUsage(authorization.supabase, requestId);
          },
        });

        return new Response(inspectedBody, {
          status: upstream.status,
          headers: {
            'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
            'Cache-Control': 'no-store',
          },
        });
}

export const Route = createFileRoute('/api/generate-image')({
  server: {
    handlers: {
      POST: async ({ request }) => handleGenerateImagePost(request),
    },
  },
});
