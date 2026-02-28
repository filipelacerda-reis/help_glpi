# Help GLPI - Plataforma Service Desk (SaaS Premium)

Plataforma full-stack para operação de Help Desk/Service Desk com módulos corporativos (ITSM, RH, Financeiro, Ativos e Administração), layout moderno unificado e observabilidade de ponta a ponta.

## Stack Atual

### Backend
- Node.js + TypeScript + Express
- Prisma ORM + PostgreSQL
- Redis + BullMQ (workers e tarefas assíncronas)
- JWT + RBAC + Entitlements por módulo/submódulo
- Zod, Winston, OpenTelemetry (telemetria)

### Frontend
- React + TypeScript + Vite
- Tailwind CSS (Light/Dark Mode)
- Recharts (dashboards e analytics)
- React Query (`@tanstack/react-query`) para cache e fetch de dados
- `lucide-react` para ícones

### Infra
- Docker Compose (PostgreSQL, Redis, Backend, Frontend)

## Principais Entregas Atuais

- UI moderna padronizada via `ModernLayout` em toda a aplicação.
- Dashboard com KPIs, gráficos e listas operacionais.
- Listagem de tickets moderna com filtros, busca e destaque de risco de SLA.
- Módulo de métricas enterprise com abas:
  - Visão Geral
  - Por Time
  - Por Técnico
  - Categoria & Tag
  - SLA & SLO
  - Backlog
- Métricas avançadas:
  - FCR (First Contact Resolution)
  - Worklog por categoria
  - Backlog envelhecido via endpoint dedicado
- Predição de quebra de SLA:
  - marcação automática de tickets em risco
  - notificações automáticas sem duplicidade
- Integração Slack:
  - webhook para `view_submission` do modal
  - criação automática de ticket
  - configurações low-code no painel administrativo

## Navegação e Módulos (Frontend)

Rotas principais:
- `/` Dashboard
- `/tickets`, `/tickets/new`, `/tickets/:id`
- `/metrics`
- `/notifications`
- `/my/journal`
- `/employees`
- `/equipments`
- `/finance`
- `/procurement`
- `/teams`
- `/users`
- `/categories`
- `/tags`
- `/admin/sso`
- `/integrations`

Notas de UX/Admin:
- `Administração` é exclusiva para perfil `ADMIN`.
- `Integrações` foi consolidada como aba/página administrativa (não fica no menu lateral principal).

## APIs Relevantes (Backend)

Base: `http://localhost:8080/api`

- Auth: `/auth/*`
- Tickets: `/tickets`
  - `GET /tickets/stale` (backlog envelhecido)
- Métricas: endpoints do serviço enterprise consumidos pela tela `/metrics`
- Admin Settings: `/admin/settings` e `/admin/settings/slack`
- Webhooks: `/webhooks/slack/interactions`

Health/observabilidade:
- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`

## Integração Slack (Omnichannel)

Fluxo implementado:
1. Slack envia payload para `POST /api/webhooks/slack/interactions`.
2. Backend responde `200` imediatamente (evita timeout do Slack).
3. Para `type=view_submission`, campos do modal são extraídos.
4. Ticket é criado via `ticket.service`.
5. Se o usuário do Slack não existir, aplica fallback seguro para usuário interno + enriquecimento da descrição.

Configurações administrativas salvas em `platformSettings`:
- `SLACK_ENABLED`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`

## Setup Local (Docker)

### 1. Pré-requisitos
- Docker
- Docker Compose

### 2. Subir ambiente
```bash
docker compose up -d
```

### 3. Derrubar ambiente
```bash
docker compose down
```

### 4. Build de validação
```bash
docker compose exec -T backend npm run build
docker compose exec -T frontend npm run build
```

### 5. Prisma e seed
```bash
docker compose exec -T backend sh -lc "npx prisma migrate deploy"
docker compose exec -T backend npm run db:seed
```

## Usuários Seed (desenvolvimento)

- `admin@example.com / admin123`
- `triager@example.com / triager123`
- `technician@example.com / technician123`
- `requester@example.com / requester123`

## Variáveis de Ambiente

Referência: `backend/.env.example`

Chaves essenciais:
- `DB_*`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `CONFIG_ENCRYPTION_KEY`
- `OPENAI_API_KEY` e/ou `GEMINI_API_KEY` (opcional)
- `SAML_*` / `AUTH0_*` (opcionais, conforme estratégia de SSO)

## Estrutura do Repositório

- `backend/` API, regras de negócio, workers e Prisma
- `frontend/` aplicação React (Vite + Tailwind)
- `docker-compose.yml` ambiente local
- `deploy-on-vm.sh` script de deploy

## Observações de Qualidade

- O frontend valida uso do layout moderno no build (`guard:modern-layout`).
- React Query foi adotado para reduzir refetch desnecessário e melhorar UX.
- As telas de métricas seguem padrão visual único (cards premium, grids limpas, tooltips e hover consistentes em dark/light).
