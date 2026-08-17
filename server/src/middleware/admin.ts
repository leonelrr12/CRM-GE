import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';

// Carga rol/empresa si resolveCompany no corrió antes (evita lookup duplicado).
async function loadUserRole(req: AuthRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!req.userId) {
    return { ok: false, status: 401, error: 'No autenticado' };
  }

  if (req.userRole === undefined) {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, companyId: true },
    });

    if (!user) {
      return { ok: false, status: 401, error: 'Usuario no encontrado' };
    }

    req.userRole = user.role;
    req.companyId = user.companyId;
  }

  return { ok: true };
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const loaded = await loadUserRole(req);
    if (!loaded.ok) {
      res.status(loaded.status).json({ error: loaded.error });
      return;
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

// Permite admin global y admin de empresa (que gestiona solo su propia empresa).
export async function requireUserManager(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const loaded = await loadUserRole(req);
    if (!loaded.ok) {
      res.status(loaded.status).json({ error: loaded.error });
      return;
    }

    if (req.userRole !== 'admin' && req.userRole !== 'company_admin') {
      res.status(403).json({ error: 'Acceso denegado: se requieren permisos de administrador' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error de autorización' });
  }
}
