import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

const LEAD_STATUSES = ['nuevo', 'contactado', 'negociacion', 'cerrado', 'perdido'] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { source, status, search } = req.query;

    const where: Prisma.LeadWhereInput = {};

    if (source && source !== 'todas') {
      where.source = source as string;
    }
    if (status && status !== 'todas') {
      where.status = status as string;
    }
    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { activities: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });

    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id as string },
      include: { activities: { orderBy: { createdAt: 'desc' } } },
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead no encontrado' });
      return;
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, source, status, notes } = req.body;

    if (!name) {
      res.status(400).json({ error: 'El nombre es requerido' });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        source: source || 'web',
        status: status || 'nuevo',
        notes: notes || null,
      },
      include: { activities: true },
    });

    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, source, status, notes } = req.body;

    const lead = await prisma.lead.update({
      where: { id: req.params.id as string },
      data: {
        ...(name !== undefined && { name: name as string }),
        ...(email !== undefined && { email: email as string }),
        ...(phone !== undefined && { phone: phone as string }),
        ...(source !== undefined && { source: source as string }),
        ...(status !== undefined && { status: status as LeadStatus }),
        ...(notes !== undefined && { notes: notes as string }),
      },
      include: { activities: true },
    });

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar lead' });
  }
});

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;

    if (!LEAD_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Estado no válido' });
      return;
    }

    const lead = await prisma.lead.update({
      where: { id: req.params.id as string },
      data: { status: status as LeadStatus },
    });

    if (status === 'contactado') {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: 'nota',
          description: 'Lead marcado como contactado (cambio automático)',
        },
      });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Lead eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

export default router;
