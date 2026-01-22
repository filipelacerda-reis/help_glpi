# Instruções para Popular Base de Conhecimento

Este documento explica como popular a Base de Conhecimento com artigos de teste para validar a funcionalidade RAG (Retrieval-Augmented Generation).

## 📋 Pré-requisitos

1. Banco de dados configurado e rodando
2. Pelo menos um usuário com role `ADMIN` no sistema
3. Prisma configurado e migrations aplicadas

## 🚀 Método 1: Usando Script de Seed (Recomendado)

### Passo 1: Encontrar ID do Usuário ADMIN

Execute no banco de dados ou use o Prisma Studio:

```sql
SELECT id, name, email, role FROM users WHERE role = 'ADMIN' LIMIT 1;
```

Ou usando Prisma Studio:
```bash
npx prisma studio
```
Navegue até a tabela `users` e copie o `id` de um usuário ADMIN.

### Passo 2: Editar Script de Seed

Abra o arquivo `backend/prisma/seed-kb-articles.ts` e substitua:

```typescript
const ADMIN_USER_ID = 'SUBSTITUA_PELO_ID_DO_USUARIO_ADMIN';
```

Pelo ID real do usuário ADMIN que você encontrou.

### Passo 3: Executar Seed

```bash
cd backend
npx tsx prisma/seed-kb-articles.ts
```

### Resultado Esperado

Você verá uma saída como:

```
🌱 Iniciando seed de artigos de Base de Conhecimento...

✅ Usando usuário: Nome do Admin (admin@example.com)

✅ Categoria "Geral" criada
✅ Criado: "Erro de Deploy - Falha na aplicação durante o deploy"
✅ Criado: "Erro de Conexão - Não consigo conectar ao banco de dados"
✅ Criado: "Erro de Rede - Timeout ou conexão recusada"
...

✨ Seed concluído!
   - Criados: 10
   - Pulados: 0
   - Total: 10
```

## 🎯 Método 2: Usando Interface Web

1. Acesse a aplicação e faça login como ADMIN ou TRIAGER
2. Navegue até **Base de Conhecimento** (menu lateral)
3. Clique em **Criar Artigo**
4. Preencha os campos:
   - **Título**: Ex: "Erro de Deploy - Falha na aplicação durante o deploy"
   - **Conteúdo**: Cole o conteúdo do artigo (Markdown)
   - **Status**: Selecione **Publicado**
   - **Tags**: Adicione tags relevantes (ex: "deploy", "erro", "build")
5. Clique em **Salvar**

## 📝 Artigos Incluídos no Seed

O script cria os seguintes artigos:

1. **Erro de Deploy** - Soluções para problemas durante deploy
2. **Erro de Conexão** - Problemas de conexão com banco de dados
3. **Erro de Rede** - Timeout e problemas de conectividade
4. **Erro 500** - Erro interno do servidor
5. **Erro de Autenticação** - Problemas com JWT e tokens
6. **Erro de Performance** - Aplicação lenta ou travando
7. **Erro de Build** - Falhas na compilação
8. **Erro de CORS** - Problemas de acesso entre origens
9. **Erro de Upload** - Falhas no upload de arquivos
10. **Erro de Migração** - Problemas com migrations do Prisma

## 🧪 Testando a Funcionalidade RAG

Após popular a base de conhecimento:

1. Acesse a página de **Criar Ticket**
2. Digite um título relacionado a um dos artigos, por exemplo:
   - "Erro de deploy na aplicação"
   - "Não consigo conectar ao banco"
   - "Aplicação está muito lenta"
3. Digite uma descrição detalhada do problema
4. Aguarde 1.5 segundos após parar de digitar
5. Você deve ver:
   - Um indicador de carregamento "Gerando sugestão de solução..."
   - Uma solução gerada pela IA baseada nos artigos da KB
   - Botões para "Isso resolveu meu problema!" ou "Ignorar"

## 🔍 Verificando Artigos Criados

### Via Prisma Studio

```bash
cd backend
npx prisma studio
```

Navegue até `kb_articles` para ver todos os artigos criados.

### Via SQL

```sql
SELECT 
  id, 
  title, 
  status, 
  tags,
  "createdAt"
FROM kb_articles 
WHERE status = 'PUBLISHED'
ORDER BY "createdAt" DESC;
```

### Via API

```bash
# Listar artigos
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:8080/api/kb/articles?status=PUBLISHED
```

## 🛠️ Solução de Problemas

### Erro: "Usuário ADMIN não encontrado"

**Solução**: 
1. Verifique se existe um usuário com role `ADMIN`
2. Confirme que o ID está correto no script
3. Execute: `SELECT * FROM users WHERE role = 'ADMIN';`

### Erro: "Cannot find module '@prisma/client'"

**Solução**:
```bash
cd backend
npm install
npx prisma generate
```

### Artigos não aparecem na busca

**Verificações**:
1. Confirme que o status é `PUBLISHED` (não `DRAFT`)
2. Verifique se há conteúdo nos campos `title` e `content`
3. Teste a busca diretamente na API

### RAG não está gerando soluções

**Verificações**:
1. Confirme que `GEMINI_API_KEY` está configurada no `.env`
2. Verifique logs do backend para erros
3. Teste se os artigos estão sendo encontrados na busca
4. Verifique se o título/descrição tem mais de 5 caracteres

## 📚 Personalizando Artigos

Você pode editar o arquivo `backend/prisma/seed-kb-articles.ts` para:

- Adicionar mais artigos ao array `KB_ARTICLES`
- Modificar conteúdo dos artigos existentes
- Adicionar mais tags
- Criar categorias específicas

### Exemplo de Novo Artigo

```typescript
{
  title: 'Meu Novo Artigo',
  content: `# Título do Artigo

Conteúdo em Markdown aqui...

## Seção

Mais conteúdo...`,
  tags: ['tag1', 'tag2'],
  status: KbArticleStatus.PUBLISHED,
}
```

## 🔄 Re-executando o Seed

O script é idempotente - ele não cria artigos duplicados. Se você quiser recriar todos os artigos:

1. Delete os artigos existentes (via interface ou SQL)
2. Execute o script novamente

Ou modifique o script para atualizar artigos existentes em vez de pular.

## 📊 Estatísticas

Após executar o seed, você pode verificar estatísticas:

```sql
-- Total de artigos
SELECT COUNT(*) FROM kb_articles WHERE status = 'PUBLISHED';

-- Artigos por categoria
SELECT 
  c.name as categoria,
  COUNT(a.id) as total
FROM kb_categories c
LEFT JOIN kb_articles a ON a."categoryId" = c.id
WHERE a.status = 'PUBLISHED'
GROUP BY c.name;

-- Tags mais usadas
SELECT 
  unnest(tags) as tag,
  COUNT(*) as quantidade
FROM kb_articles
WHERE status = 'PUBLISHED'
GROUP BY tag
ORDER BY quantidade DESC;
```

## ✅ Checklist de Validação

- [ ] Seed executado com sucesso
- [ ] Artigos aparecem na interface web
- [ ] Busca de artigos funciona
- [ ] RAG gera soluções quando título/descrição são preenchidos
- [ ] Soluções geradas são relevantes aos artigos
- [ ] Botões de ação funcionam corretamente

---

**Última atualização**: Dezembro 2024

