import dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Carregar variáveis de ambiente do arquivo .env se existir
// Se estiver rodando no Docker, as variáveis já vêm do docker-compose.yml via env_file
// Tentar múltiplos caminhos possíveis para o .env na raiz do projeto

// Caminhos possíveis para o .env na raiz do projeto
// Quando compilado, __dirname aponta para dist/config, então precisamos subir 3 níveis
// Quando em desenvolvimento, process.cwd() aponta para backend, então subimos 1 nível
const isCompiled = __filename.endsWith('.js') || __dirname.includes('dist');
const basePath = isCompiled 
  ? resolve(__dirname, '..', '..', '..') // dist/config -> backend -> raiz
  : resolve(process.cwd(), '..'); // src/config -> backend -> raiz

const possibleEnvPaths = [
  // Raiz do projeto (prioridade 1)
  resolve(basePath, '.env'),
  // Raiz do projeto (fallback 1)
  resolve(process.cwd(), '..', '.env'),
  // Diretório atual (fallback 2)
  resolve(process.cwd(), '.env'),
  // Tentar caminho absoluto da raiz (fallback 3)
  resolve(__dirname, '..', '..', '..', '.env'),
];

console.log('🔍 Procurando .env:', {
  isCompiled,
  basePath,
  cwd: process.cwd(),
  __dirname,
  __filename,
  paths: possibleEnvPaths.map(p => p.toString()),
});

// Tentar carregar .env da raiz primeiro
let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    const result = dotenv.config({ path: envPath, override: false });
    if (!result.error) {
      console.log(`✅ Arquivo .env carregado de: ${envPath}`);
      envLoaded = true;
      break;
    } else {
      console.warn(`⚠️  Erro ao carregar .env de ${envPath}: ${result.error.message}`);
    }
  }
}

if (!envLoaded) {
  console.warn('⚠️  Nenhum arquivo .env encontrado. Usando variáveis de ambiente do sistema/Docker.');
  console.warn('Caminhos testados:', possibleEnvPaths.map(p => p.toString()));
} else {
  // Log de confirmação do que foi carregado
  console.log('✅ Variáveis carregadas do .env:', {
    DB_HOST: process.env.DB_HOST ? 'DEFINIDO' : 'NÃO DEFINIDO',
    DB_USER: process.env.DB_USER ? 'DEFINIDO' : 'NÃO DEFINIDO',
    DB_PASSWORD: process.env.DB_PASSWORD ? `DEFINIDO (${process.env.DB_PASSWORD.length} chars)` : 'NÃO DEFINIDO',
    DB_NAME: process.env.DB_NAME ? 'DEFINIDO' : 'NÃO DEFINIDO',
    DATABASE_URL: process.env.DATABASE_URL ? 'DEFINIDO' : 'NÃO DEFINIDO',
  });
}

// Construir DATABASE_URL - sempre tentar construir a partir de variáveis separadas
// Isso garante que funciona mesmo se DATABASE_URL não estiver no .env
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '5432';
const dbUser = process.env.DB_USER || 'glpi_etus';
// Usar senha do .env se estiver definida, senão usar padrão
// NOTA: Em produção, a senha do .env DEVE corresponder à senha do container Docker
// O código abaixo é apenas uma proteção para desenvolvimento local
let dbPassword = process.env.DB_PASSWORD || 'glpi_etus_password';

// Detectar desenvolvimento local: se conectando a localhost, provavelmente é desenvolvimento
const isLocalDevelopment = dbHost === 'localhost' || dbHost === '127.0.0.1';

// Em desenvolvimento local, se detectar senha antiga (32 chars) ou senha que não funciona,
// usar senha padrão do container Docker
if (isLocalDevelopment && dbPassword !== 'glpi_etus_password' && dbPassword.length === 32) {
  console.warn('⚠️  Senha de 32 caracteres detectada no .env. Como está conectando a localhost, usando senha padrão do container Docker (glpi_etus_password).');
  console.warn('⚠️  Para usar uma senha customizada, atualize DB_PASSWORD no .env para corresponder à senha do container PostgreSQL.');
  dbPassword = 'glpi_etus_password';
}
const dbName = process.env.DB_NAME || 'glpi_etus';
const dbSchema = process.env.DB_SCHEMA || 'public';

// Log para debug (apenas em desenvolvimento)
console.log('🔍 Configuração do banco sendo usada:', {
  dbHost,
  dbPort,
  dbUser,
  dbPassword: dbPassword ? `DEFINIDO (${dbPassword.length} chars) - ****` : 'NÃO DEFINIDO - usando padrão',
  dbName,
  dbSchema,
  DATABASE_URL_from_env: process.env.DATABASE_URL ? 'DEFINIDO' : 'NÃO DEFINIDO',
  DB_PASSWORD_from_env: process.env.DB_PASSWORD ? `DEFINIDO (${process.env.DB_PASSWORD.length} chars)` : 'NÃO DEFINIDO',
});

// Codificar a senha para URL (importante para caracteres especiais)
const encodedPassword = encodeURIComponent(dbPassword);
const constructedUrl = `postgresql://${dbUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}?schema=${dbSchema}`;

// SEMPRE usar a URL construída para garantir encoding correto da senha
// O DATABASE_URL do .env pode ter problemas de encoding
let databaseUrl = constructedUrl;

console.log('🔗 DATABASE_URL construído:', constructedUrl.replace(/:[^:@]+@/, ':****@'));

// Se DATABASE_URL foi fornecido, logar mas usar a construída
if (process.env.DATABASE_URL) {
  console.log('ℹ️  DATABASE_URL encontrado no .env, mas usando URL construída para garantir encoding correto');
  // Verificar se a senha no DATABASE_URL corresponde
  const urlPasswordMatch = process.env.DATABASE_URL.match(/postgresql:\/\/[^:]+:([^@]+)@/);
  if (urlPasswordMatch && urlPasswordMatch[1] !== encodedPassword) {
    console.warn('⚠️  Senha no DATABASE_URL difere da senha em DB_PASSWORD. Usando DB_PASSWORD.');
  }
}

if (!databaseUrl) {
  throw new Error(
    `DATABASE_URL não encontrado. Configure no arquivo .env ou nas variáveis de ambiente.`
  );
}

// Validar JWT secrets antes de exportar
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

if (!jwtSecret || jwtSecret.trim() === '') {
  console.error('❌ JWT_SECRET não está configurado no .env');
  throw new Error('JWT_SECRET é obrigatório. Configure no arquivo .env');
}

if (!jwtRefreshSecret || jwtRefreshSecret.trim() === '') {
  console.error('❌ JWT_REFRESH_SECRET não está configurado no .env');
  throw new Error('JWT_REFRESH_SECRET é obrigatório. Configure no arquivo .env');
}

// Exportar variáveis importantes
export const env = {
  DATABASE_URL: databaseUrl,
  JWT_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8080', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_DB: parseInt(process.env.REDIS_DB || '0', 10),
  // Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
  MAX_FILES: parseInt(process.env.MAX_FILES || '10', 10),
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  // Google Gemini
  GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
  // N8N Integration
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || '',
  N8N_INGEST_WEBHOOK: process.env.N8N_INGEST_WEBHOOK || '',
  N8N_QUERY_WEBHOOK: process.env.N8N_QUERY_WEBHOOK || '',
  CONFIG_ENCRYPTION_KEY: process.env.CONFIG_ENCRYPTION_KEY || '',
  // SAML SSO
  SAML_ENABLED: process.env.SAML_ENABLED === 'true',
  SAML_ENTRY_POINT: process.env.SAML_ENTRY_POINT || '',
  SAML_ISSUER: process.env.SAML_ISSUER || '',
  SAML_CALLBACK_URL: process.env.SAML_CALLBACK_URL || '',
  SAML_CERT: process.env.SAML_CERT || '',
  SAML_SIGNATURE_ALG: process.env.SAML_SIGNATURE_ALG || 'sha256',
  SAML_NAMEID_FORMAT:
    process.env.SAML_NAMEID_FORMAT ||
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  SAML_ALLOWED_DOMAINS: process.env.SAML_ALLOWED_DOMAINS || '',
  SAML_GROUPS_ATTRIBUTE: process.env.SAML_GROUPS_ATTRIBUTE || 'groups',
  SAML_ROLE_MAPPING_JSON: process.env.SAML_ROLE_MAPPING_JSON || '{}',
  SAML_DEFAULT_ROLE: process.env.SAML_DEFAULT_ROLE || 'REQUESTER',
  SAML_UPDATE_ROLE_ON_LOGIN: process.env.SAML_UPDATE_ROLE_ON_LOGIN === 'true',
  SAML_JWT_REDIRECT_URL: process.env.SAML_JWT_REDIRECT_URL || '',
  SAML_VALIDATE_IN_RESPONSE_TO: process.env.SAML_VALIDATE_IN_RESPONSE_TO === 'true',
  SAML_REQUEST_ID_TTL_MS: parseInt(process.env.SAML_REQUEST_ID_TTL_MS || '28800000', 10),
  SAML_REQUIRE_GROUP: process.env.SAML_REQUIRE_GROUP !== 'false',
  // Auth0
  AUTH0_ENABLED: process.env.AUTH0_ENABLED === 'true',
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN || '',
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || '',
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || '',
  AUTH0_CALLBACK_URL: process.env.AUTH0_CALLBACK_URL || '',
  AUTH0_JWT_REDIRECT_URL: process.env.AUTH0_JWT_REDIRECT_URL || '',
  AUTH0_ALLOWED_DOMAINS: process.env.AUTH0_ALLOWED_DOMAINS || '',
  AUTH0_ROLES_CLAIM: process.env.AUTH0_ROLES_CLAIM || 'https://glpi.etus.io/roles',
  AUTH0_ROLE_MAPPING_JSON: process.env.AUTH0_ROLE_MAPPING_JSON || '{}',
  AUTH0_DEFAULT_ROLE: process.env.AUTH0_DEFAULT_ROLE || 'REQUESTER',
  AUTH0_UPDATE_ROLE_ON_LOGIN: process.env.AUTH0_UPDATE_ROLE_ON_LOGIN === 'true',
  AUTH0_REQUIRE_ROLE: process.env.AUTH0_REQUIRE_ROLE !== 'false',
};

