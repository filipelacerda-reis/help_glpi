#!/bin/bash
# Script para encerrar processos usando uma porta específica
# Uso: ./scripts/kill-port.sh 8080

PORT=${1:-8080}

echo "Procurando processos usando a porta $PORT..."

# Linux/Mac
if command -v lsof &> /dev/null; then
    PIDS=$(lsof -ti:$PORT)
    if [ -z "$PIDS" ]; then
        echo "Nenhum processo encontrado usando a porta $PORT"
        exit 0
    fi
    
    echo "Encerrando processos: $PIDS"
    kill -9 $PIDS
    echo "Processos encerrados com sucesso!"
elif command -v fuser &> /dev/null; then
    fuser -k $PORT/tcp
    echo "Processos encerrados com sucesso!"
else
    echo "Erro: lsof ou fuser não encontrados. Instale um deles."
    exit 1
fi

