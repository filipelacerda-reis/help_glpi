import request from 'supertest';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../../lib/prisma';
import { resetDatabase, closeDatabase } from '../helpers/reset-db';
import { createTestApp } from '../helpers/test-app';

let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = createTestApp();
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await closeDatabase();
});

describe('Asset management integration', () => {
  let adminToken: string;
  let teamId: string;
  let employeeId: string;
  let equipmentId: string;
  let assignmentId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        name: 'Admin Asset',
        email: 'admin.asset@test.com',
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'admin.asset@test.com',
      password: 'password123',
    });
    adminToken = loginRes.body.accessToken;

    const team = await prisma.team.create({
      data: {
        name: 'People Ops',
        description: 'Time para cadastro de funcionários',
      },
    });
    teamId = team.id;
  });

  it('creates employee', async () => {
    const response = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Maria Silva',
        cpf: '123.456.789-00',
        roleTitle: 'Analista de Marketing',
        teamId,
        hireDate: '2026-02-10',
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Maria Silva');
    expect(response.body.cpf).toBe('12345678900');
    employeeId = response.body.id;
  });

  it('creates equipment', async () => {
    const response = await request(app)
      .post('/api/equipments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoiceNumber: 'NF-2026-0001',
        purchaseDate: '2026-02-01',
        equipmentType: 'NOTEBOOK',
        assetTag: 'PAT-0001',
        value: 5500.9,
        serialNumber: 'SN-1234',
        brand: 'Dell',
        model: 'Latitude',
        condition: 'NEW',
      });

    expect(response.status).toBe(201);
    expect(response.body.assetTag).toBe('PAT-0001');
    equipmentId = response.body.id;
  });

  it('assigns equipment to employee', async () => {
    const response = await request(app)
      .post(`/api/equipments/${equipmentId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId,
        deliveryCondition: 'NEW',
        deliveryTermNumber: 'TERM-001',
      });

    expect(response.status).toBe(201);
    expect(response.body.employeeId).toBe(employeeId);
    expect(response.body.equipmentId).toBe(equipmentId);
    assignmentId = response.body.id;
  });

  it('gets asset dashboard', async () => {
    const response = await request(app)
      .get('/api/equipments/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.totalEquipments).toBeGreaterThanOrEqual(1);
    expect(response.body.assignedCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(response.body.byType)).toBe(true);
  });

  it('downloads employee active equipments PDF', async () => {
    const response = await request(app)
      .get(`/api/employees/${employeeId}/equipments.pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body).toBeTruthy();
  });

  it('downloads assignment delivery term PDF', async () => {
    const response = await request(app)
      .get(`/api/equipments/assignments/${assignmentId}/term.pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body).toBeTruthy();
  });

  it('gets warranty and overdue alerts', async () => {
    const now = new Date();
    const warrantyDate = new Date(now);
    warrantyDate.setDate(warrantyDate.getDate() + 5);
    const overdueDate = new Date(now);
    overdueDate.setDate(overdueDate.getDate() - 2);

    const equipment2 = await request(app)
      .post('/api/equipments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoiceNumber: 'NF-2026-0002',
        purchaseDate: '2026-02-02',
        equipmentType: 'MOUSE',
        assetTag: 'PAT-0002',
        value: 120,
        condition: 'NEW',
        warrantyEndDate: warrantyDate.toISOString().slice(0, 10),
      });
    expect(equipment2.status).toBe(201);

    const assignment2 = await request(app)
      .post(`/api/equipments/${equipment2.body.id}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId,
        expectedReturnAt: overdueDate.toISOString(),
        deliveryCondition: 'NEW',
        deliveryTermNumber: 'TERM-002',
      });
    expect(assignment2.status).toBe(201);

    const alertsResponse = await request(app)
      .get('/api/equipments/alerts?days=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(alertsResponse.status).toBe(200);
    expect(alertsResponse.body.warrantyExpiring.length).toBeGreaterThanOrEqual(1);
    expect(alertsResponse.body.overdueReturns.length).toBeGreaterThanOrEqual(1);
  });

  it('returns equipment', async () => {
    const response = await request(app)
      .post(`/api/equipments/assignments/${assignmentId}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnCondition: 'GOOD',
        finalStatus: 'IN_STOCK',
        notes: 'Devolução no desligamento',
      });

    expect(response.status).toBe(200);
    expect(response.body.returnedAt).toBeTruthy();
    expect(response.body.returnCondition).toBe('GOOD');
  });
});
