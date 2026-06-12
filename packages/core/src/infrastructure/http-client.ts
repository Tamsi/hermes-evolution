import type { HttpClientPort } from '../ports/index.js';

export class FetchHttpClient implements HttpClientPort {
  async fetchText(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Hermes-Curator/0.1' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${String(response.status)} for ${url}`);
    }
    return response.text();
  }

  async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Hermes-Curator/0.1',
        Accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${String(response.status)} for ${url}`);
    }
    return (await response.json()) as T;
  }
}
