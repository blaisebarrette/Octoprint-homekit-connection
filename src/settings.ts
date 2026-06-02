/** npm plugin identifier. Must match the "name" field in package.json. */
export const PLUGIN_NAME = 'homebridge-octoprint-matter-status';

/** Platform name as used in config.json and config.schema.json. */
export const PLATFORM_NAME = 'OctoPrintMatterStatus';

/** Default polling interval, in seconds. */
export const DEFAULT_POLL_INTERVAL_SECONDS = 10;

/** Minimum accepted polling interval to avoid hammering OctoPrint. */
export const MIN_POLL_INTERVAL_SECONDS = 2;

/** Default OctoPrint request timeout, in milliseconds. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
