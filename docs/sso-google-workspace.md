## SSO SAML (Google Workspace) - Configuração

### 1) Criar aplicativo SAML no Google Admin
1. Admin Console → **Apps** → **Web and mobile apps** → **Add app** → **Add custom SAML app**.
2. Defina um nome (ex.: `GLPI ETUS`).
3. Baixe/obtenha:
   - **SSO URL** (SAML_ENTRY_POINT)
   - **Certificate** (SAML_CERT)

### 2) Configurar Service Provider (SP)
Use os valores:
- **ACS URL**: `https://help.etus.io/api/auth/saml/acs`
- **Entity ID**: `glpi-etus-backend`
- **Name ID**: `PRIMARY_EMAIL`
- **Name ID format**: `emailAddress`

### 3) Attribute Mapping
Opcional (se desejar enriquecer usuário):
- `email`, `firstName`, `lastName`, `department`

### 4) Group Membership Mapping
1. Habilitar envio de grupos.
2. Selecionar os grupos relevantes (ex.: `glpi-admins`, `glpi-techs`).
3. Definir **App attribute name** como `groups` (ou o valor de `SAML_GROUPS_ATTRIBUTE`).

### 5) Ativar app
Ativar para as OUs/grupos corretos.

### 6) Configurar variáveis de ambiente no backend
Exemplo:
```
SAML_ENABLED=true
SAML_ENTRY_POINT=https://accounts.google.com/o/saml2/idp?idpid=XXXX
SAML_ISSUER=glpi-etus-backend
SAML_CALLBACK_URL=https://help.etus.io/api/auth/saml/acs
SAML_CERT=-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----
SAML_SIGNATURE_ALG=sha256
SAML_NAMEID_FORMAT=urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
SAML_ALLOWED_DOMAINS=empresa.com.br,empresa.com
SAML_GROUPS_ATTRIBUTE=groups
SAML_ROLE_MAPPING_JSON={"glpi-admins@empresa.com":"ADMIN","glpi-triage@empresa.com":"TRIAGER","glpi-techs@empresa.com":"TECHNICIAN","glpi-users@empresa.com":"REQUESTER"}
SAML_DEFAULT_ROLE=REQUESTER
SAML_UPDATE_ROLE_ON_LOGIN=true
SAML_REQUIRE_GROUP=true
SAML_VALIDATE_IN_RESPONSE_TO=true
SAML_REQUEST_ID_TTL_MS=28800000
SAML_JWT_REDIRECT_URL=https://help.etus.io/auth/callback
```

### 7) Teste manual
1. Abrir `https://app.../login`.
2. Clicar **Entrar com Google**.
3. Validar redirecionamento para `/auth/callback` com token.
4. Validar role por grupo e login em cada perfil.
