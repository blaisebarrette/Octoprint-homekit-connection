import { describe, expect, it, vi } from 'vitest';

import {
  MATTER_UUID_NAMESPACE,
  OctoPrintMatterStatusAccessory,
} from '../src/octoprintMatterStatusAccessory';
import type { Logging } from 'homebridge';
import type { MatterApi, PrinterConfig } from '../src/types';

function fakeLog(): Logging {
  const fn = vi.fn();
  return Object.assign(fn, {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    success: vi.fn(),
    prefix: undefined,
  }) as unknown as Logging;
}

function fakeMatter() {
  const updateAccessoryState = vi.fn(async () => {});
  const matter: MatterApi = {
    uuid: {
      generate: (data: string) => `uuid:${data}`,
      isValid: () => true,
    },
    deviceTypes: { OccupancySensor: 'OccupancySensor', ContactSensor: 'ContactSensor' },
    clusterNames: { OccupancySensing: 'OccupancySensing', BooleanState: 'BooleanState' },
    registerPlatformAccessories: vi.fn(async () => {}),
    unregisterPlatformAccessories: vi.fn(async () => {}),
    updateAccessoryState,
    getAccessoryState: vi.fn(async () => undefined),
  };
  return { matter, updateAccessoryState };
}

function makePrinter(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    id: 'p1',
    sensorName: 'Printer 1',
    octoprintUrl: 'http://p1.local',
    apiKey: 'k',
    enabled: true,
    pollIntervalSeconds: 10,
    sensorType: 'occupancy',
    invertState: false,
    ...overrides,
  };
}

describe('OctoPrintMatterStatusAccessory', () => {
  it('génère un UUID stable basé sur l\'id', () => {
    const { matter } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(matter, makePrinter(), fakeLog());
    expect(acc.uuid).toBe(`uuid:${MATTER_UUID_NAMESPACE}:p1`);
  });

  it('construit une définition occupancy', () => {
    const { matter } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(matter, makePrinter(), fakeLog());
    const def = acc.buildDefinition();
    expect(def.deviceType).toBe('OccupancySensor');
    expect(def.displayName).toBe('Printer 1');
    expect(def.clusters?.occupancySensing).toBeDefined();
  });

  it('construit une définition contact', () => {
    const { matter } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(
      matter,
      makePrinter({ sensorType: 'contact' }),
      fakeLog(),
    );
    const def = acc.buildDefinition();
    expect(def.deviceType).toBe('ContactSensor');
    expect(def.clusters?.booleanState).toEqual({ stateValue: true });
  });

  it('met à jour le cluster occupancy quand actif', async () => {
    const { matter, updateAccessoryState } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(matter, makePrinter(), fakeLog());
    await acc.applyActive(true);
    expect(updateAccessoryState).toHaveBeenCalledWith(
      `uuid:${MATTER_UUID_NAMESPACE}:p1`,
      'OccupancySensing',
      { occupancy: { occupied: true } },
    );
  });

  it('n\'écrit pas deux fois pour le même état', async () => {
    const { matter, updateAccessoryState } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(matter, makePrinter(), fakeLog());
    await acc.applyActive(true);
    await acc.applyActive(true);
    expect(updateAccessoryState).toHaveBeenCalledOnce();
  });

  it('applique l\'inversion', async () => {
    const { matter, updateAccessoryState } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(
      matter,
      makePrinter({ invertState: true }),
      fakeLog(),
    );
    await acc.applyActive(true);
    expect(updateAccessoryState).toHaveBeenCalledWith(
      `uuid:${MATTER_UUID_NAMESPACE}:p1`,
      'OccupancySensing',
      { occupancy: { occupied: false } },
    );
  });

  it('utilise BooleanState pour un capteur contact', async () => {
    const { matter, updateAccessoryState } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(
      matter,
      makePrinter({ sensorType: 'contact' }),
      fakeLog(),
    );
    await acc.applyActive(true);
    expect(updateAccessoryState).toHaveBeenCalledWith(
      `uuid:${MATTER_UUID_NAMESPACE}:p1`,
      'BooleanState',
      { stateValue: false },
    );
  });
});
