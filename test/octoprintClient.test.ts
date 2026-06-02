import { describe, expect, it, vi } from 'vitest';

import {
  normalizeBaseUrl,
  OctoPrintClient,
  OctoPrintError,
} from '../src/octoprintClient';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('normalizeBaseUrl', () => {
  it('retire le slash final', () => {
    expect(normalizeBaseUrl('http://octopi.local/')).toBe('http://octopi.local');
  });

  it('rejette une URL sans protocole', () => {
    expect(() => normalizeBaseUrl('octopi.local')).toThrow(OctoPrintError);
  });

  it('rejette un protocole non http(s)', () => {
    expect(() => normalizeBaseUrl('ftp://octopi.local')).toThrow(OctoPrintError);
  });
});

describe('OctoPrintClient.getPrinterState', () => {
  function makeClient(fetchImpl: typeof fetch) {
    return new OctoPrintClient({
      url: 'http://octopi.local',
      apiKey: 'KEY',
      fetchImpl,
      timeoutMs: 100,
    });
  }

  it('parse une réponse 200 et envoie le header X-Api-Key', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-Api-Key')).toBe('KEY');
      return jsonResponse({ state: { text: 'Printing', flags: { printing: true } } });
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const state = await client.getPrinterState();
    expect(state.state?.flags?.printing).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('traduit 409 en état non opérationnel sans erreur', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'not operational' }, 409));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const state = await client.getPrinterState();
    expect(state.state?.flags?.printing).toBe(false);
    expect(state.state?.flags?.operational).toBe(false);
  });

  it('lève une erreur auth sur 401/403', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 403));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'auth' });
  });

  it('lève une erreur http sur 500', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'http' });
  });

  it('lève une erreur network quand fetch échoue', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'network' });
  });

  it('lève une erreur network sur AbortError', async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'network' });
  });

  it('lève une erreur parse sur JSON invalide', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('not json', { status: 200 }),
    );
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'parse' });
  });
});
