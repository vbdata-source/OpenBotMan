/**
 * API Key Authentication Middleware
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Create API key authentication middleware
 */
export function createAuthMiddleware(apiKeys: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip auth for health check
    if (req.path === '/health' || req.path === '/') {
      next();
      return;
    }
    
    // Get API key from header
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];
    
    let providedKey: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7);
    } else if (typeof apiKeyHeader === 'string') {
      providedKey = apiKeyHeader;
    }
    
    // Check if key is valid
    if (!providedKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required. Use Authorization: Bearer <key> or X-API-Key header.',
      });
      return;
    }
    
    if (!apiKeys.includes(providedKey)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid API key.',
      });
      return;
    }
    
    // Add key info to request for logging
    (req as any).apiKeyId = providedKey.slice(0, 8) + '...';
    
    next();
  };
}
