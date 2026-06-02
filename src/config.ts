import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  MIN_POLL_INTERVAL_SECONDS,
} from './settings';
import type { PrinterConfig, RawPrinterConfig, SensorType } from './types';

/** Normalization result: valid printers plus readable errors. */
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
 * Validates and normalizes the printers array from configuration.
 *
 * Invalid entries are skipped and reported in `errors` rather than failing
 * the entire platform startup. Duplicate `id` values are detected: only the
 * first occurrence is kept.
 */
export function normalizePrinters(raw: unknown): NormalizeResult {
  const errors: string[] = [];
  const printers: PrinterConfig[] = [];

  if (raw === undefined || raw === null) {
    return { printers, errors };
  }

  if (!Array.isArray(raw)) {
    errors.push('Configuration "printers" must be an array.');
    return { printers, errors };
  }

  const seenIds = new Set<string>();

  raw.forEach((entry, index) => {
    const position = `printer #${index + 1}`;

    if (typeof entry !== 'object' || entry === null) {
      errors.push(`${position}: invalid entry, expected object.`);
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
      errors.push(`${position}: missing required field(s): ${missing.join(', ')}.`);
      return;
    }

    if (seenIds.has(id)) {
      errors.push(`${position}: duplicate id "${id}", entry ignored.`);
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
      pausedAsActive: asBoolean(candidate.pausedAsActive, false),
    });
  });

  return { printers, errors };
}
