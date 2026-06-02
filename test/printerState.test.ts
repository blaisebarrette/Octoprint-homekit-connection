import { describe, expect, it } from 'vitest';

import {
  computeOccupied,
  contactUpdate,
  isPrinterActive,
  occupancyUpdate,
} from '../src/printerState';

describe('isPrinterActive', () => {
  it('est faux sans état', () => {
    expect(isPrinterActive(undefined)).toBe(false);
    expect(isPrinterActive({})).toBe(false);
    expect(isPrinterActive({ state: {} })).toBe(false);
  });

  it('est vrai quand printing', () => {
    expect(isPrinterActive({ state: { flags: { printing: true } } })).toBe(true);
  });

  it('est faux quand opérationnel mais pas en impression', () => {
    expect(isPrinterActive({ state: { flags: { operational: true, printing: false } } })).toBe(false);
  });

  it('est faux en pause complète', () => {
    expect(isPrinterActive({ state: { flags: { paused: true, printing: false } } })).toBe(false);
  });

  it('est vrai pendant les transitions (pausing, cancelling, finishing)', () => {
    expect(isPrinterActive({ state: { flags: { pausing: true } } })).toBe(true);
    expect(isPrinterActive({ state: { flags: { cancelling: true } } })).toBe(true);
    expect(isPrinterActive({ state: { flags: { finishing: true } } })).toBe(true);
  });
});

describe('computeOccupied', () => {
  it('renvoie active sans inversion', () => {
    expect(computeOccupied(true, false)).toBe(true);
    expect(computeOccupied(false, false)).toBe(false);
  });

  it('inverse quand demandé', () => {
    expect(computeOccupied(true, true)).toBe(false);
    expect(computeOccupied(false, true)).toBe(true);
  });
});

describe('payloads de cluster', () => {
  it('occupancyUpdate reflète occupied', () => {
    expect(occupancyUpdate(true)).toEqual({ occupancy: { occupied: true } });
    expect(occupancyUpdate(false)).toEqual({ occupancy: { occupied: false } });
  });

  it('contactUpdate inverse la sémantique BooleanState', () => {
    // occupé (en impression) => déclenché => stateValue false
    expect(contactUpdate(true)).toEqual({ stateValue: false });
    // inactif => normal => stateValue true
    expect(contactUpdate(false)).toEqual({ stateValue: true });
  });
});
