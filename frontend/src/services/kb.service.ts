import { api } from './api';

export interface KbCategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  parent?: KbCategory;
  children?: KbCategory[];
  _count?: {
    articles: number;
  };
}

export interface KbArticle {
  id: string;
  categoryId?: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  tags: string[];
  createdById: string;
  updatedById?: string;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AiSolution {
  solution: string;
  sourceArticles: Array<{ id: string; title: string }>;
  hasAnswer: boolean;
}

export const kbService = {
  // Categories
  async getAllCategories(): Promise<KbCategory[]> {
    const response = await api.get<KbCategory[]>('/kb/categories');
    return response.data;
  },

  async getCategoryById(id: string): Promise<KbCategory> {
    const response = await api.get<KbCategory>(`/kb/categories/${id}`);
    return response.data;
  },

  async createCategory(data: {
    name: string;
    description?: string;
    parentId?: string;
  }): Promise<KbCategory> {
    const response = await api.post<KbCategory>('/kb/categories', data);
    return response.data;
  },

  async updateCategory(id: string, data: Partial<KbCategory>): Promise<KbCategory> {
    const response = await api.put<KbCategory>(`/kb/categories/${id}`, data);
    return response.data;
  },

  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/kb/categories/${id}`);
  },

  // Articles
  async searchArticles(filters?: {
    query?: string;
    categoryId?: string;
    status?: string;
    tags?: string[];
    limit?: number;
  }): Promise<KbArticle[]> {
    const params = new URLSearchParams();
    if (filters?.query) params.append('query', filters.query);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await api.get<KbArticle[]>(`/kb/articles?${params.toString()}`);
    return response.data;
  },

  async getArticleById(id: string): Promise<KbArticle> {
    const response = await api.get<KbArticle>(`/kb/articles/${id}`);
    return response.data;
  },

  async createArticle(data: {
    categoryId?: string;
    title: string;
    content: string;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    tags?: string[];
  }): Promise<KbArticle> {
    const response = await api.post<KbArticle>('/kb/articles', data);
    return response.data;
  },

  async updateArticle(id: string, data: Partial<KbArticle>): Promise<KbArticle> {
    const response = await api.put<KbArticle>(`/kb/articles/${id}`, data);
    return response.data;
  },

  async deleteArticle(id: string): Promise<void> {
    await api.delete(`/kb/articles/${id}`);
  },

  async suggestArticles(data: {
    title: string;
    description: string;
    categoryId?: string;
  }): Promise<{ articles: KbArticle[]; aiSolution: string | null }> {
    const response = await api.post<{ articles: KbArticle[]; aiSolution: string | null }>('/kb/suggestions', data);
    return response.data;
  },

  async linkArticleToTicket(ticketId: string, articleId: string): Promise<void> {
    await api.post(`/tickets/${ticketId}/kb-articles`, { articleId });
  },

  async getTicketArticles(ticketId: string): Promise<Array<{ article: KbArticle; createdAt: string }>> {
    const response = await api.get(`/tickets/${ticketId}/kb-articles`);
    return response.data;
  },

  async getAiSolution(data: {
    title: string;
    description: string;
    categoryId?: string;
  }): Promise<AiSolution> {
    const response = await api.post<AiSolution>('/kb/ai-solution', data);
    return response.data;
  },
};

