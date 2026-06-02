import { DEFAULT_REQUEST_TIMEOUT_MS } from './settings';
import type { OctoPrintPrinterState } from './types';

/** Error categories distinguished by the OctoPrint client. */
export type OctoPrintErrorKind = 'config' | 'auth' | 'network' | 'http' | 'parse';

/** Typed error allowing the caller to react based on cause. */
export class OctoPrintError extends Error {
  public readonly kind: OctoPrintErrorKind;
  public readonly status?: number;

  constructor(message: string, kind: OctoPrintErrorKind, status?: number) {
    super(message);
    this.name = 'OctoPrintError';
    this.kind = kind;
    this.status = status;
  }
}

export interface OctoPrintClientOptions {
  url: string;
  apiKey: string;
  timeoutMs?: number;
  /** Injectable fetch implementation (helps testing). */
  fetchImpl?: typeof fetch;
}

/**
 * Normalizes an OctoPrint URL: validates protocol and strips trailing slash.
 * Throws a `config` `OctoPrintError` if the URL is invalid.
 */
export function normalizeBaseUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new OctoPrintError(
      `Invalid OctoPrint URL: "${rawUrl}". Expected example: http://octopi.local`,
      'config',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OctoPrintError(
      `Invalid OctoPrint URL: protocol "${parsed.protocol}" not supported (http/https required).`,
      'config',
    );
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

/** Minimal client to query an OctoPrint instance state. */
export class OctoPrintClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OctoPrintClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.url);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    const candidate = options.fetchImpl ?? globalThis.fetch;
    if (typeof candidate !== 'function') {
      throw new OctoPrintError(
        'No fetch implementation available (Node 18+ required).',
        'config',
      );
    }
    this.fetchImpl = candidate;
  }

  /**
   * Fetches current printer state via `GET /api/printer`.
   *
   * Special case: OctoPrint returns 409 when the printer is not operational
   * (disconnected). We map that to a "not printing" state rather than an error,
   * because it is a normal situation.
   */
  async getPrinterState(): Promise<OctoPrintPrinterState> {
    const endpoint = `${this.baseUrl}/api/printer`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OctoPrintError(
          `Timed out (${this.timeoutMs} ms) contacting ${endpoint}.`,
          'network',
        );
      }
      throw new OctoPrintError(
        `OctoPrint unreachable at ${endpoint}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'network',
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new OctoPrintError(
        'Authentication rejected by OctoPrint (invalid API key or missing STATUS permission).',
        'auth',
        response.status,
      );
    }

    // Printer not operational: not an error, just not printing.
    if (response.status === 409) {
      return { state: { text: 'Offline', flags: { operational: false, printing: false } } };
    }

    if (!response.ok) {
      throw new OctoPrintError(
        `Unexpected HTTP response from OctoPrint: ${response.status} ${response.statusText}.`,
        'http',
        response.status,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new OctoPrintError(
        `Invalid JSON response from OctoPrint: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'parse',
      );
    }

    if (typeof data !== 'object' || data === null) {
      throw new OctoPrintError('Unexpected OctoPrint response: expected object.', 'parse');
    }

    return data as OctoPrintPrinterState;
  }
}
