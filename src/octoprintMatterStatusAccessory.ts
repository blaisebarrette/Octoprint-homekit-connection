import type { Logging } from 'homebridge';

import {
  computeOccupied,
  contactUpdate,
  occupancyUpdate,
} from './printerState';
import type { MatterAccessoryDefinition, MatterApi, PrinterConfig } from './types';

const OCCUPANCY_CLUSTER = 'OccupancySensing';
const BOOLEAN_STATE_CLUSTER = 'BooleanState';

/** Stable Matter UUID namespace for this plugin (do not change after pairing). */
export const MATTER_UUID_NAMESPACE = 'octoprint-matter-status';

/**
 * Represents a printer's Matter sensor. Encapsulates stable UUID generation,
 * accessory definition, and state updates (avoiding redundant writes).
 */
export class OctoPrintMatterStatusAccessory {
  public readonly uuid: string;

  private lastOccupied: boolean | undefined;

  constructor(
    private readonly matter: MatterApi,
    private readonly printer: PrinterConfig,
    private readonly log: Logging,
  ) {
    // Deterministic UUID from id (stable even if URL changes).
    this.uuid = this.matter.uuid.generate(`${MATTER_UUID_NAMESPACE}:${printer.id}`);
  }

  /** Underlying Matter sensor type (occupancy by default). */
  private resolveDeviceType(): unknown {
    const types = this.matter.deviceTypes;
    if (this.printer.sensorType === 'contact') {
      return types.ContactSensor;
    }
    // matter.js sometimes names this "MotionSensor"; controllers show
    // OccupancySensor. We handle both names.
    return types.OccupancySensor ?? types.MotionSensor;
  }

  /** Cluster used for state updates. */
  private resolveClusterName(): string {
    const names = this.matter.clusterNames;
    if (this.printer.sensorType === 'contact') {
      return names.BooleanState ?? BOOLEAN_STATE_CLUSTER;
    }
    return names.OccupancySensing ?? OCCUPANCY_CLUSTER;
  }

  /** Builds the accessory definition to register with Homebridge. */
  buildDefinition(): MatterAccessoryDefinition {
    const clusters: Record<string, unknown> =
      this.printer.sensorType === 'contact'
        ? {
            booleanState: {
              // true = closed/normal: safe default state (not printing).
              stateValue: true,
            },
          }
        : {
            occupancySensing: {
              occupancy: { occupied: false },
              occupancySensorType: 0,
              occupancySensorTypeBitmap: {
                pir: true,
                ultrasonic: false,
                physicalContact: false,
              },
            },
          };

    return {
      UUID: this.uuid,
      displayName: this.printer.sensorName,
      deviceType: this.resolveDeviceType(),
      manufacturer: 'OctoPrint',
      model: this.printer.sensorType === 'contact' ? 'Print Status Contact' : 'Print Status Occupancy',
      serialNumber: this.printer.id,
      clusters,
    };
  }

  /**
   * Applies "active" (printing) state to the Matter sensor. Only writes when
   * the effective state changes to reduce noise on controllers.
   */
  async applyActive(active: boolean): Promise<void> {
    const occupied = computeOccupied(active, this.printer.invertState);
    if (occupied === this.lastOccupied) {
      return;
    }
    this.lastOccupied = occupied;

    const cluster = this.resolveClusterName();
    const attributes =
      this.printer.sensorType === 'contact'
        ? contactUpdate(occupied)
        : occupancyUpdate(occupied);

    await this.matter.updateAccessoryState(this.uuid, cluster, attributes);
    this.log.debug(
      `[${this.printer.sensorName}] state updated: ${occupied ? 'active' : 'inactive'}.`,
    );
  }
}
