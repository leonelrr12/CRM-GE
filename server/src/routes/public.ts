import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.post('/lead', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, source, notes } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      source?: string;
      notes?: string;
    };

    if (!name || !email || !phone) {
      res.status(400).json({ error: 'Nombre, email y teléfono son requeridos' });
      return;
    }

    const allowedSources = ['web', 'ig_ads', 'otro'];
    const finalSource = allowedSources.includes(source || '') ? source! : 'web';

    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        phone,
        source: finalSource,
        status: 'nuevo',
        notes: notes || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Gracias por tu interés. Nos pondremos en contacto contigo pronto.',
      lead: { id: lead.id, name: lead.name },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al enviar el formulario' });
  }
});

export default router;
