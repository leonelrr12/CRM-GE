import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticateToken);

const ACTIVITY_TYPES = ['llamada', 'email', 'reunion', 'nota'] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

router.get('/lead/:leadId', async (req: AuthRequest, res: Response) => {
  try {
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

router.post('/lead/:leadId', async (req: AuthRequest, res: Response) => {
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

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.activity.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Actividad eliminada' });
  } catch (error) {
    console.error('Error al eliminar actividad:', error);
    res.status(500).json({ error: 'Error al eliminar actividad' });
  }
});

export default router;
