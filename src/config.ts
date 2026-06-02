import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  MIN_POLL_INTERVAL_SECONDS,
} from './settings';
import type { PrinterConfig, RawPrinterConfig, SensorType } from './types';

/** Résultat de la normalisation: imprimantes valides + erreurs lisibles. */
export interface NormalizeResult {
  printers: PrinterConfig[];
  errors: string[];
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asSensorType(value: unknown): SensorType {
  return value === 'contact' ? 'contact' : 'occupancy';
}

function asPollInterval(value: unknown): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric)) {
    return DEFAULT_POLL_INTERVAL_SECONDS;
  }
  return Math.max(MIN_POLL_INTERVAL_SECONDS, Math.round(numeric));
}

/**
 * Valide et normalise le tableau d'imprimantes provenant de la configuration.
 *
 * Les entrées invalides sont ignorées et signalées dans `errors` plutôt que de
 * faire échouer le démarrage de toute la plateforme. Les `id` dupliqués sont
 * détectés: seule la première occurrence est conservée.
 */
export function normalizePrinters(raw: unknown): NormalizeResult {
  const errors: string[] = [];
  const printers: PrinterConfig[] = [];

  if (raw === undefined || raw === null) {
    return { printers, errors };
  }

  if (!Array.isArray(raw)) {
    errors.push('La configuration "printers" doit être une liste.');
    return { printers, errors };
  }

  const seenIds = new Set<string>();

  raw.forEach((entry, index) => {
    const position = `imprimante #${index + 1}`;

    if (typeof entry !== 'object' || entry === null) {
      errors.push(`${position}: entrée invalide, objet attendu.`);
      return;
    }

    const candidate = entry as RawPrinterConfig;
    const id = asTrimmedString(candidate.id);
    const sensorName = asTrimmedString(candidate.sensorName);
    const octoprintUrl = asTrimmedString(candidate.octoprintUrl);
    const apiKey = asTrimmedString(candidate.apiKey);

    const missing: string[] = [];
    if (!id) {
      missing.push('id');
    }
    if (!sensorName) {
      missing.push('sensorName');
    }
    if (!octoprintUrl) {
      missing.push('octoprintUrl');
    }
    if (!apiKey) {
      missing.push('apiKey');
    }

    if (!id || !sensorName || !octoprintUrl || !apiKey) {
      errors.push(`${position}: champ(s) requis manquant(s): ${missing.join(', ')}.`);
      return;
    }

    if (seenIds.has(id)) {
      errors.push(`${position}: id "${id}" dupliqué, entrée ignorée.`);
      return;
    }
    seenIds.add(id);

    printers.push({
      id,
      sensorName,
      octoprintUrl,
      apiKey,
      enabled: asBoolean(candidate.enabled, true),
      pollIntervalSeconds: asPollInterval(candidate.pollIntervalSeconds),
      sensorType: asSensorType(candidate.sensorType),
      invertState: asBoolean(candidate.invertState, false),
    });
  });

  return { printers, errors };
}
