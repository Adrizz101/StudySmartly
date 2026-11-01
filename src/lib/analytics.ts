/**
 * Minimal, privacy-conscious analytics adapter.
 *
 * Events are logged locally for development verification. Do not pass free-text
 * feedback, email addresses, or other directly identifying data as properties.
 */
export type AnalyticsProperties = Record<string, any>;

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}): void {
  if (typeof console === 'undefined') return;
  console.log('📊 [ANALYTICS EVENT]:', eventName, properties);
}
