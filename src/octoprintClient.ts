import { DEFAULT_REQUEST_TIMEOUT_MS } from './settings';
import type { OctoPrintPrinterState } from './types';

/** Catégories d'erreurs distinguées par le client OctoPrint. */
export type OctoPrintErrorKind = 'config' | 'auth' | 'network' | 'http' | 'parse';

/** Erreur typée permettant à l'appelant de réagir selon la cause. */
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
  /** Implémentation de fetch injectable (facilite les tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Normalise une URL OctoPrint: vérifie le protocole et retire le slash final.
 * Lève une `OctoPrintError` de type `config` si l'URL est invalide.
 */
export function normalizeBaseUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new OctoPrintError(
      `URL OctoPrint invalide: "${rawUrl}". Exemple attendu: http://octopi.local`,
      'config',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OctoPrintError(
      `URL OctoPrint invalide: protocole "${parsed.protocol}" non supporté (http/https requis).`,
      'config',
    );
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

/** Client minimal pour interroger l'état d'une instance OctoPrint. */
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
        'Aucune implémentation de fetch disponible (Node 18+ requis).',
        'config',
      );
    }
    this.fetchImpl = candidate;
  }

  /**
   * Récupère l'état courant de l'imprimante via `GET /api/printer`.
   *
   * Cas particulier: OctoPrint renvoie 409 quand l'imprimante n'est pas
   * opérationnelle (déconnectée). On traduit cela en un état « non en
   * impression » plutôt qu'en erreur, car c'est une situation normale.
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
          `Délai dépassé (${this.timeoutMs} ms) en contactant ${endpoint}.`,
          'network',
        );
      }
      throw new OctoPrintError(
        `OctoPrint injoignable à ${endpoint}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'network',
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new OctoPrintError(
        'Authentification refusée par OctoPrint (clé API invalide ou permission STATUS manquante).',
        'auth',
        response.status,
      );
    }

    // Imprimante non opérationnelle: ce n'est pas une erreur, juste pas en impression.
    if (response.status === 409) {
      return { state: { text: 'Offline', flags: { operational: false, printing: false } } };
    }

    if (!response.ok) {
      throw new OctoPrintError(
        `Réponse HTTP inattendue d'OctoPrint: ${response.status} ${response.statusText}.`,
        'http',
        response.status,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new OctoPrintError(
        `Réponse JSON invalide d'OctoPrint: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'parse',
      );
    }

    if (typeof data !== 'object' || data === null) {
      throw new OctoPrintError('Réponse OctoPrint inattendue: objet attendu.', 'parse');
    }

    return data as OctoPrintPrinterState;
  }
}
