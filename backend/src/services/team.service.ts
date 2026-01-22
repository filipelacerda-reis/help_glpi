import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { TeamRole, TicketType } from '@prisma/client';

export interface CreateTeamDto {
  name: string;
  description?: string;
  categoryIds?: string[];
  ticketTypes?: string[] | TicketType[]; // Aceitar strings ou enums
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  categoryIds?: string[];
  ticketTypes?: string[] | TicketType[]; // Aceitar strings ou enums
}

export interface AddMemberDto {
  userId: string;
  role?: TeamRole;
}

export const teamService = {
  async createTeam(data: CreateTeamDto) {
    logger.debug('Criando novo time', { name: data.name });

    const existingTeam = await prisma.team.findUnique({
      where: { name: data.name },
    });

    if (existingTeam) {
      logger.warn('Tentativa de criar time com nome duplicado', { name: data.name });
      throw new AppError('Já existe um time com este nome', 400);
    }

    // Converter ticketTypes de string para enum se necessário
    const ticketTypesEnum = data.ticketTypes?.map((tt) => {
      if (typeof tt === 'string') {
        return tt as TicketType;
      }
      return tt;
    });

    logger.debug('Criando time com dados', { 
      name: data.name, 
      categoryIds: data.categoryIds, 
      ticketTypes: ticketTypesEnum 
    });

    // Usar transação para garantir atomicidade
    return await prisma.$transaction(async (tx) => {
      // Criar time primeiro
      const team = await tx.team.create({
        data: {
          name: data.name,
          description: data.description,
        },
      });

      // Adicionar categorias se houver
      if (data.categoryIds && data.categoryIds.length > 0) {
        await tx.teamCategory.createMany({
          data: data.categoryIds.map((categoryId) => ({
            teamId: team.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      // Adicionar tipos de chamado se houver
      if (ticketTypesEnum && ticketTypesEnum.length > 0) {
        await tx.teamTicketType.createMany({
          data: ticketTypesEnum.map((ticketType) => ({
            teamId: team.id,
            ticketType: ticketType as TicketType,
          })),
          skipDuplicates: true,
        });
      }

      // Retornar time completo com relacionamentos
      const finalTeam = await tx.team.findUnique({
        where: { id: team.id },
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
          ticketTypes: true,
        },
      });

      logger.info('Time criado com sucesso', { teamId: finalTeam!.id, name: finalTeam!.name });
      return finalTeam!;
    });
  },

  async getAllTeams(includeMembers: boolean = false) {
    const teams = await prisma.team.findMany({
      include: {
        ...(includeMembers
          ? {
              users: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      role: true,
                    },
                  },
                },
              },
            }
          : {}),
        categories: {
          include: {
            category: true,
          },
        },
        ticketTypes: true,
      },
      orderBy: { name: 'asc' },
    });
    
    logger.debug('Times retornados', { 
      count: teams.length,
      firstTeam: teams[0] ? {
        id: teams[0].id,
        name: teams[0].name,
        categoriesCount: teams[0].categories?.length || 0,
        ticketTypesCount: teams[0].ticketTypes?.length || 0,
        categories: teams[0].categories,
        ticketTypes: teams[0].ticketTypes,
      } : null
    });
    
    return teams;
  },

  async getTeamById(id: string) {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        ticketTypes: true,
      },
    });

    if (!team) {
      throw new AppError('Time não encontrado', 404);
    }

    return team;
  },

  async updateTeam(id: string, data: UpdateTeamDto) {
    const team = await prisma.team.findUnique({ where: { id } });

    if (!team) {
      throw new AppError('Time não encontrado', 404);
    }

    if (data.name && data.name !== team.name) {
      const existingTeam = await prisma.team.findUnique({
        where: { name: data.name },
      });

      if (existingTeam) {
        throw new AppError('Já existe um time com este nome', 400);
      }
    }

    // Separar dados de relacionamento dos dados básicos
    const { categoryIds, ticketTypes, ...basicData } = data;

    logger.debug('Atualizando time', { 
      teamId: id, 
      categoryIds, 
      ticketTypes,
      basicData 
    });

    // Usar transação para garantir atomicidade
    return await prisma.$transaction(async (tx) => {
      // Atualizar dados básicos primeiro
      const updatedTeam = await tx.team.update({
        where: { id },
        data: basicData,
      });

      // Atualizar categorias se fornecidas
      if (categoryIds !== undefined) {
        // Remover todas as categorias existentes
        await tx.teamCategory.deleteMany({
          where: { teamId: id },
        });
        logger.debug('Categorias removidas, adicionando novas', { categoryIds });
        
        // Adicionar novas categorias se houver
        if (categoryIds.length > 0) {
          await tx.teamCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              teamId: id,
              categoryId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Atualizar tipos de chamado se fornecidos
      if (ticketTypes !== undefined) {
        // Remover todos os tipos de chamado existentes
        await tx.teamTicketType.deleteMany({
          where: { teamId: id },
        });
        logger.debug('Tipos de chamado removidos, adicionando novos', { ticketTypes });
        
        // Adicionar novos tipos se houver
        if (ticketTypes.length > 0) {
          // Converter strings para enum se necessário
          const ticketTypesEnum = ticketTypes.map((tt) => {
            if (typeof tt === 'string') {
              return tt as TicketType;
            }
            return tt;
          });
          
          await tx.teamTicketType.createMany({
            data: ticketTypesEnum.map((ticketType) => ({
              teamId: id,
              ticketType: ticketType as TicketType,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Retornar time atualizado com todos os relacionamentos
      const finalTeam = await tx.team.findUnique({
        where: { id },
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
          ticketTypes: true,
        },
      });

      if (!finalTeam) {
        throw new AppError('Erro ao atualizar time', 500);
      }

      logger.info('Time atualizado com sucesso', { teamId: finalTeam.id, name: finalTeam.name });
      return finalTeam;
    });
  },

  async deleteTeam(id: string) {
    const team = await prisma.team.findUnique({ where: { id } });

    if (!team) {
      throw new AppError('Time não encontrado', 404);
    }

    // Verificar se há tickets associados
    const ticketsCount = await prisma.ticket.count({
      where: { teamId: id },
    });

    if (ticketsCount > 0) {
      throw new AppError(
        'Não é possível excluir time com tickets associados',
        400
      );
    }

    await prisma.team.delete({ where: { id } });
    logger.info('Time excluído', { teamId: id });
  },

  async addMember(teamId: string, data: AddMemberDto) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new AppError('Time não encontrado', 404);
    }

    const user = await prisma.user.findUnique({ where: { id: data.userId } });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    const existingMember = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId: data.userId,
          teamId: teamId,
        },
      },
    });

    if (existingMember) {
      throw new AppError('Usuário já é membro deste time', 400);
    }

    const userTeam = await prisma.userTeam.create({
      data: {
        userId: data.userId,
        teamId: teamId,
        role: data.role || TeamRole.MEMBER,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    logger.info('Membro adicionado ao time', {
      teamId,
      userId: data.userId,
      role: userTeam.role,
    });

    return userTeam;
  },

  async updateMemberRole(teamId: string, userId: string, role: TeamRole) {
    const userTeam = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!userTeam) {
      throw new AppError('Membro não encontrado no time', 404);
    }

    return prisma.userTeam.update({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  },

  async removeMember(teamId: string, userId: string) {
    const userTeam = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!userTeam) {
      throw new AppError('Membro não encontrado no time', 404);
    }

    await prisma.userTeam.delete({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    logger.info('Membro removido do time', { teamId, userId });
  },

  async isUserTeamMember(userId: string, teamId: string): Promise<boolean> {
    const userTeam = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });
    return !!userTeam;
  },

  async isUserTeamLead(userId: string, teamId: string): Promise<boolean> {
    const userTeam = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });
    return userTeam?.role === TeamRole.LEAD;
  },

  async getTeamMembers(teamId: string) {
    return prisma.userTeam.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  },

  async getUserLeadTeams(userId: string): Promise<string[]> {
    const userTeams = await prisma.userTeam.findMany({
      where: {
        userId,
        role: TeamRole.LEAD,
      },
      select: { teamId: true },
    });
    return userTeams.map((ut) => ut.teamId);
  },

  async addCategoryToTeam(teamId: string, categoryId: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new AppError('Time não encontrado', 404);
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new AppError('Categoria não encontrada', 404);
    }

    const existing = await prisma.teamCategory.findUnique({
      where: {
        teamId_categoryId: {
          teamId,
          categoryId,
        },
      },
    });

    if (existing) {
      throw new AppError('Categoria já está vinculada a este time', 400);
    }

    return prisma.teamCategory.create({
      data: {
        teamId,
        categoryId,
      },
      include: {
        category: true,
      },
    });
  },

  async removeCategoryFromTeam(teamId: string, categoryId: string) {
    const teamCategory = await prisma.teamCategory.findUnique({
      where: {
        teamId_categoryId: {
          teamId,
          categoryId,
        },
      },
    });

    if (!teamCategory) {
      throw new AppError('Categoria não está vinculada a este time', 404);
    }

    await prisma.teamCategory.delete({
      where: {
        teamId_categoryId: {
          teamId,
          categoryId,
        },
      },
    });
  },

  async addTicketTypeToTeam(teamId: string, ticketType: TicketType) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new AppError('Time não encontrado', 404);
    }

    const existing = await prisma.teamTicketType.findUnique({
      where: {
        teamId_ticketType: {
          teamId,
          ticketType,
        },
      },
    });

    if (existing) {
      throw new AppError('Tipo de chamado já está vinculado a este time', 400);
    }

    return prisma.teamTicketType.create({
      data: {
        teamId,
        ticketType,
      },
    });
  },

  async removeTicketTypeFromTeam(teamId: string, ticketType: TicketType) {
    const teamTicketType = await prisma.teamTicketType.findUnique({
      where: {
        teamId_ticketType: {
          teamId,
          ticketType,
        },
      },
    });

    if (!teamTicketType) {
      throw new AppError('Tipo de chamado não está vinculado a este time', 404);
    }

    await prisma.teamTicketType.delete({
      where: {
        teamId_ticketType: {
          teamId,
          ticketType,
        },
      },
    });
  },
};

