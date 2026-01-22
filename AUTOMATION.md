## Motor de Automações – Visão Geral e Exemplos

Esta documentação descreve **como funciona hoje o motor de automações** da plataforma, quais **eventos** disparam regras, quais **ações** estão disponíveis e traz **exemplos práticos** de uso.

---

## Arquitetura das Automações

- **Modelo de dados (`AutomationRule`)** – tabela `automation_rules`:
  - **id**: UUID da regra  
  - **name**: nome da regra  
  - **description**: descrição opcional  
  - **enabled**: se a regra está ativa  
  - **event**: tipo de evento que dispara a regra (`AutomationEvent`)  
  - **conditions** (`Json`): objeto com filtros simples baseados em campos do ticket  
  - **actions** (`Json`): lista de ações a executar quando as condições forem atendidas  
  - **createdAt / updatedAt**: auditoria

- **Eventos (`AutomationEvent`)** atualmente suportados:
  - `ON_TICKET_CREATED`
  - `ON_TICKET_UPDATED`
  - `ON_STATUS_CHANGED`
  - `ON_PRIORITY_CHANGED`
  - `ON_TEAM_CHANGED`
  - `ON_SLA_BREACH`
  - `ON_SLA_MET`
  - `ON_COMMENT_ADDED`

- **Fluxo de execução (alto nível)**:
  1. Um ticket é criado/atualizado/comentado etc.
  2. `ticketIntegrations.service` registra o evento e adiciona um job na fila `automation` (BullMQ) com:
     - `event` (`AutomationEvent`)
     - `ticketId`
     - `ticketData` (snapshot do ticket)
  3. O worker `automation.worker.ts` consome o job e chama `automationService.processAutomations(event, ticketData)`.
  4. O `automationService`:
     - Busca todas as regras **ativas** para aquele `event`
     - Avalia `conditions` contra `ticketData`
     - Se passar, executa `executeActions(ticketId, actions)`
     - Registra um evento `AUTOMATION_TRIGGERED` no histórico do ticket.

- **Administração via UI**:
  - Tela: página `AutomationAdminPage.tsx` (menu “Automações”).
  - Somente usuários com **role ADMIN** conseguem criar/editar regras.
  - Cada regra exibe: nome, descrição, status (Ativa/Inativa), evento, condições (JSON) e ações (JSON).

---

## Condições (JSON)

As condições são um **objeto JSON simples** (tipo `Record<string, any>`) onde **cada propriedade é comparada por igualdade** com o campo correspondente do ticket:

- Implementação (resumida):

```ts
for (const [key, value] of Object.entries(conditions)) {
  if (value == null) continue;
  const ticketValue = ticket[key];
  if (ticketValue === undefined) continue;
  if (ticketValue !== value) return false;
}
return true;
```

- **Regras importantes**:
  - Todas as condições são combinadas com **AND**.
  - `{}` ou objeto vazio significa “**sem filtro**” (aplica a todos os tickets daquele evento).
  - Só deve-se usar campos que existem em `ticketData` (ex.: `priority`, `status`, `teamId`, `categoryId`, `tipo`, etc.).

### Exemplos de condições

- **Somente tickets de alta prioridade**:

```json
{ "priority": "HIGH" }
```

- **Tickets do time de Suporte N2**:

```json
{ "teamId": "uuid-do-time-n2" }
```

- **Tickets do tipo PROJECT com prioridade CRITICAL**:

```json
{
  "tipo": "PROJECT",
  "priority": "CRITICAL"
}
```

- **Sem condições (aplica a todos)**:

```json
{}
```

---

## Ações disponíveis

As ações são uma **lista de objetos JSON**, cada um com um campo obrigatório `type`.  
Tipos implementados em `executeActions`:

- `SET_TEAM`
- `SET_PRIORITY`
- `SET_STATUS`
- `ASSIGN_TO_TECHNICIAN`
- `ADD_TAG` (placeholder – ainda não faz a alteração real)
- `TRIGGER_SLA` (informativo – SLA já é iniciado automaticamente)
- `CALL_WEBHOOK` (integração externa, ex.: N8N)

### 1. `SET_TEAM`

- **Função**: altera o `teamId` do ticket.
- **Back-end**: `ticketService.updateTicket(ticketId, 'SYSTEM', ADMIN, { teamId })`.

**Exemplo de ações**:

```json
[
  {
    "type": "SET_TEAM",
    "teamId": "uuid-do-time-projetos"
  }
]
```

---

### 2. `SET_PRIORITY`

- **Função**: altera a prioridade do ticket (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Back-end**: `ticketService.updateTicket(... { priority })`.

**Exemplo**:

```json
[
  {
    "type": "SET_PRIORITY",
    "priority": "HIGH"
  }
]
```

---

### 3. `SET_STATUS`

- **Função**: muda o status do ticket (`OPEN`, `IN_PROGRESS`, `WAITING_REQUESTER`, `RESOLVED`, `CLOSED`, etc.).
- **Back-end**: `ticketService.updateTicket(... { status })`.

**Exemplo**:

```json
[
  {
    "type": "SET_STATUS",
    "status": "IN_PROGRESS"
  }
]
```

---

### 4. `ASSIGN_TO_TECHNICIAN`

- **Função**: atribui o ticket a um técnico (`assignedTechnicianId`).
- **Back-end**: `ticketService.updateTicket(... { assignedTechnicianId })`.

**Exemplo**:

```json
[
  {
    "type": "ASSIGN_TO_TECHNICIAN",
    "technicianId": "uuid-do-tecnico"
  }
]
```

---

### 5. `ADD_TAG` (placeholder)

- **Função atual**: apenas registra sucesso com uma nota; a adição real da tag ainda não foi implementada.

```json
[
  {
    "type": "ADD_TAG",
    "tagId": "uuid-da-tag"
  }
]
```

---

### 6. `TRIGGER_SLA` (informativo)

- **Função atual**: apenas adiciona uma nota, pois o SLA já é tratado automaticamente em `ticketIntegrations.service.ts`.

```json
[
  {
    "type": "TRIGGER_SLA"
  }
]
```

---

### 7. `CALL_WEBHOOK` (integração com N8N / outros sistemas)

- **Função**: chama um endpoint HTTP externo com dados completos do ticket.
- **Campos suportados**:
  - `url` (obrigatório): URL do webhook
  - `method` (opcional): `POST`, `PUT`, etc. (default `POST`)
  - `headers` (opcional): cabeçalhos extras (ex.: `Authorization`)

- **Payload enviado** (exemplo):

```json
{
  "event": "ticket_automation",
  "ticketId": "uuid-do-ticket",
  "ticket": { "...": "..." },
  "timestamp": "2025-12-16T22:00:00.000Z"
}
```

**Exemplo simples**:

```json
[
  {
    "type": "CALL_WEBHOOK",
    "url": "https://seu-n8n.com/webhook/glpi-automatizacao",
    "method": "POST"
  }
]
```

**Exemplo combinado (muda prioridade e notifica N8N)**:

```json
[
  {
    "type": "SET_PRIORITY",
    "priority": "CRITICAL"
  },
  {
    "type": "CALL_WEBHOOK",
    "url": "https://seu-n8n.com/webhook/p1-incident",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer SEU_TOKEN"
    }
  }
]
```

---

## Eventos (`AutomationEvent`) e exemplos práticos

A seguir, como cada evento é disparado e exemplos de uso.

### 1. `ON_TICKET_CREATED`

- **Quando dispara**: sempre que um ticket é criado (`recordTicketCreated`).
- **Fila**: `automationQueue.add('process-automations', { event: 'ON_TICKET_CREATED', ticketData })`.

**Exemplo – definir time padrão para tickets de uma categoria:**

```json
{
  "event": "ON_TICKET_CREATED",
  "conditions": { "categoryId": "uuid-da-categoria-financeiro" },
  "actions": [
    { "type": "SET_TEAM", "teamId": "uuid-time-financeiro" }
  ]
}
```

---

### 2. `ON_TICKET_UPDATED`

- **Quando dispara**: sempre que `recordTicketUpdated` é chamado (qualquer mudança relevante).
- **Fila**: `automationQueue.add('process-update-automations', { event: 'ON_TICKET_UPDATED', ticketData })`.

**Exemplo – qualquer atualização em ticket de alta prioridade chama webhook:**

```json
{
  "event": "ON_TICKET_UPDATED",
  "conditions": { "priority": "HIGH" },
  "actions": [
    {
      "type": "CALL_WEBHOOK",
      "url": "https://seu-n8n.com/webhook/ticket-updated-vip",
      "method": "POST"
    }
  ]
}
```

---

### 3. `ON_STATUS_CHANGED`

- **Quando dispara**: somente quando há mudança de status (`changes.status`).
- **Fila**: `automationQueue.add('process-status-automations', { event: 'ON_STATUS_CHANGED', ticketData })`.

**Exemplo – ao ir para `WAITING_REQUESTER`, baixar prioridade para `MEDIUM`:**

```json
{
  "event": "ON_STATUS_CHANGED",
  "conditions": { "status": "WAITING_REQUESTER" },
  "actions": [
    { "type": "SET_PRIORITY", "priority": "MEDIUM" }
  ]
}
```

---

### 4. `ON_PRIORITY_CHANGED`

- **Quando dispara**: somente quando a prioridade muda (`changes.priority`).
- **Fila**: `automationQueue.add('process-priority-automations', { event: 'ON_PRIORITY_CHANGED', ticketData })`.

**Exemplo – prioridade CRITICAL → mover para time de crise e notificar N8N:**

```json
{
  "event": "ON_PRIORITY_CHANGED",
  "conditions": { "priority": "CRITICAL" },
  "actions": [
    { "type": "SET_TEAM", "teamId": "uuid-time-crise" },
    {
      "type": "CALL_WEBHOOK",
      "url": "https://seu-n8n.com/webhook/p1-incident",
      "method": "POST"
    }
  ]
}
```

---

### 5. `ON_TEAM_CHANGED`

- **Quando dispara**: quando o time do ticket muda (`changes.teamId`).
- **Fila**: `automationQueue.add('process-team-automations', { event: 'ON_TEAM_CHANGED', ticketData })`.

**Exemplo – ao mover para time N2, marcar como `IN_PROGRESS`:**

```json
{
  "event": "ON_TEAM_CHANGED",
  "conditions": { "teamId": "uuid-time-n2" },
  "actions": [
    { "type": "SET_STATUS", "status": "IN_PROGRESS" }
  ]
}
```

---

### 6. `ON_SLA_BREACH` e `ON_SLA_MET`

- **Quando dispara**: via `slaService` e fila `slaQueue` (suporte preparado no enum, uso prático pode ser expandido).

**Exemplo conceitual – quando SLA é violado, chamar N8N:**

```json
{
  "event": "ON_SLA_BREACH",
  "conditions": {},
  "actions": [
    {
      "type": "CALL_WEBHOOK",
      "url": "https://seu-n8n.com/webhook/sla-breach",
      "method": "POST"
    }
  ]
}
```

---

### 7. `ON_COMMENT_ADDED`

- **Quando dispara**: em `recordCommentAdded`, após registrar o comentário.
- **Fila**: `automationQueue.add('process-comment-automations', { event: 'ON_COMMENT_ADDED', ticketData })`.

**Exemplo – comentários em tickets do tipo PROJECT vão para um webhook de projetos:**

```json
{
  "event": "ON_COMMENT_ADDED",
  "conditions": { "tipo": "PROJECT" },
  "actions": [
    {
      "type": "CALL_WEBHOOK",
      "url": "https://seu-n8n.com/webhook/project-comment",
      "method": "POST"
    }
  ]
}
```

---

## Integração N8N – Webhook Global vs Regras

- **Webhook Global (`N8N_WEBHOOK_URL`)**:
  - Configurado via variável de ambiente no backend.
  - Chamado automaticamente em:
    - Criação de ticket (`event: "ticket_created"`)
    - Atualização de ticket (`event: "ticket_updated"`)
  - Implementado em `ticketIntegrations.service.ts`.

- **Webhook por Regra (`CALL_WEBHOOK`)**:
  - Configurado por automação específica.
  - Somente dispara quando as **condições da regra** são satisfeitas.
  - Payload semelhante, com `event: "ticket_automation"` + contexto da regra (via histórico).

---

## Resumo

- O motor de automações é baseado em **eventos de ticket + regras JSON** configuráveis via UI.
- Cada regra define:
  - **Evento** (quando disparar)
  - **Condições** (filtros por campos do ticket)
  - **Ações** (alterar time, prioridade, status, atribuir técnico, chamar webhooks, etc.).
- A execução é **assíncrona**, via fila BullMQ (`automation`), garantindo performance e isolamento.
- Integrações N8N podem ser:
  - **Globais** (`N8N_WEBHOOK_URL`)
  - **Específicas por regra** (`CALL_WEBHOOK`).


