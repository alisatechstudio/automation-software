import { createServer } from '../src/server/app.js';
import { loadConfig } from '../src/config/index.js';
import { DbRepository } from '../src/db/repository.js';
import { ApprovalManager } from '../src/approval/manager.js';
import { SportsClipPipeline } from '../src/scheduler/pipeline.js';

let appInstance: any = null;

function getApp() {
  if (!appInstance) {
    const config = loadConfig();
    const repo = new DbRepository();
    const approvalManager = new ApprovalManager(repo);
    const pipeline = new SportsClipPipeline(repo, config);
    appInstance = createServer({ repo, approvalManager, pipeline, config });
  }
  return appInstance;
}

export default function handler(req: any, res: any) {
  const app = getApp();
  return app(req, res);
}
