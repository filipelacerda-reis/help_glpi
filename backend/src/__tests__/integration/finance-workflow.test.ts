import request from 'supertest';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../../lib/prisma';
import { resetDatabase, closeDatabase } from '../helpers/reset-db';
import { createTestApp } from '../helpers/test-app';

let app: ReturnType<typeof createTestApp>;

describe('Finance workflow integration', () => {
  let adminToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = createTestApp();
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();

    const passwordHash = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        name: 'Admin Finance',
        email: 'admin.finance@test.com',
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'admin.finance@test.com',
      password: 'password123',
    });

    adminToken = login.body.accessToken;
  });

  it('runs PR -> approval -> PO -> approval -> invoice -> approval', async () => {
    const costCenterRes = await request(app)
      .post('/api/procurement/cost-centers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'CC-TEST-001', name: 'Centro de Custo Teste' });

    expect(costCenterRes.status).toBe(201);

    const vendorRes = await request(app)
      .post('/api/procurement/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fornecedor Teste', taxId: '10.000.000/0001-10' });

    expect(vendorRes.status).toBe(201);

    const prRes = await request(app)
      .post('/api/procurement/purchase-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `pr-${Date.now()}`)
      .send({
        costCenterId: costCenterRes.body.id,
        description: 'Compra de notebook para novo colaborador',
        items: [{ description: 'Notebook', qty: 1, unitPrice: 4500 }],
      });

    expect(prRes.status).toBe(201);
    expect(prRes.body.status).toBe('SUBMITTED');

    const prApproveRes = await request(app)
      .post(`/api/procurement/purchase-requests/${prRes.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE', notes: 'Aprovado no teste de integração' });

    expect(prApproveRes.status).toBe(200);

    const prDb = await prisma.purchaseRequest.findUnique({ where: { id: prRes.body.id } });
    expect(prDb?.status).toBe('APPROVED');

    const poRes = await request(app)
      .post('/api/procurement/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `po-${Date.now()}`)
      .send({ prId: prRes.body.id, vendorId: vendorRes.body.id });

    expect(poRes.status).toBe(201);
    expect(poRes.body.status).toBe('DRAFT');

    const poApproveRes = await request(app)
      .post(`/api/procurement/purchase-orders/${poRes.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE' });

    expect(poApproveRes.status).toBe(200);

    const poDb = await prisma.purchaseOrder.findUnique({ where: { id: poRes.body.id } });
    expect(poDb?.status).toBe('APPROVED');

    const invoiceRes = await request(app)
      .post('/api/procurement/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `inv-${Date.now()}`)
      .send({
        poId: poRes.body.id,
        vendorId: vendorRes.body.id,
        number: `INV-${Date.now()}`,
        issueDate: new Date().toISOString().slice(0, 10),
        totalAmount: 4500,
      });

    expect(invoiceRes.status).toBe(201);
    expect(invoiceRes.body.status).toBe('REGISTERED');

    const invApproveRes = await request(app)
      .post(`/api/procurement/invoices/${invoiceRes.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE' });

    expect(invApproveRes.status).toBe(200);

    const invoiceDb = await prisma.invoice.findUnique({ where: { id: invoiceRes.body.id } });
    expect(invoiceDb?.status).toBe('APPROVED');
  });

  it('keeps purchase request idempotent when Idempotency-Key is repeated', async () => {
    const cc = await prisma.costCenter.create({
      data: { code: 'CC-IDEMP-001', name: 'CC Idempotency' },
    });

    const key = `idem-pr-${Date.now()}`;

    const first = await request(app)
      .post('/api/procurement/purchase-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({
        costCenterId: cc.id,
        description: 'PR idempotente',
        items: [{ description: 'Mouse', qty: 2, unitPrice: 100 }],
      });

    const second = await request(app)
      .post('/api/procurement/purchase-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({
        costCenterId: cc.id,
        description: 'PR idempotente',
        items: [{ description: 'Mouse', qty: 2, unitPrice: 100 }],
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
  });
});
