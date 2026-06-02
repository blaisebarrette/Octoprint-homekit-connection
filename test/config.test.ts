import { describe, expect, it } from 'vitest';

import { normalizePrinters } from '../src/config';

describe('normalizePrinters', () => {
  it('retourne vide quand printers est absent', () => {
    const result = normalizePrinters(undefined);
    expect(result.printers).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('signale une erreur si printers n\'est pas un tableau', () => {
    const result = normalizePrinters({ not: 'an array' });
    expect(result.printers).toHaveLength(0);
    expect(result.errors[0]).toMatch(/liste/);
  });

  it('normalise une imprimante valide avec les valeurs par défaut', () => {
    const result = normalizePrinters([
      {
        id: 'mk3s',
        sensorName: 'Prusa MK3S',
        octoprintUrl: 'http://octopi.local',
        apiKey: 'ABC123',
      },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.printers).toEqual([
      {
        id: 'mk3s',
        sensorName: 'Prusa MK3S',
        octoprintUrl: 'http://octopi.local',
        apiKey: 'ABC123',
        enabled: true,
        pollIntervalSeconds: 10,
        sensorType: 'occupancy',
        invertState: false,
      },
    ]);
  });

  it('signale les champs requis manquants', () => {
    const result = normalizePrinters([{ id: 'x', sensorName: 'X' }]);
    expect(result.printers).toHaveLength(0);
    expect(result.errors[0]).toMatch(/octoprintUrl/);
    expect(result.errors[0]).toMatch(/apiKey/);
  });

  it('détecte les id dupliqués et ignore le doublon', () => {
    const base = {
      sensorName: 'A',
      octoprintUrl: 'http://a.local',
      apiKey: 'k',
    };
    const result = normalizePrinters([
      { id: 'dup', ...base },
      { id: 'dup', ...base, sensorName: 'B' },
    ]);
    expect(result.printers).toHaveLength(1);
    expect(result.printers[0].sensorName).toBe('A');
    expect(result.errors.some((e) => /dupliqué/.test(e))).toBe(true);
  });

  it('applique le minimum de polling et arrondit', () => {
    const result = normalizePrinters([
      {
        id: 'p',
        sensorName: 'P',
        octoprintUrl: 'http://p.local',
        apiKey: 'k',
        pollIntervalSeconds: 0.4,
      },
    ]);
    expect(result.printers[0].pollIntervalSeconds).toBe(2);
  });

  it('conserve les imprimantes désactivées (filtrage fait ailleurs)', () => {
    const result = normalizePrinters([
      {
        id: 'p',
        sensorName: 'P',
        octoprintUrl: 'http://p.local',
        apiKey: 'k',
        enabled: false,
        sensorType: 'contact',
      },
    ]);
    expect(result.printers[0].enabled).toBe(false);
    expect(result.printers[0].sensorType).toBe('contact');
  });
});
