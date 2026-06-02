import type { OctoPrintPrinterState } from './types';

/**
 * Détermine si l'imprimante est en cours d'impression.
 *
 * On considère l'imprimante « active » dès qu'un travail est en cours, ce qui
 * inclut les états transitoires (mise en pause, annulation, reprise, fin) tant
 * que la tête est encore en mouvement. La pause complète (`paused`) n'est pas
 * considérée comme active.
 */
export function isPrinterActive(state: OctoPrintPrinterState | undefined): boolean {
  const flags = state?.state?.flags;
  if (!flags) {
    return false;
  }
  return (
    flags.printing === true ||
    flags.pausing === true ||
    flags.cancelling === true ||
    flags.resuming === true ||
    flags.finishing === true
  );
}

/**
 * Applique l'option d'inversion à l'état actif pour obtenir l'état « occupé »
 * exposé au capteur.
 */
export function computeOccupied(active: boolean, invert: boolean): boolean {
  return invert ? !active : active;
}

/** Charge utile de mise à jour pour le cluster OccupancySensing. */
export function occupancyUpdate(occupied: boolean): Record<string, unknown> {
  return { occupancy: { occupied } };
}

/**
 * Charge utile de mise à jour pour le cluster BooleanState (capteur de contact).
 *
 * Sémantique Matter inversée: `stateValue === true` signifie contact fermé /
 * état normal, `false` signifie déclenché. On déclenche donc le capteur quand
 * l'imprimante est « occupée » (en impression).
 */
export function contactUpdate(occupied: boolean): Record<string, unknown> {
  return { stateValue: !occupied };
}
