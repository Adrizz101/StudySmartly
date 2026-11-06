type OpenverseImage = {
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
};

type OpenverseSearchResponse = {
  results?: OpenverseImage[];
};

type WikimediaPage = {
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
  }>;
};

type WikimediaSearchResponse = {
  query?: {
    pages?: Record<string, WikimediaPage>;
  };
};

const REQUEST_TIMEOUT_MS = 7000;
const USER_AGENT = 'StudySmartly/1.0 (educational presentation image search)';

/**
 * Fetches one openly licensed image without API credentials.
 * Provider order: Openverse -> Wikimedia Commons. The caller uses
 * Pollinations as the final fallback when this function returns null.
 */
export async function fetchWebImage(query: string): Promise<string | null> {
  const searchQuery = query.trim().slice(0, 200);
  if (!searchQuery) return null;

  // Primary: Openverse supports anonymous image searches.
  try {
    const params = new URLSearchParams({
      q: searchQuery,
      page_size: '1',
      license_type: 'all',
      mature: 'false',
      filter_dead: 'true',
    });
    const response = await fetch(`https://api.openverse.org/v1/images/?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      const result = (await response.json()) as OpenverseSearchResponse;
      const imageUrl = result.results?.[0]?.thumbnail ?? result.results?.[0]?.url;
      if (imageUrl && /^https:\/\//i.test(imageUrl)) return imageUrl;
    } else {
      console.warn(`[Openverse] Image search returned HTTP ${response.status}; trying Wikimedia Commons.`);
    }
  } catch (error) {
    console.warn('[Openverse] Image search unavailable; trying Wikimedia Commons.', error);
  }

  // Secondary: Wikimedia Commons' public MediaWiki API requires no API key.
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `filetype:bitmap ${searchQuery}`,
      gsrnamespace: '6',
      gsrlimit: '1',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '1600',
      format: 'json',
      formatversion: '2',
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      const result = (await response.json()) as WikimediaSearchResponse;
      const pages = result.query?.pages ?? {};
      const firstPage = Object.values(pages)[0];
      const imageUrl = firstPage?.imageinfo?.[0]?.thumburl ?? firstPage?.imageinfo?.[0]?.url;
      if (imageUrl && /^https:\/\//i.test(imageUrl)) return imageUrl;
    } else {
      console.warn(`[Wikimedia] Image search returned HTTP ${response.status}; using Pollinations fallback.`);
    }
  } catch (error) {
    console.warn('[Wikimedia] Image search unavailable; using Pollinations fallback.', error);
  }

  return null;
}
