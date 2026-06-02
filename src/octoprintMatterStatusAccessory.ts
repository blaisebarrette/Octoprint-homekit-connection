import type { Logging } from 'homebridge';

import {
  computeOccupied,
  contactUpdate,
  occupancyUpdate,
} from './printerState';
import type { MatterAccessoryDefinition, MatterApi, PrinterConfig } from './types';

const OCCUPANCY_CLUSTER = 'OccupancySensing';
const BOOLEAN_STATE_CLUSTER = 'BooleanState';

/** Préfixe UUID Matter stable pour ce plugin (ne pas modifier après appairage). */
export const MATTER_UUID_NAMESPACE = 'octoprint-matter-status';

/**
 * Représente le capteur Matter d'une imprimante. Encapsule la génération de
 * l'UUID stable, la définition de l'accessoire et l'application des mises à jour
 * d'état (en évitant les écritures redondantes).
 */
export class OctoPrintMatterStatusAccessory {
  public readonly uuid: string;

  private lastOccupied: boolean | undefined;

  constructor(
    private readonly matter: MatterApi,
    private readonly printer: PrinterConfig,
    private readonly log: Logging,
  ) {
    // UUID déterministe basé sur l'id (stable même si l'URL change).
    this.uuid = this.matter.uuid.generate(`${MATTER_UUID_NAMESPACE}:${printer.id}`);
  }

  /** Type de capteur Matter sous-jacent (occupancy par défaut). */
  private resolveDeviceType(): unknown {
    const types = this.matter.deviceTypes;
    if (this.printer.sensorType === 'contact') {
      return types.ContactSensor;
    }
    // matter.js nomme parfois ce type "MotionSensor"; il s'affiche en
    // OccupancySensor dans les contrôleurs. On gère les deux noms.
    return types.OccupancySensor ?? types.MotionSensor;
  }

  /** Cluster utilisé pour les mises à jour d'état. */
  private resolveClusterName(): string {
    const names = this.matter.clusterNames;
    if (this.printer.sensorType === 'contact') {
      return names.BooleanState ?? BOOLEAN_STATE_CLUSTER;
    }
    return names.OccupancySensing ?? OCCUPANCY_CLUSTER;
  }

  /** Construit la définition d'accessoire à enregistrer auprès de Homebridge. */
  buildDefinition(): MatterAccessoryDefinition {
    const clusters: Record<string, unknown> =
      this.printer.sensorType === 'contact'
        ? {
            booleanState: {
              // true = fermé/normal: état sûr par défaut (pas en impression).
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
   * Applique l'état « actif » (en impression) au capteur Matter. N'écrit que
   * lorsque l'état effectif change pour éviter le bruit côté contrôleurs.
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
      `[${this.printer.sensorName}] état mis à jour: ${occupied ? 'actif' : 'inactif'}.`,
    );
  }
}
