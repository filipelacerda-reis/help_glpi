import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

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
  async getAllCategories(activeOnly: boolean = true, teamId?: string) {
    const where: any = activeOnly ? { active: true } : {};

    if (teamId) {
      // Filtrar apenas categorias vinculadas ao time
      where.teams = {
        some: {
          teamId,
        },
      };
    }

    return prisma.category.findMany({
      where,
      include: {
        parentCategory: true,
        subCategories: true,
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  },

  async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parentCategory: true,
        subCategories: true,
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      throw new AppError('Categoria não encontrada', 404);
    }

    return category;
  },

  async createCategory(data: CreateCategoryDto) {
    if (data.parentCategoryId) {
      const parent = await prisma.category.findUnique({
        where: { id: data.parentCategoryId },
      });

      if (!parent) {
        throw new AppError('Categoria pai não encontrada', 404);
      }
    }

    return prisma.category.create({
      data: {
        name: data.name,
        parentCategoryId: data.parentCategoryId,
        active: data.active ?? true,
      },
      include: {
        parentCategory: true,
        subCategories: true,
      },
    });
  },

  async updateCategory(id: string, data: UpdateCategoryDto) {
    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new AppError('Categoria não encontrada', 404);
    }

    if (data.parentCategoryId && data.parentCategoryId !== category.parentCategoryId) {
      const parent = await prisma.category.findUnique({
        where: { id: data.parentCategoryId },
      });

      if (!parent) {
        throw new AppError('Categoria pai não encontrada', 404);
      }

      // Evitar referência circular
      if (data.parentCategoryId === id) {
        throw new AppError('Uma categoria não pode ser pai de si mesma', 400);
      }
    }

    return prisma.category.update({
      where: { id },
      data,
      include: {
        parentCategory: true,
        subCategories: true,
      },
    });
  },

  async deleteCategory(id: string) {
    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new AppError('Categoria não encontrada', 404);
    }

    // Verificar se há tickets usando esta categoria
    const ticketsCount = await prisma.ticket.count({
      where: { categoryId: id },
    });

    if (ticketsCount > 0) {
      throw new AppError(
        'Não é possível excluir categoria com tickets associados',
        400
      );
    }

    // Verificar se há subcategorias
    const subCategoriesCount = await prisma.category.count({
      where: { parentCategoryId: id },
    });

    if (subCategoriesCount > 0) {
      throw new AppError(
        'Não é possível excluir categoria com subcategorias',
        400
      );
    }

    return prisma.category.delete({ where: { id } });
  },
};

