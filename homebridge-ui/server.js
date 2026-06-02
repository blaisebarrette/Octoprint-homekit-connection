import { HomebridgePluginUiServer, RequestError } from '@homebridge/plugin-ui-utils';

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Normalise l'URL OctoPrint (protocole obligatoire, slash final retiré).
 */
function normalizeBaseUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RequestError('URL OctoPrint invalide. Exemple: http://octopi.local', { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new RequestError('Protocole non supporté (http/https requis).', { status: 400 });
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

class OctoPrintMatterStatusUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();
    this.onRequest('/test-connection', this.testConnection.bind(this));
    this.ready();
  }

  /**
   * Teste la connexion à une instance OctoPrint depuis le serveur du plugin,
   * afin de ne jamais exposer la clé API directement au navigateur.
   */
  async testConnection(payload) {
    const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
    const apiKey = typeof payload?.apiKey === 'string' ? payload.apiKey.trim() : '';

    if (!url || !apiKey) {
      throw new RequestError('URL et clé API requises.', { status: 400 });
    }

    const endpoint = `${normalizeBaseUrl(url)}/api/printer`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (error) {
      throw new RequestError(
        error?.name === 'AbortError'
          ? `Délai dépassé en contactant ${endpoint}.`
          : `OctoPrint injoignable: ${error?.message ?? error}`,
        { status: 502 },
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new RequestError('Clé API refusée (permission STATUS manquante ?).', { status: 401 });
    }

    // 409 = imprimante non opérationnelle: la connexion OctoPrint fonctionne.
    if (response.status === 409) {
      return { ok: true, operational: false, printing: false, text: 'Offline' };
    }

    if (!response.ok) {
      throw new RequestError(`Réponse HTTP inattendue: ${response.status}.`, { status: 502 });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new RequestError('Réponse JSON invalide depuis OctoPrint.', { status: 502 });
    }

    const flags = data?.state?.flags ?? {};
    return {
      ok: true,
      operational: flags.operational === true,
      printing: flags.printing === true,
      text: data?.state?.text ?? 'Inconnu',
    };
  }
}

(() => new OctoPrintMatterStatusUiServer())();
