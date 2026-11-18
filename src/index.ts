import { loadConfig } from './config/index.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { DbRepository } from './db/repository.js';
import { PublisherOrchestrator } from './publishers/index.js';
import { ApprovalManager } from './approval/manager.js';
import { TelegramApprovalBot } from './approval/telegram-bot.js';
import { SportsClipPipeline } from './scheduler/pipeline.js';
import { CopyrightMonitor } from './monitoring/copyright-monitor.js';
import { SchedulerService } from './scheduler/cron.js';
import { createServer } from './server/app.js';
import { logger } from './logger.js';

async function main() {
  logger.info('=====================================================');
  logger.info('   ⚡ SportsClipBot - Monetization Compliance Bot   ');
  logger.info('=====================================================');

  // 1. Load & Validate Configuration
  const loadedConfig = loadConfig();
  const { config, env, isDryRun } = loadedConfig;

  logger.info({ environment: env.NODE_ENV, dryRun: isDryRun }, 'Configuration loaded.');

  // 2. Initialize Database & Repositories (MongoDB)
  const db = await initDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME);
  const repo = new DbRepository(db);

  // 3. Initialize Publishing Engine
  const publisher = new PublisherOrchestrator(loadedConfig, repo);

  // 4. Initialize Approval Manager (Mandatory Human Gate)
  const approvalManager = new ApprovalManager(repo, publisher);

  // 5. Initialize Telegram Bot
  const telegramBot = new TelegramApprovalBot({
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    adminUserId: env.TELEGRAM_ADMIN_USER_ID,
    approvalManager,
  });

  if (config.approval.telegramEnabled && env.TELEGRAM_BOT_TOKEN) {
    await telegramBot.start();
  }

  // 6. Initialize Processing Pipeline
  const pipeline = new SportsClipPipeline(repo, loadedConfig, telegramBot);

  // 7. Initialize Copyright & Strikes Monitor
  const monitor = new CopyrightMonitor(repo, loadedConfig);

  // 8. Initialize Scheduled Cron Jobs
  const scheduler = new SchedulerService(pipeline, monitor);
  scheduler.start();

  // 9. Start Express Dashboard & Control Center
  const app = createServer({
    repo,
    approvalManager,
    pipeline,
    config: loadedConfig,
  });

  const server = app.listen(env.PORT, () => {
    logger.info(`Web Dashboard & Control Center active at: http://localhost:${env.PORT}`);
  });

  // Graceful Shutdown
  const shutdown = async () => {
    logger.info('Shutting down SportsClipBot gracefully...');
    scheduler.stop();
    server.close(async () => {
      await closeDatabase();
      logger.info('All services stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Fatal error during SportsClipBot initialization');
  process.exit(1);
});
