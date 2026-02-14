# ✅ Checklist Pré-Deploy - Deflexão de Tickets com IA (RAG)

## 📋 Verificações Necessárias Antes do Deploy

### 1. ✅ Dependências
- [x] `@google/generative-ai` está no `package.json` (versão ^0.21.0)
- [x] `axios` está no `package.json` (já existia)
- [x] Todas as dependências estão instaladas

### 2. ✅ Variáveis de Ambiente

**Obrigatórias:**
- [ ] `GEMINI_API_KEY` - **CRÍTICO** para funcionamento do RAG
  - Obter em: https://makersuite.google.com/app/apikey
  - Adicionar no `.env` do backend em produção

**Opcionais (N8N):**
- [ ] `N8N_QUERY_WEBHOOK` - Para integração com N8N (opcional)
- [ ] `N8N_INGEST_WEBHOOK` - Para ingestão de dados (opcional, futuro)

**Obrigatórias (Admin Console / segredos):**
- [ ] `CONFIG_ENCRYPTION_KEY` - **CRÍTICO** para salvar segredos no Admin Console (ex.: SAML_CERT)

**Verificar no `.env` de produção:**
```bash
# Backend - Obrigatório para RAG
GEMINI_API_KEY=<SUA_CHAVE_GEMINI>

# Backend - Obrigatório para Admin Console
CONFIG_ENCRYPTION_KEY=seu-segredo-forte

# Backend - Opcional (N8N)
N8N_QUERY_WEBHOOK=https://seu-n8n.com/webhook/query
N8N_INGEST_WEBHOOK=https://seu-n8n.com/webhook/ingest
```

### 3. ✅ Código Implementado

**Backend:**
- [x] `backend/src/services/kb.service.ts` - Método `generateAiSolution()` implementado
- [x] `backend/src/controllers/kb.controller.ts` - Controller `getAiSolution()` implementado
- [x] `backend/src/routes/kb.routes.ts` - Rota `POST /api/kb/ai-solution` registrada
- [x] `backend/src/config/env.ts` - Variáveis N8N adicionadas
- [x] Modelo Gemini corrigido para `gemini-2.5-flash` (funcionando)

**Frontend:**
- [x] `frontend/src/services/kb.service.ts` - Método `getAiSolution()` implementado
- [x] `frontend/src/pages/CreateTicketPage.tsx` - Componente RAG implementado
- [x] Debounce de 1.5s configurado
- [x] Componente visual com Markdown implementado

### 4. ✅ Banco de Dados

**Migrations:**
- [x] Nenhuma migration nova necessária (usa tabelas existentes: `kb_articles`, `kb_categories`)

**Seed (Opcional - para testes):**
- [x] Script de seed criado: `backend/prisma/seed-kb-articles.ts`
- [ ] Executar seed após deploy para popular KB com artigos de teste:
  ```bash
  docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed-kb-articles.ts
  ```

### 5. ✅ Script de Deploy

**Verificações no `deploy-on-vm.sh`:**
- [x] Script preserva arquivos `.env` (não sobrescreve)
- [x] Script preserva configuração Cloudflare Tunnel
- [x] Script executa migrations automaticamente
- [x] Script verifica status dos containers

**Arquivos a serem copiados:**
- [x] Código backend atualizado
- [x] Código frontend atualizado
- [x] Scripts de seed (opcional)

### 6. ✅ Documentação

**Arquivos de documentação criados:**
- [x] `N8N_INTEGRATION.md` - Integração com N8N
- [x] `KB_SEED_INSTRUCTIONS.md` - Instruções para popular KB
- [x] `KB_SEED_INSTRUCTIONS.md` - Instruções para popular Base de Conhecimento
- [x] `N8N_INTEGRATION.md` - Integração opcional de IA com N8N
- [x] `DEPLOY_INSTRUCTIONS.md` - Guia rápido de deploy

**Nota:** O script de deploy exclui arquivos `.md` exceto os essenciais. Se quiser incluir a documentação nova, ajuste o `.rsync-exclude`.

**Admin Console / SSO:**
- [x] `docs/admin-console.md`
- [x] `docs/sso-google-workspace.md`

### 7. ⚠️ Ações Necessárias ANTES do Deploy

#### 7.1. Configurar GEMINI_API_KEY em Produção

**CRÍTICO:** A funcionalidade RAG não funcionará sem esta variável!

1. Obter API Key:
   - Acesse: https://makersuite.google.com/app/apikey
   - Crie uma nova API key ou use uma existente
   - Copie a chave

2. Adicionar no `.env` de produção:
   ```bash
   # No servidor, edite o .env do backend
   nano /opt/glpi-etus/backend/.env
   # ou
   nano /opt/glpi-etus/.env
   ```

3. Adicionar a linha:
   ```env
   GEMINI_API_KEY=<SUA_CHAVE_GEMINI>
   ```

4. Reiniciar o container backend:
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```

#### 7.2. (Opcional) Popular Base de Conhecimento

Após o deploy, execute o seed para ter artigos de teste:

```bash
cd /opt/glpi-etus
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed-kb-articles.ts
```

Isso criará 10 artigos sobre erros comuns (deploy, conexão, rede, etc.)

### 8. ✅ Verificações Pós-Deploy

Após executar o deploy, verificar:

1. **Logs do Backend:**
   ```bash
   docker compose -f docker-compose.prod.yml logs backend | grep -i gemini
   ```
   Deve mostrar: `✅ Gemini client inicializado com sucesso`

2. **Testar RAG:**
   - Acesse a aplicação
   - Vá em "Criar Ticket"
   - Digite: "Erro de deploy na aplicação"
   - Adicione uma descrição
   - Aguarde 1.5 segundos
   - Deve aparecer solução gerada pela IA

3. **Verificar Erros:**
   ```bash
   docker compose -f docker-compose.prod.yml logs backend | grep -i error
   ```
   Não deve haver erros relacionados ao Gemini

### 9. 📝 Comandos Úteis Pós-Deploy

```bash
# Ver logs do backend em tempo real
docker compose -f docker-compose.prod.yml logs -f backend

# Verificar se Gemini está configurado
docker compose -f docker-compose.prod.yml exec backend sh -c 'echo $GEMINI_API_KEY | cut -c1-10'

# Executar seed de artigos KB
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed-kb-articles.ts

# Verificar artigos criados
docker compose -f docker-compose.prod.yml exec backend npx prisma studio
```

## 🚀 Passos para Deploy

### 1. Preparar Código Local
```bash
# Garantir que está tudo commitado e atualizado
git status
```

### 2. Copiar para VM
```bash
# Copiar diretório atualizado para a VM
# (ajustar caminho conforme necessário)
scp -r glpi-etus-atualizado usuario@vm:/home/filipe_lacerda/glpi_atualizado
```

### 3. Executar Deploy na VM
```bash
# Conectar na VM
ssh usuario@vm

# Ir para o diretório
cd /home/filipe_lacerda/glpi_atualizado

# Dar permissão de execução
chmod +x deploy-on-vm.sh

# Executar deploy
./deploy-on-vm.sh
```

### 4. Configurar GEMINI_API_KEY (CRÍTICO)
```bash
# Após deploy, editar .env
nano /opt/glpi-etus/backend/.env
# ou
nano /opt/glpi-etus/.env

# Adicionar:
GEMINI_API_KEY=<SUA_CHAVE_GEMINI>

# Reiniciar backend
cd /opt/glpi-etus
docker compose -f docker-compose.prod.yml restart backend
```

### 5. (Opcional) Popular KB
```bash
cd /opt/glpi-etus
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed-kb-articles.ts
```

## ⚠️ Problemas Comuns

### Problema: RAG não funciona
**Causa:** `GEMINI_API_KEY` não configurada
**Solução:** Adicionar no `.env` e reiniciar backend

### Problema: Erro 404 no modelo
**Causa:** Modelo incorreto (já corrigido para `gemini-2.5-flash`)
**Solução:** Verificar se o código está atualizado

### Problema: Nenhuma solução aparece
**Causa:** Base de conhecimento vazia
**Solução:** Executar seed de artigos KB

## ✅ Checklist Final

Antes de executar o deploy, confirme:

- [ ] Código está atualizado e testado localmente
- [ ] `GEMINI_API_KEY` está pronta para adicionar em produção
- [ ] Script `deploy-on-vm.sh` está no diretório a ser copiado
- [ ] Backup será feito automaticamente pelo script
- [ ] Você tem acesso SSH à VM
- [ ] Você sabe onde está o `.env` de produção

## 🎯 Após Deploy

1. ✅ Verificar logs do backend
2. ✅ Configurar `GEMINI_API_KEY` no `.env`
3. ✅ Reiniciar container backend
4. ✅ (Opcional) Executar seed de artigos KB
5. ✅ Testar funcionalidade RAG na interface

---

**Status**: ✅ **PRONTO PARA DEPLOY**

**Última atualização**: Dezembro 2024
