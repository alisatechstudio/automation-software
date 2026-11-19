import cron from 'node-cron';
import { InputPipelineService } from './pipeline/input-pipeline.js';
import { createInputServer } from './server/app.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { config } from './config/env.js';
import { logger } from './logger.js';

async function main() {
  logger.info('================================================================');
  logger.info('   ⚡ 1. Input Automation (Source -> Reel -> Google Drive)       ');
  logger.info('================================================================');

  try {
    await initDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
    logger.info('Connected to MongoDB database.');
  } catch (dbErr: any) {
    logger.warn({ err: dbErr.message }, 'MongoDB not connected, running with fallback defaults.');
  }

  const pipeline = new InputPipelineService();
  const app = createInputServer(pipeline);

  const server = app.listen(config.PORT, () => {
    logger.info(`Input Automation Server running on http://localhost:${config.PORT}`);
    logger.info(`Webhook trigger endpoint: http://localhost:${config.PORT}/api/cron/input`);
  });

  let cronTask: any = null;
  if (config.CRON_ENABLED) {
    logger.info(`Starting internal cron job with schedule: "${config.CRON_SCHEDULE}"`);
    cronTask = cron.schedule(config.CRON_SCHEDULE, async () => {
      logger.info('[InputScheduler] ⏰ Cron trigger activated. Running Input Automation...');
      try {
        await pipeline.runInputCron();
      } catch (err: any) {
        logger.error({ err: err.message }, '[InputScheduler] Error during scheduled run');
      }
    });
  } else {
    logger.info('Internal cron scheduler disabled. Use external webhook (/api/cron/input).');
  }

  const shutdown = async () => {
    logger.info('Shutting down Input Automation cleanly...');
    if (cronTask) cronTask.stop();
    server.close(async () => {
      await closeDatabase().catch(() => {});
      logger.info('Input Automation stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Fatal Input Automation startup crash');
  process.exit(1);
});
