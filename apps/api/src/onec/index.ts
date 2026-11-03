import { resolve } from 'node:path';
import type { Config } from '../config';
import { HttpServiceAdapter } from './http-adapter';
import { MockAdapter } from './mock-adapter';
import { ODataAdapter, loadODataMapping } from './odata-adapter';
import type { OneCAdapter } from './types';

export function createOneCAdapter(cfg: Config): OneCAdapter {
  const http = {
    baseUrl: cfg.ONEC_BASE_URL,
    user: cfg.ONEC_USER,
    password: cfg.ONEC_PASSWORD,
    timeoutMs: cfg.ONEC_TIMEOUT_MS,
  };
  switch (cfg.ONEC_MODE) {
    case 'odata':
      return new ODataAdapter(http, loadODataMapping(resolve(process.cwd(), cfg.ONEC_ODATA_MAPPING)));
    case 'http':
      return new HttpServiceAdapter(http);
    default:
      return new MockAdapter();
  }
}

export * from './types';
