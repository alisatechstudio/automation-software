import { config } from './config/env.js';
import { initMongoDb, closeDatabase } from './db/index.js';
import { createServer } from './server/app.js';
import { PipelineCoordinator } from './services/pipeline/coordinator.js';

async function bootstrap() {
  console.log('====================================================');
  console.log('🚀 NEWS-TO-FACEBOOK AUTOMATION PLATFORM STARTING');
  console.log(`🌍 Environment: ${config.NODE_ENV} | Port: ${config.PORT}`);
  console.log(`🍃 Database: ${config.DB_TYPE === 'mysql' ? `MySQL (${config.MYSQL_DATABASE} @ ${config.MYSQL_HOST}:${config.MYSQL_PORT})` : 'MongoDB'}`);
  console.log(`🛡️  Dry Run Mode: ${config.DRY_RUN ? 'ENABLED (Safe Simulated Publishing)' : 'DISABLED (Live Graph API)'}`);
  console.log(`⏱️  Poll Interval: "${config.POLL_INTERVAL_CRON}"`);
  console.log('====================================================');

  // 1. Start HTTP server FIRST so cPanel/Passenger & healthchecks get an instant response
  const app = createServer();
  const port = process.env.PORT || config.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`✓ [Server] Admin Dashboard listening on port/socket: ${port}`);
    console.log(`✓ [Server] Health check available at /health`);
  });

  server.on('error', (err: any) => {
    console.error(`[Server] Critical HTTP server error: ${err.message || err}`);
  });

  // 2. Connect to MongoDB asynchronously (non-blocking for HTTP server)
  initMongoDb().catch((err) => {
    console.warn('[Bootstrap] Initial MongoDB connection attempt failed:', err.message);
  });

  // 3. Start Pipeline Coordinator (Scheduler + Worker)
  const coordinator = new PipelineCoordinator();
  await coordinator.start();

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Received ${signal}. Gracefully shutting down...`);
    coordinator.stop();
    server.close(async () => {
      console.log('[Shutdown] HTTP server closed.');
      await closeDatabase();
      console.log('[Shutdown] MongoDB connection closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err);
  // Do NOT process.exit(1) on cPanel / Passenger, otherwise Passenger kills the process with 503
});
