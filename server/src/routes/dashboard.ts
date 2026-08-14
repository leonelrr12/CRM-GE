import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { resolveCompany } from '../middleware/company';
import { scopedWhere } from '../lib/scoping';

const router = Router();

router.use(authenticateToken, resolveCompany);

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const where = scopedWhere(req);

    const totalLeads = await prisma.lead.count({ where });

    const bySource = await prisma.lead.groupBy({
      by: ['source'],
      where,
      _count: { id: true },
    });

    const byStatus = await prisma.lead.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const cerrados = byStatus.find((s) => s.status === 'cerrado')?._count?.id || 0;
    const perdidos = byStatus.find((s) => s.status === 'perdido')?._count?.id || 0;
    const conversionRate = totalLeads > 0 ? ((cerrados / (totalLeads - perdidos)) * 100).toFixed(1) : '0';

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const newToday = await prisma.lead.count({
      where: { ...where, createdAt: { gte: startOfToday } },
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const newThisWeek = await prisma.lead.count({
      where: { ...where, createdAt: { gte: oneWeekAgo } },
    });

    const lastWeekAgo = new Date();
    lastWeekAgo.setDate(lastWeekAgo.getDate() - 14);

    const newLastWeek = await prisma.lead.count({
      where: {
        ...where,
        createdAt: { gte: lastWeekAgo, lt: oneWeekAgo },
      },
    });

    const recentLeads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, source: true, status: true, createdAt: true },
    });

    // Distribución por empresa (útil para el admin global; un user de empresa
    // solo ve su propia compañía por el scoping).
    const byCompanyRaw = await prisma.lead.groupBy({
      by: ['companyId'],
      where,
      _count: { id: true },
    });
    const companyIds = byCompanyRaw.map((r) => r.companyId).filter((id): id is string => Boolean(id));
    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });
    const companyNames = new Map(companies.map((c) => [c.id, c.name]));
    const byCompany = byCompanyRaw.map((r) => ({
      companyId: r.companyId,
      name: companyNames.get(r.companyId ?? '') ?? 'Sin empresa',
      count: r._count.id,
    }));

    res.json({
      totalLeads,
      bySource: bySource.map((s) => ({ source: s.source, count: s._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      conversionRate: Number(conversionRate),
      newThisWeek,
      newToday,
      byCompany,
      growthPercent: newLastWeek > 0 ? (((newThisWeek - newLastWeek) / newLastWeek) * 100).toFixed(1) : '0',
      recentLeads,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
