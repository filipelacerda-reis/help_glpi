# Script para verificar conexao com o banco de dados
# Uso: .\scripts\check-db.ps1

Write-Host "Verificando conexao com PostgreSQL..." -ForegroundColor Cyan
Write-Host ""

# Verificar se a porta esta aberta
Write-Host "1. Verificando porta 5432..." -ForegroundColor Yellow
$portCheck = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue

if ($portCheck) {
    Write-Host "   OK: Porta 5432 esta acessivel" -ForegroundColor Green
} else {
    Write-Host "   ERRO: Porta 5432 nao esta acessivel" -ForegroundColor Red
    Write-Host "   Dica: Verifique se o PostgreSQL esta rodando" -ForegroundColor Yellow
}

Write-Host ""

# Verificar Docker
Write-Host "2. Verificando Docker Compose..." -ForegroundColor Yellow
try {
    $dockerStatus = docker ps --filter "name=postgres" --format "{{.Names}} - {{.Status}}" 2>$null
    if ($dockerStatus) {
        Write-Host "   OK: Container PostgreSQL encontrado:" -ForegroundColor Green
        Write-Host "      $dockerStatus" -ForegroundColor Gray
    } else {
        Write-Host "   AVISO: Nenhum container PostgreSQL rodando no Docker" -ForegroundColor Yellow
        Write-Host "   Dica: Execute: docker-compose up -d postgres" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   AVISO: Docker nao esta rodando ou nao esta instalado" -ForegroundColor Yellow
}

Write-Host ""

# Verificar .env
Write-Host "3. Verificando arquivo .env..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envPath) {
    Write-Host "   OK: Arquivo .env encontrado" -ForegroundColor Green
    $dbUrl = Get-Content $envPath | Select-String "DATABASE_URL"
    if ($dbUrl) {
        Write-Host "   OK: DATABASE_URL configurado" -ForegroundColor Green
        Write-Host "      $($dbUrl.ToString().Substring(0, [Math]::Min(60, $dbUrl.ToString().Length)))..." -ForegroundColor Gray
    } else {
        Write-Host "   ERRO: DATABASE_URL nao encontrado no .env" -ForegroundColor Red
    }
} else {
    Write-Host "   ERRO: Arquivo .env nao encontrado em: $envPath" -ForegroundColor Red
    Write-Host "   Dica: Crie o arquivo .env com DATABASE_URL" -ForegroundColor Yellow
}

Write-Host ""

# Teste de conexao Prisma
Write-Host "4. Testando conexao com Prisma..." -ForegroundColor Yellow
$testScript = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$connect()
    .then(() => {
        console.log('OK: Conectado ao banco de dados!');
        prisma.$disconnect();
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERRO:', e.message);
        prisma.$disconnect();
        process.exit(1);
    });
'@

$testFile = Join-Path $env:TEMP "prisma-test-$(Get-Random).js"
$testScript | Out-File -FilePath $testFile -Encoding UTF8

try {
    Push-Location (Join-Path $PSScriptRoot "..")
    $result = node $testFile 2>&1
    Write-Host $result
} catch {
    Write-Host "   ERRO ao executar teste: $_" -ForegroundColor Red
} finally {
    Pop-Location
    Remove-Item $testFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Resumo:" -ForegroundColor Cyan
Write-Host "   - Se a porta nao esta acessivel: Inicie o PostgreSQL (Docker ou local)" -ForegroundColor Gray
Write-Host "   - Se Docker nao esta rodando: Abra o Docker Desktop" -ForegroundColor Gray
Write-Host "   - Se .env nao existe: Crie com DATABASE_URL configurado" -ForegroundColor Gray
Write-Host ""
