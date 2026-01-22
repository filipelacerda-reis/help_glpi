import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { KbArticleStatus } from '@prisma/client';
import axios from 'axios';
import { env } from '../config/env';
import { geminiClient } from '../lib/geminiClient';

export interface CreateKbCategoryDto {
  name: string;
  description?: string;
  parentId?: string;
}

export interface UpdateKbCategoryDto {
  name?: string;
  description?: string;
  parentId?: string;
}

export interface CreateKbArticleDto {
  categoryId?: string;
  title: string;
  content: string;
  status?: KbArticleStatus;
  tags?: string[];
}

export interface UpdateKbArticleDto {
  categoryId?: string;
  title?: string;
  content?: string;
  status?: KbArticleStatus;
  tags?: string[];
}

export interface SearchArticlesDto {
  query?: string;
  categoryId?: string;
  status?: KbArticleStatus;
  tags?: string[];
  limit?: number;
}

export interface SuggestArticlesDto {
  title: string;
  description: string;
  categoryId?: string;
}

export interface AiSolutionResponse {
  solution: string;
  sourceArticles: Array<{ id: string; title: string }>;
  hasAnswer: boolean;
}

// Função auxiliar para buscar artigos relevantes
async function findRelevantArticles(data: SuggestArticlesDto) {
  const searchText = `${data.title} ${data.description}`.toLowerCase();

  // Buscar artigos publicados que contenham palavras-chave do título/descrição
  const articles = await prisma.kbArticle.findMany({
    where: {
      status: KbArticleStatus.PUBLISHED,
      ...(data.categoryId && { categoryId: data.categoryId }),
      OR: [
        { title: { contains: searchText, mode: 'insensitive' } },
        { content: { contains: searchText, mode: 'insensitive' } },
        { tags: { hasSome: searchText.split(' ') } },
      ],
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 5,
  });

  // Ordenar por relevância simples
  const scored = articles.map((article) => {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const contentLower = article.content.toLowerCase();

    // Pontuação baseada em matches
    if (titleLower.includes(data.title.toLowerCase())) score += 10;
    if (contentLower.includes(data.title.toLowerCase())) score += 5;
    if (contentLower.includes(data.description.toLowerCase())) score += 3;

    return { article, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.article);
}

export const kbService = {
  // ============================================
  // CATEGORIES
  // ============================================

  /**
   * Cria uma categoria de KB
   */
  async createCategory(data: CreateKbCategoryDto) {
    if (data.parentId) {
      const parent = await prisma.kbCategory.findUnique({
        where: { id: data.parentId },
      });

      if (!parent) {
        throw new AppError('Categoria pai não encontrada', 404);
      }
    }

    const category = await prisma.kbCategory.create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
      },
    });

    logger.info('Categoria de KB criada', { categoryId: category.id, name: category.name });
    return category;
  },

  /**
   * Busca todas as categorias
   */
  async getAllCategories() {
    return prisma.kbCategory.findMany({
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            articles: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  },

  /**
   * Busca categoria por ID
   */
  async getCategoryById(id: string) {
    const category = await prisma.kbCategory.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        articles: {
          where: {
            status: KbArticleStatus.PUBLISHED,
          },
        },
      },
    });

    if (!category) {
      throw new AppError('Categoria não encontrada', 404);
    }

    return category;
  },

  /**
   * Atualiza categoria
   */
  async updateCategory(id: string, data: UpdateKbCategoryDto) {
    const category = await prisma.kbCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new AppError('Categoria não encontrada', 404);
    }

    if (data.parentId && data.parentId === id) {
      throw new AppError('Uma categoria não pode ser pai de si mesma', 400);
    }

    const updated = await prisma.kbCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
      },
    });

    logger.info('Categoria de KB atualizada', { categoryId: id });
    return updated;
  },

  /**
   * Deleta categoria
   */
  async deleteCategory(id: string) {
    const category = await prisma.kbCategory.findUnique({
      where: { id },
      include: {
        articles: {
          take: 1,
        },
      },
    });

    if (!category) {
      throw new AppError('Categoria não encontrada', 404);
    }

    if (category.articles.length > 0) {
      throw new AppError('Não é possível deletar categoria com artigos', 400);
    }

    await prisma.kbCategory.delete({
      where: { id },
    });

    logger.info('Categoria de KB deletada', { categoryId: id });
  },

  // ============================================
  // ARTICLES
  // ============================================

  /**
   * Cria um artigo de KB
   */
  async createArticle(userId: string, data: CreateKbArticleDto) {
    if (data.categoryId) {
      const category = await prisma.kbCategory.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new AppError('Categoria não encontrada', 404);
      }
    }

    const article = await prisma.kbArticle.create({
      data: {
        categoryId: data.categoryId,
        title: data.title,
        content: data.content,
        status: data.status || KbArticleStatus.DRAFT,
        tags: data.tags || [],
        createdById: userId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info('Artigo de KB criado', { articleId: article.id, title: article.title });
    return article;
  },

  /**
   * Busca artigos com filtros
   */
  async searchArticles(filters: SearchArticlesDto) {
    const where: any = {};

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { content: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    return prisma.kbArticle.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: filters.limit || 50,
    });
  },

  /**
   * Busca artigo por ID
   */
  async getArticleById(id: string) {
    const article = await prisma.kbArticle.findUnique({
      where: { id },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!article) {
      throw new AppError('Artigo não encontrado', 404);
    }

    return article;
  },

  /**
   * Atualiza artigo
   */
  async updateArticle(id: string, userId: string, data: UpdateKbArticleDto) {
    const article = await prisma.kbArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new AppError('Artigo não encontrado', 404);
    }

    if (data.categoryId) {
      const category = await prisma.kbCategory.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new AppError('Categoria não encontrada', 404);
      }
    }

    const updated = await prisma.kbArticle.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        title: data.title,
        content: data.content,
        status: data.status,
        tags: data.tags,
        updatedById: userId,
      },
      include: {
        category: true,
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info('Artigo de KB atualizado', { articleId: id });
    return updated;
  },

  /**
   * Deleta artigo
   */
  async deleteArticle(id: string) {
    await prisma.kbArticle.delete({
      where: { id },
    });

    logger.info('Artigo de KB deletado', { articleId: id });
  },

  /**
   * Sugere artigos baseado em título e descrição
   */
  async suggestArticles(data: SuggestArticlesDto): Promise<{ articles: any[]; aiSolution: string | null }> {
    const sortedArticles = await findRelevantArticles(data);

    // Chamar N8N se as condições forem atendidas
    let aiSolution: string | null = null;
    const shouldCallN8N = data.title.length > 5 || data.description.length > 100;

    if (shouldCallN8N && env.N8N_QUERY_WEBHOOK) {
      try {
        const response = await axios.post(
          env.N8N_QUERY_WEBHOOK,
          {
            title: data.title,
            description: data.description,
          },
          {
            timeout: 10000, // 10 segundos de timeout
          }
        );

        // Extrair a resposta da IA (pode vir em diferentes formatos)
        if (response.data?.answer) {
          aiSolution = response.data.answer;
        } else if (response.data?.solution) {
          aiSolution = response.data.solution;
        } else if (typeof response.data === 'string') {
          aiSolution = response.data;
        }

        logger.info('Resposta do N8N recebida', {
          hasSolution: !!aiSolution,
          titleLength: data.title.length,
        });
      } catch (error: any) {
        // Não travar a criação do ticket se o N8N falhar
        logger.warn('Erro ao chamar N8N para sugestão de artigos', {
          error: error.message,
          url: env.N8N_QUERY_WEBHOOK,
        });
      }
    }

    return {
      articles: sortedArticles,
      aiSolution,
    };
  },

  /**
   * Gera uma solução baseada na KB usando Gemini (RAG)
   */
  async generateAiSolution(data: SuggestArticlesDto): Promise<AiSolutionResponse> {
    // 1. Buscar artigos relevantes usando a função auxiliar
    const articles = await findRelevantArticles(data);

    if (articles.length === 0) {
      return { solution: '', sourceArticles: [], hasAnswer: false };
    }

    // 2. Preparar o contexto para a IA
    const context = articles.map(a => 
      `Título: ${a.title}\nConteúdo: ${a.content}\n---\n`
    ).join('\n');

    const userQuery = `${data.title}\n${data.description}`;

    const prompt = `
Você é um assistente de suporte técnico amigável e prestativo. Sua função é ajudar usuários a resolver problemas técnicos de forma clara e conversacional.

BASE DE CONHECIMENTO DISPONÍVEL:
${context}

PROBLEMA RELATADO PELO USUÁRIO:
${userQuery}

INSTRUÇÕES IMPORTANTES:
1. Analise se a BASE DE CONHECIMENTO contém informações relevantes para resolver o PROBLEMA DO USUÁRIO.
2. Se SIM, escreva uma resposta CONVERSACIONAL e AMIGÁVEL, como se você estivesse conversando diretamente com o usuário.
3. NÃO copie a documentação literalmente. Transforme as informações em uma explicação natural e fácil de entender.
4. Use linguagem simples e direta, evitando jargão técnico desnecessário.
5. Seja empático e prestativo, como um colega de trabalho ajudando outro.
6. Se o contexto NÃO tiver relação com o problema, responda apenas "NO_ANSWER".
7. NÃO invente informações que não estejam na base de conhecimento.

FORMATO DA RESPOSTA:
- Comece de forma amigável, reconhecendo o problema
- Explique a solução de forma passo-a-passo, de maneira natural
- Use exemplos práticos quando apropriado
- Seja objetivo e direto
- Use Markdown apenas para formatação básica (negrito, listas, código quando necessário)
- Escreva em português brasileiro (pt-BR)

EXEMPLO DE TOM:
"Olá! Vejo que você está tendo problemas com [problema]. Vamos resolver isso juntos! 

Primeiro, vamos verificar [passo 1]. Depois, você pode [passo 2]. 

Se isso não funcionar, tente [alternativa]."

Agora, baseado na BASE DE CONHECIMENTO acima, responda ao PROBLEMA DO USUÁRIO de forma conversacional e amigável:
    `;

    try {
      if (!geminiClient) {
        logger.warn('Gemini client não configurado, retornando sem solução', {
          geminiClientType: typeof geminiClient,
          geminiClientNull: geminiClient === null,
          geminiClientUndefined: geminiClient === undefined,
          hasGeminiApiKey: !!(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
        });
        return { solution: '', sourceArticles: [], hasAnswer: false };
      }

      // Verificar se getGenerativeModel existe
      if (typeof geminiClient.getGenerativeModel !== 'function') {
        logger.error('Gemini client não possui método getGenerativeModel', {
          geminiClientKeys: Object.keys(geminiClient || {}),
        });
        return { solution: '', sourceArticles: [], hasAnswer: false };
      }

      logger.info('Chamando Gemini para gerar solução RAG', {
        articlesCount: articles.length,
        titleLength: data.title.length,
        descriptionLength: data.description.length,
        promptLength: prompt.length,
        modelName: 'gemini-2.5-flash',
      });

      // Usar o modelo configurado com parâmetros para resposta mais natural
      // Usar gemini-2.5-flash que está disponível (mesmo usado no llm.service)
      const model = geminiClient.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.7, // Mais criatividade para linguagem natural (0.0-1.0)
          topP: 0.8, // Diversidade de respostas
          topK: 40, // Variedade de tokens
        },
      });

      let result;
      let response;
      let text;

      try {
        result = await model.generateContent(prompt);
        response = result.response;
        text = response.text();
      } catch (genError: any) {
        // Erro específico na geração de conteúdo - extrair informações como strings
        const genErrorMessage = genError?.message || String(genError) || 'Erro desconhecido';
        const genErrorName = genError?.name || 'Unknown';
        const genErrorCode = genError?.code ? String(genError.code) : '';
        const genErrorStatus = genError?.status ? String(genError.status) : '';
        
        // Tentar extrair mais informações
        let additionalInfo = '';
        if (genError?.response?.data) {
          try {
            additionalInfo = typeof genError.response.data === 'string' 
              ? genError.response.data 
              : JSON.stringify(genError.response.data);
          } catch (e) {
            additionalInfo = String(genError.response.data);
          }
        }
        
        logger.error('Erro ao gerar conteúdo com Gemini', {
          errorMessage: genErrorMessage,
          errorName: genErrorName,
          errorCode: genErrorCode,
          errorStatus: genErrorStatus,
          additionalInfo: additionalInfo || undefined,
        });
        throw genError; // Re-lançar para ser capturado pelo catch externo
      }

      logger.info('Resposta do Gemini recebida', {
        textLength: text.length,
        preview: text.substring(0, 100) + '...',
      });

      if (text.includes("NO_ANSWER") || text.trim().length === 0) {
        logger.info('Gemini retornou NO_ANSWER ou resposta vazia');
        return { solution: '', sourceArticles: [], hasAnswer: false };
      }

      logger.info('Solução RAG gerada com sucesso pelo Gemini', {
        solutionLength: text.length,
        sourceArticlesCount: articles.length,
      });

      return {
        solution: text,
        sourceArticles: articles.map(a => ({ id: a.id, title: a.title })),
        hasAnswer: true
      };

    } catch (error: any) {
      // Log detalhado do erro para debug - garantir que tudo seja string primitiva
      let errorMessage = 'Erro desconhecido';
      let errorName = 'Unknown';
      let errorStack = '';
      let errorCode = '';
      let errorStatus = '';
      let errorDetails = '';

      try {
        // Extrair mensagem básica
        if (error?.message) {
          errorMessage = String(error.message);
        } else if (error?.toString && typeof error.toString === 'function') {
          errorMessage = error.toString();
        } else {
          errorMessage = String(error);
        }
        
        errorName = error?.name ? String(error.name) : 'Unknown';
        errorStack = error?.stack ? String(error.stack).substring(0, 500) : '';
        
        // Verificar se é erro do Google Generative AI
        if (error?.status !== undefined) {
          errorStatus = String(error.status);
        }
        if (error?.statusText) {
          errorMessage = `${String(error.statusText)}: ${errorMessage}`;
        }
        
        // Verificar se há resposta HTTP
        if (error?.response) {
          if (error.response.status !== undefined) {
            errorStatus = String(error.response.status);
          }
          if (error.response.statusText) {
            errorMessage = `${String(error.response.statusText)}: ${errorMessage}`;
          }
          if (error.response.data) {
            try {
              errorDetails = typeof error.response.data === 'string' 
                ? error.response.data 
                : JSON.stringify(error.response.data);
            } catch (e) {
              errorDetails = String(error.response.data);
            }
          }
        }

        // Verificar se há código de erro
        if (error?.code !== undefined) {
          errorCode = String(error.code);
        }
      } catch (e) {
        // Se falhar ao extrair, usar string direta
        errorMessage = String(error);
      }

      // Construir objeto de log com apenas strings primitivas
      const logData: Record<string, string | boolean> = {
        errorMessage,
        errorName,
        geminiClientExists: !!geminiClient,
        hasGeminiApiKey: !!(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      };

      if (errorCode) logData.errorCode = errorCode;
      if (errorStatus) logData.errorStatus = errorStatus;
      if (errorStack) logData.errorStack = errorStack;
      if (errorDetails) logData.errorDetails = errorDetails;

      logger.error('Erro ao gerar solução com IA', logData);
      
      return { solution: '', sourceArticles: [], hasAnswer: false };
    }
  },

  /**
   * Associa artigo a um ticket
   */
  async linkArticleToTicket(ticketId: string, articleId: string, userId: string) {
    // Verificar se o ticket existe
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404);
    }

    // Verificar se o artigo existe
    const article = await prisma.kbArticle.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new AppError('Artigo não encontrado', 404);
    }

    // Criar associação
    await prisma.ticketKbArticle.create({
      data: {
        ticketId,
        articleId,
      },
    });

    // Registrar uso
    await prisma.kbArticleUsage.create({
      data: {
        articleId,
        ticketId,
        usedById: userId,
      },
    });

    logger.info('Artigo de KB associado ao ticket', { ticketId, articleId });
  },

  /**
   * Lista artigos associados a um ticket
   */
  async getTicketArticles(ticketId: string) {
    return prisma.ticketKbArticle.findMany({
      where: { ticketId },
      include: {
        article: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
};

