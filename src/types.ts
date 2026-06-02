/** Type de capteur Matter exposé pour une imprimante. */
export type SensorType = 'occupancy' | 'contact';

/**
 * Configuration brute d'une imprimante telle que reçue depuis config.json.
 * Tous les champs sont optionnels car la validation est faite dans `config.ts`.
 */
export interface RawPrinterConfig {
  id?: unknown;
  sensorName?: unknown;
  octoprintUrl?: unknown;
  apiKey?: unknown;
  enabled?: unknown;
  pollIntervalSeconds?: unknown;
  sensorType?: unknown;
  invertState?: unknown;
}

/** Configuration validée et normalisée d'une imprimante. */
export interface PrinterConfig {
  id: string;
  sensorName: string;
  octoprintUrl: string;
  apiKey: string;
  enabled: boolean;
  pollIntervalSeconds: number;
  sensorType: SensorType;
  invertState: boolean;
}

/** Configuration de la plateforme telle que reçue depuis config.json. */
export interface OctoPrintMatterStatusPlatformConfig {
  platform: string;
  name?: string;
  printers?: RawPrinterConfig[];
  debug?: boolean;
}

/** Drapeaux d'état renvoyés par OctoPrint dans `state.flags`. */
export interface OctoPrintStateFlags {
  operational?: boolean;
  paused?: boolean;
  printing?: boolean;
  cancelling?: boolean;
  pausing?: boolean;
  resuming?: boolean;
  finishing?: boolean;
  error?: boolean;
  ready?: boolean;
  closedOrError?: boolean;
  sdReady?: boolean;
}

/** Réponse partielle de `GET /api/printer` (seul l'état nous intéresse). */
export interface OctoPrintPrinterState {
  state?: {
    text?: string;
    flags?: OctoPrintStateFlags;
  };
}

/**
 * Sous-ensemble typé de l'API Matter de Homebridge 2 réellement utilisée par
 * le plugin. On définit notre propre interface plutôt que de dépendre des
 * types complets de `homebridge` afin de rester robuste aux variations.
 */
export interface MatterAccessoryDefinition {
  UUID: string;
  displayName: string;
  deviceType: unknown;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  clusters?: Record<string, unknown>;
}

export interface MatterApi {
  uuid: {
    generate(data: string): string;
    isValid(uuid: string): boolean;
  };
  deviceTypes: Record<string, unknown>;
  clusterNames: Record<string, string>;
  registerPlatformAccessories(
    pluginIdentifier: string,
    platformName: string,
    accessories: MatterAccessoryDefinition[],
  ): Promise<void>;
  unregisterPlatformAccessories(
    pluginIdentifier: string,
    platformName: string,
    accessories: Array<{ UUID: string }>,
  ): Promise<void>;
  updateAccessoryState(
    uuid: string,
    cluster: string,
    attributes: Record<string, unknown>,
    partId?: string,
  ): Promise<void>;
  getAccessoryState(
    uuid: string,
    cluster: string,
    partId?: string,
  ): Promise<Record<string, unknown> | undefined>;
}
