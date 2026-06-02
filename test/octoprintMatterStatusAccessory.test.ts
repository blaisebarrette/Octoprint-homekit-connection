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

function fakeMotionSensorDeviceType() {
  const deviceType = {
    name: 'OccupancySensor',
    with: vi.fn((...behaviors: unknown[]) => ({
      ...deviceType,
      behaviors,
    })),
  };
  return deviceType;
}

function fakeMatter() {
  const updateAccessoryState = vi.fn(async () => {});
  const motionSensor = fakeMotionSensorDeviceType();
  const matter: MatterApi = {
    uuid: {
      generate: (data: string) => `uuid:${data}`,
      isValid: () => true,
    },
    deviceTypes: { MotionSensor: motionSensor, ContactSensor: 'ContactSensor' },
    clusterNames: { OccupancySensing: 'occupancySensing', BooleanState: 'booleanState' },
    registerPlatformAccessories: vi.fn(async () => {}),
    unregisterPlatformAccessories: vi.fn(async () => {}),
    updateAccessoryState,
    getAccessoryState: vi.fn(async () => undefined),
  };
  return { matter, updateAccessoryState, motionSensor };
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
  it('generates a stable UUID based on id', () => {
    const { matter } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(matter, makePrinter(), fakeLog());
    expect(acc.uuid).toBe(`uuid:${MATTER_UUID_NAMESPACE}:p1`);
  });

  it('builds an occupancy definition', () => {
    const { matter, motionSensor } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(matter, makePrinter(), fakeLog());
    const def = acc.buildDefinition();
    expect(motionSensor.with).toHaveBeenCalledOnce();
    expect(def.deviceType).toEqual(expect.objectContaining({ behaviors: expect.any(Array) }));
    expect(def.displayName).toBe('Printer 1');
    expect(def.clusters?.occupancySensing).toBeDefined();
  });

  it('builds a contact definition', () => {
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

  it('updates occupancy cluster when active', async () => {
    const { matter, updateAccessoryState } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(matter, makePrinter(), fakeLog());
    await acc.applyActive(true);
    expect(updateAccessoryState).toHaveBeenCalledWith(
      `uuid:${MATTER_UUID_NAMESPACE}:p1`,
      'occupancySensing',
      { occupancy: { occupied: true } },
    );
  });

  it('does not write twice for the same state', async () => {
    const { matter, updateAccessoryState } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(matter, makePrinter(), fakeLog());
    await acc.applyActive(true);
    await acc.applyActive(true);
    expect(updateAccessoryState).toHaveBeenCalledOnce();
  });

  it('applies inversion', async () => {
    const { matter, updateAccessoryState } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(
      matter,
      makePrinter({ invertState: true }),
      fakeLog(),
    );
    await acc.applyActive(true);
    expect(updateAccessoryState).toHaveBeenCalledWith(
      `uuid:${MATTER_UUID_NAMESPACE}:p1`,
      'occupancySensing',
      { occupancy: { occupied: false } },
    );
  });

  it('uses BooleanState for a contact sensor', async () => {
    const { matter, updateAccessoryState } = fakeMatter();
    const acc = new OctoPrintMatterStatusAccessory(
      matter,
      makePrinter({ sensorType: 'contact' }),
      fakeLog(),
    );
    await acc.applyActive(true);
    expect(updateAccessoryState).toHaveBeenCalledWith(
      `uuid:${MATTER_UUID_NAMESPACE}:p1`,
      'booleanState',
      { stateValue: false },
    );
  });
});
