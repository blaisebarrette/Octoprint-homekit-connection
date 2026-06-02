/**
 * Identifiant npm du plugin. Doit correspondre au champ "name" de package.json.
 */
export const PLUGIN_NAME = 'homebridge-octoprint-matter-status';

/**
 * Nom de la plateforme tel qu'utilisé dans config.json et config.schema.json.
 */
export const PLATFORM_NAME = 'OctoPrintMatterStatus';

/** Intervalle de polling par défaut, en secondes. */
export const DEFAULT_POLL_INTERVAL_SECONDS = 10;

/** Intervalle de polling minimal accepté, pour éviter de marteler OctoPrint. */
export const MIN_POLL_INTERVAL_SECONDS = 2;

/** Délai d'expiration par défaut d'une requête OctoPrint, en millisecondes. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
