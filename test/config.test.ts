import { describe, expect, it } from 'vitest';

import { normalizePrinters } from '../src/config';

describe('normalizePrinters', () => {
  it('returns empty when printers is absent', () => {
    const result = normalizePrinters(undefined);
    expect(result.printers).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('reports an error if printers is not an array', () => {
    const result = normalizePrinters({ not: 'an array' });
    expect(result.printers).toHaveLength(0);
    expect(result.errors[0]).toMatch(/array/);
  });

  it('normalizes a valid printer with default values', () => {
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
        pausedAsActive: false,
      },
    ]);
  });

  it('reports missing required fields', () => {
    const result = normalizePrinters([{ id: 'x', sensorName: 'X' }]);
    expect(result.printers).toHaveLength(0);
    expect(result.errors[0]).toMatch(/octoprintUrl/);
    expect(result.errors[0]).toMatch(/apiKey/);
  });

  it('detects duplicate ids and ignores the duplicate', () => {
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
    expect(result.errors.some((e) => /duplicate/.test(e))).toBe(true);
  });

  it('applies minimum polling and rounds', () => {
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

  it('keeps disabled printers (filtering done elsewhere)', () => {
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
    expect(result.printers[0].pausedAsActive).toBe(false);
  });

  it('accepts pausedAsActive when set', () => {
    const result = normalizePrinters([
      {
        id: 'p',
        sensorName: 'P',
        octoprintUrl: 'http://p.local',
        apiKey: 'k',
        pausedAsActive: true,
      },
    ]);
    expect(result.printers[0].pausedAsActive).toBe(true);
  });
});
