import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';

// Bloquea al rol de solo lectura (viewer) en rutas mutantes.
// Mismo patrón de lazy-lookup que requireAdmin: reutiliza userRole si
// resolveCompany ya corrió.
export async function requireCanEdit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.userRole === undefined) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true, companyId: true },
      });

      if (!user) {
        res.status(401).json({ error: 'Usuario no encontrado' });
        return;
      }

      req.userRole = user.role;
      req.companyId = user.companyId;
    }

    if (req.userRole === 'viewer') {
      res.status(403).json({ error: 'Acceso denegado: rol de solo lectura' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error de autorización' });
  }
}
