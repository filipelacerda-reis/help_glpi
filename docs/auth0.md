# Configuração Auth0 (OIDC)

Este guia descreve como configurar o Auth0 como provedor de identidade opcional na plataforma. O login por email/senha e o SAML (Google Workspace) continuam disponíveis; o Auth0 é mais uma opção.

## Visão geral

- O usuário clica em **Entrar com Auth0** na tela de login.
- É redirecionado para o Auth0 (tenant configurado), faz login lá e autoriza o app.
- O Auth0 redireciona de volta para o backend (`/api/auth/auth0/callback`).
- O backend valida o perfil, cria ou atualiza o usuário (JIT), emite JWT e redireciona para o frontend com o token na URL (`/auth/callback?token=...`).

## Passo a passo no Auth0 Dashboard

### 1) Criar um Application

1. Acesse [Auth0 Dashboard](https://manage.auth0.com/) e faça login.
2. Vá em **Applications** → **Applications** → **Create Application**.
3. Escolha **Regular Web Application** e dê um nome (ex.: `GLPI ETUS`).
4. Clique em **Create**.

### 2) Configurar o Application

Na aba **Settings** do application:

- **Allowed Callback URLs**  
  Adicione a URL de callback do seu backend, por exemplo:
  - Produção: `https://help.etus.io/api/auth/auth0/callback`
  - Local: `http://localhost:3000/api/auth/auth0/callback`

- **Allowed Logout URLs** (opcional)  
  URL do frontend para onde o usuário vai após logout, ex.: `https://help.etus.io` ou `http://localhost:5173`.

- **Allowed Web Origins** (opcional)  
  Pode ser a origem do frontend (ex.: `https://help.etus.io`) se usar chamadas CORS.

Anote:

- **Domain** (ex.: `seu-tenant.us.auth0.com`) — sem `https://`.
- **Client ID**
- **Client Secret** (em “Credentials”)

### 3) Configurar roles (opcional)

Para mapear usuários a perfis da plataforma (ADMIN, TRIAGER, TECHNICIAN, REQUESTER):

1. **User Management** → **Roles** → crie roles (ex.: `admin`, `triager`, `technician`, `requester`).
2. Atribua roles aos usuários (Users → usuário → Role).
3. Adicione uma **Action** (ou Rule legada) para incluir as roles no ID token:
   - **Actions** → **Flows** → **Login** → **+ Add Action** → **Build from scratch**.
   - Nome, ex.: `Add roles to ID token`.
   - Código (exemplo):

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const namespace = 'https://glpi.etus.io';
     if (event.authorization) {
       api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
     }
   };
   ```

4. Ative a Action no flow **Login**.

O claim no token será `https://glpi.etus.io/roles` (array de strings). Esse nome deve ser o mesmo configurado em **Claim de roles** na plataforma.

## Configuração na plataforma

1. Acesse **Administração** → **Autenticação (SAML / Auth0)**.
2. Role até a seção **Auth0 (OIDC)**.
3. Clique em **Aplicar URLs padrão** para preencher Callback URL e JWT Redirect URL com base no ambiente.
4. Preencha:
   - **Domain**: o Domain do Auth0 (ex.: `seu-tenant.us.auth0.com`).
   - **Client ID**: Client ID do Application.
   - **Client Secret**: Client Secret (ou deixe em branco se já estiver salvo).
   - **Callback URL**: mesma URL que colocou em Allowed Callback URLs no Auth0.
   - **JWT Redirect URL**: URL do frontend que recebe o token (ex.: `https://help.etus.io/auth/callback`).
   - **Domínios permitidos** (CSV): ex. `empresa.com.br,empresa.com` — só emails desses domínios podem logar.
   - **Claim de roles**: ex. `https://glpi.etus.io/roles` (igual ao usado na Action).
   - **Mapeamento de roles**: JSON que mapeia o valor do claim para a role interna, ex.:
     ```json
     {
       "admin": "ADMIN",
       "triager": "TRIAGER",
       "technician": "TECHNICIAN",
       "requester": "REQUESTER"
     }
     ```
   - **Role padrão**: usado quando o usuário não tem role no claim.
   - **Requer role mapeada**: se ativo, usuários sem role no token não conseguem logar (quando há mapeamento configurado).
5. Clique em **Salvar**.
6. Clique em **Testar configuração Auth0** para validar sem fazer login.
7. Marque **Habilitar Auth0** e salve novamente.

## Variáveis de ambiente (opcional)

As configurações podem ser definidas pela interface e salvas no banco. Se preferir env vars (ex.: deploy inicial), use:

```env
AUTH0_ENABLED=true
AUTH0_DOMAIN=seu-tenant.us.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_CALLBACK_URL=https://help.etus.io/api/auth/auth0/callback
AUTH0_JWT_REDIRECT_URL=https://help.etus.io/auth/callback
AUTH0_ALLOWED_DOMAINS=empresa.com.br,empresa.com
AUTH0_ROLES_CLAIM=https://glpi.etus.io/roles
AUTH0_ROLE_MAPPING_JSON={"admin":"ADMIN","triager":"TRIAGER","technician":"TECHNICIAN","requester":"REQUESTER"}
AUTH0_DEFAULT_ROLE=REQUESTER
AUTH0_UPDATE_ROLE_ON_LOGIN=true
AUTH0_REQUIRE_ROLE=false
```

O que estiver no banco (configurado pela tela de Administração) tem precedência sobre o `.env`.

## Teste manual

1. Abra a tela de login da aplicação.
2. Clique em **Entrar com Auth0**.
3. Faça login no Auth0 e autorize o app.
4. Verifique o redirecionamento para o dashboard com o usuário logado e a role correta.

## Troubleshooting

- **Erro de domínio**: confira **Domínios permitidos** e o domínio do email do usuário no Auth0.
- **Callback inválido**: verifique se a **Callback URL** na plataforma é exatamente a mesma que está em **Allowed Callback URLs** no Auth0 (incluindo protocolo e path).
- **Role não aplicada**: confirme que a Action (ou Rule) está no flow **Login**, que o claim name é o mesmo em **Claim de roles** e que o **Mapeamento de roles** está em JSON válido.
- **Client Secret**: em produção, use **CONFIG_ENCRYPTION_KEY** para que o secret seja armazenado criptografado no banco (veja `docs/admin-console.md`).
