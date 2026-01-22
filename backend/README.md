## Business Time, SLA, and Metrics (Technical Note)

### What changed
- Business time is now calculated by a single engine at `src/domain/time/businessTime.engine.ts`.
- SLA resolution time now pauses during `WAITING_REQUESTER` and `WAITING_THIRD_PARTY`.
- Enterprise metrics now compute MTTA/MTTR from actual timestamps and use a unified reopen definition.
- Backlog aging in business hours now uses the business schedule (no hardcoded hours).

### Business calendar and schedule
- Schedules are sourced via `businessCalendarService.getBusinessSchedule(calendarId)`.
- If no calendar is provided, the default corporate calendar is used:
  - Timezone: `America/Sao_Paulo`
  - Weekdays: Mon–Fri enabled
  - Hours: `09:00`–`18:00`
  - Holidays: taken from calendar exceptions (YYYY-MM-DD in schedule timezone)

### How to validate reports
1. Create three tickets:
   - Ticket A: has `firstResponseAt`, not resolved.
   - Ticket B: resolved.
   - Ticket C: resolved and re-opened (transition RESOLVED -> OPEN).
2. Run Enterprise Metrics with business hours enabled:
   - MTTA uses tickets with `firstResponseAt` (A/B/C).
   - MTTR uses tickets with `resolvedAt` (B/C).
   - Reopen rate counts tickets with status transition RESOLVED -> OPEN.
3. Validate backlog aging with a ticket created inside business hours.

### Tests added
- Business time engine: `src/__tests__/domain/businessTime.engine.test.ts`
- Ticket service business minutes: `src/__tests__/services/ticket.service.businessMinutes.test.ts`
- SLA pause/resume: `src/__tests__/services/sla.service.pause.test.ts`
- Enterprise metrics: `src/__tests__/services/enterpriseMetrics.service.test.ts`
- Ticket validation rules: `src/__tests__/services/ticket.service.validation.test.ts`

## SSO SAML (Google Workspace)

### Variáveis de ambiente
```
SAML_ENABLED=true|false
SAML_ENTRY_POINT=https://accounts.google.com/o/saml2/idp?idpid=XXXX
SAML_ISSUER=glpi-etus-backend
SAML_CALLBACK_URL=https://api.seudominio.com/api/auth/saml/acs
SAML_CERT=-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----
SAML_SIGNATURE_ALG=sha256
SAML_NAMEID_FORMAT=urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
SAML_ALLOWED_DOMAINS=empresa.com.br,empresa.com
SAML_GROUPS_ATTRIBUTE=groups
SAML_ROLE_MAPPING_JSON={"glpi-admins@empresa.com":"ADMIN","glpi-triage@empresa.com":"TRIAGER","glpi-techs@empresa.com":"TECHNICIAN","glpi-users@empresa.com":"REQUESTER"}
SAML_DEFAULT_ROLE=REQUESTER
SAML_UPDATE_ROLE_ON_LOGIN=true|false
SAML_REQUIRE_GROUP=true|false
SAML_VALIDATE_IN_RESPONSE_TO=true|false
SAML_REQUEST_ID_TTL_MS=28800000
SAML_JWT_REDIRECT_URL=https://app.seudominio.com/auth/callback
```

### Rotas
- `GET /api/auth/saml/login`
- `POST /api/auth/saml/acs`
- `GET /api/auth/saml/metadata`
- `POST /api/auth/saml/logout`

### Docs
Veja `docs/sso-google-workspace.md`.

## Admin Console
Veja `docs/admin-console.md` para configuração de SAML via UI, encryption key e checklist.
