import { Request, Response, NextFunction } from 'express';
import { teamService } from '../services/team.service';
import { z } from 'zod';
import { TeamRole, TicketType } from '@prisma/client';

const createTeamSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  description: z.string().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  ticketTypes: z.array(z.string()).optional(), // Aceitar strings e converter depois
});

const updateTeamSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  ticketTypes: z.array(z.string()).optional(), // Aceitar strings e converter depois
});

const addMemberSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  role: z.nativeEnum(TeamRole).optional(),
});

const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(TeamRole),
});

export const teamController = {
  async createTeam(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('Body recebido:', JSON.stringify(req.body, null, 2)); // Debug
      const data = createTeamSchema.parse(req.body);
      console.log('Dados validados:', JSON.stringify(data, null, 2)); // Debug
      const team = await teamService.createTeam(data);
      res.status(201).json(team);
    } catch (error: any) {
      console.error('Erro no controller createTeam:', error); // Debug
      next(error);
    }
  },

  async getAllTeams(req: Request, res: Response, next: NextFunction) {
    try {
      const includeMembers = req.query.includeMembers === 'true';
      const teams = await teamService.getAllTeams(includeMembers);
      
      // Debug detalhado
      if (teams.length > 0) {
        const firstTeam = teams[0];
        console.log('=== DEBUG GET ALL TEAMS ===');
        console.log('Primeiro time ID:', firstTeam.id);
        console.log('Primeiro time nome:', firstTeam.name);
        console.log('Categories existe?', !!firstTeam.categories);
        console.log('Categories length:', firstTeam.categories?.length || 0);
        console.log('Categories:', JSON.stringify(firstTeam.categories, null, 2));
        console.log('TicketTypes existe?', !!firstTeam.ticketTypes);
        console.log('TicketTypes length:', firstTeam.ticketTypes?.length || 0);
        console.log('TicketTypes:', JSON.stringify(firstTeam.ticketTypes, null, 2));
        console.log('===========================');
      }
      
      res.json(teams);
    } catch (error: any) {
      next(error);
    }
  },

  async getTeamById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const team = await teamService.getTeamById(id);
      res.json(team);
    } catch (error: any) {
      next(error);
    }
  },

  async updateTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      console.log('Body recebido para update:', JSON.stringify(req.body, null, 2)); // Debug
      console.log('Team ID:', id); // Debug
      const data = updateTeamSchema.parse(req.body);
      console.log('Dados validados para update:', JSON.stringify(data, null, 2)); // Debug
      const team = await teamService.updateTeam(id, data);
      console.log('Time atualizado retornado:', JSON.stringify(team, null, 2)); // Debug
      res.json(team);
    } catch (error: any) {
      console.error('Erro no controller updateTeam:', error); // Debug
      next(error);
    }
  },

  async deleteTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await teamService.deleteTeam(id);
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  },

  async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = addMemberSchema.parse(req.body);
      const member = await teamService.addMember(id, data);
      res.status(201).json(member);
    } catch (error: any) {
      next(error);
    }
  },

  async updateMemberRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, userId } = req.params;
      const { role } = updateMemberRoleSchema.parse(req.body);
      const member = await teamService.updateMemberRole(id, userId, role);
      res.json(member);
    } catch (error: any) {
      next(error);
    }
  },

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, userId } = req.params;
      await teamService.removeMember(id, userId);
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  },

  async checkUserMembership(req: Request, res: Response, next: NextFunction) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const { id: teamId } = req.params;
      const isMember = await teamService.isUserTeamMember(req.userId, teamId);
      const isLead = await teamService.isUserTeamLead(req.userId, teamId);
      const members = await teamService.getTeamMembers(teamId);

      res.json({
        isMember,
        isLead,
        members: members.map((m) => ({
          userId: m.userId,
          role: m.role,
          user: m.user,
        })),
      });
    } catch (error: any) {
      next(error);
    }
  },

  async getUserLeadTeams(req: Request, res: Response, next: NextFunction) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    try {
      const teamIds = await teamService.getUserLeadTeams(req.userId);
      res.json({ teamIds });
    } catch (error: any) {
      next(error);
    }
  },

  async addCategoryToTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: teamId } = req.params;
      const { categoryId } = req.body;
      if (!categoryId) {
        res.status(400).json({ error: 'categoryId é obrigatório' });
        return;
      }
      const result = await teamService.addCategoryToTeam(teamId, categoryId);
      res.status(201).json(result);
    } catch (error: any) {
      next(error);
    }
  },

  async removeCategoryFromTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: teamId, categoryId } = req.params;
      await teamService.removeCategoryFromTeam(teamId, categoryId);
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  },

  async addTicketTypeToTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: teamId } = req.params;
      const { ticketType } = req.body;
      if (!ticketType) {
        res.status(400).json({ error: 'ticketType é obrigatório' });
        return;
      }
      const result = await teamService.addTicketTypeToTeam(teamId, ticketType as TicketType);
      res.status(201).json(result);
    } catch (error: any) {
      next(error);
    }
  },

  async removeTicketTypeFromTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: teamId } = req.params;
      const { ticketType } = req.body;
      if (!ticketType) {
        res.status(400).json({ error: 'ticketType é obrigatório' });
        return;
      }
      await teamService.removeTicketTypeFromTeam(teamId, ticketType as TicketType);
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  },

  async getTeamTicketTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: teamId } = req.params;
      const team = await teamService.getTeamById(teamId);
      const ticketTypes = team.ticketTypes?.map((tt) => tt.ticketType) || [];
      res.json({ ticketTypes });
    } catch (error: any) {
      next(error);
    }
  },
};

