import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// No need for auth on public endpoint

const SLUG_REGEX = /^[a-z0-9-]{2,60}$/;

router.get('/test', (req: Request, res: Response) => {
  res.send('test');
});

// Datos públicos de una empresa para el formulario de captación
router.get('/company/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;

    if (!SLUG_REGEX.test(slug)) {
      res.status(400).json({ error: 'Empresa no válida' });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!company) {
      res.status(404).json({ error: 'Empresa no encontrada' });
      return;
    }

    res.json(company);
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

router.post('/lead', async (req: Request, res: Response) => {
  try {
    const {
      slug, name, email, phone, contactPhone,
      serviceInterest, city, budget, receiptImage,
      source, notes,
    } = req.body as {
      slug?: string;
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

    if (!slug || typeof slug !== 'string' || !SLUG_REGEX.test(slug)) {
      res.status(400).json({ error: 'Empresa no válida' });
      return;
    }

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) {
      res.status(404).json({ error: 'Empresa no encontrada' });
      return;
    }

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
        companyId: company.id,
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
