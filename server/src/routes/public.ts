import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// El sitio web (estático) no porta secretos: el correo de confirmación
// se envía a través de este proxy, que llama al mailer con la key del .env.
// Se leen en cada request (no al cargar el módulo) para no depender del
// orden de inicialización de dotenv.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// No need for auth on public endpoint

const SLUG_REGEX = /^[a-z0-9-]{2,60}$/;

router.get('/test', (req: Request, res: Response) => {
  res.send('test');
});

// Envío de correo de confirmación desde los formularios del sitio web.
// Proxy al mailer interno: la key vive en el .env del server, nunca en el cliente.
router.post('/send-mail', async (req: Request, res: Response) => {
  try {
    const MAILER_URL = process.env.MAILER_URL || 'http://localhost:3004';
    const MAILER_API_KEY = process.env.MAILER_API_KEY || '';
    const { slug, to, subject, html, text } = req.body as {
      slug?: string;
      to?: string;
      subject?: string;
      html?: string;
      text?: string;
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

    if (typeof to !== 'string' || !EMAIL_REGEX.test(to)) {
      res.status(400).json({ error: 'Email de destino inválido' });
      return;
    }

    if (!subject || (!html && !text)) {
      res.status(400).json({ error: 'Faltan campos requeridos (subject, text/html)' });
      return;
    }

    const mailerRes = await fetch(`${MAILER_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MAILER_API_KEY}`,
      },
      body: JSON.stringify({ to, subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });

    if (!mailerRes.ok) {
      console.error('Mailer rechazó el correo:', mailerRes.status);
      res.status(502).json({ error: 'Error al enviar el correo' });
      return;
    }

    res.json(await mailerRes.json());
  } catch (error) {
    console.error('Error al enviar correo vía proxy:', error);
    res.status(502).json({ error: 'Error al enviar el correo' });
  }
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
