import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { resolveCompany } from '../middleware/company';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticateToken, resolveCompany);

// Admin global ve todas; el resto ve solo las de su empresa (filosofía scoping.ts)
function scopedNotificationsWhere(req: AuthRequest): { companyId?: string } {
  if (req.userRole === 'admin') return {};
  return { companyId: req.companyId ?? '' };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const where = scopedNotificationsWhere(req);

    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);

    res.json({ items, total, unread });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const unread = await prisma.notification.count({
      where: { ...scopedNotificationsWhere(req), readAt: null },
    });
    res.json({ unread });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Marca como leídas: ids específicos (los ajenos al scope son no-op) o todas
router.post('/read', async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    const where = scopedNotificationsWhere(req);

    if (Array.isArray(ids) && ids.length > 0) {
      const update = await prisma.notification.updateMany({
        where: { id: { in: ids }, ...where, readAt: null },
        data: { readAt: new Date() },
      });
      res.json({ success: true, updated: update.count });
      return;
    }

    const update = await prisma.notification.updateMany({
      where: { ...where, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true, updated: update.count });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
});

export default router;
