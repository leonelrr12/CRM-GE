import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('usuario123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@crmge.com' },
    update: {},
    create: {
      name: 'Admin CRM',
      email: 'admin@crmge.com',
      password: adminPassword,
      role: 'admin',
    },
  });

  // Empresas demo
  const green = await prisma.company.upsert({
    where: { slug: 'green-energy-technologie' },
    update: {},
    create: { name: 'Green Energy Technologie', slug: 'green-energy-technologie' },
  });

  const ecosolar = await prisma.company.upsert({
    where: { slug: 'ecosolar-panama' },
    update: {},
    create: { name: 'EcoSolar Panamá', slug: 'ecosolar-panama' },
  });

  // Usuarios con empresa
  await prisma.user.upsert({
    where: { email: 'usuario1@green.com' },
    update: {},
    create: {
      name: 'Usuario Green',
      email: 'usuario1@green.com',
      password: userPassword,
      role: 'user',
      companyId: green.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'usuario2@ecosolar.com' },
    update: {},
    create: {
      name: 'Usuario EcoSolar',
      email: 'usuario2@ecosolar.com',
      password: userPassword,
      role: 'user',
      companyId: ecosolar.id,
    },
  });

  const leads = [
    // Empresa Green Energy Technologie
    { name: 'Carlos Mendoza', email: 'carlos@email.com', phone: '555-1001', source: 'web', status: 'nuevo', notes: 'Interesado en plan premium', companyId: green.id },
    { name: 'Juan Pérez', email: 'juan@email.com', phone: '555-1003', source: 'web', status: 'calificado', notes: 'Presupuesto aprobado', companyId: green.id },
    { name: 'Pedro Ramírez', email: 'pedro@email.com', phone: '555-1005', source: 'web', status: 'negociacion', notes: 'Ajustando detalles del contrato', companyId: green.id },
    { name: 'Roberto Torres', email: 'roberto@email.com', phone: '555-1007', source: 'web', status: 'perdido', notes: 'Se fue con competencia', companyId: green.id },
    // Empresa EcoSolar Panamá
    { name: 'María García', email: 'maria@email.com', phone: '555-1002', source: 'ig_ads', status: 'contactado', notes: 'Llamar el lunes', companyId: ecosolar.id },
    { name: 'Ana López', email: 'ana@email.com', phone: '555-1004', source: 'ig_ads', status: 'enviar_propuesta', notes: 'Propuesta enviada el viernes', companyId: ecosolar.id },
    { name: 'Laura Díaz', email: 'laura@email.com', phone: '555-1006', source: 'ig_ads', status: 'cerrado', notes: 'Contrato firmado', companyId: ecosolar.id },
    { name: 'Sofía Herrera', email: 'sofia@email.com', phone: '555-1008', source: 'ig_ads', status: 'nuevo', notes: '', companyId: ecosolar.id },
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
