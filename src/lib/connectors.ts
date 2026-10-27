import { Connectors } from '@/types';

const FALLBACK_IMAGE_BASE = 'https://picsum.photos/seed';

export function getConnectorStatus(key: string): 'connected' | 'fallback' {
  return key.trim().length > 0 ? 'connected' : 'fallback';
}

export function fetchImageUrl(connectorKey: string, query: string, width = 800, height = 600): string {
  if (connectorKey.trim()) {
    const encoded = encodeURIComponent(query);
    return `https://api.unsplash.com/search/photos?query=${encoded}&per_page=1&client_id=${connectorKey}`;
  }
  const seed = query.replace(/\s+/g, '-').toLowerCase().slice(0, 30) || 'study';
  return `${FALLBACK_IMAGE_BASE}/${seed}/${width}/${height}`;
}

export function getFallbackImage(query: string, width = 800, height = 600): string {
  const seed = query.replace(/\s+/g, '-').toLowerCase().slice(0, 30) || 'study';
  return `${FALLBACK_IMAGE_BASE}/${seed}/${width}/${height}`;
}

export function getTopicImages(topic: string, count: number = 4): string[] {
  const baseSeed = topic.replace(/\s+/g, '-').toLowerCase().slice(0, 20) || 'study';
  return Array.from({ length: count }, (_, i) => `${FALLBACK_IMAGE_BASE}/${baseSeed}-${i}/800/600`);
}

export function isAiConnected(c: Connectors): boolean {
  return c.aiApiKey.trim().length > 0;
}

export function isImageConnected(c: Connectors): boolean {
  return c.imageApiKey.trim().length > 0;
}
