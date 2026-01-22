import { api } from './api';

export interface Tag {
  id: string;
  name: string;
  group: 'FEATURE' | 'AREA' | 'ENV' | 'PLATFORM' | 'SOURCE' | 'IMPACT' | 'RC' | 'STATUS_REASON' | 'WORK' | 'QUESTION' | 'INFRA';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagDto {
  name: string;
  group: Tag['group'];
  isActive?: boolean;
}

export interface UpdateTagDto {
  name?: string;
  group?: Tag['group'];
  isActive?: boolean;
}

export interface TagFilters {
  group?: Tag['group'];
  search?: string;
  isActive?: boolean;
}

export const tagService = {
  async getAllTags(filters?: TagFilters): Promise<Tag[]> {
    const params = new URLSearchParams();
    if (filters?.group) params.append('group', filters.group);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const response = await api.get<Tag[]>(`/tags?${params.toString()}`);
    return response.data;
  },

  async getTagById(id: string): Promise<Tag> {
    const response = await api.get<Tag>(`/tags/${id}`);
    return response.data;
  },

  async createTag(data: CreateTagDto): Promise<Tag> {
    const response = await api.post<Tag>('/tags', data);
    return response.data;
  },

  async updateTag(id: string, data: UpdateTagDto): Promise<Tag> {
    const response = await api.patch<Tag>(`/tags/${id}`, data);
    return response.data;
  },

  async deleteTag(id: string): Promise<void> {
    await api.delete(`/tags/${id}`);
  },

  async getTagsByGroup(group: Tag['group']): Promise<Tag[]> {
    return this.getAllTags({ group, isActive: true });
  },
};

