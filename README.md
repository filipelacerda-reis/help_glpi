# GLPI ETUS - Super App Corporativo

Plataforma corporativa full-stack para operação de Service Desk e governança interna, com módulos integrados de:

- chamados e tarefas,
- SLA/SLO,
- automações,
- base de conhecimento com IA,
- administração/SSO/auditoria,
- gestão de colaboradores,
- gestão de equipamentos e termos de entrega/devolução.

Este README foi escrito para servir como guia funcional e operacional completo do projeto para publicação no GitHub e uso em produção.

---

## Índice

1. [Visão de Produto](#visão-de-produto)
2. [Arquitetura e Stack](#arquitetura-e-stack)
3. [Perfis e Permissões](#perfis-e-permissões)
4. [Mapa de Telas e Janelas](#mapa-de-telas-e-janelas)
5. [Fluxos de Negócio](#fluxos-de-negócio)
6. [Como o SLA/SLO é Calculado](#como-o-slaslo-é-calculado)
7. [Como o Chatbot Funciona](#como-o-chatbot-funciona)
8. [Automação e Auditoria](#automação-e-auditoria)
9. [Modelo de Dados (resumo)](#modelo-de-dados-resumo)
10. [API Principal](#api-principal)
11. [Setup Local](#setup-local)
12. [Seeds e Dados de Teste](#seeds-e-dados-de-teste)
13. [Testes e Validação](#testes-e-validação)
14. [Deploy em Produção (rsync)](#deploy-em-produção-rsync)
15. [Segurança para GitHub e Produção](#segurança-para-github-e-produção)
16. [Documentação Complementar](#documentação-complementar)

---

## Visão de Produto

O GLPI ETUS centraliza operação e governança em um único portal, com quatro domínios principais:

1. **Operação de chamados**
- Abertura, triagem, atribuição, atendimento, resolução e fechamento.
- Comentários públicos/internos, anexos, observadores, relacionamento entre tickets e worklogs.

2. **Governança operacional**
- Políticas de SLA e calendários de negócio.
- Métricas avançadas (operacionais e executivas) com filtros, abas e presets.
- Motor de automações orientado a eventos.

3. **Conhecimento + IA**
- Base de conhecimento (artigos/categorias).
- Sugestão de artigos durante abertura de chamado.
- Chatbot com sessão persistida e contexto de ativos.

4. **Ativos e pessoas**
- Cadastro de colaboradores.
- Cadastro de equipamentos com patrimônio, NF, compra, valor e condição.
- Entrega/devolução com histórico e emissão de PDF.
- Consulta por colaborador com exportação filtrada/ordenada.

---

## Arquitetura e Stack

### Backend
- Node.js + TypeScript + Express
- Prisma ORM + PostgreSQL
- Redis + BullMQ (workers)
- JWT + bcrypt
- Zod (validação)
- Socket.io (tempo real)
- OpenAI/Gemini (assistente)

### Frontend
- React + TypeScript + Vite
- TailwindCSS
- Axios
- Recharts

### Infra
- Docker + Docker Compose
- `docker-compose.yml` para desenvolvimento
- `docker-compose.prod.yml` para produção
- Deploy automatizado por rsync via `deploy-on-vm.sh`

### Organização de pastas
- `backend/`: API, regras de negócio, Prisma, seeds, workers
- `frontend/`: interface, páginas, componentes
- `docs/`: guias administrativos e SSO

---

## Perfis e Permissões

Papéis da plataforma:

- `REQUESTER`
- `TECHNICIAN`
- `TRIAGER`
- `ADMIN`

### Matriz resumida

| Capacidade | Requester | Technician | Triager | Admin |
|---|---|---|---|---|
| Abrir ticket | Sim | Sim | Sim | Sim |
| Ver todos os tickets | Não | Não (apenas time/acesso) | Sim | Sim |
| Alterar status de tickets | Parcial (próprios fluxos) | Sim (escopo permitido) | Sim | Sim |
| Atribuir técnico | Não | Não | Sim | Sim |
| Alterar prioridade/time | Não | Restrito | Sim | Sim |
| Comentário interno | Não | Sim | Sim | Sim |
| Gestão de usuários/times/categorias/tags | Não | Não | Não | Sim |
| Administração (SSO, plataforma, auditoria) | Não | Não | Não | Sim |
| Funcionários/equipamentos (consulta) | Não | Sim | Sim | Sim |
| Funcionários/equipamentos (cadastro/alteração) | Não | Não | Sim | Sim |

Observação: em métricas, existe autorização para `ADMIN` e também líder de time em rotas específicas.

---

## Mapa de Telas e Janelas

A navegação principal (tema escuro) é organizada por seções no menu lateral.

### Operação

#### 1. Dashboard (`/`)
- Visão geral inicial por perfil.
- Atalhos para módulos.

#### 2. Tickets (`/tickets`)
- Duas visualizações:
  - Lista
  - Kanban
- Filtros por status, prioridade, categoria, time e tipo.
- No Kanban, cards podem ser movidos por swipe/drag para transição de status.

#### 3. Abrir Ticket (`/tickets/new`)
- Form com título, descrição rica, time, categoria, prioridade, tipo e infra.
- Upload de arquivos.
- Seleção de observadores.
- Suporte a ticket pai (hierarquia/projeto) e campos de prazo/estimativa.
- **RAG**:
  - Sugestão de artigos.
  - Geração automática de solução via IA com debounce.
- Se vier do chatbot, formulário é pré-preenchido com histórico da conversa.

#### 4. Detalhe do Ticket (`/tickets/:id`)
- Visão completa com abas e ações:
  - Detalhes operacionais.
  - Histórico de eventos.
  - Relações com outros tickets.
- Recursos na página:
  - Comentários público/interno com anexos.
  - Alteração de status, prioridade, time e técnico (conforme permissão).
  - Worklogs.
  - Observadores (adicionar/remover).
  - CSAT (quando aplicável).
  - Vincular artigos KB.

#### 5. Notificações (`/notifications`)
- Central de notificações com leitura individual ou em massa.

#### 6. Meu Diário (`/my/journal`)
- Registro pessoal de atividades do técnico.
- Entradas manuais e automáticas (status/comentários/worklogs).

### Ativos e Pessoas

#### 7. Funcionários (`/employees`)
- Listagem com busca por nome/CPF/função/time.
- Colunas principais: nome, CPF, função, time, ativos em posse.
- Para `ADMIN`/`TRIAGER`: criar, editar e remover colaboradores.

#### 8. Equipamentos (`/equipments`)
- Dashboard de ativos (totais, entregues, estoque, valor total).
- Alertas operacionais (garantia e devoluções atrasadas).
- Tabela de equipamentos com responsável atual.
- Ações:
  - Entregar (abre modal sobreposto)
  - Registrar devolução (abre modal sobreposto)
  - Baixar termo de entrega
- Clique no nome do colaborador abre modal com:
  - dados do colaborador,
  - lista de equipamentos,
  - filtros (`ativos`, `devolvidos`, `todos`),
  - ordenação,
  - busca textual,
  - exportação PDF conforme o filtro/ordem/busca da tela.

### Qualidade, Conhecimento e Governança

#### 9. Métricas (`/metrics`)
- Visão analítica com abas:
  - Visão Geral
  - Por Time
  - Por Técnico
  - Categoria & Tag
  - SLA & SLO
  - Backlog
- Filtros avançados e comparação de período.
- Presets de relatório.

#### 10. Base de Conhecimento (`/kb`)
- Gestão de categorias e artigos (admin/triagem).
- Busca e vínculo com tickets.
- Base utilizada por RAG/chatbot.

#### 11. SLA (`/sla`)
- Gestão de calendários de negócio.
- Gestão de políticas SLA.
- Cadastro de regras de aplicação por time/categoria/prioridade/tipo/time solicitante.

### Administração da Plataforma

#### 12. Times (`/teams`)
- CRUD de times.
- Membros e liderança.

#### 13. Usuários (`/users`)
- CRUD de usuários e perfis.

#### 14. Tags (`/tags`)
- CRUD de tags por grupos semânticos.

#### 15. Categorias (`/categories`)
- CRUD de categorias de chamados.

#### 16. Automações (`/automations`)
- Regras por evento, com ConditionBuilder e ActionBuilder.
- Ativar/desativar, editar e excluir regras.

#### 17. Administração (`/admin/sso`)
- Console robusto com abas:
  - SSO (SAML/Auth0)
  - Configurações gerais da plataforma
  - Ferramentas administrativas (ex.: recálculo SLA)
  - Auditoria (consulta e exportação)

---

## Fluxos de Negócio

### Fluxo de Chamado

1. Usuário abre ticket.
2. Sistema valida políticas de plataforma (tipos/prioridades habilitados).
3. Ticket entra em `OPEN`.
4. SLA pode iniciar automaticamente para o ticket.
5. Atendimento evolui por status e comentários.
6. Ao resolver/fechar, sistema registra métricas de tempo, compliance e eventos.
7. Pode haver CSAT no encerramento.

### Fluxo de Ativo

1. Cadastro do equipamento (NF, compra, tipo, patrimônio, valor...).
2. Entrega para colaborador (assignment ativo + termo).
3. Consulta de posse atual por patrimônio ou colaborador.
4. Devolução com condição de retorno e status final do ativo.
5. Histórico de movimentações permanece disponível para auditoria e chatbot.

---

## Como o SLA/SLO é Calculado

### Conceitos

- **SLA**: alvo operacional por ticket (tempo de 1ª resposta e/ou resolução).
- **SLO**: meta de compliance agregada (percentual de tickets dentro do SLA).

### Componentes de cálculo

1. **Calendário de negócio**
- Define timezone, janelas úteis por dia e feriados.
- O motor de tempo útil calcula minutos de negócio ignorando períodos fora da janela.

2. **Política SLA**
- Critérios de aplicação (`teamId`, `categoryId`, `priority`, `ticketType`, `requesterTeamId`).
- Alvos em minutos úteis:
  - `targetFirstResponseBusinessMinutes`
  - `targetResolutionBusinessMinutes`
- `targetCompliance` (SLO da política), default `98.5%`.

3. **Seleção da política**
- A política é escolhida por pontuação de especificidade dos critérios.

4. **Registro de tempos**
- Primeira resposta:
  - calcula minutos úteis entre criação e primeira resposta;
  - compara com alvo de primeira resposta (quando definido).
- Resolução:
  - calcula minutos úteis efetivos considerando estados que contam (`OPEN`, `IN_PROGRESS`);
  - compara com alvo de resolução.

5. **Breach/Met**
- Se exceder alvo, marca `BREACHED`.
- Caso contrário, `MET`.
- Eventos são registrados no histórico do ticket.

6. **SLO agregado em métricas**
- Compliance global: `% tickets com SLA não violado`.
- SLO global compara compliance com média de `targetCompliance` das políticas ativas.
- Status resultante: `MET` ou `BREACHED`.

### Recálculo

- Há ferramenta administrativa para recálculo de SLA em lote (fila BullMQ).
- Permite recalcular por período/time/categoria sem reprocessar manualmente ticket a ticket.

---

## Como o Chatbot Funciona

### Arquitetura funcional

1. Frontend cria sessão (`POST /api/assistant/session`).
2. Mensagens do usuário são enviadas para (`POST /api/assistant/message`).
3. Backend persiste histórico (`chat_sessions`, `chat_messages`).
4. Backend monta contexto e consulta LLM.
5. Resposta é persistida e retornada ao widget.

### Provedores de IA

- Prioridade atual: **Gemini**.
- Fallback: **OpenAI**.
- Se ambos falharem, resposta de erro controlada para o usuário.

### Contexto de ativos (diferencial)

Antes de gerar resposta, o backend constrói uma base contextual com:

- equipamentos aderentes ao texto (patrimônio/NF/serial/marca/modelo),
- colaboradores aderentes ao texto (nome/CPF),
- mapa de posse atual (entregas ativas recentes).

Isso permite perguntas naturais como:

- “Com quem está a máquina PAT-NB-1001?”
- “Quais itens a Ana Paula Ribeiro tem?”

### Políticas administrativas do assistente

Acesso ao chatbot pode ser restringido por configuração de plataforma:

- habilitar/desabilitar assistente,
- limite diário de mensagens por usuário.

### Escalonamento para ticket

No widget há ação “Não resolveu? Abrir chamado”, que redireciona para `/tickets/new` com título/descrição pré-preenchidos a partir da conversa.

---

## Automação e Auditoria

### Motor de automação

Regras por evento, com condições e ações, por exemplo:

- eventos: criação, atualização, mudança de status/prioridade/time, SLA breach/met, comentário;
- ações: alterar time/prioridade/status, atribuir técnico, adicionar tag, etc.

### Auditoria administrativa

- Console em `Administração > Auditoria`.
- Filtros por ator/ação/recurso/período.
- Exportação JSON.

---

## Modelo de Dados (resumo)

### Tickets
- Ticket + comentários + anexos + eventos + relações + worklogs + observers + satisfação.

### SLA
- `SlaPolicy`
- `TicketSlaInstance`
- `TicketSlaStats`

### Assistente
- `ChatSession`
- `ChatMessage`

### Ativos
- `Employee`
- `Equipment`
- `EquipmentAssignment`

---

## API Principal

### Autenticação
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Tickets
- `GET /api/tickets`
- `GET /api/tickets/:id`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `POST /api/tickets/:id/comments`

### Assistente
- `POST /api/assistant/session`
- `POST /api/assistant/message`
- `POST /api/assistant/escalate`

### SLA
- `GET /api/sla/calendars`
- `POST /api/sla/calendars` (admin)
- `GET /api/sla/policies`
- `POST /api/sla/policies` (admin)

### Ativos e Pessoas
- `GET /api/employees`
- `POST /api/employees` (admin/triager)
- `GET /api/employees/:id/equipments.pdf`
- `GET /api/equipments`
- `POST /api/equipments` (admin/triager)
- `POST /api/equipments/:id/assignments` (admin/triager)
- `POST /api/equipments/assignments/:assignmentId/return` (admin/triager)
- `GET /api/equipments/assignments/:assignmentId/term.pdf`

### Administração
- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `POST /api/admin/settings/saml/test`
- `POST /api/admin/settings/auth0/test`
- `POST /api/admin/tools/recalculate-sla`
- `GET /api/admin/audit`
- `GET /api/admin/audit/export`

---

## Setup Local

### Pré-requisitos
- Docker + Docker Compose
- Node.js 20+ (para execução fora de containers)

### Subir stack local

```bash
docker compose up -d
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Healthcheck: `http://localhost:8080/health`

---

## Seeds e Dados de Teste

No `backend`:

```bash
npm run db:seed
npm run db:seed:assets-chat
npm run db:seed:validation
npm run db:ensure-admin
```

### Usuários padrão

- `admin@example.com` / `admin123`
- `triager@example.com` / `triager123`
- `technician@example.com` / `technician123`
- `requester@example.com` / `requester123`

### Objetivo de cada seed

- `db:seed`: base funcional principal (usuários/tickets/tags/times).
- `db:seed:assets-chat`: colaboradores, equipamentos, assignments para testar linguagem natural do chatbot.
- `db:seed:validation`: massa adicional de validação/relatórios.
- `db:ensure-admin`: garante admin padrão idempotentemente.

---

## Testes e Validação

### Backend

```bash
docker compose run --rm backend sh -lc "npx prisma generate && npm test -- --runInBand"
```

### Frontend build

```bash
docker compose run --rm frontend npm run build
```

### Backend build

```bash
docker compose run --rm backend sh -lc "npx prisma generate && npm run build"
```

---

## Deploy em Produção (rsync)

Script oficial: `deploy-on-vm.sh`

### O que ele faz

1. valida pré-requisitos e variáveis obrigatórias;
2. cria backup de banco/uploads;
3. sincroniza código via rsync preservando segredos;
4. rebuilda e reinicia containers;
5. executa migrations;
6. valida healthcheck.

### Uso

```bash
chmod +x deploy-on-vm.sh
./deploy-on-vm.sh
```

### Variáveis obrigatórias no `.env` de produção

- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CONFIG_ENCRYPTION_KEY`

---

## Segurança para GitHub e Produção

### Repositório

- Não versionar `.env` real, chaves e credenciais.
- Usar apenas placeholders em documentação.
- Revisar histórico Git para garantir ausência de segredos antigos.

### Runtime

- Segredos somente em ambiente (VM/CI Secret Manager).
- Rotacionar chaves em caso de exposição.
- Usar `CONFIG_ENCRYPTION_KEY` em produção para settings sensíveis (SAML/Auth0).
- Manter backups com acesso restrito.

### Operação

- Validar healthcheck após deploy.
- Monitorar logs de backend/frontend/workers.
- Executar recálculo SLA apenas quando necessário e com filtros.

---

## Documentação Complementar

- `DEPLOY_INSTRUCTIONS.md`
- `DEPLOY_GITLAB.md`
- `DOCKER-SETUP.md`
- `PRE_DEPLOY_CHECKLIST.md`
- `N8N_INTEGRATION.md`
- `KB_SEED_INSTRUCTIONS.md`
- `AUTOMATION.md`
- `docs/admin-console.md`
- `docs/auth0.md`
- `docs/sso-google-workspace.md`

---

## Licença

Uso interno.
