## Admin Console

### Configuração SAML via UI
1. Acesse `Administração` → `SSO / SAML`.
2. O formulário já vem pré-preenchido para `https://help.etus.io`.
3. Preencha apenas o que vem do Google Workspace: `Entry Point`, `Certificado` e `Role Mapping`.
3. Configure domínios permitidos e mapeamento de grupos.
4. Clique em **Salvar**.
5. Clique em **Testar configuração**.
6. Use **Ver metadata do SP** para configurar o Google Workspace.

### CONFIG_ENCRYPTION_KEY
- Obrigatória em produção para salvar segredos (ex.: `SAML_CERT`).
- Pode ser hex 64 chars ou string qualquer (será derivada via SHA-256).
```
CONFIG_ENCRYPTION_KEY=seu-segredo-forte
```

### Checklist de validação
- Admin consegue editar e salvar settings.
- Usuário não-admin recebe 403 nos endpoints `/api/admin/settings`.
- Certificado SAML não aparece em claro na UI.
- Toggle SAML habilita/desabilita o botão **Entrar com Google**.
- Mapeamento de grupos aplica roles corretos (ADMIN/TRIAGER/TECHNICIAN/REQUESTER).

### Google Workspace
Veja `docs/sso-google-workspace.md`.
