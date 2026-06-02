import type { API } from 'homebridge';

import { OctoPrintMatterStatusPlatform } from './platform';
import { PLATFORM_NAME } from './settings';

export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, OctoPrintMatterStatusPlatform);
};
