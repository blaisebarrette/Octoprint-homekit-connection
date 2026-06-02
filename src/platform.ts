import type {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';

import { normalizePrinters } from './config';
import { OctoPrintClient, OctoPrintError } from './octoprintClient';
import { OctoPrintMatterStatusAccessory } from './octoprintMatterStatusAccessory';
import { isPrinterActive } from './printerState';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import type {
  MatterApi,
  OctoPrintMatterStatusPlatformConfig,
  PrinterConfig,
} from './types';

interface RunningPrinter {
  config: PrinterConfig;
  client: OctoPrintClient;
  accessory: OctoPrintMatterStatusAccessory;
  timer?: ReturnType<typeof setInterval>;
}

export class OctoPrintMatterStatusPlatform implements DynamicPlatformPlugin {
  private readonly api: API;
  private readonly platformConfig: OctoPrintMatterStatusPlatformConfig;
  private readonly running: RunningPrinter[] = [];
  private readonly restoredUuids = new Set<string>();
  private stopped = false;

  constructor(
    private readonly log: Logging,
    config: PlatformConfig,
    api: API,
  ) {
    this.api = api;
    this.platformConfig = config as unknown as OctoPrintMatterStatusPlatformConfig;

    this.api.on('didFinishLaunching', () => {
      void this.start();
    });
    this.api.on('shutdown', () => {
      this.stop();
    });
  }

  /**
   * Required by DynamicPlatformPlugin for HAP accessories. This plugin only
   * exposes Matter accessories, so nothing to do here.
   */
  configureAccessory(_accessory: PlatformAccessory): void {
    // No-op: no HAP accessories.
  }

  /**
   * Called by Homebridge 2 to re-inject cached Matter accessories.
   * We store their UUIDs so stale accessories (removed printers) can be deleted.
   */
  configureMatterAccessory(accessory: { UUID?: string }): void {
    if (typeof accessory?.UUID === 'string') {
      this.restoredUuids.add(accessory.UUID);
    }
  }

  private getMatterApi(): MatterApi | undefined {
    if (typeof this.api.isMatterEnabled === 'function' && !this.api.isMatterEnabled()) {
      this.log.warn(
        'Matter is not enabled for this bridge. Enable Matter (bridge.matter or _bridge.matter) to expose sensors.',
      );
      return undefined;
    }
    if (!this.api.matter) {
      this.log.warn(
        'Matter API unavailable. This plugin requires Homebridge >= 2.0.0 with Matter enabled.',
      );
      return undefined;
    }
    // Bridge to our minimal interface: the real API is a superset.
    return this.api.matter as unknown as MatterApi;
  }

  private async start(): Promise<void> {
    const matter = this.getMatterApi();
    if (!matter) {
      return;
    }

    const { printers, errors } = normalizePrinters(this.platformConfig.printers);
    for (const error of errors) {
      this.log.warn(`Configuration: ${error}`);
    }

    const enabled = printers.filter((p) => p.enabled);
    const disabledCount = printers.length - enabled.length;
    if (disabledCount > 0) {
      this.log.info(`${disabledCount} disabled printer(s) skipped.`);
    }

    if (enabled.length === 0) {
      this.log.warn('No enabled printers to expose. Check the plugin configuration.');
      return;
    }

    const definitions = [];
    for (const printerConfig of enabled) {
      let client: OctoPrintClient;
      try {
        client = new OctoPrintClient({
          url: printerConfig.octoprintUrl,
          apiKey: printerConfig.apiKey,
        });
      } catch (error) {
        this.log.error(
          `[${printerConfig.sensorName}] invalid configuration: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      const accessory = new OctoPrintMatterStatusAccessory(matter, printerConfig, this.log);
      this.running.push({ config: printerConfig, client, accessory });
      definitions.push(accessory.buildDefinition());
    }

    if (definitions.length === 0) {
      this.log.warn('No valid printers to expose after validation.');
      return;
    }

    // Matter accessories must be (re)registered on every launch. The Matter
    // server cache only preserves prior state and pairing (matched by the
    // stable UUID); it does NOT make accessories live. configureMatterAccessory()
    // merely informs us of cached UUIDs (used below for stale cleanup) without
    // registering them, so skipping registration would leave the sensor unknown
    // to the server and updateAccessoryState() would fail.
    try {
      await matter.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, definitions);
      this.log.info(`${this.running.length} Matter sensor(s) active.`);
    } catch (error) {
      this.log.error(
        `Failed to register Matter accessories: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    await this.removeStaleAccessories(matter);

    for (const printer of this.running) {
      this.startPolling(printer);
    }
  }

  /** Removes cached Matter accessories that are no longer configured. */
  private async removeStaleAccessories(matter: MatterApi): Promise<void> {
    const activeUuids = new Set(this.running.map((p) => p.accessory.uuid));
    const stale = [...this.restoredUuids].filter((uuid) => !activeUuids.has(uuid));
    if (stale.length === 0) {
      return;
    }
    try {
      await matter.unregisterPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        stale.map((UUID) => ({ UUID })),
      );
      this.log.info(`${stale.length} stale sensor(s) removed.`);
    } catch (error) {
      this.log.warn(
        `Could not remove stale accessories: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private startPolling(printer: RunningPrinter): void {
    const intervalMs = printer.config.pollIntervalSeconds * 1000;
    // First poll immediately, then per-printer periodic polling.
    void this.pollOnce(printer);
    printer.timer = setInterval(() => {
      void this.pollOnce(printer);
    }, intervalMs);
    // Do not block process shutdown because of the timer.
    printer.timer.unref?.();
  }

  private async pollOnce(printer: RunningPrinter): Promise<void> {
    if (this.stopped) {
      return;
    }
    try {
      const state = await printer.client.getPrinterState();
      const active = isPrinterActive(state, printer.config.pausedAsActive);
      await printer.accessory.applyActive(active);
    } catch (error) {
      if (error instanceof OctoPrintError) {
        // Keep last known state to avoid sensor flapping.
        this.log.warn(`[${printer.config.sensorName}] poll skipped (${error.kind}): ${error.message}`);
      } else {
        this.log.error(
          `[${printer.config.sensorName}] unexpected error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private stop(): void {
    this.stopped = true;
    for (const printer of this.running) {
      if (printer.timer) {
        clearInterval(printer.timer);
        printer.timer = undefined;
      }
    }
  }
}
