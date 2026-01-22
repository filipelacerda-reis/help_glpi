/**
 * Configuração global para testes
 */

// Mock do uuid para evitar problemas com ES modules
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

// Mock do logger para não poluir os logs durante os testes
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock do Prisma Client será feito individualmente em cada arquivo de teste
// para permitir maior flexibilidade

