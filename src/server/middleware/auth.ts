import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow health check without authentication
  if (req.path === '/health' || req.path === '/healthz') {
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
  const [username, password] = credentials.split(':');

  // Any username accepted, password must match ADMIN_PASSWORD
  if (password === config.ADMIN_PASSWORD) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="News Automation Admin"');
  res.status(401).send('Invalid credentials');
}

