import defaultApp from '../src/server/app.js';

function handler(req: any, res: any) {
  return defaultApp(req, res);
}

export default handler;

// CommonJS compatibility so require('api/index') is callable as a function
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.default = handler;
}
