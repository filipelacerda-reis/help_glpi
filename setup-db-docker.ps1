# Script para executar migrations e seed nos containers Docker

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURANDO BANCO DE DADOS" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# Verificar se os containers estão rodando
Write-Host "1. Verificando containers..." -ForegroundColor Cyan

# Tentar diferentes formas de verificar
$backendContainer = docker ps --filter "name=glpi_etus_backend" --format "{{.Names}}" 2>&1
if ($backendContainer -match "glpi_etus_backend") {
    Write-Host "   ✅ Container backend encontrado: $backendContainer" -ForegroundColor Green
} else {
    Write-Host "   ❌ Container backend não encontrado" -ForegroundColor Red
    Write-Host "   💡 Certifique-se de que os containers estão rodando no Docker Desktop" -ForegroundColor Yellow
    exit 1
}

$dbContainer = docker ps --filter "name=glpi_etus_db" --format "{{.Names}}" 2>&1
if ($dbContainer -match "glpi_etus_db") {
    Write-Host "   ✅ Container PostgreSQL encontrado: $dbContainer" -ForegroundColor Green
} else {
    Write-Host "   ❌ Container PostgreSQL não encontrado" -ForegroundColor Red
    exit 1
}

# Executar migrations
Write-Host "`n2. Executando migrations do Prisma..." -ForegroundColor Cyan
Write-Host "   Comando: docker exec glpi_etus_backend npx prisma migrate deploy" -ForegroundColor Gray

$migrationResult = docker exec glpi_etus_backend npx prisma migrate deploy 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Migrations executadas com sucesso!" -ForegroundColor Green
    Write-Host $migrationResult
} else {
    Write-Host "   ⚠️  Erro ao executar migrations:" -ForegroundColor Yellow
    Write-Host $migrationResult
    Write-Host "`n   💡 Tentando executar seed mesmo assim..." -ForegroundColor Yellow
}

# Executar seed
Write-Host "`n3. Executando seed para criar usuário admin..." -ForegroundColor Cyan
Write-Host "   Comando: docker exec glpi_etus_backend npx prisma db seed" -ForegroundColor Gray

$seedResult = docker exec glpi_etus_backend npx prisma db seed 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Seed executado com sucesso!" -ForegroundColor Green
    Write-Host $seedResult
} else {
    Write-Host "   ⚠️  Resultado do seed:" -ForegroundColor Yellow
    Write-Host $seedResult
}

# Verificar se o usuário admin foi criado
Write-Host "`n4. Verificando se o usuário admin foi criado..." -ForegroundColor Cyan

# Criar script temporário para verificar
$checkScript = @"
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
  try {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
    if (admin) {
      console.log('✅ Usuário admin encontrado!');
      console.log('   Email:', admin.email);
      console.log('   Nome:', admin.name);
      console.log('   Role:', admin.role);
    } else {
      console.log('❌ Usuário admin NÃO encontrado');
    }
  } catch (error: any) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.`$disconnect();
  }
}
check();
"@

# Copiar script para o container e executar
$checkScript | docker exec -i glpi_etus_backend sh -c "cat > /tmp/check-admin.ts && npx tsx /tmp/check-admin.ts"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  CONFIGURACAO CONCLUIDA" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "📋 Credenciais de login:" -ForegroundColor Cyan
Write-Host "   Email: admin@example.com" -ForegroundColor White
Write-Host "   Senha: admin123" -ForegroundColor White

Write-Host "`n🌐 URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:  http://localhost:8080" -ForegroundColor White

Write-Host "`n💡 Se ainda não conseguir fazer login:" -ForegroundColor Yellow
Write-Host "   1. Verifique os logs do backend: docker logs glpi_etus_backend" -ForegroundColor Gray
Write-Host "   2. Verifique se o backend está conectando ao banco" -ForegroundColor Gray
Write-Host "   3. Execute este script novamente se necessário" -ForegroundColor Gray

