import type { OctoPrintPrinterState } from './types';

/**
 * Determines whether the printer is currently printing.
 *
 * The printer is considered "active" while a job is in progress, including
 * transitional states (pausing, cancelling, resuming, finishing) while the tool
 * head is still moving. Full pause (`paused`) is not considered active by
 * default, but can be opted in via `pausedAsActive`.
 */
export function isPrinterActive(
  state: OctoPrintPrinterState | undefined,
  pausedAsActive = false,
): boolean {
  const flags = state?.state?.flags;
  if (!flags) {
    return false;
  }
  return (
    flags.printing === true ||
    flags.pausing === true ||
    flags.cancelling === true ||
    flags.resuming === true ||
    flags.finishing === true ||
    (pausedAsActive && flags.paused === true)
  );
}

/** Applies invert option to the active state to obtain the "occupied" sensor state. */
export function computeOccupied(active: boolean, invert: boolean): boolean {
  return invert ? !active : active;
}

/** Update payload for the OccupancySensing cluster. */
export function occupancyUpdate(occupied: boolean): Record<string, unknown> {
  return { occupancy: { occupied } };
}

/**
 * Update payload for the BooleanState cluster (contact sensor).
 *
 * Inverted Matter semantics: `stateValue === true` means closed contact /
 * normal state, `false` means triggered. The sensor triggers when the printer
 * is "occupied" (printing).
 */
export function contactUpdate(occupied: boolean): Record<string, unknown> {
  return { stateValue: !occupied };
}
