import prisma from '../lib/prisma';
import { TeamRole } from '@prisma/client';

/**
 * Verifica se um usuário é membro de um time
 */
export async function isUserTeamMember(userId: string, teamId: string): Promise<boolean> {
  const userTeam = await prisma.userTeam.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
  return !!userTeam;
}

/**
 * Verifica se um usuário é líder de um time
 */
export async function isUserTeamLead(userId: string, teamId: string): Promise<boolean> {
  const userTeam = await prisma.userTeam.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
  return userTeam?.role === TeamRole.LEAD;
}

/**
 * Obtém todos os times de um usuário
 */
export async function getUserTeams(userId: string): Promise<string[]> {
  const userTeams = await prisma.userTeam.findMany({
    where: { userId },
    select: { teamId: true },
  });
  return userTeams.map((ut) => ut.teamId);
}

/**
 * Verifica se um usuário é membro de um time específico e retorna o papel
 */
export async function getUserTeamRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
  const userTeam = await prisma.userTeam.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
  return userTeam?.role || null;
}

/**
 * Obtém todos os membros de um time
 */
export async function getTeamMembers(teamId: string) {
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
}

/**
 * Obtém todos os times onde um usuário é líder
 */
export async function getUserLeadTeams(userId: string): Promise<string[]> {
  const userTeams = await prisma.userTeam.findMany({
    where: {
      userId,
      role: TeamRole.LEAD,
    },
    select: { teamId: true },
  });
  return userTeams.map((ut) => ut.teamId);
}

