## Admin Console

A aba **Autenticação (SAML / Auth0)** concentra a configuração de login opcional por **SAML (Google Workspace)** e **Auth0 (OIDC)**. Pode habilitar um ou ambos; o login por email/senha permanece sempre disponível.

### Configuração SAML (Google Workspace) via UI
1. Acesse `Administração` → `Autenticação (SAML / Auth0)`.
2. Na seção SAML, clique em **Aplicar padrão Workspace** (preenche Issuer, ACS, NameID e Redirect).
3. Preencha **Entry Point (SSO URL)** e **Certificado X.509**.
4. Defina **Domínios permitidos** (CSV) e **Atributo de grupos** (default: `groups`).
5. Preencha o **Mapeamento de grupos** (JSON) usando o botão **Usar template**.
6. Clique em **Salvar**.
7. Clique em **Testar configuração SAML**.
8. Ative **Habilitar SAML** somente após o teste.

### Configuração Auth0 via UI
1. Na mesma aba, role até a seção **Auth0 (OIDC)**.
2. Clique em **Aplicar URLs padrão** para preencher Callback e JWT Redirect.
3. Preencha **Domain**, **Client ID** e **Client Secret** (do Auth0 Dashboard).
4. Ajuste **Domínios permitidos** e, se usar roles, **Claim de roles** e **Mapeamento de roles**.
5. **Salvar** → **Testar configuração Auth0** → marque **Habilitar Auth0** e salve de novo.

Passo a passo completo do Auth0 (Dashboard + Actions): `docs/auth0.md`.

### Dicas rápidas
- **SAML**: Issuer / ACS / Redirect use os valores sugeridos; **Validate InResponseTo** recomendado em produção.
- **Auth0**: Callback URL deve ser idêntica à configurada em Allowed Callback URLs no Auth0.
- **Role padrão**: usado quando não há grupo/role mapeado.
- **Requer grupo / Requer role mapeada**: restringe login a usuários com mapeamento.

### CONFIG_ENCRYPTION_KEY
- Obrigatória em produção para salvar segredos (ex.: `SAML_CERT`, Auth0 **Client Secret**).
- Pode ser hex 64 chars ou string qualquer (será derivada via SHA-256).
```
CONFIG_ENCRYPTION_KEY=seu-segredo-forte
```

### Checklist de validação
- Admin consegue editar e salvar settings.
- Usuário não-admin recebe 403 nos endpoints `/api/admin/settings`.
- Certificado SAML e Client Secret Auth0 não aparecem em claro na UI.
- Toggle SAML habilita/desabilita **Entrar com Google**; toggle Auth0 habilita **Entrar com Auth0**.
- Mapeamento de grupos/roles aplica perfis corretos (ADMIN/TRIAGER/TECHNICIAN/REQUESTER).

### Documentação
- **Google Workspace (SAML)**: `docs/sso-google-workspace.md`.
- **Auth0 (OIDC)**: `docs/auth0.md`.
