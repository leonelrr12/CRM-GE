import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { resolveCompany } from '../middleware/company';
import { requireCanEdit } from '../middleware/canEdit';
import { scopedWhere } from '../lib/scoping';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticateToken, resolveCompany);

const ACTIVITY_TYPES = ['llamada', 'email', 'reunion', 'nota'] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

router.get('/lead/:leadId', async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.leadId as string, ...scopedWhere(req) },
      select: { id: true },
    });
    if (!lead) {
      res.status(404).json({ error: 'Lead no encontrado' });
      return;
    }

    const activities = await prisma.activity.findMany({
      where: { leadId: req.params.leadId as string },
      orderBy: { createdAt: 'desc' },
    });

    res.json(activities);
  } catch (error) {
    console.error('Error al obtener actividades:', error);
    res.status(500).json({ error: 'Error al obtener actividades' });
  }
});

router.post('/lead/:leadId', requireCanEdit, async (req: AuthRequest, res: Response) => {
  try {
    const { type, description } = req.body;

    if (!type || !description) {
      res.status(400).json({ error: 'Tipo y descripción son requeridos' });
      return;
    }

    if (!ACTIVITY_TYPES.includes(type as ActivityType)) {
      res.status(400).json({ error: 'Tipo de actividad no válido' });
      return;
    }

    if (typeof description !== 'string' || description.trim() === '') {
      res.status(400).json({ error: 'Descripción debe ser un texto no vacío' });
      return;
    }

    const lead = await prisma.lead.findFirst({
      where: { id: req.params.leadId as string, ...scopedWhere(req) },
      select: { id: true },
    });
    if (!lead) {
      res.status(404).json({ error: 'Lead no encontrado' });
      return;
    }

    const activity = await prisma.activity.create({
      data: {
        leadId: req.params.leadId as string,
        type: type as ActivityType,
        description: description.trim(),
      },
    });

    res.status(201).json(activity);
  } catch (error) {
    console.error('Error al crear actividad:', error);
    res.status(500).json({ error: 'Error al crear actividad' });
  }
});

router.delete('/:id', requireCanEdit, async (req: AuthRequest, res: Response) => {
  try {
    const activity = await prisma.activity.findFirst({
      where: { id: req.params.id as string, lead: scopedWhere(req) },
      select: { id: true },
    });
    if (!activity) {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    await prisma.activity.delete({ where: { id: activity.id } });
    res.json({ message: 'Actividad eliminada' });
  } catch (error) {
    console.error('Error al eliminar actividad:', error);
    res.status(500).json({ error: 'Error al eliminar actividad' });
  }
});

export default router;
