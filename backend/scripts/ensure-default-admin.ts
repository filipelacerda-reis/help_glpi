import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const name = process.env.DEFAULT_ADMIN_NAME || 'Administrador';
  const department = process.env.DEFAULT_ADMIN_DEPARTMENT || 'TI';
  const forceResetPassword = process.env.FORCE_RESET_ADMIN_PASSWORD === 'true';

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    const updateData: {
      name: string;
      role: UserRole;
      department: string;
      passwordHash?: string;
    } = {
      name,
      role: UserRole.ADMIN,
      department,
    };

    if (forceResetPassword) {
      updateData.passwordHash = await hashPassword(password);
    }

    const user = await prisma.user.update({
      where: { email },
      data: updateData,
    });

    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Administrador da plataforma' },
    });
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id },
    });

    console.log(
      `✅ Admin validado: ${user.email} (${forceResetPassword ? 'senha resetada' : 'senha preservada'})`
    );
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: UserRole.ADMIN,
      department,
      passwordHash,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Administrador da plataforma' },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });

  console.log(
    `✅ Admin criado: ${user.email} (senha definida por DEFAULT_ADMIN_PASSWORD ou padrão local)`
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
