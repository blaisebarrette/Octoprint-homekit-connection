import { HomebridgePluginUiServer, RequestError } from '@homebridge/plugin-ui-utils';

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Normalizes the OctoPrint URL (protocol required, trailing slash removed).
 */
function normalizeBaseUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RequestError('Invalid OctoPrint URL. Example: http://octopi.local', { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new RequestError('Unsupported protocol (http/https required).', { status: 400 });
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
   * Tests connectivity to an OctoPrint instance from the plugin server,
   * so the API key is never exposed directly to the browser.
   */
  async testConnection(payload) {
    const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
    const apiKey = typeof payload?.apiKey === 'string' ? payload.apiKey.trim() : '';

    if (!url || !apiKey) {
      throw new RequestError('URL and API key are required.', { status: 400 });
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
          ? `Timed out contacting ${endpoint}.`
          : `OctoPrint unreachable: ${error?.message ?? error}`,
        { status: 502 },
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new RequestError('API key rejected (missing STATUS permission?).', { status: 401 });
    }

    // 409 = printer not operational: OctoPrint connectivity still works.
    if (response.status === 409) {
      return { ok: true, operational: false, printing: false, text: 'Offline' };
    }

    if (!response.ok) {
      throw new RequestError(`Unexpected HTTP response: ${response.status}.`, { status: 502 });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new RequestError('Invalid JSON response from OctoPrint.', { status: 502 });
    }

    const flags = data?.state?.flags ?? {};
    return {
      ok: true,
      operational: flags.operational === true,
      printing: flags.printing === true,
      text: data?.state?.text ?? 'Unknown',
    };
  }
}

(() => new OctoPrintMatterStatusUiServer())();
