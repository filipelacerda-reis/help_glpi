import { Router } from 'express';
import { teamController } from '../controllers/team.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Rotas para Times
// Leitura pública (para seleção em formulários) - qualquer usuário autenticado pode ver
router.get('/', authenticate, teamController.getAllTeams);
router.get('/:id', authenticate, teamController.getTeamById);

// Mutações apenas para ADMIN
router.post('/', authenticate, authorize(UserRole.ADMIN), teamController.createTeam);
router.patch('/:id', authenticate, authorize(UserRole.ADMIN), teamController.updateTeam);
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), teamController.deleteTeam);

// Rotas para Membros de Time (apenas ADMIN)
router.post('/:id/members', authenticate, authorize(UserRole.ADMIN), teamController.addMember);
router.patch('/:id/members/:userId', authenticate, authorize(UserRole.ADMIN), teamController.updateMemberRole);
router.delete('/:id/members/:userId', authenticate, authorize(UserRole.ADMIN), teamController.removeMember);

// Rota pública para verificar se usuário é membro de um time (autenticado)
router.get('/:id/members/check', authenticate, teamController.checkUserMembership);

// Rota para obter times onde o usuário é líder
router.get('/my/lead-teams', authenticate, teamController.getUserLeadTeams);

// Rotas para vincular categorias e tipos de chamados (apenas ADMIN)
router.post('/:id/categories', authenticate, authorize(UserRole.ADMIN), teamController.addCategoryToTeam);
router.delete('/:id/categories/:categoryId', authenticate, authorize(UserRole.ADMIN), teamController.removeCategoryFromTeam);
router.post('/:id/ticket-types', authenticate, authorize(UserRole.ADMIN), teamController.addTicketTypeToTeam);
router.delete('/:id/ticket-types', authenticate, authorize(UserRole.ADMIN), teamController.removeTicketTypeFromTeam);
router.get('/:id/ticket-types', authenticate, teamController.getTeamTicketTypes);

export { router as teamRoutes };
