/** Matter sensor type exposed for a printer. */
export type SensorType = 'occupancy' | 'contact';

/**
 * Raw printer configuration as received from config.json.
 * All fields are optional because validation is done in `config.ts`.
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
  pausedAsActive?: unknown;
}

/** Validated and normalized printer configuration. */
export interface PrinterConfig {
  id: string;
  sensorName: string;
  octoprintUrl: string;
  apiKey: string;
  enabled: boolean;
  pollIntervalSeconds: number;
  sensorType: SensorType;
  invertState: boolean;
  pausedAsActive: boolean;
}

/** Platform configuration as received from config.json. */
export interface OctoPrintMatterStatusPlatformConfig {
  platform: string;
  name?: string;
  printers?: RawPrinterConfig[];
  debug?: boolean;
}

/** State flags returned by OctoPrint in `state.flags`. */
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

/** Partial response from `GET /api/printer` (only state is used). */
export interface OctoPrintPrinterState {
  state?: {
    text?: string;
    flags?: OctoPrintStateFlags;
  };
}

/**
 * Typed subset of the Homebridge 2 Matter API used by this plugin.
 * We define our own interface rather than depending on full `homebridge` types
 * to stay robust across variations.
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
