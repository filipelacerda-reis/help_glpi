# Script para encerrar processos usando uma porta específica
# Uso: .\scripts\kill-port.ps1 -Port 8080

param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "Procurando processos usando a porta $Port..." -ForegroundColor Yellow

$processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($processId in $processes) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Encerrando processo: $($process.ProcessName) (PID: $processId)" -ForegroundColor Red
            Stop-Process -Id $processId -Force
        }
    }
    Write-Host "Processos encerrados com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Nenhum processo encontrado usando a porta $Port" -ForegroundColor Green
}

# Aguardar um pouco para a porta ser liberada
Start-Sleep -Seconds 2

# Verificar se a porta está livre (ignorar TIME_WAIT)
$remaining = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "⚠️  Aviso: Ainda há processos LISTENING na porta $Port" -ForegroundColor Red
    Write-Host "   PIDs: $($remaining.OwningProcess -join ', ')" -ForegroundColor Yellow
} else {
    Write-Host "✅ Porta $Port está livre para uso!" -ForegroundColor Green
    Write-Host "   (Conexões em TIME_WAIT são normais e não impedem o uso da porta)" -ForegroundColor Gray
}

