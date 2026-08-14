import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { resolveCompany } from '../middleware/company';
import { scopedWhere } from '../lib/scoping';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticateToken, resolveCompany);

const LEAD_STATUSES = ['nuevo', 'contactado', 'calificado', 'enviar_propuesta', 'negociacion', 'cerrado', 'perdido'] as const;
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
      where: scopedWhere(req, where),
      orderBy: { createdAt: 'desc' },
      include: { activities: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });

    res.json(leads);
  } catch (error) {
    console.error('Error al obtener leads:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id as string, ...scopedWhere(req) },
      include: { activities: { orderBy: { createdAt: 'desc' } } },
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead no encontrado' });
      return;
    }

    res.json(lead);
  } catch (error) {
    console.error('Error al obtener lead:', error);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, contactPhone, serviceInterest, city, budget, receiptImage, source, status, notes } = req.body;

    if (!name) {
      res.status(400).json({ error: 'El nombre es requerido' });
      return;
    }

    // Validar email si se proporciona
    if (email && !email.includes('@')) {
      res.status(400).json({ error: 'Email inválido' });
      return;
    }

    // El admin (sin empresa) debe indicar la empresa; el user usa la suya
    let companyId: string | null = req.companyId ?? null;
    if (req.userRole === 'admin') {
      const { companyId: bodyCompanyId } = req.body as { companyId?: string };
      if (!bodyCompanyId) {
        res.status(400).json({ error: 'El campo companyId es requerido' });
        return;
      }
      const company = await prisma.company.findUnique({ where: { id: bodyCompanyId } });
      if (!company) {
        res.status(400).json({ error: 'Empresa no encontrada' });
        return;
      }
      companyId = company.id;
    }

    if (!companyId) {
      res.status(400).json({ error: 'Usuario sin empresa asignada' });
      return;
    }

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
        source: source || 'web',
        status: status || 'nuevo',
        notes: notes || null,
        companyId,
      },
      include: { activities: true },
    });

    res.status(201).json(lead);
  } catch (error) {
    console.error('Error al crear lead:', error);
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, contactPhone, serviceInterest, city, budget, receiptImage, source, status, notes } = req.body;

    // Validar email si se proporciona
    if (email && !email.includes('@')) {
      res.status(400).json({ error: 'Email inválido' });
      return;
    }

    const owned = await prisma.lead.findFirst({
      where: { id: req.params.id as string, ...scopedWhere(req) },
      select: { id: true },
    });
    if (!owned) {
      res.status(404).json({ error: 'Lead no encontrado' });
      return;
    }

    const lead = await prisma.lead.update({
      where: { id: req.params.id as string },
      data: {
        ...(name !== undefined && { name: name as string }),
        ...(email !== undefined && { email: email as string }),
        ...(phone !== undefined && { phone: phone as string }),
        ...(contactPhone !== undefined && { contactPhone: contactPhone as string }),
        ...(serviceInterest !== undefined && { serviceInterest: serviceInterest as string }),
        ...(city !== undefined && { city: city as string }),
        ...(budget !== undefined && { budget: budget as string }),
        ...(receiptImage !== undefined && { receiptImage: receiptImage as string }),
        ...(source !== undefined && { source: source as string }),
        ...(status !== undefined && { status: status as LeadStatus }),
        ...(notes !== undefined && { notes: notes as string }),
      },
      include: { activities: true },
    });

    res.json(lead);
  } catch (error) {
    console.error('Error al actualizar lead:', error);
    res.status(500).json({ error: 'Error al actualizar lead' });
  }
});

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Estado es requerido' });
      return;
    }

    if (!LEAD_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Estado no válido' });
      return;
    }

    const owned = await prisma.lead.findFirst({
      where: { id: req.params.id as string, ...scopedWhere(req) },
      select: { id: true },
    });
    if (!owned) {
      res.status(404).json({ error: 'Lead no encontrado' });
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
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const owned = await prisma.lead.findFirst({
      where: { id: req.params.id as string, ...scopedWhere(req) },
      select: { id: true },
    });
    if (!owned) {
      res.status(404).json({ error: 'Lead no encontrado' });
      return;
    }

    await prisma.lead.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Lead eliminado' });
  } catch (error) {
    console.error('Error al eliminar lead:', error);
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

// Envío de correo al lead desde el CRM. El server llama directo al mailer
// con la key del .env (misma cadena que el proxy público /api/public/send-mail).
router.post('/:id/send-email', async (req: AuthRequest, res: Response) => {
  try {
    const { subject, message } = req.body as { subject?: string; message?: string };

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      res.status(400).json({ error: 'El asunto es requerido' });
      return;
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'El mensaje es requerido' });
      return;
    }
    if (message.length > 4000) {
      res.status(400).json({ error: 'Mensaje demasiado largo (máx 4000)' });
      return;
    }

    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id as string, ...scopedWhere(req) },
    });
    if (!lead) {
      res.status(404).json({ error: 'Lead no encontrado' });
      return;
    }
    if (!lead.email) {
      res.status(400).json({ error: 'El lead no tiene email registrado' });
      return;
    }

    const MAILER_URL = process.env.MAILER_URL || 'http://localhost:3004';
    const MAILER_API_KEY = process.env.MAILER_API_KEY || '';

    // Contenido del usuario escapado antes de ir al HTML del correo.
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const html =
      `<p>Hola <strong>${escapeHtml(lead.name)}</strong>,</p>` +
      `<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`;

    const mailerRes = await fetch(`${MAILER_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MAILER_API_KEY}`,
      },
      body: JSON.stringify({ to: lead.email, subject: subject.trim(), text: message, html }),
      signal: AbortSignal.timeout(10000),
    });

    if (!mailerRes.ok) {
      console.error('Mailer rechazó el correo:', mailerRes.status);
      res.status(502).json({ error: 'Error al enviar el correo' });
      return;
    }

    // Bitácora en el lead
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: 'email',
        description: `Correo enviado: "${subject.trim()}"`,
      },
    });

    res.json({ success: true, message: 'Correo enviado' });
  } catch (error) {
    console.error('Error al enviar correo desde el CRM:', error);
    res.status(502).json({ error: 'Error al enviar el correo' });
  }
});

export default router;
