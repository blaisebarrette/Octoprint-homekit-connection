import { describe, expect, it } from 'vitest';

import {
  computeOccupied,
  contactUpdate,
  isPrinterActive,
  occupancyUpdate,
} from '../src/printerState';

describe('isPrinterActive', () => {
  it('is false without state', () => {
    expect(isPrinterActive(undefined)).toBe(false);
    expect(isPrinterActive({})).toBe(false);
    expect(isPrinterActive({ state: {} })).toBe(false);
  });

  it('is true when printing', () => {
    expect(isPrinterActive({ state: { flags: { printing: true } } })).toBe(true);
  });

  it('is false when operational but not printing', () => {
    expect(isPrinterActive({ state: { flags: { operational: true, printing: false } } })).toBe(false);
  });

  it('is false when fully paused', () => {
    expect(isPrinterActive({ state: { flags: { paused: true, printing: false } } })).toBe(false);
  });

  it('is true during transitions (pausing, cancelling, finishing)', () => {
    expect(isPrinterActive({ state: { flags: { pausing: true } } })).toBe(true);
    expect(isPrinterActive({ state: { flags: { cancelling: true } } })).toBe(true);
    expect(isPrinterActive({ state: { flags: { finishing: true } } })).toBe(true);
  });
});

describe('computeOccupied', () => {
  it('returns active without inversion', () => {
    expect(computeOccupied(true, false)).toBe(true);
    expect(computeOccupied(false, false)).toBe(false);
  });

  it('inverts when requested', () => {
    expect(computeOccupied(true, true)).toBe(false);
    expect(computeOccupied(false, true)).toBe(true);
  });
});

describe('cluster payloads', () => {
  it('occupancyUpdate reflects occupied', () => {
    expect(occupancyUpdate(true)).toEqual({ occupancy: { occupied: true } });
    expect(occupancyUpdate(false)).toEqual({ occupancy: { occupied: false } });
  });

  it('contactUpdate inverts BooleanState semantics', () => {
    // occupied (printing) => triggered => stateValue false
    expect(contactUpdate(true)).toEqual({ stateValue: false });
    // inactive => normal => stateValue true
    expect(contactUpdate(false)).toEqual({ stateValue: true });
  });
});
