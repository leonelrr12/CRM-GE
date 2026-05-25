import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const totalLeads = await prisma.lead.count();

    const bySource = await prisma.lead.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    const byStatus = await prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const cerrados = byStatus.find((s) => s.status === 'cerrado')?._count?.id || 0;
    const perdidos = byStatus.find((s) => s.status === 'perdido')?._count?.id || 0;
    const conversionRate = totalLeads > 0 ? ((cerrados / (totalLeads - perdidos)) * 100).toFixed(1) : '0';

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const newThisWeek = await prisma.lead.count({
      where: { createdAt: { gte: oneWeekAgo } },
    });

    const lastWeekAgo = new Date();
    lastWeekAgo.setDate(lastWeekAgo.getDate() - 14);

    const newLastWeek = await prisma.lead.count({
      where: {
        createdAt: { gte: lastWeekAgo, lt: oneWeekAgo },
      },
    });

    const recentLeads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, source: true, status: true, createdAt: true },
    });

    res.json({
      totalLeads,
      bySource: bySource.map((s) => ({ source: s.source, count: s._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      conversionRate: Number(conversionRate),
      newThisWeek,
      growthPercent: newLastWeek > 0 ? (((newThisWeek - newLastWeek) / newLastWeek) * 100).toFixed(1) : '0',
      recentLeads,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
