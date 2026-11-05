import { config } from './config/env.js';
import { runMigrations } from './db/migrator.js';
import { createServer } from './server/app.js';
import { PipelineCoordinator } from './services/pipeline/coordinator.js';
import { closeDatabase } from './db/index.js';

async function bootstrap() {
  console.log('====================================================');
  console.log('🚀 NEWS-TO-FACEBOOK AUTOMATION PLATFORM STARTING');
  console.log(`🌍 Environment: ${config.NODE_ENV} | Port: ${config.PORT}`);
  console.log(`🛡️  Dry Run Mode: ${config.DRY_RUN ? 'ENABLED (Safe Simulated Publishing)' : 'DISABLED (Live Graph API)'}`);
  console.log(`⏱️  Poll Interval: "${config.POLL_INTERVAL_CRON}"`);
  console.log(`📦 Database: ${config.DATABASE_PATH}`);
  console.log('====================================================');

  // 1. Run migrations
  console.log('[Bootstrap] Checking and applying database migrations...');
  runMigrations();

  // 2. Start HTTP server (Admin UI + API + Health)
  const app = createServer();
  const server = app.listen(config.PORT, () => {
    console.log(`✓ [Server] Admin Dashboard listening at http://localhost:${config.PORT}`);
    console.log(`✓ [Server] Health check available at http://localhost:${config.PORT}/health`);
  });

  // 3. Start Pipeline Coordinator (Scheduler + Worker)
  const coordinator = new PipelineCoordinator();
  await coordinator.start();

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Received ${signal}. Gracefully shutting down...`);
    coordinator.stop();
    server.close(() => {
      console.log('[Shutdown] HTTP server closed.');
      closeDatabase();
      console.log('[Shutdown] Database connection closed.');
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

