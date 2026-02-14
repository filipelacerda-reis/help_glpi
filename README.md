# GLPI ETUS

Plataforma corporativa para gestão de chamados, tarefas, SLA, automações, base de conhecimento, administração, e agora também **gestão de equipamentos e colaboradores** com rastreabilidade de entrega/devolução.

## Visão Geral

O sistema cobre quatro frentes principais:

1. **Service Desk**: abertura, triagem, atendimento e acompanhamento de chamados.
2. **Operação e Governança**: SLA, automações, métricas avançadas, auditoria e políticas administrativas.
3. **Conhecimento e Assistente IA**: KB + chatbot com contexto de tickets e ativos.
4. **Patrimônio de TI**: cadastro de colaboradores/equipamentos, termos, entregas/devoluções e exportação PDF.

## Funcionalidades

### 1) Service Desk (Chamados)

- Criação e atualização de tickets com tipos (`INCIDENT`, `SERVICE_REQUEST`, `PROBLEM`, `CHANGE`, `TASK`, `QUESTION`).
- Comentários públicos/internos, anexos, observadores, relacionamentos e histórico de eventos.
- Worklogs e diário técnico com entradas automáticas/manuais.
- Notificações em tempo real (Socket.io).
- CSAT (satisfação) no fechamento.

### 2) Administração e Governança

- Gestão de usuários, times, categorias, tags e permissões por papel (`REQUESTER`, `TECHNICIAN`, `TRIAGER`, `ADMIN`).
- Console administrativo com configurações de plataforma.
- Trilhas de auditoria com consulta e exportação.
- Hardening aplicado em settings/políticas administrativas.

### 3) SLA, Métricas e Automações

- Calendários de negócio e políticas de SLA.
- Cálculo de tempos úteis, pausa/retomada, breach e compliance.
- Métricas operacionais e enterprise.
- Motor de automações por evento.

### 4) Base de Conhecimento + IA

- CRUD de artigos/categorias KB.
- Sugestão de artigos e geração de solução assistida por IA (RAG).
- Assistente virtual com suporte OpenAI/Gemini.

### 5) Gestão de Colaboradores e Equipamentos

- Cadastro de colaborador: nome, CPF, time, função, admissão, status.
- Cadastro de equipamento: NF, data de compra, tipo, patrimônio, valor, serial, marca, modelo, condição, garantia.
- Entrega/devolução com histórico de posse e termo.
- Alertas operacionais (garantia e devolução atrasada).
- Painel de ativos com indicadores.
- Modal de colaborador com:
  - filtro (`ativos`, `devolvidos`, `todos`),
  - ordenação (entrega/devolução/patrimônio/tipo),
  - busca textual,
  - exportação PDF sincronizada com o filtro/ordenação/busca da tela.
- Chatbot com contexto de ativos (ex.: “com quem está a máquina X?”, “quais itens o colaborador Y possui?”).

## Stack

### Backend

- Node.js + TypeScript + Express
- Prisma + PostgreSQL
- Redis + BullMQ
- JWT + bcrypt
- Zod
- Socket.io

### Frontend

- React + TypeScript + Vite
- TailwindCSS
- Axios

### Infra

- Docker + Docker Compose
- Deploy em VM com `rsync` (script `deploy-on-vm.sh`)

## Estrutura

- `backend/` API, regras de negócio, Prisma, seeds, workers
- `frontend/` interface web
- `docs/` documentação operacional (admin/SSO/Auth0)
- `docker-compose.yml` ambiente local
- `docker-compose.prod.yml` ambiente produção
- `deploy-on-vm.sh` deploy em VM por rsync

## Rotas Principais (API)

- Auth: `/api/auth/*`
- Tickets: `/api/tickets/*`
- SLA: `/api/sla/*`
- Automações: `/api/automation-rules/*`
- KB: `/api/kb/*`
- Admin: `/api/admin/*`
- Assistente: `/api/assistant/*`
- Colaboradores: `/api/employees/*`
- Equipamentos: `/api/equipments/*`

## Ambiente Local (Docker)

```bash
docker compose up -d
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:8080`

## Seeds

Executar no backend:

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

## Segurança para GitHub

Checklist mínimo antes de publicar:

1. **Não versionar segredos** (`.env`, chaves API, credenciais, certificados).
2. Garantir `.gitignore` cobrindo `.env*`, backups, logs e credenciais de túnel.
3. Usar apenas placeholders em documentação (`<SUA_CHAVE>`), nunca valores reais.
4. Configurar segredos apenas no ambiente de execução (VM/CI).
5. Rotacionar chaves se alguma já tiver sido exposta fora do repositório.
6. Em produção, definir obrigatoriamente:
   - `DB_PASSWORD`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CONFIG_ENCRYPTION_KEY`

## Deploy Produção (VM + rsync)

Script principal: `deploy-on-vm.sh`.

O script atual:

- cria backup do banco e uploads,
- valida pré-requisitos e variáveis obrigatórias,
- sincroniza com `rsync` preservando `.env` e credenciais sensíveis,
- rebuilda containers,
- executa migrations,
- valida healthcheck (`/health`).

Uso:

```bash
chmod +x deploy-on-vm.sh
./deploy-on-vm.sh
```

## Compatibilidade de Produção

Itens já cobertos:

- `docker-compose.prod.yml` com serviços principais.
- Deploy por rsync com exclusão de segredos e arquivos temporários.
- Migrations automáticas no fluxo de deploy.
- Persistência de uploads por volume bind.

## Documentação Mantida

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

## Licença

Uso interno.
