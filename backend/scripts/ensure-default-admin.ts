import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const name = process.env.DEFAULT_ADMIN_NAME || 'Administrador';
  const department = process.env.DEFAULT_ADMIN_DEPARTMENT || 'TI';

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: UserRole.ADMIN,
      department,
      passwordHash,
    },
    create: {
      name,
      email,
      role: UserRole.ADMIN,
      department,
      passwordHash,
    },
  });

  console.log(
    `✅ Admin garantido: ${user.email} (senha padrão atual: ${password})`
  );
}

main()
  .catch((error) => {
    console.error('❌ Falha ao garantir admin padrão:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
