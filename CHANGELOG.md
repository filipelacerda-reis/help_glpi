# Changelog - Times, Categorias e Métricas

## 🎯 Funcionalidades Implementadas

### 1. ✅ Sistema de Times

**Backend:**
- Modelos `Team` e `UserTeam` adicionados ao schema
- Enum `TeamRole` (MEMBER, LEAD)
- CRUD completo de times (apenas ADMIN)
- Gerenciamento de membros de time
- Validações: não permite excluir time com tickets associados

**Frontend:**
- Serviço `teamService` criado
- Integração com páginas de tickets

**Endpoints:**
- `POST /api/teams` - Criar time
- `GET /api/teams` - Listar times
- `GET /api/teams/:id` - Obter time
- `PATCH /api/teams/:id` - Atualizar time
- `DELETE /api/teams/:id` - Excluir time
- `POST /api/teams/:id/members` - Adicionar membro
- `PATCH /api/teams/:id/members/:userId` - Atualizar papel
- `DELETE /api/teams/:id/members/:userId` - Remover membro

### 2. ✅ Categorias Dinâmicas

**Backend:**
- CRUD completo já existia, apenas ajustado controle de acesso
- Leitura pública (para formulários)
- Mutações apenas para ADMIN

**Frontend:**
- Categorias já eram carregadas dinamicamente
- Mantido funcionamento existente

### 3. ✅ Endpoint de Métricas

**Backend:**
- `GET /api/admin/metrics` - Métricas agregadas
- Acesso restrito a ADMIN
- Retorna:
  - Tickets por status
  - Tickets por prioridade
  - Tickets por time
  - Tempo médio de resolução por time

**Estrutura de resposta:**
```json
{
  "ticketsByStatus": [...],
  "ticketsByPriority": [...],
  "ticketsByTeam": [...],
  "avgResolutionTimeByTeam": [...]
}
```

### 4. ✅ Atualização do Fluxo de Tickets

**Mudanças:**
- Campo `team` (string) substituído por `teamId` (FK)
- Filtro por `teamId` na listagem
- Atribuição de time na triagem (TRIAGER/ADMIN)
- Técnicos veem tickets do seu time automaticamente
- Validação: apenas TRIAGER/ADMIN podem alterar `teamId` e `priority`

**Frontend:**
- Filtro por time na listagem de tickets
- Seleção de time na página de detalhes (triagista/admin)
- Exibição do time nos tickets

## 📝 Próximos Passos

### Para Aplicar as Mudanças:

1. **Executar Migration:**
   ```powershell
   cd backend
   npx prisma migrate dev --name add_teams_and_relations
   ```

2. **Regenerar Prisma Client:**
   ```powershell
   npx prisma generate
   ```

3. **Reiniciar Backend:**
   ```powershell
   npm run dev
   ```

4. **Testar Funcionalidades:**
   - Criar times como ADMIN
   - Adicionar membros aos times
   - Atribuir times aos tickets na triagem
   - Filtrar tickets por time
   - Visualizar métricas como ADMIN

## 🔒 Permissões

- **ADMIN**: Acesso total (times, categorias, métricas)
- **TRIAGER**: Pode atribuir times e prioridades aos tickets
- **TECHNICIAN**: Vê tickets do seu time automaticamente
- **REQUESTER**: Sem mudanças (vê apenas seus tickets)

## ⚠️ Breaking Changes

- Campo `team` (string) foi removido do modelo Ticket
- Use `teamId` (UUID) para referenciar times
- Tickets existentes com `team` (string) precisarão ser migrados

## 📚 Arquivos Criados/Modificados

### Backend:
- `prisma/schema.prisma` - Modelos Team e UserTeam adicionados
- `src/services/team.service.ts` - Novo
- `src/controllers/team.controller.ts` - Novo
- `src/routes/team.routes.ts` - Novo
- `src/services/metrics.service.ts` - Novo
- `src/controllers/metrics.controller.ts` - Novo
- `src/routes/admin.routes.ts` - Novo
- `src/services/ticket.service.ts` - Atualizado para usar teamId
- `src/controllers/ticket.controller.ts` - Atualizado filtros

### Frontend:
- `src/services/team.service.ts` - Novo
- `src/services/ticket.service.ts` - Atualizado tipos
- `src/pages/TicketsPage.tsx` - Adicionado filtro por time
- `src/pages/TicketDetailPage.tsx` - Adicionado seleção de time

