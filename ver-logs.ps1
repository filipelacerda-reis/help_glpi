# Script Helper para Visualizar Logs
# Uso: .\ver-logs.ps1 [backend|frontend|todos|processos]

param(
    [Parameter(Position=0)]
    [ValidateSet("backend", "frontend", "todos", "processos", "reiniciar")]
    [string]$Acao = "processos"
)

Write-Host "`n=== VISUALIZADOR DE LOGS GLPI ETUS ===" -ForegroundColor Cyan
Write-Host ""

switch ($Acao) {
    "processos" {
        Write-Host "📊 Processos Node.js em execução:" -ForegroundColor Yellow
        $processos = Get-Process node -ErrorAction SilentlyContinue
        if ($processos) {
            $processos | Format-Table Id,ProcessName,StartTime,CPU -AutoSize
            Write-Host "💡 Dica: Os logs aparecem nas janelas do PowerShell onde os processos foram iniciados" -ForegroundColor Green
            Write-Host "   Procure por janelas minimizadas na barra de tarefas ou use Alt+Tab" -ForegroundColor Green
        } else {
            Write-Host "❌ Nenhum processo Node.js encontrado" -ForegroundColor Red
        }
    }
    
    "backend" {
        Write-Host "🔵 Iniciando Backend em janela visível..." -ForegroundColor Blue
        Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*backend*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        $backendPath = Join-Path $PSScriptRoot "backend"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host '=== BACKEND LOGS ===' -ForegroundColor Blue; npm run dev"
        Write-Host "✅ Backend iniciado! Verifique a nova janela do PowerShell" -ForegroundColor Green
    }
    
    "frontend" {
        Write-Host "🟡 Iniciando Frontend em janela visível..." -ForegroundColor Yellow
        Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*frontend*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        $frontendPath = Join-Path $PSScriptRoot "frontend"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host '=== FRONTEND LOGS ===' -ForegroundColor Yellow; npm run dev"
        Write-Host "✅ Frontend iniciado! Verifique a nova janela do PowerShell" -ForegroundColor Green
    }
    
    "todos" {
        Write-Host "🔄 Iniciando Backend e Frontend em janelas visíveis..." -ForegroundColor Cyan
        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 2
        
        $backendPath = Join-Path $PSScriptRoot "backend"
        $frontendPath = Join-Path $PSScriptRoot "frontend"
        
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host '=== BACKEND LOGS ===' -ForegroundColor Blue; npm run dev"
        Start-Sleep -Seconds 2
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host '=== FRONTEND LOGS ===' -ForegroundColor Yellow; npm run dev"
        
        Write-Host "✅ Ambos iniciados! Verifique as novas janelas do PowerShell" -ForegroundColor Green
    }
    
    "reiniciar" {
        Write-Host "🔄 Reiniciando todos os serviços..." -ForegroundColor Cyan
        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 3
        
        $backendPath = Join-Path $PSScriptRoot "backend"
        $frontendPath = Join-Path $PSScriptRoot "frontend"
        
        Write-Host "🔵 Iniciando Backend..." -ForegroundColor Blue
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host '=== BACKEND LOGS ===' -ForegroundColor Blue; npm run dev"
        Start-Sleep -Seconds 3
        
        Write-Host "🟡 Iniciando Frontend..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host '=== FRONTEND LOGS ===' -ForegroundColor Yellow; npm run dev"
        
        Write-Host "✅ Serviços reiniciados! Verifique as janelas do PowerShell" -ForegroundColor Green
    }
}

Write-Host ""

