import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

// Fuerza el scoping por empresa en cualquier where de Lead.
// Los admins (globales, sin empresa) no reciben filtro: ven todo.
// '' nunca matchea un UUID: defensivo si un user quedó sin empresa.
export function scopedWhere(req: AuthRequest, where: Prisma.LeadWhereInput = {}): Prisma.LeadWhereInput {
  if (req.userRole === 'admin') return where;
  return { ...where, companyId: req.companyId ?? '' };
}
