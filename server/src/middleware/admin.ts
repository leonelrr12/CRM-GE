import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Acceso denegado: se requieren permisos de administrador' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error de autorización' });
  }
}
