import { PrismaClient } from './src/lib/prisma';

const prisma = new PrismaClient();

async function main() {
  const userId = '6a22711e-d639-4268-9ab1-b8e528644a8a';
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: 'admin' }
  });
  console.log('Usuario actualizado:', updatedUser);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
