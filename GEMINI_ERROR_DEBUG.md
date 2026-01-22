# 🔍 Debug de Erro do Gemini

## Problema Identificado

O log mostra:
```
{"error":"[object Object]","level":"error","message":"Erro ao gerar solução com IA"}
```

Isso indica que o erro não está sendo serializado corretamente.

## ✅ Melhorias Implementadas

### 1. Logging Detalhado
Agora o erro é logado com:
- `errorMessage`: Mensagem do erro
- `errorName`: Nome do erro
- `errorStack`: Stack trace completo
- `geminiResponse`: Resposta da API (se disponível)
- `errorString`: Serialização completa do erro

### 2. Verificações Adicionais
- Verifica se `geminiClient` existe
- Verifica se `getGenerativeModel` é uma função
- Loga informações do modelo antes de chamar

## 🔍 Próximos Passos para Debug

### 1. Verificar Logs Melhorados
Após as mudanças, os logs devem mostrar mais detalhes:
```json
{
  "errorMessage": "...",
  "errorName": "...",
  "errorStack": "...",
  "geminiResponse": { ... },
  "errorString": "..."
}
```

### 2. Possíveis Causas

#### A. API Key Inválida ou Não Configurada
**Sintoma**: Erro de autenticação
**Solução**: 
- Verifique `GEMINI_API_KEY` no `.env`
- Confirme que a chave está correta
- Teste a chave diretamente na API do Google

#### B. Modelo Não Disponível
**Sintoma**: Erro 404 ou "model not found"
**Solução**:
- Verifique se `gemini-1.5-flash` está disponível
- Tente `gemini-pro` como alternativa

#### C. Rate Limit
**Sintoma**: Erro 429
**Solução**:
- Aguarde alguns minutos
- Verifique limites da API

#### D. Prompt Muito Longo
**Sintoma**: Erro de tamanho
**Solução**:
- Reduza o número de artigos no contexto
- Limite o tamanho do prompt

### 3. Teste Manual da API Key

```bash
# Teste direto com curl
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=SUA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Olá, como você está?"
      }]
    }]
  }'
```

### 4. Verificar Instalação

```bash
cd backend
npm list @google/generative-ai
```

Se não estiver instalado:
```bash
npm install @google/generative-ai
```

### 5. Verificar Variáveis de Ambiente

```bash
# No backend
echo $GEMINI_API_KEY

# Ou verificar no código
console.log(process.env.GEMINI_API_KEY)
```

## 🛠️ Solução Alternativa

Se o problema persistir, podemos:

1. **Usar modelo diferente**:
   ```typescript
   model: "gemini-pro" // em vez de gemini-1.5-flash
   ```

2. **Simplificar o prompt**:
   - Reduzir tamanho do contexto
   - Usar menos artigos

3. **Adicionar retry logic**:
   - Tentar novamente em caso de erro temporário
   - Implementar backoff exponencial

## 📊 Monitoramento

Após aplicar as mudanças, monitore os logs para:
- Ver a mensagem de erro completa
- Identificar o tipo de erro (autenticação, rate limit, etc.)
- Verificar se o Gemini client está inicializado

---

**Execute novamente e verifique os logs melhorados para identificar o problema específico.**

