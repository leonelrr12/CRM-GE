import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import ExcelJS from 'exceljs';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { resolveCompany } from '../middleware/company';
import { scopedWhere } from '../lib/scoping';

const router = Router();

router.use(authenticateToken, resolveCompany);

router.get('/excel', async (req: AuthRequest, res: Response) => {
  try {
    const leads = await prisma.lead.findMany({
      where: scopedWhere(req),
      orderBy: { createdAt: 'desc' },
      include: {
        activities: { orderBy: { createdAt: 'desc' } },
        company: { select: { name: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leads CRM-GE');

    sheet.columns = [
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Teléfono', key: 'phone', width: 18 },
      { header: 'Fuente', key: 'source', width: 15 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Notas', key: 'notes', width: 40 },
      { header: 'Actividades', key: 'activities', width: 50 },
      { header: 'Empresa', key: 'company', width: 25 },
      { header: 'Fecha creación', key: 'createdAt', width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    leads.forEach((lead) => {
      sheet.addRow({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source,
        status: lead.status,
        notes: lead.notes || '',
        activities: lead.activities.map((a) => `[${a.type}] ${a.description}`).join(' | '),
        company: lead.company?.name || '',
        createdAt: lead.createdAt.toISOString().split('T')[0],
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=leads-crmge-${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Error al exportar' });
  }
});

router.get('/csv', async (req: AuthRequest, res: Response) => {
  try {
    const leads = await prisma.lead.findMany({
      where: scopedWhere(req),
      orderBy: { createdAt: 'desc' },
      include: {
        activities: { orderBy: { createdAt: 'desc' } },
        company: { select: { name: true } },
      },
    });

    const headers = ['Nombre', 'Email', 'Teléfono', 'Fuente', 'Estado', 'Notas', 'Actividades', 'Empresa', 'Fecha creación'];
    const rows = leads.map((lead) => [
      lead.name,
      lead.email || '',
      lead.phone || '',
      lead.source,
      lead.status,
      (lead.notes || '').replace(/,/g, ';'),
      lead.activities.map((a) => `[${a.type}] ${a.description}`).join(' | ').replace(/,/g, ';'),
      lead.company?.name || '',
      lead.createdAt.toISOString().split('T')[0],
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=leads-crmge-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Error al exportar' });
  }
});

export default router;
