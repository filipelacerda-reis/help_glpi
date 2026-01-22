# 🚀 Quick Start - Popular Base de Conhecimento

Guia rápido para popular a Base de Conhecimento com artigos de teste.

## ⚡ Método Rápido (Recomendado)

```bash
cd backend
npx tsx prisma/seed-kb-articles.ts
```

**Pronto!** O script vai:
- ✅ Buscar automaticamente um usuário ADMIN
- ✅ Criar categoria "Geral" se não existir
- ✅ Criar 10 artigos de conhecimento sobre erros comuns
- ✅ Pular artigos que já existem (idempotente)

## 📋 Pré-requisitos

1. Banco de dados rodando
2. Pelo menos um usuário ADMIN (criado pelo seed principal)

Se não tiver usuário ADMIN, execute primeiro:
```bash
cd backend
npx tsx prisma/seed.ts
```

## ✅ Verificar se Funcionou

### Via Interface Web
1. Acesse a aplicação
2. Vá em **Base de Conhecimento**
3. Você deve ver os artigos criados

### Via SQL
```sql
SELECT COUNT(*) FROM kb_articles WHERE status = 'PUBLISHED';
-- Deve retornar 10 (ou mais se já existiam)
```

## 🧪 Testar RAG

1. Acesse **Criar Ticket**
2. Digite: **"Erro de deploy na aplicação"**
3. Digite uma descrição qualquer
4. Aguarde 1.5 segundos
5. Você deve ver uma solução gerada pela IA! ✨

## 📚 Artigos Criados

- ✅ Erro de Deploy
- ✅ Erro de Conexão (Banco de Dados)
- ✅ Erro de Rede
- ✅ Erro 500
- ✅ Erro de Autenticação
- ✅ Erro de Performance
- ✅ Erro de Build
- ✅ Erro de CORS
- ✅ Erro de Upload
- ✅ Erro de Migração

## 🔄 Re-executar

O script é seguro para executar múltiplas vezes - ele não cria duplicatas.

## ❓ Problemas?

### "Nenhum usuário ADMIN encontrado"
**Solução**: Execute `npx tsx prisma/seed.ts` primeiro

### "Cannot find module"
**Solução**: 
```bash
npm install
npx prisma generate
```

### Artigos não aparecem
**Verifique**:
- Status está como `PUBLISHED`?
- Execute: `SELECT * FROM kb_articles WHERE status = 'PUBLISHED';`

---

**Pronto para testar!** 🎉

