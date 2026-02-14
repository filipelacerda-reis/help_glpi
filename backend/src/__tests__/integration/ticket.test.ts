import request from 'supertest';
import { resetDatabase, closeDatabase } from '../helpers/reset-db';
import { createTestApp } from '../helpers/test-app';
import prisma from '../../lib/prisma';
import { UserRole, TicketStatus, TicketPriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  // Configurar NODE_ENV como test
  process.env.NODE_ENV = 'test';
  
  // Criar app de teste
  app = createTestApp();
  
  // Limpar banco antes de todos os testes
  try {
    await resetDatabase();
  } catch (error) {
    // Ignorar erro se já estiver limpo
  }
});

afterAll(async () => {
  await resetDatabase();
  await closeDatabase();
});

describe('Fluxo Crítico de Tickets - Testes de Integração', () => {
  let requesterToken: string;
  let requesterId: string;
  let technicianToken: string;
  let technicianId: string;
  let teamId: string;
  let ticketId: string;

  const setupBaseData = async () => {
    // Criar usuários de teste
    const hashedPassword = await bcrypt.hash('password123', 10);

    const requester = await prisma.user.create({
      data: {
        name: 'Requester Test',
        email: 'requester@test.com',
        passwordHash: hashedPassword,
        role: UserRole.REQUESTER,
      },
    });
    requesterId = requester.id;

    const technician = await prisma.user.create({
      data: {
        name: 'Technician Test',
        email: 'technician@test.com',
        passwordHash: hashedPassword,
        role: UserRole.TECHNICIAN,
      },
    });
    technicianId = technician.id;

    // Criar time
    const team = await prisma.team.create({
      data: {
        name: 'Test Team',
        description: 'Time de teste',
        users: {
          create: {
            userId: technician.id,
            role: 'MEMBER',
          },
        },
      },
    });
    teamId = team.id;

    // Fazer login e obter tokens
    const requesterLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'requester@test.com',
        password: 'password123',
      });
    requesterToken = requesterLoginRes.body.accessToken;

    const technicianLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'technician@test.com',
        password: 'password123',
      });
    technicianToken = technicianLoginRes.body.accessToken;
  };

  beforeEach(async () => {
    await resetDatabase();
    await setupBaseData();
  });

  describe('POST /api/tickets - Criar Ticket', () => {
    it('deve criar um ticket com sucesso', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          title: 'Ticket de Teste',
          description: 'Descrição do ticket de teste para validação',
          teamId: teamId,
          priority: TicketPriority.MEDIUM,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Ticket de Teste');
      expect(response.body.requesterId).toBe(requesterId);
      expect(response.body.status).toBe(TicketStatus.OPEN);
      
      ticketId = response.body.id;
    });

    it('deve falhar ao criar ticket sem autenticação', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .send({
          title: 'Ticket sem Auth',
          description: 'Descrição',
          teamId: teamId,
        });

      expect(response.status).toBe(401);
    });

    it('deve falhar ao criar ticket com dados inválidos', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          title: 'AB', // Muito curto
          description: 'Desc', // Muito curto
          teamId: teamId,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/tickets/:id - Atualizar Ticket', () => {
    beforeEach(async () => {
      // Criar ticket antes de cada teste de atualização
      const ticket = await prisma.ticket.create({
        data: {
          title: 'Ticket para Atualizar',
          description: 'Descrição inicial',
          requesterId: requesterId,
          teamId: teamId,
          status: TicketStatus.OPEN,
          priority: TicketPriority.MEDIUM,
        },
      });
      ticketId = ticket.id;
    });

    it('deve atualizar ticket com usuário autorizado', async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          status: TicketStatus.IN_PROGRESS,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('deve falhar ao atualizar ticket com usuário sem permissão', async () => {
      // Criar outro requester sem acesso ao ticket
      const hashedPassword = await bcrypt.hash('password123', 10);
      const otherRequester = await prisma.user.create({
        data: {
          name: 'Other Requester',
          email: 'other@test.com',
          passwordHash: hashedPassword,
          role: UserRole.REQUESTER,
        },
      });

      const otherLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@test.com',
          password: 'password123',
        });
      const otherToken = otherLoginRes.body.accessToken;

      const response = await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          status: TicketStatus.RESOLVED,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/tickets/:id/comments - Adicionar Comentário', () => {
    beforeEach(async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: 'Ticket para Comentar',
          description: 'Descrição',
          requesterId: requesterId,
          teamId: teamId,
          status: TicketStatus.OPEN,
          priority: TicketPriority.MEDIUM,
        },
      });
      ticketId = ticket.id;
    });

    it('deve adicionar comentário público com sucesso', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          content: 'Este é um comentário de teste',
          type: 'PUBLIC',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('Este é um comentário de teste');
      expect(response.body.type).toBe('PUBLIC');
    });

    it('deve adicionar comentário interno com técnico', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          content: 'Comentário interno do técnico',
          type: 'INTERNAL',
        });

      expect(response.status).toBe(201);
      expect(response.body.type).toBe('INTERNAL');
    });

    it('deve falhar ao adicionar comentário sem conteúdo', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          content: '',
          type: 'PUBLIC',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/tickets - Listar Tickets', () => {
    beforeEach(async () => {
      // Criar alguns tickets
      await prisma.ticket.createMany({
        data: [
          {
            title: 'Ticket 1',
            description: 'Descrição 1',
            requesterId: requesterId,
            teamId: teamId,
            status: TicketStatus.OPEN,
            priority: TicketPriority.HIGH,
          },
          {
            title: 'Ticket 2',
            description: 'Descrição 2',
            requesterId: requesterId,
            teamId: teamId,
            status: TicketStatus.IN_PROGRESS,
            priority: TicketPriority.MEDIUM,
          },
        ],
      });
    });

    it('deve listar tickets do usuário autenticado', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('deve filtrar tickets por status', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${requesterToken}`)
        .query({ status: TicketStatus.OPEN });

      expect(response.status).toBe(200);
      expect(response.body.every((t: any) => t.status === TicketStatus.OPEN)).toBe(true);
    });
  });
});
