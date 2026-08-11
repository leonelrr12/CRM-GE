import prisma from './src/lib/prisma';

async function main() {
  const user = await prisma.user.updateMany({
    where: { email: 'admin2@example.com' },
    data: { role: 'admin' }
  });
  console.log(`Updated ${user.count} user(s)`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
