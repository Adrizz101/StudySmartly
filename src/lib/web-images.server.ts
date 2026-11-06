type PexelsPhoto = {
  src?: {
    large?: string;
  };
};

type PexelsSearchResponse = {
  photos?: PexelsPhoto[];
};

/**
 * Fetches one landscape stock image from Pexels.
 * This module is server-only: the API key must never reach the browser.
 */
export async function fetchWebImage(query: string): Promise<string | null> {
  const apiKey = process.env['PEXELS_API_KEY'];
  const searchQuery = query.trim();

  if (!apiKey || !searchQuery) return null;

  try {
    const params = new URLSearchParams({
      query: searchQuery,
      per_page: '1',
      orientation: 'landscape',
    });
    const response = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[Pexels] Image search failed with HTTP ${response.status}.`);
      return null;
    }

    const result = (await response.json()) as PexelsSearchResponse;
    return result.photos?.[0]?.src?.large ?? null;
  } catch (error) {
    console.warn('[Pexels] Image search unavailable; using generated-image fallback.', error);
    return null;
  }
}
