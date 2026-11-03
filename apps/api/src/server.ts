import { loadConfig } from './config';
import { buildApp } from './app';

const cfg = loadConfig();
const { app } = await buildApp({ cfg });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    app.log.info(`${sig}: остановка`);
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: cfg.PORT, host: cfg.HOST });
