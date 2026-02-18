# GLPI ETUS - Super App Corporativo

Plataforma corporativa full-stack para operação integrada de ITSM, RH, Financeiro, Ativos/Estoque/Entregas, Compliance e Administração.

Projeto preparado para execução local com Docker e deploy em VM via `rsync` + `docker compose`.

## 1. Visão Geral

A plataforma substitui ferramentas isoladas com um único fluxo operacional:

- ITSM: abertura, triagem, atendimento e fechamento de chamados.
- RH: cadastro de colaboradores, onboarding/offboarding, tarefas e políticas.
- Financeiro: cost centers, vendors, PR/PO/Invoice, aprovação e ativo imobilizado.
- Ativos: cadastro de equipamentos, vínculo por colaborador, estoque, movimentações, entregas e devoluções.
- Compliance: auditoria imutável, retenção e anonimização (LGPD mínimo viável).
- Administração: SSO, usuários, roles, permissões, mapeamento de grupos e configurações globais.
- IA/Chatbot: atendimento natural com contexto real de usuários/equipamentos persistidos.

## 2. Arquitetura e Stack

### Backend

- Node.js + TypeScript + Express
- Prisma ORM + PostgreSQL
- Redis + BullMQ
- JWT + RBAC + Permission Keys + ABAC
- Zod (validação)
- OpenTelemetry + métricas/healthchecks

### Frontend

- React + Vite + TypeScript
- TailwindCSS
- Recharts

### Infra

- Docker Compose para dev/prod
- Deploy por `rsync` via `deploy-on-vm.sh`

## 3. Organização de Código

### Backend (domínios)

- `backend/src/domains/iam`
- `backend/src/domains/itsm`
- `backend/src/domains/hr`
- `backend/src/domains/finance`
- `backend/src/domains/assets`
- `backend/src/domains/compliance`
- `backend/src/shared`

### Frontend (módulos)

- `frontend/src/modules` (estrutura evolutiva)
- páginas principais em `frontend/src/pages`
- configuração de módulos legados: `frontend/src/config/modules.ts`
- configuração de entitlements: `frontend/src/config/entitlements.ts`

## 4. Autenticação e SSO

A plataforma suporta **somente 1 provedor de SSO ativo por vez**:

- `SAML_GOOGLE` (Google Workspace)
- `AUTH0`

Configuração via:

- UI admin (`/admin/sso`)
- tabela `AuthProviderConfig` no banco

Regras:

- não roda dois provedores ativos ao mesmo tempo
- login local por usuário/senha continua disponível para break-glass e operação interna
- provisionamento no primeiro login externo pode criar usuário e vínculo mínimo

## 5. Autorização Enterprise

Modelo híbrido:

- Role-based defaults (`Role`, `RolePermission`, `UserRoleAssignment`)
- Permission keys granulares
- Entitlements por usuário para UX/admin (`UserEntitlement`)
- ABAC para escopo de dados

Permissões efetivas:

- `RolePermissions ∪ EntitlementPermissions`
- ABAC sempre filtra o escopo final

Middleware base:

- `authenticate`
- `requirePermission`
- `requireAnyPermission`
- `requireAbac`

## 6. Matriz de Permissões (catálogo inicial)

Fonte de verdade: `backend/src/domains/iam/entitlements/permissionCatalog.ts`

### Plataforma/Admin

- `platform.admin.view`
- `platform.settings.read`
- `platform.settings.write`
- `platform.authprovider.read`
- `platform.authprovider.write`
- `platform.groupmapping.read`
- `platform.groupmapping.write`
- `platform.users.read`
- `platform.users.write`
- `platform.roles.read`
- `platform.roles.write`
- `audit.read`

### IAM

- `iam.user.view`
- `iam.user.read`
- `iam.user.write`
- `iam.user.disable`
- `iam.role.read`
- `iam.role.write`

### ITSM

- `itsm.view`
- `itsm.ticket.read`
- `itsm.ticket.write`
- `itsm.ticket.assign`
- `itsm.ticket.close`
- `itsm.sla.read`
- `itsm.sla.write`
- `itsm.kb.read`
- `itsm.kb.write`
- `itsm.automation.read`
- `itsm.automation.write`
- `itsm.reports.read`

### Assets / Estoque / Entregas

- `assets.view`
- `assets.equipment.read`
- `assets.equipment.write`
- `assets.assignment.read`
- `assets.assignment.write`
- `assets.stock.read`
- `assets.stock.write`
- `assets.delivery.read`
- `assets.delivery.write`
- `assets.maintenance.read`
- `assets.maintenance.write`
- `assets.reports.read`

### RH

- `hr.view`
- `hr.employee.read`
- `hr.employee.write`
- `hr.employee.read_pii`
- `hr.employee.write_pii`
- `hr.onboarding.read`
- `hr.onboarding.write`
- `hr.offboarding.read`
- `hr.offboarding.write`
- `hr.policy.read`
- `hr.policy.write`
- `hr.ack.read`
- `hr.ack.write`
- `hr.reports.read`

### Financeiro

- `finance.view`
- `finance.costcenter.read`
- `finance.costcenter.write`
- `finance.vendor.read`
- `finance.vendor.write`
- `finance.pr.read`
- `finance.pr.write`
- `finance.po.read`
- `finance.po.write`
- `finance.invoice.read`
- `finance.invoice.write`
- `finance.approval.approve`
- `finance.assets.read`
- `finance.assets.write`
- `finance.reports.read`

### Compliance

- `compliance.view`
- `compliance.retention.read`
- `compliance.retention.write`
- `compliance.anonymize.request`
- `compliance.anonymize.approve`

## 7. Roles Iniciais (seed)

Fonte de verdade: `backend/prisma/seed.ts`

- `ADMIN`: acesso total
- `SRE_IT`: ITSM + Assets + leitura de auditoria
- `RH`: RH (sem `hr.employee.write_pii` por padrão)
- `HR_ADMIN`: RH completo com escrita de PII
- `FINANCE`: Finance sem aprovação final
- `FINANCE_APPROVER`: Finance completo + `finance.approval.approve`
- `MANAGER`: leitura de time via ABAC
- `EMPLOYEE`: acesso operacional básico

Usuários seed:

- `admin@example.com / admin123`
- `triager@example.com / triager123`
- `technician@example.com / technician123`
- `requester@example.com / requester123`

## 8. Entitlements por Usuário (Módulo/Submódulo)

Modelo em banco:

- `UserEntitlement { userId, module, submodule, level }`
- `level`: `READ | WRITE` (`WRITE` implica `READ`)

Catálogo de módulos:

- `ADMIN`, `ITSM`, `HR`, `FINANCE`, `ASSETS`, `COMPLIANCE`

Exemplos de submódulo:

- `ADMIN_USERS`, `ADMIN_SSO`
- `ITSM_TICKETS`, `ITSM_SLA`
- `HR_EMPLOYEES`, `HR_EMPLOYEES_PII`
- `FINANCE_INVOICES`, `FINANCE_APPROVALS`
- `ASSETS_EQUIPMENT`, `ASSETS_DELIVERIES`
- `COMPLIANCE_RETENTION`, `COMPLIANCE_ANONYMIZATION`

API admin para gestão:

- `GET /api/admin/permission-catalog`
- `GET /api/admin/entitlement-catalog`
- `GET /api/admin/users/:id/entitlements`
- `PUT /api/admin/users/:id/entitlements`

Tela de usuários (`/users`):

- CRUD de usuário
- seleção de módulos legados
- seleção de submódulo por nível (`NONE`, `READ`, `WRITE`)

## 9. Mapa de Telas (Frontend)

- `/` Dashboard
- `/tickets`, `/tickets/new`, `/tickets/:id`
- `/notifications`
- `/my/journal`
- `/employees`
- `/equipments`
- `/metrics`
- `/kb`
- `/sla`
- `/teams`
- `/users`
- `/tags`
- `/categories`
- `/automations`
- `/admin/sso`
- `/finance`
- `/hr`
- `/procurement`

Menu lateral é filtrado por módulo/entitlement e role.

## 10. Regras de Negócio Principais

### ITSM

- Abertura com tipo/prioridade/categoria/time
- Fluxo de status com rastreabilidade
- Worklog, comentários internos e observadores

### SLA/SLO

- política por critério (time/categoria/prioridade/tipo)
- cálculo em minutos úteis com calendário de negócio
- compliance agregado para dashboards
- recálculo administrativo em lote

### RH

- onboarding/offboarding com `CaseTask`
- offboarding dispara workflow assíncrono (BullMQ)
- vínculo com devolução de ativos
- políticas e aceites (`PolicyAcknowledgement`)

### Financeiro

- PR -> aprovação -> PO -> Invoice -> aprovação
- cadeia simples de aprovação
- cost center e vendor obrigatórios por fluxo

### Ativos/Estoque/Entrega

- cadastro de equipamento com NF, compra, patrimônio, valor
- entrega cria assignment e pode criar delivery
- devolução encerra assignment e atualiza delivery
- `StockMovement` rastreia IN/OUT/TRANSFER
- POD suportado por URL de comprovante

### Compliance/LGPD

- `AuditEvent` append-only (imutável)
- request_id/correlation_id propagado em API e jobs
- masking de PII por permissão
- anonimização via fluxo administrativo auditado

## 11. Chatbot e IA

O chatbot usa dados persistidos para responder linguagem natural (não inventa estado):

- quem está com equipamento X
- quais equipamentos o colaborador Y possui
- datas de entrega/devolução
- contexto de chamados e KB

Integrações configuráveis por ambiente:

- OpenAI (`OPENAI_API_KEY`)
- Gemini (`GEMINI_API_KEY`)

## 12. Observabilidade e SRE

Endpoints:

- `GET /health`
- `GET /healthz`
- `GET /readyz` (DB + Redis)
- `GET /metrics`

Além disso:

- logs estruturados com `requestId`
- telemetria de workers BullMQ
- trilha de auditoria assíncrona com DLQ

## 13. Banco de Dados (entidades-chave)

- IAM: `User`, `Role`, `Permission`, `RolePermission`, `UserRoleAssignment`, `UserEntitlement`, `AuthProviderConfig`
- Compliance: `AuditEvent`, `PlatformAuditLog`
- RH: `Employee`, `OnboardingCase`, `OffboardingCase`, `CaseTask`, `Policy`, `PolicyAcknowledgement`
- Financeiro: `CostCenter`, `Vendor`, `PurchaseRequest`, `PurchaseOrder`, `Invoice`, `Approval`, `AssetLedger`, `AssetMovement`
- Ativos: `Equipment`, `EquipmentAssignment`, `StockLocation`, `StockMovement`, `Delivery`, `DeliveryItem`

## 14. Setup Local

### Requisitos

- Docker + Docker Compose

### Subir ambiente

```bash
docker compose up -d
```

### Build/execução backend/frontend

```bash
docker compose exec -T backend npm run build
docker compose exec -T frontend npm run build
```

### Migração + seed

```bash
docker compose exec -T backend sh -lc "npx prisma migrate deploy"
docker compose exec -T backend npm run db:seed
```

## 15. Testes

Backend:

```bash
docker compose exec -T backend npm test
```

Testes focados IAM/entitlement:

```bash
docker compose exec -T backend sh -lc "npm test -- --runInBand src/__tests__/services/authorization.service.test.ts src/__tests__/services/entitlement-mapping.test.ts"
```

## 16. Variáveis de Ambiente

Arquivo base: `backend/.env.example`

Mínimo para produção:

- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CONFIG_ENCRYPTION_KEY`
- `OPENAI_API_KEY` e/ou `GEMINI_API_KEY` (se usar IA)

SSO (opcional por provedor ativo):

- bloco SAML (`SAML_*`)
- bloco Auth0 (`AUTH0_*`)

## 17. Deploy em Produção com rsync

Script: `deploy-on-vm.sh`

O script faz:

1. valida pré-requisitos (`docker`, `rsync`, `curl`)
2. valida `.env` e chaves obrigatórias
3. backup de banco/uploads/schema
4. sync com exclusão de segredos e artefatos (`.rsync-exclude`)
5. rebuild e restart (`docker-compose.prod.yml`)
6. migrations (`prisma migrate deploy`)
7. garantia de admin (`npm run db:ensure-admin`)
8. healthchecks (`/health`, `/healthz`, `/readyz`, `/metrics`) dentro do container backend

## 18. Checklist de Pronto para Produção

### Segurança

- [ ] `.env` não versionado no Git
- [ ] segredos fortes para JWT/DB/cripto
- [ ] `CONFIG_ENCRYPTION_KEY` definido
- [ ] SSO com somente 1 provedor ativo
- [ ] política de backup e retenção definida

### Aplicação

- [ ] `docker compose -f docker-compose.prod.yml build` sem erro
- [ ] migrations aplicam do zero
- [ ] seed/admin ok
- [ ] login admin funcionando
- [ ] `/readyz` respondendo `ok`

### Governança

- [ ] roles e permissões revisadas por área
- [ ] entitlements por usuário revisados
- [ ] ABAC validado para managers e escopo de time
- [ ] auditoria de ações críticas validada

## 19. Arquivos e Caminhos Importantes

- README: `README.md`
- Deploy VM: `deploy-on-vm.sh`
- Exclusões rsync: `.rsync-exclude`
- Compose prod: `docker-compose.prod.yml`
- Prisma schema: `backend/prisma/schema.prisma`
- Seed principal: `backend/prisma/seed.ts`
- Catálogo de permissões: `backend/src/domains/iam/entitlements/permissionCatalog.ts`
- Catálogo de entitlements: `backend/src/domains/iam/entitlements/entitlementCatalog.ts`
- Mapping entitlement->permission: `backend/src/domains/iam/entitlements/map.ts`

## 20. Estado Atual

A plataforma está funcional localmente com os módulos corporativos e base de segurança enterprise (RBAC + Permission + ABAC + Auditoria + Entitlements) já aplicados de forma incremental.

Para novos módulos ou evolução de políticas, manter sempre:

- migração Prisma + seed
- autorização no backend (`requirePermission`/`requireAbac`)
- visibilidade no frontend por entitlement
- teste unitário/integrado de regressão
