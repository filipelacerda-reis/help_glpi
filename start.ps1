# Script de inicializacao do GLPI ETUS
# PowerShell Script

Write-Host "Iniciando GLPI ETUS..." -ForegroundColor Green

# Verificar Docker
Write-Host ""
Write-Host "Verificando Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop nao esta rodando!" -ForegroundColor Red
    Write-Host "Por favor, inicie o Docker Desktop e tente novamente." -ForegroundColor Yellow
    exit 1
}

Write-Host "Docker esta rodando" -ForegroundColor Green

# Subir banco de dados
Write-Host ""
Write-Host "Subindo banco de dados PostgreSQL..." -ForegroundColor Yellow
docker-compose up -d postgres

# Aguardar banco inicializar
Write-Host "Aguardando banco de dados inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Executar migrations
Write-Host ""
Write-Host "Executando migrations..." -ForegroundColor Yellow
Set-Location backend
npx prisma migrate dev --name init

# Executar seed
Write-Host ""
Write-Host "Executando seed..." -ForegroundColor Yellow
npx prisma db seed

# Voltar para raiz
Set-Location ..

Write-Host ""
Write-Host "Configuracao concluida!" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar os servidores:" -ForegroundColor Cyan
Write-Host "  Terminal 1 (Backend): cd backend" -ForegroundColor White
Write-Host "                        npm run dev" -ForegroundColor White
Write-Host "  Terminal 2 (Frontend): cd frontend" -ForegroundColor White
Write-Host "                         npm run dev" -ForegroundColor White
