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
   * Requis par DynamicPlatformPlugin pour les accessoires HAP. Ce plugin
   * n'expose que des accessoires Matter, donc rien à faire ici.
   */
  configureAccessory(_accessory: PlatformAccessory): void {
    // No-op: pas d'accessoires HAP.
  }

  /**
   * Appelé par Homebridge 2 pour ré-injecter les accessoires Matter en cache.
   * On mémorise leur UUID afin de pouvoir supprimer les accessoires devenus
   * obsolètes (imprimantes retirées de la configuration).
   */
  configureMatterAccessory(accessory: { UUID?: string }): void {
    if (typeof accessory?.UUID === 'string') {
      this.restoredUuids.add(accessory.UUID);
    }
  }

  private getMatterApi(): MatterApi | undefined {
    if (typeof this.api.isMatterEnabled === 'function' && !this.api.isMatterEnabled()) {
      this.log.warn(
        'Matter n\'est pas activé pour ce bridge. Activez Matter (bridge.matter ou _bridge.matter) pour exposer les capteurs.',
      );
      return undefined;
    }
    if (!this.api.matter) {
      this.log.warn(
        'API Matter indisponible. Ce plugin requiert Homebridge >= 2.0.0 avec Matter activé.',
      );
      return undefined;
    }
    // Pont vers notre interface minimale: l'API réelle est un sur-ensemble.
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
      this.log.info(`${disabledCount} imprimante(s) désactivée(s) ignorée(s).`);
    }

    if (enabled.length === 0) {
      this.log.warn('Aucune imprimante activée à exposer. Vérifiez la configuration du plugin.');
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
          `[${printerConfig.sensorName}] configuration invalide: ${
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
      this.log.warn('Aucune imprimante valide à exposer après validation.');
      return;
    }

    try {
      await matter.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, definitions);
      this.log.info(`${definitions.length} capteur(s) Matter enregistré(s).`);
    } catch (error) {
      this.log.error(
        `Échec de l'enregistrement des accessoires Matter: ${
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

  /** Supprime les accessoires Matter en cache qui ne sont plus configurés. */
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
      this.log.info(`${stale.length} capteur(s) obsolète(s) supprimé(s).`);
    } catch (error) {
      this.log.warn(
        `Impossible de supprimer des accessoires obsolètes: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private startPolling(printer: RunningPrinter): void {
    const intervalMs = printer.config.pollIntervalSeconds * 1000;
    // Premier relevé immédiat, puis polling périodique isolé par imprimante.
    void this.pollOnce(printer);
    printer.timer = setInterval(() => {
      void this.pollOnce(printer);
    }, intervalMs);
    // Ne pas bloquer l'arrêt du process à cause du timer.
    printer.timer.unref?.();
  }

  private async pollOnce(printer: RunningPrinter): Promise<void> {
    if (this.stopped) {
      return;
    }
    try {
      const state = await printer.client.getPrinterState();
      const active = isPrinterActive(state);
      await printer.accessory.applyActive(active);
    } catch (error) {
      if (error instanceof OctoPrintError) {
        // On conserve le dernier état connu pour éviter le flapping du capteur.
        this.log.warn(`[${printer.config.sensorName}] relevé ignoré (${error.kind}): ${error.message}`);
      } else {
        this.log.error(
          `[${printer.config.sensorName}] erreur inattendue: ${
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
