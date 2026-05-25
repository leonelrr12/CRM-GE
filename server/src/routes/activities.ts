import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/lead/:leadId', async (req: AuthRequest, res: Response) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { leadId: req.params.leadId as string },
      orderBy: { createdAt: 'desc' },
    });

    res.json(activities);
  } catch (error) {
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

    const activity = await prisma.activity.create({
      data: {
        leadId: req.params.leadId as string,
        type,
        description,
      },
    });

    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear actividad' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.activity.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Actividad eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar actividad' });
  }
});

export default router;
