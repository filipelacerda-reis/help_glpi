# Configuração do Banco de Dados no Docker

Como os containers já estão rodando no Docker Desktop, execute os seguintes comandos para configurar o banco de dados:

## Opção 1: Via Terminal do Docker Desktop

1. Abra o Docker Desktop
2. Clique no container `glpi_etus_backend`
3. Clique na aba "Exec" ou "Terminal"
4. Execute os comandos abaixo:

### 1. Executar Migrations

```bash
npx prisma migrate deploy
```

### 2. Executar Seed (criar usuário admin)

```bash
npx prisma db seed
```

### 3. Verificar se o usuário admin foi criado

```bash
npx tsx scripts/check-admin.ts
```

## Opção 2: Via PowerShell (se o Docker CLI estiver funcionando)

Execute no PowerShell (como Administrador):

```powershell
# Executar migrations
docker exec glpi_etus_backend npx prisma migrate deploy

# Executar seed
docker exec glpi_etus_backend npx prisma db seed

# Verificar usuário admin
docker exec glpi_etus_backend npx tsx scripts/check-admin.ts
```

## Opção 3: Via Interface do Docker Desktop

1. Abra o Docker Desktop
2. Vá em "Containers"
3. Clique em `glpi_etus_backend`
4. Clique em "Exec" ou no ícone de terminal
5. Execute os comandos acima

## Credenciais de Login

Após executar o seed, você poderá fazer login com:

- **Email:** `admin@example.com`
- **Senha:** `admin123`

## Verificar Logs

Para ver os logs do backend e verificar se há erros:

```powershell
docker logs glpi_etus_backend --tail 50 -f
```

Ou via Docker Desktop:
1. Clique no container `glpi_etus_backend`
2. Vá na aba "Logs"

## Verificar Status dos Containers

```powershell
docker ps --filter "name=glpi_etus"
```

## Solução de Problemas

### Se o comando `npx` não funcionar no container:

```bash
# Entrar no container
docker exec -it glpi_etus_backend sh

# Dentro do container, executar:
cd /app
npm run prisma:migrate:deploy
npm run prisma:seed
```

### Se houver erro de conexão com o banco:

Verifique se o container do PostgreSQL está rodando:
```powershell
docker ps --filter "name=glpi_etus_db"
```

### Se o backend não estiver conectando ao Redis:

Verifique se o container do Redis está rodando:
```powershell
docker ps --filter "name=glpi_etus_redis"
```

## URLs da Aplicação

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:8080 (ou porta configurada no .env)
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

