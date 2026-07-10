import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@crmge.com' },
    update: {},
    create: {
      name: 'Admin CRM',
      email: 'admin@crmge.com',
      password,
      role: 'admin',
    },
  });

  const leads = [
    { name: 'Carlos Mendoza', email: 'carlos@email.com', phone: '555-1001', source: 'web', status: 'nuevo', notes: 'Interesado en plan premium' },
    { name: 'María García', email: 'maria@email.com', phone: '555-1002', source: 'ig_ads', status: 'contactado', notes: 'Llamar el lunes' },
    { name: 'Juan Pérez', email: 'juan@email.com', phone: '555-1003', source: 'web', status: 'calificado', notes: 'Presupuesto aprobado' },
    { name: 'Ana López', email: 'ana@email.com', phone: '555-1004', source: 'ig_ads', status: 'enviar_propuesta', notes: 'Propuesta enviada el viernes' },
    { name: 'Pedro Ramírez', email: 'pedro@email.com', phone: '555-1005', source: 'web', status: 'negociacion', notes: 'Ajustando detalles del contrato' },
    { name: 'Laura Díaz', email: 'laura@email.com', phone: '555-1006', source: 'ig_ads', status: 'cerrado', notes: 'Contrato firmado' },
    { name: 'Roberto Torres', email: 'roberto@email.com', phone: '555-1007', source: 'web', status: 'perdido', notes: 'Se fue con competencia' },
    { name: 'Sofía Herrera', email: 'sofia@email.com', phone: '555-1008', source: 'ig_ads', status: 'nuevo', notes: '' },
  ];

  for (const leadData of leads) {
    const existing = await prisma.lead.findFirst({ where: { email: leadData.email } });
    if (!existing) {
      await prisma.lead.create({ data: leadData });
    }
  }

  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
