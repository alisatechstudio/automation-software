import { createServer } from '../src/server/app.js';
import { loadConfig } from '../src/config/index.js';
import { DbRepository } from '../src/db/repository.js';
import { ApprovalManager } from '../src/approval/manager.js';
import { SportsClipPipeline } from '../src/scheduler/pipeline.js';

const config = loadConfig();
const repo = new DbRepository();
const approvalManager = new ApprovalManager(repo);
const pipeline = new SportsClipPipeline(repo, config);
const app = createServer({ repo, approvalManager, pipeline, config });

export default app;
