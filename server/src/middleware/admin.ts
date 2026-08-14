import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    // Reutiliza los datos si resolveCompany ya corrió antes (evita lookup duplicado)
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

    if (req.userRole !== 'admin') {
      res.status(403).json({ error: 'Acceso denegado: se requieren permisos de administrador' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error de autorización' });
  }
}
