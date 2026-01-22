import { api } from './api';

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  users?: UserTeam[];
  categories?: Array<{
    teamId?: string;
    categoryId: string;
    category: {
      id: string;
      name: string;
    };
  }>;
  ticketTypes?: Array<{
    teamId?: string;
    ticketType: string;
  }>;
}

export interface UserTeam {
  userId: string;
  teamId: string;
  role: 'MEMBER' | 'LEAD';
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface CreateTeamDto {
  name: string;
  description?: string;
  categoryIds?: string[];
  ticketTypes?: string[];
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  categoryIds?: string[];
  ticketTypes?: string[];
}

export interface AddMemberDto {
  userId: string;
  role?: 'MEMBER' | 'LEAD';
}

export const teamService = {
  async getAllTeams(includeMembers: boolean = false): Promise<Team[]> {
    const response = await api.get<Team[]>('/teams', {
      params: { includeMembers },
    });
    return response.data;
  },

  async getTeamById(id: string): Promise<Team> {
    const response = await api.get<Team>(`/teams/${id}`);
    return response.data;
  },

  async createTeam(data: CreateTeamDto): Promise<Team> {
    const response = await api.post<Team>('/teams', data);
    return response.data;
  },

  async updateTeam(id: string, data: UpdateTeamDto): Promise<Team> {
    const response = await api.patch<Team>(`/teams/${id}`, data);
    return response.data;
  },

  async deleteTeam(id: string): Promise<void> {
    await api.delete(`/teams/${id}`);
  },

  async addMember(teamId: string, data: AddMemberDto): Promise<UserTeam> {
    const response = await api.post<UserTeam>(`/teams/${teamId}/members`, data);
    return response.data;
  },

  async updateMemberRole(teamId: string, userId: string, role: 'MEMBER' | 'LEAD'): Promise<UserTeam> {
    const response = await api.patch<UserTeam>(`/teams/${teamId}/members/${userId}`, { role });
    return response.data;
  },

  async removeMember(teamId: string, userId: string): Promise<void> {
    await api.delete(`/teams/${teamId}/members/${userId}`);
  },

  async getTeamMembers(teamId: string): Promise<UserTeam[]> {
    const team = await this.getTeamById(teamId);
    return team.users || [];
  },

  async checkUserMembership(teamId: string): Promise<{
    isMember: boolean;
    isLead: boolean;
    members: UserTeam[];
  }> {
    const response = await api.get<{
      isMember: boolean;
      isLead: boolean;
      members: UserTeam[];
    }>(`/teams/${teamId}/members/check`);
    return response.data;
  },

  async getUserLeadTeams(): Promise<string[]> {
    const response = await api.get<{ teamIds: string[] }>('/teams/my/lead-teams');
    return response.data.teamIds;
  },

  async getTeamTicketTypes(teamId: string): Promise<string[]> {
    const response = await api.get<{ ticketTypes: string[] }>(`/teams/${teamId}/ticket-types`);
    return response.data.ticketTypes;
  },
};
