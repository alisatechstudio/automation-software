import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow health check, cron endpoint, and emergency reset without basic authentication
  if (
    req.path === '/health' ||
    req.path === '/healthz' ||
    req.path === '/api/cron' ||
    req.path.startsWith('/api/cron/') ||
    req.path === '/reset-server' ||
    req.path === '/reset-server.php' ||
    req.path === '/api/reset-server'
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="News Automation Admin"');
    res.status(401).send('Authentication required');
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
    res.status(401).send('Invalid authorization format');
    return;
  }

  const credentials = Buffer.from(parts[1], 'base64').toString('utf8');
  const [username, ...passwordParts] = credentials.split(':');
  const password = passwordParts.join(':');

  const expectedUsername = (config.ADMIN_USERNAME || 'Admin').toLowerCase();
  const incomingUsername = (username || '').toLowerCase();

  // Validate username and password
  if (
    incomingUsername === expectedUsername &&
    password === config.ADMIN_PASSWORD
  ) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="News Automation Admin"');
  res.status(401).send('Invalid credentials');
}

