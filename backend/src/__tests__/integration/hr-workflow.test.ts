import { UserRole } from '@prisma/client';
import prisma from '../../lib/prisma';
import { initializeQueues, closeQueues } from '../../lib/queue';
import { hrOperationsService } from '../../domains/hr/services/hrOperations.service';
import { hashPassword } from '../../utils/password';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('hr workflow', () => {
  beforeAll(async () => {
    await initializeQueues();
    await import('../../workers/hr.workflow.worker');
  });

  afterAll(async () => {
    await closeQueues();
  });

  it('deve criar offboarding com tarefas e ticket ITSM via workflow', async () => {
    const suffix = Date.now().toString();

    const admin = await prisma.user.create({
      data: {
        name: 'Admin HR Test',
        email: `admin-hr-${suffix}@example.com`,
        passwordHash: await hashPassword('123456'),
        role: UserRole.ADMIN,
      },
    });

    const team = await prisma.team.create({
      data: {
        name: `Suporte Teste ${suffix}`,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        name: `Employee ${suffix}`,
        cpf: `5${suffix.slice(-10)}`,
        roleTitle: 'Analista',
        active: true,
      },
    });

    const equipment = await prisma.equipment.create({
      data: {
        invoiceNumber: `NF-${suffix}`,
        purchaseDate: new Date(),
        equipmentType: 'NOTEBOOK',
        assetTag: `AT-${suffix}`,
        value: 5000,
      },
    });

    await prisma.equipmentAssignment.create({
      data: {
        equipmentId: equipment.id,
        employeeId: employee.id,
        assignedAt: new Date(),
        deliveryCondition: 'NEW',
      },
    });

    const offboarding = await hrOperationsService.createOffboardingCase(
      {
        employeeId: employee.id,
        ownerUserId: admin.id,
        terminationDate: new Date(),
        idempotencyKey: `test-offboarding-${suffix}`,
      },
      admin.id
    );

    for (let i = 0; i < 30; i += 1) {
      const details = await hrOperationsService.getCaseDetails('OFFBOARDING', offboarding.id);
      if ((details as any).tasks?.length >= 4 && (details as any).itsmTicketId) {
        expect((details as any).tasks.some((task: any) => String(task.title).includes('Recolher ativo'))).toBe(true);
        expect((details as any).itsmTicketId).toBeTruthy();
        return;
      }
      await wait(200);
    }

    throw new Error('Workflow offboarding não concluiu no tempo esperado');
  });
});
