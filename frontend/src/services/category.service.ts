import { api } from './api';

export interface Category {
  id: string;
  name: string;
  parentCategoryId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  parentCategory?: Category | null;
  subCategories?: Category[];
  teams?: Array<{
    teamId: string;
    team: {
      id: string;
      name: string;
    };
  }>;
}

export interface CreateCategoryDto {
  name: string;
  parentCategoryId?: string;
  active?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  parentCategoryId?: string | null;
  active?: boolean;
}

export const categoryService = {
  async getAllCategories(activeOnly: boolean = true, teamId?: string): Promise<Category[]> {
    const response = await api.get<Category[]>('/categories', {
      params: { activeOnly, teamId },
    });
    return response.data;
  },

  async getCategoryById(id: string): Promise<Category> {
    const response = await api.get<Category>(`/categories/${id}`);
    return response.data;
  },

  async createCategory(data: CreateCategoryDto): Promise<Category> {
    const response = await api.post<Category>('/categories', data);
    return response.data;
  },

  async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    const response = await api.patch<Category>(`/categories/${id}`, data);
    return response.data;
  },

  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/categories/${id}`);
  },
};

