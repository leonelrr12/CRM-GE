import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

let JWT_SECRET: string;

if (process.env.JWT_SECRET) {
  JWT_SECRET = process.env.JWT_SECRET;
} else {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be defined in environment variables for production');
  }
  // For development, generate a temporary secure key but warn
  console.warn('WARNING: JWT_SECRET not set. Using temporary development key. DO NOT USE IN PRODUCTION!');
  // Generate a random 32-byte hex string for development
  const crypto = require('crypto');
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

export { JWT_SECRET };

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  companyId?: string | null;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    // Differentiate between expired token and invalid token
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expirado' });
      } else {
        res.status(401).json({ error: 'Token inválido' });
      }
    } else {
      res.status(401).json({ error: 'Token inválido' });
    }
  }
}
