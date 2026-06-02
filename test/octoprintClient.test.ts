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
  it('removes trailing slash', () => {
    expect(normalizeBaseUrl('http://octopi.local/')).toBe('http://octopi.local');
  });

  it('rejects URL without protocol', () => {
    expect(() => normalizeBaseUrl('octopi.local')).toThrow(OctoPrintError);
  });

  it('rejects non-http(s) protocol', () => {
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

  it('parses 200 response and sends X-Api-Key header', async () => {
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

  it('maps 409 to non-operational state without error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'not operational' }, 409));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const state = await client.getPrinterState();
    expect(state.state?.flags?.printing).toBe(false);
    expect(state.state?.flags?.operational).toBe(false);
  });

  it('throws auth error on 401/403', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 403));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'auth' });
  });

  it('throws http error on 500', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'http' });
  });

  it('throws network error when fetch fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'network' });
  });

  it('throws network error on AbortError', async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'network' });
  });

  it('throws parse error on invalid JSON', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('not json', { status: 200 }),
    );
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPrinterState()).rejects.toMatchObject({ kind: 'parse' });
  });
});
