import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireAdmin, requireUserManager } from '../middleware/admin';
import { resolveCompany } from '../middleware/company';
import { slugify, SLUG_REGEX } from '../lib/slugify';
import { EVENT_TYPES, EventType } from '../lib/events';
import { validateRuleBody } from '../lib/rules';
import prisma from '../lib/prisma';

const router = Router();

router.use(authenticateToken);
router.use(resolveCompany);

const ROLES = ['admin', 'company_admin', 'user', 'viewer'] as const;
type Role = (typeof ROLES)[number];

const COMPANY_SELECT = { id: true, name: true, slug: true, primaryColor: true, logoUrl: true } as const;

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// Valida rol + empresa antes de crear/editar un usuario, y autoriza al actor:
// el admin global asigna cualquier rol; el company_admin solo roles user/viewer
// dentro de SU empresa (sin companyId en el body se fuerza la suya).
// Admins globales no tienen empresa.
async function validateRoleAndCompany(
  body: { role?: string; companyId?: string },
  actor: AuthRequest,
): Promise<{ ok: true; role: Role; companyId: string | null } | { ok: false; error: string; status: number }> {
  const role = (body.role || 'user') as Role;

  if (!ROLES.includes(role)) {
    return { ok: false, error: 'Rol no válido', status: 400 };
  }

  if (actor.userRole === 'company_admin') {
    if (role === 'admin' || role === 'company_admin') {
      return { ok: false, error: `No puedes asignar el rol ${role}`, status: 403 };
    }
    if (body.companyId && body.companyId !== actor.companyId) {
      return { ok: false, error: 'Solo puedes gestionar usuarios de tu empresa', status: 403 };
    }
    return { ok: true, role, companyId: actor.companyId ?? null };
  }

  if (actor.userRole !== 'admin') {
    return { ok: false, error: 'Acceso denegado: se requieren permisos de administrador', status: 403 };
  }

  if (role === 'admin') {
    if (body.companyId) {
      return { ok: false, error: 'Un admin global no puede tener empresa', status: 400 };
    }
    return { ok: true, role, companyId: null };
  }

  if (!body.companyId) {
    return { ok: false, error: 'El usuario debe tener una empresa asignada', status: 400 };
  }

  const company = await prisma.company.findUnique({ where: { id: body.companyId } });
  if (!company) {
    return { ok: false, error: 'Empresa no encontrada', status: 400 };
  }

  return { ok: true, role, companyId: company.id };
}

// ── Usuarios ────────────────────────────────────────────────────────────────

router.get('/users', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      // company_admin solo ve los usuarios de su empresa
      where: req.userRole === 'company_admin' ? { companyId: req.companyId } : undefined,
      select: {
        id: true, name: true, email: true, role: true, companyId: true, createdAt: true, updatedAt: true,
        company: { select: COMPANY_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/users', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
      return;
    }

    const validated = await validateRoleAndCompany(req.body, req);
    if (!validated.ok) {
      res.status(validated.status).json({ error: validated.error });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'El email ya está registrado' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name, email, password: hashedPassword,
        role: validated.role, companyId: validated.companyId,
      },
      select: {
        id: true, name: true, email: true, role: true, companyId: true, createdAt: true,
        company: { select: COMPANY_SELECT },
      },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put('/users/:id', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const id = req.params.id as string;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Reglas de target para company_admin (corren SIEMPRE, antes del update:
    // el PUT escribe role/companyId con los valores previos si el body no los trae)
    if (req.userRole === 'company_admin') {
      if (existingUser.companyId !== req.companyId) {
        // 404 y no 403: no revelar usuarios de otras empresas
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }
      if (existingUser.role === 'admin' || existingUser.role === 'company_admin') {
        res.status(403).json({ error: 'No puedes gestionar este usuario' });
        return;
      }
      if (id === req.userId && req.body.role !== undefined && req.body.role !== existingUser.role) {
        res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
        return;
      }
    }

    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        res.status(400).json({ error: 'El email ya está registrado' });
        return;
      }
    }

    let role = existingUser.role;
    let companyId = existingUser.companyId;
    if (req.body.role !== undefined || req.body.companyId !== undefined) {
      const validated = await validateRoleAndCompany(req.body, req);
      if (!validated.ok) {
        res.status(validated.status).json({ error: validated.error });
        return;
      }
      role = validated.role;
      companyId = validated.companyId;
    }

    const data: Record<string, string | null> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    data.role = role;
    data.companyId = companyId;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, role: true, companyId: true, updatedAt: true,
        company: { select: COMPANY_SELECT },
      },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.delete('/users/:id', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    if (id === req.userId) {
      res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
      return;
    }

    if (req.userRole === 'company_admin') {
      if (user.companyId !== req.companyId) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }
      if (user.role === 'admin' || user.role === 'company_admin') {
        res.status(403).json({ error: 'No puedes gestionar este usuario' });
        return;
      }
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// ── Empresas ────────────────────────────────────────────────────────────────

router.get('/companies', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { leads: true, users: true } } },
    });

    res.json(companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      primaryColor: c.primaryColor,
      logoUrl: c.logoUrl,
      createdAt: c.createdAt,
      leadCount: c._count.leads,
      userCount: c._count.users,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

router.post('/companies', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, primaryColor, logoUrl } = req.body as {
      name?: string;
      slug?: string;
      primaryColor?: string;
      logoUrl?: string;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre es requerido' });
      return;
    }

    let finalPrimaryColor: string | null = null;
    if (primaryColor !== undefined && primaryColor !== null && typeof primaryColor === 'string' && primaryColor.trim()) {
      if (!HEX_COLOR_REGEX.test(primaryColor.trim())) {
        res.status(400).json({ error: 'Color inválido (formato #RRGGBB)' });
        return;
      }
      finalPrimaryColor = primaryColor.trim();
    }

    let finalLogoUrl: string | null = null;
    if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim()) {
      finalLogoUrl = logoUrl.trim().slice(0, 500);
    }

    let finalSlug: string;
    if (slug && typeof slug === 'string' && slug.trim()) {
      finalSlug = slug.trim();
      if (!SLUG_REGEX.test(finalSlug)) {
        res.status(400).json({ error: 'Slug inválido (minúsculas, guiones, máx 60)' });
        return;
      }
      const taken = await prisma.company.findUnique({ where: { slug: finalSlug } });
      if (taken) {
        res.status(400).json({ error: 'El slug ya está en uso' });
        return;
      }
    } else {
      // Slug auto-generado; si colisiona, probar con sufijo numérico
      const base = slugify(name);
      finalSlug = base;
      let suffix = 2;
      while (await prisma.company.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${base}-${suffix}`;
        suffix++;
      }
    }

    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        primaryColor: finalPrimaryColor,
        logoUrl: finalLogoUrl,
      },
    });

    res.status(201).json({
      id: company.id,
      name: company.name,
      slug: company.slug,
      primaryColor: company.primaryColor,
      logoUrl: company.logoUrl,
      createdAt: company.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear empresa' });
  }
});

router.put('/companies/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, slug, primaryColor, logoUrl } = req.body as {
      name?: string;
      slug?: string;
      primaryColor?: string;
      logoUrl?: string;
    };

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Empresa no encontrada' });
      return;
    }

    const data: Record<string, string | null> = {};
    if (name !== undefined && typeof name === 'string' && name.trim()) {
      data.name = name.trim();
    }
    if (slug !== undefined && typeof slug === 'string' && slug.trim()) {
      if (!SLUG_REGEX.test(slug.trim())) {
        res.status(400).json({ error: 'Slug inválido (minúsculas, guiones, máx 60)' });
        return;
      }
      const taken = await prisma.company.findUnique({ where: { slug: slug.trim() } });
      if (taken && taken.id !== id) {
        res.status(400).json({ error: 'El slug ya está en uso' });
        return;
      }
      data.slug = slug.trim();
    }
    if (primaryColor !== undefined && primaryColor !== null) {
      if (typeof primaryColor !== 'string' || !primaryColor.trim()) {
        data.primaryColor = null;
      } else {
        const color = primaryColor.trim();
        if (!HEX_COLOR_REGEX.test(color)) {
          res.status(400).json({ error: 'Color inválido (formato #RRGGBB)' });
          return;
        }
        data.primaryColor = color;
      }
    }
    if (logoUrl !== undefined && logoUrl !== null) {
      if (typeof logoUrl !== 'string' || !logoUrl.trim()) {
        data.logoUrl = null;
      } else {
        data.logoUrl = logoUrl.trim().slice(0, 500);
      }
    }

    const company = await prisma.company.update({ where: { id }, data });
    res.json({
      id: company.id,
      name: company.name,
      slug: company.slug,
      primaryColor: company.primaryColor,
      logoUrl: company.logoUrl,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar empresa' });
  }
});

router.delete('/companies/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      res.status(404).json({ error: 'Empresa no encontrada' });
      return;
    }

    const counts = await prisma.company.findUnique({
      where: { id },
      include: { _count: { select: { leads: true, users: true } } },
    });
    if (counts && (counts._count.leads > 0 || counts._count.users > 0)) {
      res.status(400).json({ error: 'No se puede eliminar una empresa con leads o usuarios' });
      return;
    }

    await prisma.company.delete({ where: { id } });
    res.json({ message: 'Empresa eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar empresa' });
  }
});

// ── Webhooks ────────────────────────────────────────────────────────────────

// https siempre; http solo para localhost/127.0.0.1 (permite E2E local)
function webhookUrlOk(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function webhookWithoutSecret(wh: { id: string; url: string; events: string[]; active: boolean; companyId: string | null; createdAt: Date; company?: { id: string; name: string } | null }): Record<string, unknown> {
  return {
    id: wh.id,
    url: wh.url,
    events: wh.events,
    active: wh.active,
    companyId: wh.companyId,
    createdAt: wh.createdAt,
    company: wh.company ?? null,
  };
}

// Valida url + events del body; devuelve { ok } o { error, status }.
function validateWebhookBody(body: { url?: unknown; events?: unknown }): { ok: true; url: string; events: EventType[] } | { ok: false; error: string; status: number } {
  if (typeof body.url !== 'string' || !body.url.trim() || !webhookUrlOk(body.url.trim())) {
    return { ok: false, error: 'URL inválida (https requerido; http solo localhost)', status: 400 };
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return { ok: false, error: 'Debes seleccionar al menos un evento', status: 400 };
  }
  if (!body.events.every((e) => typeof e === 'string' && (EVENT_TYPES as readonly string[]).includes(e))) {
    return { ok: false, error: 'Evento no válido', status: 400 };
  }
  return { ok: true, url: body.url.trim(), events: body.events as EventType[] };
}

// Para company_admin: el webhook debe ser de SU empresa (404 = no revelar ajenos)
async function webhookTargetCheck(req: AuthRequest, webhook: { companyId: string | null }): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (req.userRole === 'company_admin' && webhook.companyId !== req.companyId) {
    return { ok: false, status: 404, error: 'Webhook no encontrado' };
  }
  return { ok: true };
}

router.get('/webhooks', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.query;
    const where: { companyId?: string | null } | undefined =
      req.userRole === 'company_admin'
        ? { companyId: req.companyId }
        : typeof companyId === 'string' && companyId
          ? { companyId }
          : undefined;

    const webhooks = await prisma.webhook.findMany({
      where,
      include: { company: { select: COMPANY_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(webhooks.map(webhookWithoutSecret));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener webhooks' });
  }
});

router.post('/webhooks', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateWebhookBody(req.body ?? {});
    if (!validated.ok) {
      res.status(validated.status).json({ error: validated.error });
      return;
    }

    let companyId: string | null = null;
    if (req.userRole === 'company_admin') {
      if (req.body.companyId && req.body.companyId !== req.companyId) {
        res.status(403).json({ error: 'Solo puedes configurar webhooks de tu empresa' });
        return;
      }
      companyId = req.companyId ?? null;
    } else {
      const bodyCompanyId = req.body.companyId as string | undefined;
      if (bodyCompanyId) {
        const company = await prisma.company.findUnique({ where: { id: bodyCompanyId } });
        if (!company) {
          res.status(400).json({ error: 'Empresa no encontrada' });
          return;
        }
        companyId = company.id;
      }
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const webhook = await prisma.webhook.create({
      data: {
        url: validated.url,
        secret,
        events: validated.events,
        active: req.body.active === false ? false : true,
        companyId,
      },
      include: { company: { select: COMPANY_SELECT } },
    });

    // El secret se devuelve UNA sola vez (aquí y en regenerate-secret)
    res.status(201).json({ ...webhookWithoutSecret(webhook), secret });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear webhook' });
  }
});

router.put('/webhooks/:id', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Webhook no encontrado' });
      return;
    }
    const target = await webhookTargetCheck(req, existing);
    if (!target.ok) {
      res.status(target.status!).json({ error: target.error });
      return;
    }

    const validated = validateWebhookBody(req.body ?? {});
    if (!validated.ok) {
      res.status(validated.status).json({ error: validated.error });
      return;
    }

    const data: { url: string; events: EventType[]; active: boolean; companyId?: string | null } = {
      url: validated.url,
      events: validated.events,
      active: req.body.active === false ? false : true,
    };
    // company_admin no puede mover su webhook a otra empresa; admin sí puede
    if (req.userRole === 'admin' && req.body.companyId !== undefined) {
      const bodyCompanyId = req.body.companyId as string | null;
      if (bodyCompanyId) {
        const company = await prisma.company.findUnique({ where: { id: bodyCompanyId } });
        if (!company) {
          res.status(400).json({ error: 'Empresa no encontrada' });
          return;
        }
        data.companyId = company.id;
      } else {
        data.companyId = null;
      }
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data,
      include: { company: { select: COMPANY_SELECT } },
    });
    res.json(webhookWithoutSecret(webhook));
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar webhook' });
  }
});

router.delete('/webhooks/:id', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Webhook no encontrado' });
      return;
    }
    const target = await webhookTargetCheck(req, existing);
    if (!target.ok) {
      res.status(target.status!).json({ error: target.error });
      return;
    }

    await prisma.webhook.delete({ where: { id } });
    res.json({ message: 'Webhook eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar webhook' });
  }
});

router.post('/webhooks/:id/regenerate-secret', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Webhook no encontrado' });
      return;
    }
    const target = await webhookTargetCheck(req, existing);
    if (!target.ok) {
      res.status(target.status!).json({ error: target.error });
      return;
    }

    const secret = crypto.randomBytes(32).toString('hex');
    await prisma.webhook.update({ where: { id }, data: { secret } });
    res.json({ id, secret });
  } catch (error) {
    res.status(500).json({ error: 'Error al regenerar secret' });
  }
});

// ── Reglas (automatización IF/THEN) ─────────────────────────────────────────

// Para company_admin: la regla debe ser de SU empresa (404 = no revelar ajenas)
async function ruleTargetCheck(req: AuthRequest, rule: { companyId: string }): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (req.userRole === 'company_admin' && rule.companyId !== req.companyId) {
    return { ok: false, status: 404, error: 'Regla no encontrada' };
  }
  return { ok: true };
}

// Resuelve la empresa de la regla según el actor (requerida siempre)
async function resolveRuleCompany(req: AuthRequest, bodyCompanyId: unknown): Promise<{ ok: true; companyId: string } | { ok: false; error: string; status: number }> {
  if (req.userRole === 'company_admin') {
    if (bodyCompanyId && bodyCompanyId !== req.companyId) {
      return { ok: false, error: 'Solo puedes configurar reglas de tu empresa', status: 403 };
    }
    return { ok: true, companyId: req.companyId ?? '' };
  }
  if (typeof bodyCompanyId !== 'string' || !bodyCompanyId) {
    return { ok: false, error: 'La empresa es requerida', status: 400 };
  }
  const company = await prisma.company.findUnique({ where: { id: bodyCompanyId } });
  if (!company) {
    return { ok: false, error: 'Empresa no encontrada', status: 400 };
  }
  return { ok: true, companyId: company.id };
}

router.get('/rules', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.query;
    const where: { companyId?: string } =
      req.userRole === 'company_admin'
        ? { companyId: req.companyId ?? '' }
        : typeof companyId === 'string' && companyId
          ? { companyId }
          : {};

    const rules = await prisma.rule.findMany({
      where,
      include: { company: { select: COMPANY_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener reglas' });
  }
});

router.post('/rules', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateRuleBody(req.body ?? {});
    if (!validated.ok) {
      res.status(validated.status).json({ error: validated.error });
      return;
    }

    const company = await resolveRuleCompany(req, req.body.companyId);
    if (!company.ok) {
      res.status(company.status).json({ error: company.error });
      return;
    }

    const rule = await prisma.rule.create({
      data: {
        name: validated.data.name,
        active: validated.data.active,
        trigger: validated.data.trigger,
        conditions: validated.data.conditions as unknown as object,
        actions: validated.data.actions as unknown as object,
        companyId: company.companyId,
      },
      include: { company: { select: COMPANY_SELECT } },
    });
    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear regla' });
  }
});

router.put('/rules/:id', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Regla no encontrada' });
      return;
    }
    const target = await ruleTargetCheck(req, existing);
    if (!target.ok) {
      res.status(target.status!).json({ error: target.error });
      return;
    }

    const validated = validateRuleBody(req.body ?? {});
    if (!validated.ok) {
      res.status(validated.status).json({ error: validated.error });
      return;
    }

    let companyId = existing.companyId;
    if (req.userRole === 'admin' && req.body.companyId !== undefined) {
      const company = await resolveRuleCompany(req, req.body.companyId);
      if (!company.ok) {
        res.status(company.status).json({ error: company.error });
        return;
      }
      companyId = company.companyId;
    }

    const rule = await prisma.rule.update({
      where: { id },
      data: {
        name: validated.data.name,
        active: validated.data.active,
        trigger: validated.data.trigger,
        conditions: validated.data.conditions as unknown as object,
        actions: validated.data.actions as unknown as object,
        companyId,
      },
      include: { company: { select: COMPANY_SELECT } },
    });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar regla' });
  }
});

router.delete('/rules/:id', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Regla no encontrada' });
      return;
    }
    const target = await ruleTargetCheck(req, existing);
    if (!target.ok) {
      res.status(target.status!).json({ error: target.error });
      return;
    }

    await prisma.rule.delete({ where: { id } });
    res.json({ message: 'Regla eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar regla' });
  }
});

router.post('/rules/:id/toggle', requireUserManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Regla no encontrada' });
      return;
    }
    const target = await ruleTargetCheck(req, existing);
    if (!target.ok) {
      res.status(target.status!).json({ error: target.error });
      return;
    }

    const rule = await prisma.rule.update({
      where: { id },
      data: { active: !existing.active },
      include: { company: { select: COMPANY_SELECT } },
    });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar regla' });
  }
});

export default router;
