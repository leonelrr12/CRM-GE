import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';

// Resuelve el rol y la empresa del usuario desde la DB en cada request
// (mismo patrón que requireAdmin). El JWT solo lleva userId; así los
// cambios de empresa/rol se reflejan al instante sin invalidar tokens.
export async function resolveCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

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
  next();
}
