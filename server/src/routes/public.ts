import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.post('/lead', async (req: Request, res: Response) => {
  try {
    const {
      name, email, phone, contactPhone,
      serviceInterest, city, budget, receiptImage,
      source, notes,
    } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      contactPhone?: string;
      serviceInterest?: string;
      city?: string;
      budget?: string;
      receiptImage?: string;
      source?: string;
      notes?: string;
    };

    if (!name) {
      res.status(400).json({ error: 'El nombre es requerido' });
      return;
    }

    const allowedSources = ['whatsapp', 'web', 'ig_ads', 'otro'];
    const finalSource = allowedSources.includes(source || '') ? source! : 'whatsapp';

    const lead = await prisma.lead.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        contactPhone: contactPhone || null,
        serviceInterest: serviceInterest || null,
        city: city || null,
        budget: budget || null,
        receiptImage: receiptImage || null,
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
