import { config } from './config/env.js';
import { initMongoDb, closeDatabase } from './db/index.js';
import { createServer } from './server/app.js';
import { PipelineCoordinator } from './services/pipeline/coordinator.js';

async function bootstrap() {
  console.log('====================================================');
  console.log('🚀 NEWS-TO-FACEBOOK AUTOMATION PLATFORM STARTING');
  console.log(`🌍 Environment: ${config.NODE_ENV} | Port: ${config.PORT}`);
  console.log(`🍃 Database: MongoDB (Vercel Integration)`);
  console.log(`🛡️  Dry Run Mode: ${config.DRY_RUN ? 'ENABLED (Safe Simulated Publishing)' : 'DISABLED (Live Graph API)'}`);
  console.log(`⏱️  Poll Interval: "${config.POLL_INTERVAL_CRON}"`);
  console.log('====================================================');

  // 1. Start HTTP server FIRST so Vercel & healthchecks get an instant response
  const app = createServer();
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`✓ [Server] Admin Dashboard listening at http://0.0.0.0:${config.PORT}`);
    console.log(`✓ [Server] Health check available at http://0.0.0.0:${config.PORT}/health`);
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
  process.exit(1);
});
