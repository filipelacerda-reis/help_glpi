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

describe('Admin hardening integration', () => {
  let adminToken: string;
  let requesterToken: string;
  let teamId: string;
  let categoryId: string;
  let ticketId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    await prisma.user.createMany({
      data: [
        {
          name: 'Admin',
          email: 'admin.hardening@test.com',
          passwordHash,
          role: UserRole.ADMIN,
        },
        {
          name: 'Requester',
          email: 'requester.hardening@test.com',
          passwordHash,
          role: UserRole.REQUESTER,
        },
      ],
    });

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin.hardening@test.com',
      password: 'password123',
    });
    adminToken = adminLogin.body.accessToken;

    const requesterLogin = await request(app).post('/api/auth/login').send({
      email: 'requester.hardening@test.com',
      password: 'password123',
    });
    requesterToken = requesterLogin.body.accessToken;

    const team = await prisma.team.create({
      data: { name: 'Hardening Team', description: 'Team' },
    });
    teamId = team.id;

    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin.hardening@test.com' },
    });
    await prisma.userTeam.create({
      data: {
        userId: adminUser!.id,
        teamId,
        role: 'LEAD',
      },
    });

    const category = await prisma.category.create({
      data: { name: 'Hardening Category' },
    });
    categoryId = category.id;
  });

  it('rejects invalid SAML config on settings update', async () => {
    const response = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        saml: {
          enabled: true,
          entryPoint: 'https://idp.example.com/saml',
          issuer: 'glpi',
          callbackUrl: 'https://app.example.com/api/auth/saml/acs',
          allowedDomains: 'example.com',
          cert: '',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Configuração SAML inválida');
  });

  it('blocks assistant when platform setting disables it', async () => {
    const saveResponse = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        platform: {
          ai: {
            assistantEnabled: false,
            dailyLimit: 10,
          },
        },
      });
    expect(saveResponse.status).toBe(200);

    const sessionResponse = await request(app)
      .post('/api/assistant/session')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(sessionResponse.status).toBe(403);
    expect(String(sessionResponse.body.error || '')).toContain('Assistente virtual desabilitado');
  });

  it('blocks requester ticket creation when platform disallows requester create', async () => {
    const settingsResponse = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        platform: {
          ai: {
            assistantEnabled: true,
            dailyLimit: 100,
          },
          ticketing: {
            allowRequesterCreate: false,
            enabledTypes: ['INCIDENT'],
            enabledPriorities: ['LOW', 'MEDIUM', 'HIGH'],
          },
        },
      });
    expect(settingsResponse.status).toBe(200);

    const createResponse = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        title: 'Bloqueio requester',
        description: 'Teste de bloqueio de criação por requester',
        teamId,
        categoryId,
        priority: 'MEDIUM',
        tipo: 'INCIDENT',
      });

    expect(createResponse.status).toBe(403);
    expect(String(createResponse.body.error || '')).toContain('Solicitantes não podem criar tickets');
  });

  it('enforces enabled ticket types and priorities', async () => {
    const createDisallowedType = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Tipo bloqueado',
        description: 'Teste com tipo bloqueado pela administração',
        teamId,
        categoryId,
        priority: 'LOW',
        tipo: 'CHANGE',
      });
    expect(createDisallowedType.status).toBe(400);
    expect(String(createDisallowedType.body.error || '')).toContain('desabilitado');

    const createAllowed = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Tipo permitido',
        description: 'Teste com tipo permitido pela administração',
        teamId,
        categoryId,
        priority: 'LOW',
        tipo: 'INCIDENT',
      });
    expect(createAllowed.status).toBe(201);
    ticketId = createAllowed.body.id;

    const lockPrioritiesResponse = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        platform: {
          ticketing: {
            allowRequesterCreate: false,
            enabledTypes: ['INCIDENT'],
            enabledPriorities: ['LOW'],
          },
        },
      });
    expect(lockPrioritiesResponse.status).toBe(200);

    const updateDisallowedPriority = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        priority: 'HIGH',
      });
    expect(updateDisallowedPriority.status).toBe(400);
    expect(String(updateDisallowedPriority.body.error || '')).toContain('desabilitada');
  });

  it('supports audit filters and full export endpoint', async () => {
    const samlTest = await request(app)
      .post('/api/admin/settings/saml/test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect([200, 400]).toContain(samlTest.status);

    const auth0Test = await request(app)
      .post('/api/admin/settings/auth0/test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect([200, 400]).toContain(auth0Test.status);

    const listFiltered = await request(app)
      .get('/api/admin/audit')
      .query({ resource: 'SAML', limit: 20 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listFiltered.status).toBe(200);
    expect(Array.isArray(listFiltered.body.data)).toBe(true);
    expect(
      listFiltered.body.data.every((item: any) => item.resource === 'SAML')
    ).toBe(true);

    const exportFiltered = await request(app)
      .get('/api/admin/audit/export')
      .query({ resource: 'SAML' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(exportFiltered.status).toBe(200);
    expect(exportFiltered.headers['content-type']).toContain('application/json');
  });
});
