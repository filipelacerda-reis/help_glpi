# Integração N8N - Deflexão de Tickets com IA

## 📋 Visão Geral

Esta documentação descreve a integração do sistema GLPI-ETUS com o N8N para implementar a funcionalidade de **Deflexão de Tickets com IA**. O sistema utiliza o N8N como intermediário para processar consultas de IA e retornar soluções automáticas aos usuários antes que eles criem um ticket.

## 🎯 Objetivo

Reduzir o número de tickets criados oferecendo soluções automáticas baseadas em IA quando o usuário está preenchendo o formulário de criação de ticket. A integração é acionada automaticamente quando:
- O **título** do chamado tem mais de **5 caracteres**, OU
- A **descrição** tem mais de **100 caracteres**

## 🔧 Arquitetura

```
Frontend (CreateTicketPage)
    ↓
Backend (kb.service.ts)
    ↓
N8N Webhook (N8N_QUERY_WEBHOOK)
    ↓
IA/LLM (OpenAI, Gemini, etc.)
    ↓
Resposta processada
    ↓
Frontend (exibe solução)
```

## 📦 Componentes Implementados

### 1. Backend

#### Arquivo: `backend/src/services/kb.service.ts`

**Método modificado:** `suggestArticles()`

**Funcionalidades:**
- Mantém a busca de artigos locais da base de conhecimento
- Adiciona chamada HTTP POST para o webhook do N8N
- Processa a resposta da IA e retorna junto com os artigos

**Código relevante:**
```typescript
// Chamar N8N se as condições forem atendidas
let aiSolution: string | null = null;
const shouldCallN8N = data.title.length > 5 || data.description.length > 100;

if (shouldCallN8N && env.N8N_QUERY_WEBHOOK) {
  try {
    const response = await axios.post(
      env.N8N_QUERY_WEBHOOK,
      {
        title: data.title,
        description: data.description,
      },
      {
        timeout: 10000, // 10 segundos de timeout
      }
    );

    // Extrair a resposta da IA
    if (response.data?.answer) {
      aiSolution = response.data.answer;
    } else if (response.data?.solution) {
      aiSolution = response.data.solution;
    } else if (typeof response.data === 'string') {
      aiSolution = response.data;
    }
  } catch (error) {
    // Não travar a criação do ticket se o N8N falhar
    logger.warn('Erro ao chamar N8N...');
  }
}

return {
  articles: sortedArticles,
  aiSolution,
};
```

#### Arquivo: `backend/src/config/env.ts`

**Variáveis de ambiente adicionadas:**
```typescript
N8N_INGEST_WEBHOOK: process.env.N8N_INGEST_WEBHOOK || '',
N8N_QUERY_WEBHOOK: process.env.N8N_QUERY_WEBHOOK || '',
```

### 2. Frontend

#### Arquivo: `frontend/src/pages/CreateTicketPage.tsx`

**Funcionalidades:**
- Estado para armazenar a solução da IA
- Componente visual para exibir a solução
- Botões de ação:
  - **"Isso resolveu!"**: Navega para lista de tickets (ticket não é criado)
  - **"Continuar chamado"**: Oculta a sugestão e permite continuar criando o ticket

## 🔌 Configuração do N8N

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env` na raiz do projeto:

```env
# N8N Integration
N8N_INGEST_WEBHOOK=https://seu-n8n.com/webhook/ingest
N8N_QUERY_WEBHOOK=https://seu-n8n.com/webhook/query
```

**Nota:** 
- `N8N_INGEST_WEBHOOK`: Para ingestão de dados (futuro uso)
- `N8N_QUERY_WEBHOOK`: Para consultas de IA (usado na deflexão)

### 2. Criando o Webhook no N8N

#### Passo 1: Criar um novo Workflow

1. Acesse seu N8N
2. Crie um novo workflow
3. Nome sugerido: **"Deflexão de Tickets - Consulta IA"**

#### Passo 2: Configurar o Webhook Trigger

1. Adicione o nó **"Webhook"** como trigger
2. Configure:
   - **HTTP Method**: `POST`
   - **Path**: `/webhook/query` (ou o path que você preferir)
   - **Response Mode**: `Last Node`
   - **Response Code**: `200`

3. **Copie a URL do webhook** gerada (ex: `https://seu-n8n.com/webhook/query`)
4. Cole essa URL na variável `N8N_QUERY_WEBHOOK` do `.env`

#### Passo 3: Processar os Dados Recebidos

O webhook receberá um JSON no seguinte formato:

```json
{
  "title": "Como resetar minha senha?",
  "description": "Esqueci minha senha e preciso resetá-la urgentemente"
}
```

**Campos:**
- `title` (string): Título do ticket que está sendo criado
- `description` (string): Descrição detalhada do problema

#### Passo 4: Integrar com IA

Adicione um nó de IA (ex: **OpenAI**, **Google Gemini**, ou outro):

**Exemplo com OpenAI:**
1. Adicione o nó **"OpenAI"**
2. Configure:
   - **Resource**: Sua conexão OpenAI
   - **Operation**: `Chat`
   - **Model**: `gpt-4` ou `gpt-3.5-turbo`
   - **Messages**: 
     ```json
     [
       {
         "role": "system",
         "content": "Você é um assistente de suporte técnico. Analise o problema descrito e forneça uma solução clara e objetiva. Se não houver solução direta, sugira próximos passos."
       },
       {
         "role": "user",
         "content": "Título: {{ $json.title }}\n\nDescrição: {{ $json.description }}\n\nForneça uma solução para este problema."
       }
     ]
     ```

**Exemplo com Google Gemini:**
1. Adicione o nó **"Google Gemini"**
2. Configure:
   - **Resource**: Sua conexão Gemini
   - **Model**: `gemini-pro`
   - **Prompt**: 
     ```
     Analise o seguinte problema de suporte técnico e forneça uma solução clara:

     Título: {{ $json.title }}
     Descrição: {{ $json.description }}

     Forneça uma resposta objetiva e útil.
     ```

#### Passo 5: Formatar a Resposta

Adicione um nó **"Set"** ou **"Code"** para formatar a resposta:

**Opção 1: Usando nó "Set"**
```json
{
  "answer": "{{ $json.choices[0].message.content }}"
}
```

**Opção 2: Usando nó "Code" (JavaScript)**
```javascript
// Para OpenAI
const aiResponse = $input.item.json.choices[0].message.content;

return {
  answer: aiResponse
};
```

**Importante:** A resposta deve ter um dos seguintes formatos:
- `{ "answer": "sua solução aqui" }` ✅
- `{ "solution": "sua solução aqui" }` ✅
- `"sua solução aqui"` (string direta) ✅

#### Passo 6: Retornar a Resposta

O último nó do workflow será automaticamente retornado como resposta HTTP.

### 3. Exemplo de Workflow Completo

```
┌─────────────┐
│   Webhook   │ (Recebe: title, description)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   OpenAI    │ (Processa com IA)
│   / Gemini  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     Set     │ (Formata: { answer: "..." })
└──────┬──────┘
       │
       ▼
   (Retorna)
```

## 📤 Formato de Requisição

### Request (Backend → N8N)

**URL:** `POST {N8N_QUERY_WEBHOOK}`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Como resetar minha senha?",
  "description": "Esqueci minha senha e preciso resetá-la. Já tentei usar a opção 'esqueci minha senha' mas não recebi o email."
}
```

## 📥 Formato de Resposta

### Response (N8N → Backend)

O N8N deve retornar um dos seguintes formatos:

**Formato 1 (Recomendado):**
```json
{
  "answer": "Para resetar sua senha, acesse a página de login e clique em 'Esqueci minha senha'. Verifique sua caixa de entrada e spam. Se não receber o email em 5 minutos, entre em contato com o suporte."
}
```

**Formato 2 (Alternativo):**
```json
{
  "solution": "Para resetar sua senha, acesse a página de login e clique em 'Esqueci minha senha'. Verifique sua caixa de entrada e spam. Se não receber o email em 5 minutos, entre em contato com o suporte."
}
```

**Formato 3 (String direta):**
```
"Para resetar sua senha, acesse a página de login e clique em 'Esqueci minha senha'. Verifique sua caixa de entrada e spam. Se não receber o email em 5 minutos, entre em contato com o suporte."
```

## 🎨 Interface do Usuário

Quando uma solução da IA é retornada, o usuário verá:

```
┌─────────────────────────────────────────────────┐
│ 🤖 Solução Sugerida pela IA              [✕]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Card com fundo escuro mostrando a solução]    │
│                                                 │
│ [Isso resolveu!]  [Continuar chamado]           │
└─────────────────────────────────────────────────┘
```

**Comportamento:**
- **"Isso resolveu!"**: Navega para `/tickets` sem criar o ticket
- **"Continuar chamado"**: Oculta a sugestão e permite continuar
- **[✕]**: Fecha a sugestão

## 🔍 Regras de Disparo

A chamada ao N8N ocorre quando:

```typescript
const shouldCallN8N = 
  data.title.length > 5 ||      // Título tem mais de 5 caracteres
  data.description.length > 100; // OU descrição tem mais de 100 caracteres
```

**Exemplos:**
- ✅ Título: "Como resetar senha?" (18 chars) → **Dispara**
- ✅ Descrição: "Preciso de ajuda com..." (120 chars) → **Dispara**
- ❌ Título: "Erro" (4 chars) + Descrição: "Ajuda" (5 chars) → **Não dispara**

## ⚠️ Tratamento de Erros

### No Backend

- **Timeout**: 10 segundos
- **Erro de conexão**: Logado como warning, não bloqueia criação do ticket
- **Resposta inválida**: `aiSolution` permanece `null`, artigos locais ainda são retornados

### No Frontend

- Erros são silenciados (não mostrados ao usuário)
- Se a IA falhar, apenas os artigos da base de conhecimento são exibidos

## 🧪 Testando a Integração

### 1. Teste Manual no N8N

1. Ative o workflow no N8N
2. Use a ferramenta de teste do webhook ou crie um nó "Manual Trigger"
3. Envie um JSON de teste:
   ```json
   {
     "title": "Teste de integração",
     "description": "Esta é uma descrição de teste para verificar se a integração está funcionando corretamente."
   }
   ```
4. Verifique se a resposta está no formato correto

### 2. Teste no Sistema

1. Acesse a página de criação de ticket
2. Digite um título com mais de 5 caracteres
3. Digite uma descrição
4. Aguarde alguns segundos
5. Verifique se a solução da IA aparece abaixo do campo de descrição

### 3. Verificar Logs

No backend, verifique os logs para:
- `Resposta do N8N recebida` - Sucesso
- `Erro ao chamar N8N` - Falha (mas não bloqueia)

## 📊 Monitoramento

### Métricas Recomendadas

1. **Taxa de deflexão**: Quantos tickets foram evitados
2. **Taxa de sucesso da IA**: Quantas respostas foram geradas
3. **Tempo de resposta**: Latência do N8N
4. **Taxa de erro**: Falhas na comunicação

### Logs Importantes

```typescript
logger.info('Resposta do N8N recebida', {
  hasSolution: !!aiSolution,
  titleLength: data.title.length,
});

logger.warn('Erro ao chamar N8N para sugestão de artigos', {
  error: error.message,
  url: env.N8N_QUERY_WEBHOOK,
});
```

## 🔐 Segurança

### Recomendações

1. **Autenticação no Webhook**: Configure autenticação no webhook do N8N
2. **HTTPS**: Use sempre HTTPS para os webhooks
3. **Rate Limiting**: Configure limites de taxa no N8N
4. **Validação**: Valide os dados recebidos no N8N

### Exemplo de Autenticação no N8N

No nó Webhook, configure:
- **Authentication**: `Header Auth` ou `Query Auth`
- Adicione validação no workflow para verificar o token

## 🚀 Próximos Passos

### Melhorias Futuras

1. **Cache de respostas**: Cachear respostas similares
2. **Feedback do usuário**: Coletar feedback sobre a qualidade das respostas
3. **Aprendizado**: Usar feedback para melhorar as respostas
4. **Múltiplos provedores**: Fallback entre diferentes IAs
5. **Análise de sentimento**: Detectar urgência no título/descrição

### N8N_INGEST_WEBHOOK

A variável `N8N_INGEST_WEBHOOK` está preparada para uso futuro, possivelmente para:
- Ingestão de tickets criados
- Sincronização de base de conhecimento
- Análise de métricas

## 📝 Checklist de Configuração

- [ ] N8N instalado e acessível
- [ ] Workflow criado no N8N
- [ ] Webhook configurado
- [ ] Integração com IA configurada (OpenAI/Gemini/etc)
- [ ] Formatação de resposta configurada
- [ ] Variáveis de ambiente configuradas no `.env`
- [ ] Backend reiniciado após adicionar variáveis
- [ ] Teste manual realizado
- [ ] Teste no sistema realizado
- [ ] Logs verificados

## 🆘 Troubleshooting

### Problema: Solução da IA não aparece

**Possíveis causas:**
1. Variável `N8N_QUERY_WEBHOOK` não configurada
2. Workflow não está ativo no N8N
3. Título/descrição não atende aos critérios (>5 chars ou >100 chars)
4. Erro na comunicação (verificar logs)

**Solução:**
- Verificar variáveis de ambiente
- Verificar logs do backend
- Testar webhook diretamente no N8N

### Problema: Erro de timeout

**Causa:** N8N demorando mais de 10 segundos para responder

**Solução:**
- Otimizar workflow no N8N
- Considerar aumentar timeout (não recomendado)
- Usar cache para respostas similares

### Problema: Formato de resposta incorreto

**Causa:** N8N retornando formato não suportado

**Solução:**
- Verificar formato da resposta no workflow
- Garantir que retorna `{ answer: "..." }` ou `{ solution: "..." }`

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs do backend
2. Verificar execuções do workflow no N8N
3. Testar webhook diretamente com ferramentas como Postman

---

**Última atualização:** Dezembro 2024
**Versão:** 1.0

