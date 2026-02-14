# 🚀 Instruções de Deploy - Deflexão de Tickets com IA (RAG)

## ✅ Status: PRONTO PARA DEPLOY

Todas as funcionalidades foram implementadas e testadas. O sistema está pronto para deploy em produção.

## 📋 Pré-requisitos

### 1. Variável de Ambiente Obrigatória

**CRÍTICO:** A funcionalidade RAG não funcionará sem `GEMINI_API_KEY`!

- Obter em: https://makersuite.google.com/app/apikey
- Adicionar no `.env` do backend em produção após o deploy

### 1.1 Variável obrigatória para Admin Console (segredos)

**CRÍTICO:** Para salvar segredos no Admin Console (ex.: SAML_CERT), configure:

```
CONFIG_ENCRYPTION_KEY=seu-segredo-forte
```

O `deploy-on-vm.sh` **não sobrescreve** o `.env` de produção, então este valor deve ser mantido no servidor.

### 2. Arquivos Necessários

Todos os arquivos necessários estão no repositório:
- ✅ Código backend atualizado
- ✅ Código frontend atualizado
- ✅ Script de deploy (`deploy-on-vm.sh`)
- ✅ Script de seed (`backend/prisma/seed-kb-articles.ts`)

## 🚀 Passos para Deploy

### Passo 1: Copiar Código para VM

```bash
# Do seu ambiente local, copiar para a VM
scp -r glpi-etus-atualizado usuario@vm:/home/filipe_lacerda/glpi_atualizado
```

### Passo 2: Executar Script de Deploy

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

O script irá:
1. ✅ Criar backup automático
2. ✅ Sincronizar arquivos (preservando .env e Cloudflare)
3. ✅ Reconstruir imagens Docker
4. ✅ Reiniciar containers
5. ✅ Executar migrations

**Nota:** As configurações do Admin Console ficam no banco de dados (`platform_settings`).
O rsync não sobrescreve essas informações — apenas o DB backup é crítico.

### Passo 3: Configurar GEMINI_API_KEY (CRÍTICO)

**Após o deploy**, configure a API key do Gemini:

```bash
# Editar .env do backend
nano /opt/glpi-etus/backend/.env
# ou
nano /opt/glpi-etus/.env

# Adicionar a linha:
GEMINI_API_KEY=<SUA_CHAVE_GEMINI>

# Salvar e sair (Ctrl+X, Y, Enter)
```

### Passo 4: Reiniciar Backend

```bash
cd /opt/glpi-etus
docker compose -f docker-compose.prod.yml restart backend
```

### Passo 5: Verificar Funcionamento

```bash
# Verificar logs do backend
docker compose -f docker-compose.prod.yml logs backend | grep -i gemini

# Deve aparecer:
# ✅ Gemini client inicializado com sucesso
```

### Passo 6: (Opcional) Popular Base de Conhecimento

Para ter artigos de teste na KB:

```bash
cd /opt/glpi-etus
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed-kb-articles.ts
```

Isso criará 10 artigos sobre erros comuns (deploy, conexão, rede, etc.)

## 🧪 Testar Funcionalidade

1. Acesse a aplicação em produção
2. Vá em **"Criar Ticket"**
3. Digite um título: **"Erro de deploy na aplicação"**
4. Adicione uma descrição qualquer
5. Aguarde **1.5 segundos** após parar de digitar
6. Deve aparecer:
   - Indicador "Gerando sugestão de solução..."
   - Solução gerada pela IA em linguagem natural
   - Botões "Isso resolveu meu problema!" e "Ignorar"

## ✅ Verificações Pós-Deploy

### 1. Logs do Backend
```bash
docker compose -f docker-compose.prod.yml logs backend | tail -50
```

Verificar:
- ✅ "Gemini client inicializado com sucesso"
- ❌ Sem erros relacionados ao Gemini

### 2. Teste de API
```bash
# Testar endpoint diretamente
curl -X POST http://localhost:8080/api/kb/ai-solution \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "title": "Erro de deploy",
    "description": "A aplicação não está fazendo deploy corretamente"
  }'
```

### 3. Interface Web
- Acesse a página de criar ticket
- Digite título e descrição
- Verifique se a solução RAG aparece

## ⚠️ Troubleshooting

### Problema: RAG não funciona
**Causa:** `GEMINI_API_KEY` não configurada
**Solução:** 
1. Verificar se está no `.env`
2. Reiniciar backend: `docker compose restart backend`
3. Verificar logs: `docker compose logs backend | grep gemini`

### Problema: Erro 404 no modelo
**Causa:** Código desatualizado (modelo antigo)
**Solução:** Verificar se o deploy copiou os arquivos corretos

### Problema: Nenhuma solução aparece
**Causa:** Base de conhecimento vazia
**Solução:** Executar seed de artigos KB (Passo 6)

### Problema: Container não inicia
**Causa:** Erro de build ou dependências
**Solução:** 
1. Verificar logs: `docker compose logs backend`
2. Verificar se `@google/generative-ai` está instalado
3. Rebuild: `docker compose build --no-cache backend`

## 📝 Checklist Rápido

- [ ] Código copiado para VM
- [ ] Script de deploy executado com sucesso
- [ ] `GEMINI_API_KEY` configurada no `.env`
- [ ] Backend reiniciado
- [ ] Logs mostram "Gemini client inicializado"
- [ ] (Opcional) Seed de artigos KB executado
- [ ] Funcionalidade testada na interface

## 🔗 Referências

- **Documentação N8N**: `N8N_INTEGRATION.md`
- **Seed de Artigos**: `KB_SEED_INSTRUCTIONS.md`
- **Checklist Completo**: `PRE_DEPLOY_CHECKLIST.md`

---

**Última atualização**: Dezembro 2024
**Status**: ✅ Pronto para produção
