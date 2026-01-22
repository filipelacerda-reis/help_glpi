import { PrismaClient, KbArticleStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para popular a Base de Conhecimento com artigos de teste
 * Execute: npx tsx prisma/seed-kb-articles.ts
 * 
 * IMPORTANTE: Você precisa ter pelo menos um usuário ADMIN no banco
 * para usar como createdById. Ajuste o userId abaixo.
 */

const KB_ARTICLES = [
  {
    title: 'Erro de Deploy - Falha na aplicação durante o deploy',
    content: `# Erro de Deploy - Solução

## Problema
A aplicação está falhando durante o processo de deploy, gerando erros de build ou timeout.

## Soluções

### 1. Verificar Logs do Deploy
- Acesse os logs do processo de deploy
- Procure por mensagens de erro específicas
- Verifique se há problemas de memória ou timeout

### 2. Verificar Variáveis de Ambiente
- Confirme que todas as variáveis de ambiente necessárias estão configuradas
- Verifique especialmente:
  - \`DATABASE_URL\`
  - \`JWT_SECRET\`
  - \`NODE_ENV\`
  - Chaves de API (OpenAI, Gemini, etc.)

### 3. Verificar Dependências
- Execute \`npm install\` ou \`yarn install\`
- Verifique se não há conflitos de versão
- Limpe o cache: \`npm cache clean --force\`

### 4. Verificar Espaço em Disco
- Deploy pode falhar se não houver espaço suficiente
- Libere espaço removendo arquivos temporários

### 5. Verificar Build Local
- Teste o build localmente antes de fazer deploy
- Execute: \`npm run build\`
- Se falhar localmente, corrija antes de fazer deploy

## Prevenção
- Configure CI/CD adequadamente
- Use ambientes de staging antes de produção
- Mantenha logs detalhados do processo de deploy`,
    tags: ['deploy', 'erro', 'build', 'ci-cd'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro de Conexão - Não consigo conectar ao banco de dados',
    content: `# Erro de Conexão com Banco de Dados

## Problema
A aplicação não consegue estabelecer conexão com o banco de dados PostgreSQL.

## Diagnóstico

### 1. Verificar se o Banco está Rodando
\`\`\`bash
# Verificar se o container está rodando
docker ps | grep postgres

# Ou verificar serviço local
sudo systemctl status postgresql
\`\`\`

### 2. Verificar Credenciais
- Confirme usuário, senha e nome do banco
- Verifique se a \`DATABASE_URL\` está correta no arquivo \`.env\`
- Formato esperado: \`postgresql://usuario:senha@host:porta/database\`

### 3. Verificar Firewall e Porta
- Confirme que a porta 5432 (padrão PostgreSQL) está aberta
- Verifique regras de firewall
- Teste conexão: \`telnet host 5432\`

### 4. Verificar Rede
- Se usando Docker, verifique se os containers estão na mesma rede
- Verifique conectividade de rede entre aplicação e banco

## Soluções

### Solução 1: Reiniciar Serviço
\`\`\`bash
# Docker
docker restart nome-do-container-postgres

# Sistema
sudo systemctl restart postgresql
\`\`\`

### Solução 2: Verificar Conexão Manual
\`\`\`bash
psql -h host -U usuario -d database
\`\`\`

### Solução 3: Verificar Logs do PostgreSQL
- Acesse logs do PostgreSQL para identificar o problema
- Procure por mensagens de autenticação ou conexão

## Prevenção
- Configure pool de conexões adequadamente
- Use health checks para monitorar o banco
- Configure timeouts apropriados`,
    tags: ['banco-dados', 'postgresql', 'conexão', 'erro'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro de Rede - Timeout ou conexão recusada',
    content: `# Erro de Rede - Timeout ou Conexão Recusada

## Problema
A aplicação está apresentando erros de timeout ou conexão recusada ao tentar se comunicar com serviços externos ou internos.

## Diagnóstico

### 1. Verificar Conectividade Básica
\`\`\`bash
# Testar ping
ping servidor-destino

# Testar porta específica
telnet servidor-destino porta
# ou
nc -zv servidor-destino porta
\`\`\`

### 2. Verificar DNS
- Confirme que o DNS está resolvendo corretamente
- Teste: \`nslookup dominio.com\`
- Verifique arquivo \`/etc/hosts\` se necessário

### 3. Verificar Firewall
- Confirme que as portas necessárias estão abertas
- Verifique regras de firewall (iptables, ufw, etc.)
- Se usando cloud, verifique Security Groups

### 4. Verificar Timeout
- Aumente timeout se necessário
- Verifique se o serviço de destino está respondendo

## Soluções

### Solução 1: Verificar Configuração de Rede
- Confirme IPs e portas corretas
- Verifique se não há mudanças recentes na infraestrutura

### Solução 2: Testar com curl
\`\`\`bash
curl -v http://servidor:porta/endpoint
\`\`\`

### Solução 3: Verificar Logs
- Analise logs da aplicação
- Procure por mensagens de erro de rede específicas
- Verifique se há tentativas de reconexão

### Solução 4: Reiniciar Serviços de Rede
\`\`\`bash
# Reiniciar network manager (Linux)
sudo systemctl restart NetworkManager

# Ou reiniciar interface
sudo ifdown interface && sudo ifup interface
\`\`\`

## Prevenção
- Configure retry com backoff exponencial
- Use circuit breakers para serviços externos
- Monitore latência de rede
- Configure health checks`,
    tags: ['rede', 'timeout', 'conexão', 'firewall', 'dns'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro 500 - Erro interno do servidor',
    content: `# Erro 500 - Erro Interno do Servidor

## Problema
A aplicação está retornando erro HTTP 500 (Internal Server Error).

## Diagnóstico

### 1. Verificar Logs do Servidor
- Acesse logs da aplicação imediatamente
- Procure por stack traces ou mensagens de erro
- Verifique timestamp do erro

### 2. Verificar Recursos do Sistema
\`\`\`bash
# Verificar memória
free -h

# Verificar CPU
top
# ou
htop

# Verificar espaço em disco
df -h
\`\`\`

### 3. Verificar Banco de Dados
- Confirme que o banco está acessível
- Verifique se há queries lentas ou travadas
- Analise logs do PostgreSQL

### 4. Verificar Aplicação
- Confirme que a aplicação está rodando
- Verifique se não há processos travados
- Reinicie a aplicação se necessário

## Soluções

### Solução 1: Reiniciar Aplicação
\`\`\`bash
# Se usando PM2
pm2 restart app

# Se usando systemd
sudo systemctl restart app

# Se usando Docker
docker restart container-name
\`\`\`

### Solução 2: Verificar Variáveis de Ambiente
- Confirme que todas as variáveis estão configuradas
- Verifique especialmente secrets e chaves de API

### Solução 3: Verificar Dependências
- Confirme que todas as dependências estão instaladas
- Execute \`npm install\` se necessário

### Solução 4: Verificar Permissões
- Confirme permissões de arquivos e diretórios
- Verifique logs de permissão negada

## Prevenção
- Configure monitoramento e alertas
- Use error tracking (Sentry, etc.)
- Implemente health checks
- Configure logs estruturados`,
    tags: ['erro-500', 'servidor', 'aplicação', 'logs'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro de Autenticação - Token inválido ou expirado',
    content: `# Erro de Autenticação - Token Inválido ou Expirado

## Problema
Usuários estão recebendo erros de autenticação, como "Token inválido" ou "Sessão expirada".

## Diagnóstico

### 1. Verificar Token
- Confirme se o token está sendo enviado no header
- Formato esperado: \`Authorization: Bearer <token>\`
- Verifique se o token não está expirado

### 2. Verificar Configuração JWT
- Confirme que \`JWT_SECRET\` está configurado
- Verifique se \`JWT_EXPIRES_IN\` está adequado
- Confirme que o secret é o mesmo em todos os ambientes

### 3. Verificar Relógio do Sistema
- Tokens JWT são sensíveis a diferenças de horário
- Sincronize o relógio do servidor: \`sudo ntpdate -s time.nist.gov\`

## Soluções

### Solução 1: Fazer Login Novamente
- Peça ao usuário para fazer logout e login novamente
- Isso gerará um novo token válido

### Solução 2: Limpar Cache do Navegador
- Limpe cookies e cache do navegador
- Use modo anônimo para testar

### Solução 3: Verificar Refresh Token
- Se usando refresh tokens, verifique se estão funcionando
- Confirme que o refresh token não está expirado

### Solução 4: Verificar Configuração
\`\`\`bash
# Verificar variáveis de ambiente
echo $JWT_SECRET
echo $JWT_EXPIRES_IN
\`\`\`

## Prevenção
- Configure expiração adequada de tokens
- Implemente refresh tokens
- Use HTTPS sempre
- Configure CORS corretamente`,
    tags: ['autenticação', 'jwt', 'token', 'sessão', 'login'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro de Performance - Aplicação lenta ou travando',
    content: `# Erro de Performance - Aplicação Lenta ou Travando

## Problema
A aplicação está lenta, com tempos de resposta altos ou travando completamente.

## Diagnóstico

### 1. Verificar Recursos do Sistema
\`\`\`bash
# CPU
top
# ou
htop

# Memória
free -h
vmstat 1

# Disco I/O
iostat -x 1

# Rede
iftop
\`\`\`

### 2. Verificar Banco de Dados
- Analise queries lentas
- Verifique índices faltando
- Confirme se há locks ou deadlocks
- Use \`EXPLAIN ANALYZE\` em queries problemáticas

### 3. Verificar Aplicação
- Analise logs de performance
- Identifique endpoints lentos
- Verifique se há memory leaks
- Use profiler (Node.js: clinic.js, 0x)

## Soluções

### Solução 1: Otimizar Queries
- Adicione índices nas colunas usadas em WHERE e JOIN
- Evite SELECT *
- Use paginação em listagens grandes
- Implemente cache quando apropriado

### Solução 2: Aumentar Recursos
- Aumente memória disponível
- Escale horizontalmente (mais instâncias)
- Use load balancer

### Solução 3: Otimizar Código
- Identifique e corrija N+1 queries
- Use connection pooling
- Implemente cache (Redis, etc.)
- Otimize loops e algoritmos

### Solução 4: Configurar Cache
- Use cache para dados frequentemente acessados
- Configure TTL apropriado
- Use CDN para assets estáticos

## Prevenção
- Configure monitoramento de performance (APM)
- Use load testing regularmente
- Implemente rate limiting
- Configure alertas para degradação de performance`,
    tags: ['performance', 'lentidão', 'otimização', 'cache', 'banco-dados'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro de Build - Falha na compilação do projeto',
    content: `# Erro de Build - Falha na Compilação

## Problema
O processo de build está falhando com erros de compilação, TypeScript, ou dependências.

## Diagnóstico

### 1. Verificar Erros de TypeScript
- Execute: \`npm run build\` ou \`tsc\`
- Leia mensagens de erro cuidadosamente
- Corrija tipos incorretos

### 2. Verificar Dependências
- Confirme que \`package.json\` está correto
- Execute \`npm install\` para instalar dependências
- Verifique se há conflitos de versão

### 3. Verificar Node.js
- Confirme versão do Node.js (verifique \`.nvmrc\` ou \`package.json\`)
- Use versão LTS recomendada
- Verifique: \`node --version\`

## Soluções

### Solução 1: Limpar e Reinstalar
\`\`\`bash
# Limpar node_modules e lock files
rm -rf node_modules package-lock.json

# Reinstalar
npm install

# Tentar build novamente
npm run build
\`\`\`

### Solução 2: Verificar TypeScript
\`\`\`bash
# Verificar configuração
cat tsconfig.json

# Compilar manualmente
npx tsc --noEmit
\`\`\`

### Solução 3: Atualizar Dependências
\`\`\`bash
# Verificar dependências desatualizadas
npm outdated

# Atualizar (cuidado!)
npm update
\`\`\`

### Solução 4: Verificar Variáveis de Ambiente
- Confirme que variáveis necessárias para build estão configuradas
- Verifique arquivo \`.env\` ou variáveis de ambiente

## Prevenção
- Use CI/CD para detectar erros cedo
- Configure linting e type checking no pre-commit
- Mantenha dependências atualizadas
- Use lock files (package-lock.json)`,
    tags: ['build', 'typescript', 'compilação', 'dependências'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro de CORS - Acesso negado entre origens',
    content: `# Erro de CORS - Acesso Negado entre Origens

## Problema
A aplicação está bloqueando requisições de origens diferentes devido a política CORS.

## Diagnóstico

### 1. Verificar Mensagem de Erro
- Erro típico: "Access to fetch at 'URL' from origin 'ORIGIN' has been blocked by CORS policy"
- Verifique qual origem está tentando acessar
- Confirme qual origem está configurada no servidor

### 2. Verificar Configuração CORS
- Localize configuração CORS no código
- Verifique se a origem está na lista de permitidas
- Confirme se métodos HTTP estão permitidos

## Soluções

### Solução 1: Adicionar Origem Permitida
\`\`\`typescript
// Exemplo com Express
app.use(cors({
  origin: ['http://localhost:5173', 'https://seu-dominio.com'],
  credentials: true
}));
\`\`\`

### Solução 2: Permitir Todas as Origens (Desenvolvimento)
\`\`\`typescript
// APENAS para desenvolvimento!
app.use(cors({
  origin: '*'
}));
\`\`\`

### Solução 3: Configurar Headers Manualmente
\`\`\`typescript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://seu-dominio.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
\`\`\`

## Prevenção
- Configure CORS adequadamente para cada ambiente
- Use variáveis de ambiente para origens permitidas
- Nunca use '*' em produção
- Configure CORS antes de outros middlewares`,
    tags: ['cors', 'origem', 'acesso', 'frontend', 'api'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro de Upload - Falha ao fazer upload de arquivos',
    content: `# Erro de Upload - Falha ao Fazer Upload de Arquivos

## Problema
O sistema não está conseguindo fazer upload de arquivos, retornando erros ou timeout.

## Diagnóstico

### 1. Verificar Tamanho do Arquivo
- Confirme se o arquivo não excede o limite configurado
- Verifique configuração \`MAX_FILE_SIZE\` no servidor
- Verifique limite do cliente (browser)

### 2. Verificar Permissões
- Confirme permissões de escrita no diretório de upload
- Verifique: \`ls -la uploads/\`
- Permissões necessárias: 755 ou 775

### 3. Verificar Espaço em Disco
\`\`\`bash
df -h
\`\`\`
- Confirme que há espaço suficiente

### 4. Verificar Tipo de Arquivo
- Confirme se o tipo de arquivo é permitido
- Verifique configuração \`accept\` no frontend
- Verifique validação no backend

## Soluções

### Solução 1: Aumentar Limite de Tamanho
\`\`\`typescript
// Backend (Express)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});
\`\`\`

### Solução 2: Corrigir Permissões
\`\`\`bash
# Dar permissão de escrita
chmod 775 uploads/
chown -R usuario:grupo uploads/
\`\`\`

### Solução 3: Verificar Configuração Nginx (se aplicável)
\`\`\`nginx
client_max_body_size 50M;
\`\`\`

### Solução 4: Usar Storage Externo
- Considere usar S3, Google Cloud Storage, etc.
- Reduz carga no servidor
- Melhor para arquivos grandes

## Prevenção
- Configure limites apropriados
- Use validação de tipo de arquivo
- Implemente sanitização de nomes de arquivo
- Configure monitoramento de espaço em disco`,
    tags: ['upload', 'arquivo', 'multer', 'permissões', 'storage'],
    status: KbArticleStatus.PUBLISHED,
  },
  {
    title: 'Erro de Migração - Falha ao executar migrations do Prisma',
    content: `# Erro de Migração - Falha ao Executar Migrations do Prisma

## Problema
As migrations do Prisma estão falhando ao executar, gerando erros de schema ou banco de dados.

## Diagnóstico

### 1. Verificar Schema
- Confirme que \`schema.prisma\` está correto
- Verifique sintaxe: \`npx prisma format\`
- Confirme que não há conflitos

### 2. Verificar Estado do Banco
- Verifique migrations já aplicadas: \`npx prisma migrate status\`
- Confirme que o banco está acessível
- Verifique se há migrations pendentes

### 3. Verificar Conflitos
- Se em equipe, verifique se há migrations conflitantes
- Confirme que todos estão na mesma versão do schema

## Soluções

### Solução 1: Resetar Banco (Desenvolvimento)
\`\`\`bash
# CUIDADO: Isso apaga todos os dados!
npx prisma migrate reset
\`\`\`

### Solução 2: Criar Migration Manualmente
\`\`\`bash
# Criar nova migration
npx prisma migrate dev --name nome-da-migration

# Aplicar em produção
npx prisma migrate deploy
\`\`\`

### Solução 3: Resolver Conflitos
\`\`\`bash
# Verificar status
npx prisma migrate status

# Marcar como aplicada (se necessário)
npx prisma migrate resolve --applied nome-da-migration
\`\`\`

### Solução 4: Regenerar Client
\`\`\`bash
npx prisma generate
\`\`\`

## Prevenção
- Sempre teste migrations em ambiente de desenvolvimento
- Use versionamento adequado
- Documente migrations complexas
- Faça backup antes de aplicar em produção`,
    tags: ['prisma', 'migration', 'banco-dados', 'schema'],
    status: KbArticleStatus.PUBLISHED,
  },
];

async function main() {
  console.log('🌱 Iniciando seed de artigos de Base de Conhecimento...\n');

  // Buscar primeiro usuário ADMIN disponível
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!adminUser) {
    console.error('❌ Erro: Nenhum usuário ADMIN encontrado!');
    console.error('Por favor, crie um usuário ADMIN primeiro executando:');
    console.error('  npx tsx prisma/seed.ts');
    console.error('\nOu crie manualmente via interface web.');
    process.exit(1);
  }

  const ADMIN_USER_ID = adminUser.id;

  console.log(`✅ Usando usuário: ${adminUser.name} (${adminUser.email})\n`);

  // Criar categoria padrão se não existir
  let defaultCategory = await prisma.kbCategory.findFirst({
    where: { name: 'Geral' },
  });

  if (!defaultCategory) {
    defaultCategory = await prisma.kbCategory.create({
      data: {
        name: 'Geral',
        description: 'Artigos gerais de conhecimento',
      },
    });
    console.log('✅ Categoria "Geral" criada');
  }

  // Criar artigos
  let created = 0;
  let skipped = 0;

  for (const article of KB_ARTICLES) {
    const existing = await prisma.kbArticle.findFirst({
      where: { title: article.title },
    });

    if (existing) {
      console.log(`⏭️  Pulando: "${article.title}" (já existe)`);
      skipped++;
      continue;
    }

    await prisma.kbArticle.create({
      data: {
        ...article,
        categoryId: defaultCategory.id,
        createdById: ADMIN_USER_ID,
      },
    });

    console.log(`✅ Criado: "${article.title}"`);
    created++;
  }

  console.log(`\n✨ Seed concluído!`);
  console.log(`   - Criados: ${created}`);
  console.log(`   - Pulados: ${skipped}`);
  console.log(`   - Total: ${KB_ARTICLES.length}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

