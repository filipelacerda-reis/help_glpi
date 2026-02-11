## SSO SAML (Google Workspace) - Configuração

### Visão geral
O fluxo é: Google Workspace (IdP) autentica o usuário → retorna SAML para o backend → backend emite JWT e redireciona o usuário para o frontend.

### Dados que você vai precisar
Use estes valores ao configurar o **Service Provider (SP)** no Google:
- **ACS URL**: `https://help.etus.io/api/auth/saml/acs`
- **Entity ID**: `glpi-etus-backend`
- **Name ID**: `PRIMARY_EMAIL`
- **Name ID format**: `emailAddress`

No backend, estes campos são configurados na UI (Administração → SSO / SAML):
- **Entry Point (SSO URL)** do Google
- **Certificado X.509**
- **Domínios permitidos**
- **Atributo de grupos**
- **Mapeamento de grupos**

### 1) Criar aplicativo SAML no Google Admin
1. Acesse o **Admin Console**.
2. Vá em **Apps** → **Web and mobile apps** → **Add app** → **Add custom SAML app**.
3. Dê um nome (ex.: `GLPI ETUS`).
4. Na etapa de detalhes do IdP, anote:
   - **SSO URL** (Entry Point)
   - **Certificate** (download do X.509)

### 2) Configurar o Service Provider (SP)
Na etapa “Service Provider Details”, preencha:
- **ACS URL**: `https://help.etus.io/api/auth/saml/acs`
- **Entity ID**: `glpi-etus-backend`
- **Name ID**: `PRIMARY_EMAIL`
- **Name ID format**: `emailAddress`

### 3) Attribute Mapping (opcional)
Se desejar enriquecer o perfil do usuário, você pode mapear:
- `email`, `firstName`, `lastName`, `department`

### 4) Group Membership Mapping (obrigatório para roles)
1. Habilite o envio de grupos.
2. Selecione os grupos que terão acesso (ex.: `glpi-admins`, `glpi-techs`).
3. Defina **App attribute name** como `groups` (ou o valor configurado em `SAML_GROUPS_ATTRIBUTE`).

### 5) Ativar o app
Ative o app para as OUs/grupos corretos.

### 6) Configurar na plataforma (Administração → SSO / SAML)
1. Clique em **Aplicar padrão Workspace** (preenche Issuer, ACS e NameID Format).
2. Preencha o **Entry Point** com a SSO URL.
3. Cole o **Certificado X.509**.
4. Informe **Domínios permitidos** (CSV).
5. Defina **Atributo de grupos** (por padrão, `groups`).
6. Preencha o **Mapeamento de grupos** (JSON).
7. Clique em **Salvar** e depois em **Testar configuração SAML**.
8. Habilite o SAML e valide com usuários reais.

Exemplo de mapeamento:
```
{
  "glpi-admins@empresa.com": "ADMIN",
  "glpi-triage@empresa.com": "TRIAGER",
  "glpi-techs@empresa.com": "TECHNICIAN",
  "glpi-users@empresa.com": "REQUESTER"
}
```

### 7) Teste manual
1. Abra `https://help.etus.io/login`.
2. Clique em **Entrar com Google**.
3. Verifique o redirecionamento para `/auth/callback` com token.
4. Valide o role por grupo (ADMIN/TRIAGER/TECHNICIAN/REQUESTER).

### Troubleshooting rápido
- **Erro de domínio**: verifique `Domínios permitidos`.
- **Sem grupos**: confirme o atributo `groups` no Google e o `requireGroup`.
- **Sem certificado**: cole o X.509 em formato PEM (`BEGIN CERTIFICATE`).
