import { InputPipelineService } from './pipeline/input-pipeline.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { config } from './config/env.js';

async function runCli() {
  console.log('===============================================================');
  console.log('   ⚡ Input Automation CLI: Source -> Reel -> Google Drive     ');
  console.log('===============================================================');

  try {
    await initDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME).catch((err) => {
      console.warn('MongoDB connection note (continuing in standalone mode):', err.message);
    });

    const pipeline = new InputPipelineService();
    const result = await pipeline.runInputCron({ force: true, limit: 1 });

    console.log('\n📊 Result:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Fatal CLI Error:', err);
  } finally {
    await closeDatabase().catch(() => {});
    process.exit(0);
  }
}

runCli();
