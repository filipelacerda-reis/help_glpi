import request from 'supertest';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../../lib/prisma';
import { resetDatabase, closeDatabase } from '../helpers/reset-db';
import { createTestApp } from '../helpers/test-app';

let app: ReturnType<typeof createTestApp>;

describe('Stock and delivery flow integration', () => {
  let adminToken: string;
  let employeeId: string;
  let equipmentId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();

    const passwordHash = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        name: 'Admin Stock',
        email: 'admin.stock@test.com',
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'admin.stock@test.com',
      password: 'password123',
    });
    adminToken = login.body.accessToken;

    const team = await prisma.team.create({ data: { name: 'Logistica TI' } });
    const employee = await prisma.employee.create({
      data: {
        name: 'Colaborador Teste',
        cpf: `9${Date.now().toString().slice(-10)}`,
        roleTitle: 'Analista',
        teamId: team.id,
      },
    });
    employeeId = employee.id;

    const equipment = await prisma.equipment.create({
      data: {
        invoiceNumber: 'NF-STOCK-001',
        purchaseDate: new Date(),
        equipmentType: 'NOTEBOOK',
        assetTag: `PAT-ST-${Date.now()}`,
        value: 5500,
      },
    });
    equipmentId = equipment.id;
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDatabase();
  });

  it('creates OUT movement and delivery on assignment, then IN movement on return', async () => {
    const assign = await request(app)
      .post(`/api/equipments/${equipmentId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId,
        createDelivery: true,
        deliveryCourier: 'Logistica Interna',
        deliveryTracking: 'TRK-001',
      });

    expect(assign.status).toBe(201);

    const deliveriesRes = await request(app)
      .get('/api/equipments/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ employeeId });

    expect(deliveriesRes.status).toBe(200);
    expect(deliveriesRes.body.length).toBe(1);
    expect(deliveriesRes.body[0].status).toBe('SCHEDULED');
    expect(deliveriesRes.body[0].items.length).toBe(1);

    const movementsAfterAssign = await request(app)
      .get('/api/equipments/stock-movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ equipmentId });

    expect(movementsAfterAssign.status).toBe(200);
    expect(movementsAfterAssign.body.some((m: any) => m.type === 'OUT')).toBe(true);

    const returnRes = await request(app)
      .post(`/api/equipments/assignments/${assign.body.id}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ returnCondition: 'GOOD' });

    expect(returnRes.status).toBe(200);

    const movementsAfterReturn = await request(app)
      .get('/api/equipments/stock-movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ equipmentId });

    expect(movementsAfterReturn.status).toBe(200);
    expect(movementsAfterReturn.body.some((m: any) => m.type === 'IN')).toBe(true);

    const deliveryAfterReturn = await prisma.delivery.findFirst({
      where: { assignmentId: assign.body.id },
    });
    expect(deliveryAfterReturn?.status).toBe('RETURNED');
  });
});
