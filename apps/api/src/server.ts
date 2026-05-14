import { createApp, config } from './app';
import { logger } from './utils/logger';

const app = createApp();

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'API server started');
});
