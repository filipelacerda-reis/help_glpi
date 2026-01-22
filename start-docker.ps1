# Script para iniciar toda a aplicação via Docker

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  INICIANDO APLICACAO VIA DOCKER" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# Verificar se Docker está rodando
Write-Host "1. Verificando Docker..." -ForegroundColor Cyan
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "   ✅ Docker encontrado: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker não está instalado ou não está rodando" -ForegroundColor Red
    Write-Host "   💡 Instale o Docker Desktop e tente novamente" -ForegroundColor Yellow
    exit 1
}

# Verificar se docker-compose está disponível
Write-Host "`n2. Verificando Docker Compose..." -ForegroundColor Cyan
try {
    $composeVersion = docker compose version 2>&1
    Write-Host "   ✅ Docker Compose encontrado" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker Compose não encontrado" -ForegroundColor Red
    exit 1
}

# Verificar se .env existe
Write-Host "`n3. Verificando arquivo .env..." -ForegroundColor Cyan
if (Test-Path ".env") {
    Write-Host "   ✅ Arquivo .env encontrado" -ForegroundColor Green
    
    # Verificar se DB_PASSWORD está configurado
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "DB_PASSWORD\s*=") {
        Write-Host "   ✅ DB_PASSWORD configurado no .env" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  DB_PASSWORD não encontrado no .env" -ForegroundColor Yellow
        Write-Host "   💡 Adicione DB_PASSWORD=suasenha no arquivo .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Arquivo .env não encontrado" -ForegroundColor Yellow
    Write-Host "   💡 Criando .env de exemplo..." -ForegroundColor Yellow
    
    $envExample = @"
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=glpi_etus
DB_PASSWORD=suasenhaaqui
DB_NAME=glpi_etus
DB_SCHEMA=public

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
"@
    
    Set-Content -Path ".env" -Value $envExample
    Write-Host "   ✅ Arquivo .env criado. Configure DB_PASSWORD e execute novamente." -ForegroundColor Green
    exit 1
}

# Parar containers existentes
Write-Host "`n4. Parando containers existentes..." -ForegroundColor Cyan
docker compose down 2>&1 | Out-Null
Write-Host "   ✅ Containers parados" -ForegroundColor Green

# Iniciar PostgreSQL e Redis primeiro
Write-Host "`n5. Iniciando PostgreSQL e Redis..." -ForegroundColor Cyan
docker compose up -d postgres redis

# Aguardar PostgreSQL estar pronto
Write-Host "`n6. Aguardando PostgreSQL estar pronto..." -ForegroundColor Cyan
$maxAttempts = 30
$attempt = 0
$postgresReady = $false

while ($attempt -lt $maxAttempts -and -not $postgresReady) {
    Start-Sleep -Seconds 2
    $attempt++
    $healthCheck = docker exec glpi_etus_db pg_isready -U glpi_etus 2>&1
    if ($LASTEXITCODE -eq 0) {
        $postgresReady = $true
        Write-Host "   ✅ PostgreSQL está pronto!" -ForegroundColor Green
    } else {
        Write-Host "   ⏳ Aguardando PostgreSQL... ($attempt/$maxAttempts)" -ForegroundColor Yellow
    }
}

if (-not $postgresReady) {
    Write-Host "   ❌ PostgreSQL não ficou pronto a tempo" -ForegroundColor Red
    exit 1
}

# Executar migrations
Write-Host "`n7. Executando migrations do Prisma..." -ForegroundColor Cyan
Set-Location backend

# Construir DATABASE_URL para o Prisma
$envContent = Get-Content "../.env" -Raw
if ($envContent -match "DB_PASSWORD\s*=\s*(.+)$") {
    $dbPassword = $matches[1].Trim()
    $dbUser = if ($envContent -match "DB_USER\s*=\s*(.+)$") { $matches[1].Trim() } else { "glpi_etus" }
    $dbName = if ($envContent -match "DB_NAME\s*=\s*(.+)$") { $matches[1].Trim() } else { "glpi_etus" }
    
    $encodedPassword = [System.Web.HttpUtility]::UrlEncode($dbPassword)
    $databaseUrl = "postgresql://${dbUser}:${encodedPassword}@localhost:5432/${dbName}?schema=public"
    
    $env:DATABASE_URL = $databaseUrl
    
    Write-Host "   Executando migrations..." -ForegroundColor Yellow
    npx prisma migrate deploy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migrations executadas com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erro ao executar migrations" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    
    # Executar seed
    Write-Host "`n8. Executando seed para criar usuário admin..." -ForegroundColor Cyan
    npx prisma db seed
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Seed executado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Erro ao executar seed (pode ser que já exista)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ DB_PASSWORD não encontrado no .env" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

# Iniciar backend e frontend
Write-Host "`n9. Iniciando Backend e Frontend..." -ForegroundColor Cyan
docker compose up -d backend frontend

# Aguardar serviços iniciarem
Write-Host "`n10. Aguardando serviços iniciarem..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Verificar status
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  APLICACAO INICIADA COM SUCESSO!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "📋 Credenciais de login:" -ForegroundColor Cyan
Write-Host "   Email: admin@example.com" -ForegroundColor White
Write-Host "   Senha: admin123" -ForegroundColor White

Write-Host "`n🌐 URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:  http://localhost:3000" -ForegroundColor White

Write-Host "`n📊 Status dos containers:" -ForegroundColor Cyan
docker compose ps

Write-Host "`n💡 Comandos úteis:" -ForegroundColor Yellow
Write-Host "   Ver logs: docker compose logs -f" -ForegroundColor Gray
Write-Host "   Parar tudo: docker compose down" -ForegroundColor Gray
Write-Host "   Reiniciar: docker compose restart" -ForegroundColor Gray

