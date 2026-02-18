import { useEffect, useState } from 'react';
import ModernLayout from '../components/ModernLayout';
import { adminSettingsService } from '../services/adminSettings.service';
import { slaService } from '../services/sla.service';
import { teamService } from '../services/team.service';
import { categoryService } from '../services/category.service';

type TabKey = 'sso' | 'platform' | 'tools' | 'audit';

const SamlAdminPage = () => {
  const ticketTypes = ['INCIDENT', 'SERVICE_REQUEST', 'PROBLEM', 'CHANGE', 'TASK', 'QUESTION'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const roleMappingTemplate = `{
  "glpi-admins@empresa.com": "ADMIN",
  "glpi-triage@empresa.com": "TRIAGER",
  "glpi-techs@empresa.com": "TECHNICIAN",
  "glpi-users@empresa.com": "REQUESTER"
}`;
  const applyWorkspaceDefaults = () => {
    setSettings((prev: any) => ({
      ...prev,
      saml: {
        ...prev?.saml,
        issuer: 'glpi-etus-backend',
        callbackUrl: 'https://help.etus.io/api/auth/saml/acs',
        jwtRedirectUrl: 'https://help.etus.io/auth/callback',
        groupsAttribute: 'groups',
        signatureAlgorithm: 'sha256',
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      },
    }));
  };
  const [activeTab, setActiveTab] = useState<TabKey>('sso');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [samlCert, setSamlCert] = useState('');
  const [auth0ClientSecret, setAuth0ClientSecret] = useState('');
  const [calendars, setCalendars] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [toolFilters, setToolFilters] = useState({
    from: '',
    to: '',
    teamId: '',
    categoryId: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsData, calendarsData, teamsData, categoriesData] = await Promise.all([
          adminSettingsService.getSettings(),
          slaService.getAllCalendars(),
          teamService.getAllTeams(),
          categoryService.getAllCategories(),
        ]);
        const samlDefaults = {
          issuer: 'glpi-etus-backend',
          callbackUrl: 'https://help.etus.io/api/auth/saml/acs',
          jwtRedirectUrl: 'https://help.etus.io/auth/callback',
          allowedDomains: '',
          groupsAttribute: 'groups',
          defaultRole: 'REQUESTER',
          updateRoleOnLogin: true,
          requireGroup: true,
          signatureAlgorithm: 'sha256',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          validateInResponseTo: true,
          requestIdTtlMs: 8 * 60 * 60 * 1000,
        };
        const apiBase = import.meta.env.VITE_API_URL || '';
        const appBase = import.meta.env.VITE_APP_URL || window.location.origin;
        const auth0Defaults = {
          domain: '',
          clientId: '',
          callbackUrl: apiBase ? `${apiBase.replace(/\/$/, '')}/api/auth/auth0/callback` : '',
          audience: '',
          jwtRedirectUrl: `${appBase.replace(/\/$/, '')}/auth/callback`,
          allowedDomains: '',
          rolesClaim: 'https://glpi.etus.io/roles',
          roleMappingJson: '{}',
          defaultRole: 'REQUESTER',
          updateRoleOnLogin: true,
          requireRole: false,
        };
        const merged = {
          ...settingsData,
          saml: {
            ...samlDefaults,
            ...(settingsData.saml || {}),
          },
          auth0: {
            ...auth0Defaults,
            ...(settingsData.auth0 || {}),
          },
        };
        setSettings(merged);
        setCalendars(calendarsData);
        setTeams(teamsData);
        setCategories(categoriesData);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      if (settings.saml?.enabled) {
        if (!settings.saml.entryPoint || !settings.saml.issuer || !settings.saml.callbackUrl) {
          setError('Preencha Entry Point, Issuer e Callback.');
          setSaving(false);
          return;
        }
        if (!settings.saml.allowedDomains) {
          setError('Informe os domínios permitidos.');
          setSaving(false);
          return;
        }
        if (settings.saml.requireGroup && !settings.saml.roleMappingJson) {
          setError('Informe o mapeamento de grupos.');
          setSaving(false);
          return;
        }
        if (samlCert && !samlCert.includes('BEGIN CERTIFICATE')) {
          setError('Certificado inválido.');
          setSaving(false);
          return;
        }
      }
      if (settings.auth0?.enabled) {
        if (!settings.auth0.domain || !settings.auth0.clientId || !settings.auth0.callbackUrl) {
          setError('Auth0: preencha Domain, Client ID e Callback URL.');
          setSaving(false);
          return;
        }
        if (settings.auth0.clientSecret !== '***' && !auth0ClientSecret) {
          setError('Auth0: informe o Client Secret.');
          setSaving(false);
          return;
        }
      }

      const payload = {
        saml: {
          ...settings.saml,
          cert: samlCert || undefined,
        },
        auth0: {
          ...settings.auth0,
          clientSecret: auth0ClientSecret || (settings.auth0?.clientSecret === '***' ? undefined : settings.auth0?.clientSecret),
        },
        platform: settings.platform,
      };
      await adminSettingsService.updateSettings(payload);
      setSuccess('Configurações salvas com sucesso');
      setSamlCert('');
      setAuth0ClientSecret('');
      const refreshed = await adminSettingsService.getSettings();
      setSettings(refreshed);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSaml = async () => {
    setError('');
    setSuccess('');
    try {
      const result = await adminSettingsService.testSaml();
      setSuccess(result.message || 'Configuração válida');
    } catch (err: any) {
      const message = err.response?.data?.errors?.join(', ') || err.response?.data?.error;
      setError(message || 'Falha ao testar configuração');
    }
  };

  const handleTestAuth0 = async () => {
    setError('');
    setSuccess('');
    try {
      const result = await adminSettingsService.testAuth0();
      setSuccess(result.message || 'Configuração Auth0 válida');
    } catch (err: any) {
      const message = err.response?.data?.errors?.join(', ') || err.response?.data?.error;
      setError(message || 'Falha ao testar Auth0');
    }
  };

  const applyAuth0Defaults = () => {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const apiUrl = import.meta.env.VITE_API_URL || baseUrl;
    setSettings((prev: any) => ({
      ...prev,
      auth0: {
        ...prev?.auth0,
        callbackUrl: `${apiUrl.replace(/\/$/, '')}/api/auth/auth0/callback`,
        jwtRedirectUrl: `${baseUrl.replace(/\/$/, '')}/auth/callback`,
        rolesClaim: 'https://glpi.etus.io/roles',
      },
    }));
  };

  const auth0RoleMappingTemplate = `{
  "admin": "ADMIN",
  "triager": "TRIAGER",
  "technician": "TECHNICIAN",
  "requester": "REQUESTER"
}`;

  const loadAudit = async () => {
    const result = await adminSettingsService.getAudit(50, auditCursor || undefined);
    setAuditItems((prev) => [...prev, ...result.data]);
    setAuditCursor(result.nextCursor);
  };

  if (loading) {
    return (
      <ModernLayout title="Administração" subtitle="Console Administrativo">
        <div className="p-6 text-gray-300">Carregando...</div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Administração" subtitle="Console Administrativo">
      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-lg backdrop-blur-sm">
            {success}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'sso', label: 'Autenticação (SAML / Auth0)' },
            { key: 'platform', label: 'Configurações Gerais' },
            { key: 'tools', label: 'Ferramentas' },
            { key: 'audit', label: 'Auditoria' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`px-4 py-2 rounded-lg text-sm ${
                activeTab === tab.key
                  ? 'bg-etus-green text-gray-900'
                  : 'bg-gray-800/50 text-gray-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'sso' && settings && (
          <div className="bg-gray-700/30 backdrop-blur-sm border border-gray-600/50 rounded-lg p-6 space-y-6">
            <div className="text-sm text-gray-300">
              Provedor ativo atual:{' '}
              <span className="font-semibold text-etus-green">
                {settings.activeProvider === 'SAML_GOOGLE'
                  ? 'SAML Google Workspace'
                  : settings.activeProvider === 'AUTH0'
                    ? 'Auth0'
                    : 'Nenhum (somente login local)'}
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border border-gray-600/50 rounded-lg p-4 bg-gray-700/20">
                <p className="text-sm text-gray-200 font-medium">1) Gerar Metadata do SP</p>
                <p className="text-xs text-gray-400 mt-2">
                  Use o link abaixo para cadastrar o app no Google Workspace.
                </p>
                <a
                  href={`${import.meta.env.VITE_API_URL}/api/auth/saml/metadata`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs text-etus-green hover:text-etus-green-dark"
                >
                  Abrir metadata do SP
                </a>
              </div>
              <div className="border border-gray-600/50 rounded-lg p-4 bg-gray-700/20">
                <p className="text-sm text-gray-200 font-medium">2) Configurar Google Workspace</p>
                <p className="text-xs text-gray-400 mt-2">
                  Crie um app SAML customizado, ative grupos e copie o Entry Point e o Certificado.
                </p>
              </div>
              <div className="border border-gray-600/50 rounded-lg p-4 bg-gray-700/20">
                <p className="text-sm text-gray-200 font-medium">3) Preencher abaixo e testar</p>
                <p className="text-xs text-gray-400 mt-2">
                  Salve as configurações e rode o teste antes de habilitar para todos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <label className="text-sm text-gray-300 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(settings.saml.enabled)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      saml: { ...settings.saml, enabled: e.target.checked },
                      auth0: {
                        ...settings.auth0,
                        enabled: e.target.checked ? false : Boolean(settings.auth0?.enabled),
                      },
                    })
                  }
                />
                <span>Habilitar SAML</span>
              </label>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={applyWorkspaceDefaults}
                  className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200 text-sm"
                >
                  Aplicar padrão Workspace
                </button>
                <button
                  onClick={handleTestSaml}
                  className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200 text-sm"
                >
                  Testar configuração SAML
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Entry Point (SSO URL)</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.saml.entryPoint || ''}
                  onChange={(e) => setSettings({ ...settings, saml: { ...settings.saml, entryPoint: e.target.value } })}
                  placeholder="https://accounts.google.com/o/saml2/idp?idpid=..."
                />
                <span className="text-xs text-gray-500">Copie do Google Workspace → SSO URL</span>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Issuer (Entity ID)</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.saml.issuer || ''}
                  onChange={(e) => setSettings({ ...settings, saml: { ...settings.saml, issuer: e.target.value } })}
                />
                <span className="text-xs text-gray-500">Use este valor no Google como Entity ID do SP</span>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">ACS Callback</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.saml.callbackUrl || ''}
                  onChange={(e) => setSettings({ ...settings, saml: { ...settings.saml, callbackUrl: e.target.value } })}
                />
                <span className="text-xs text-gray-500">Use este valor no Google como ACS URL</span>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">JWT Redirect URL</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.saml.jwtRedirectUrl || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, saml: { ...settings.saml, jwtRedirectUrl: e.target.value } })
                  }
                />
                <span className="text-xs text-gray-500">URL do frontend para receber o token</span>
              </label>
              <label className="text-sm text-gray-300 md:col-span-2">
                <span className="block mb-2">Certificado (PEM)</span>
                <textarea
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white h-28"
                  placeholder={settings.saml.cert === '***' ? 'Certificado já configurado' : ''}
                  value={samlCert}
                  onChange={(e) => setSamlCert(e.target.value)}
                />
                <span className="text-xs text-gray-500">Cole o certificado X.509 exportado no Google Workspace</span>
              </label>
              <div className="md:col-span-2 text-sm text-gray-400">
                Certificado configurado: <span className="text-white">{settings.saml.cert === '***' ? 'Sim' : 'Não'}</span>
              </div>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Domínios permitidos (CSV)</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.saml.allowedDomains || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, saml: { ...settings.saml, allowedDomains: e.target.value } })
                  }
                  placeholder="empresa.com.br,empresa.com"
                />
                <span className="text-xs text-gray-500">Bloqueia acesso de domínios externos</span>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Atributo de grupos</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.saml.groupsAttribute || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, saml: { ...settings.saml, groupsAttribute: e.target.value } })
                  }
                />
                <span className="text-xs text-gray-500">Nome do atributo de grupos enviado pelo IdP</span>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Role padrão</span>
                <select
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.saml.defaultRole || 'REQUESTER'}
                  onChange={(e) =>
                    setSettings({ ...settings, saml: { ...settings.saml, defaultRole: e.target.value } })
                  }
                >
                  {['ADMIN', 'TRIAGER', 'TECHNICIAN', 'REQUESTER'].map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">Usado quando o grupo não foi mapeado</span>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Atualizar role no login</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.saml.updateRoleOnLogin)}
                  onChange={(e) =>
                    setSettings({ ...settings, saml: { ...settings.saml, updateRoleOnLogin: e.target.checked } })
                  }
                />
                <span className="text-xs text-gray-500 block">Sincroniza role com grupos a cada login</span>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Requer grupo</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.saml.requireGroup)}
                  onChange={(e) =>
                    setSettings({ ...settings, saml: { ...settings.saml, requireGroup: e.target.checked } })
                  }
                />
                <span className="text-xs text-gray-500 block">Se ativo, só loga quando há grupo mapeado</span>
              </label>
              <label className="text-sm text-gray-300 md:col-span-2">
                <span className="block mb-2">Mapeamento de grupos</span>
                <textarea
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white h-32"
                  value={settings.saml.roleMappingJson || '{}'}
                  onChange={(e) =>
                    setSettings({ ...settings, saml: { ...settings.saml, roleMappingJson: e.target.value } })
                  }
                />
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>Mapeie grupos do Workspace → roles internos</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({ ...settings, saml: { ...settings.saml, roleMappingJson: roleMappingTemplate } })
                    }
                    className="text-etus-green hover:text-etus-green-dark"
                  >
                    Usar template
                  </button>
                </div>
              </label>
            </div>

            <div className="border border-gray-600/50 rounded-lg p-4 bg-gray-700/20 space-y-3">
              <p className="text-sm text-gray-200 font-medium">Configurações avançadas</p>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">NameID Format</span>
                  <input
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.saml.nameIdFormat || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, saml: { ...settings.saml, nameIdFormat: e.target.value } })
                    }
                  />
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Signature Algorithm</span>
                  <input
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.saml.signatureAlgorithm || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, saml: { ...settings.saml, signatureAlgorithm: e.target.value } })
                    }
                  />
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Validate InResponseTo</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.saml.validateInResponseTo)}
                    onChange={(e) =>
                      setSettings({ ...settings, saml: { ...settings.saml, validateInResponseTo: e.target.checked } })
                    }
                  />
                  <span className="text-xs text-gray-500 block">Recomendado para produção (anti-replay)</span>
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">TTL Request ID (ms)</span>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.saml.requestIdTtlMs || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        saml: { ...settings.saml, requestIdTtlMs: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              </div>
            </div>

            {/* Auth0 */}
            <div className="border-t border-gray-600/50 pt-6 mt-6">
              <h3 className="text-lg font-medium text-white mb-2">Auth0 (OIDC)</h3>
              <p className="text-sm text-gray-400 mb-4">
                Use Auth0 como provedor de identidade. Configure um Application no Dashboard e preencha os campos abaixo.
              </p>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="border border-gray-600/50 rounded-lg p-4 bg-gray-700/20">
                  <p className="text-sm text-gray-200 font-medium">1) Criar Application no Auth0</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Dashboard → Applications → Create Application → Regular Web Application. Anote Domain, Client ID e Client Secret.
                  </p>
                </div>
                <div className="border border-gray-600/50 rounded-lg p-4 bg-gray-700/20">
                  <p className="text-sm text-gray-200 font-medium">2) URLs no Auth0</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Allowed Callback URLs: use o valor de Callback URL abaixo. Allowed Logout URLs (opcional): URL do frontend.
                  </p>
                </div>
                <div className="border border-gray-600/50 rounded-lg p-4 bg-gray-700/20">
                  <p className="text-sm text-gray-200 font-medium">3) Roles (opcional)</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Crie roles no Auth0 e adicione uma Action para incluir o claim no ID token. Use o nome do claim em &quot;Claim de roles&quot;.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <label className="text-sm text-gray-300 flex items-center gap-2">
                  <input
                  type="checkbox"
                  checked={Boolean(settings.auth0?.enabled)}
                  onChange={(e) =>
                      setSettings({
                        ...settings,
                        auth0: { ...settings.auth0, enabled: e.target.checked },
                        saml: {
                          ...settings.saml,
                          enabled: e.target.checked ? false : Boolean(settings.saml?.enabled),
                        },
                      })
                    }
                  />
                  <span>Habilitar Auth0</span>
                </label>
                <button
                  onClick={applyAuth0Defaults}
                  className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200 text-sm"
                >
                  Aplicar URLs padrão
                </button>
                <button
                  onClick={handleTestAuth0}
                  className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200 text-sm"
                >
                  Testar configuração Auth0
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Domain (tenant)</span>
                  <input
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.auth0?.domain || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, domain: e.target.value } })
                    }
                    placeholder="seu-tenant.us.auth0.com"
                  />
                  <span className="text-xs text-gray-500">Ex.: meu-tenant.us.auth0.com (sem https://)</span>
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Client ID</span>
                  <input
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.auth0?.clientId || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, clientId: e.target.value } })
                    }
                  />
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Client Secret</span>
                  <input
                    type="password"
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    placeholder={settings.auth0?.clientSecret === '***' ? 'Secret já configurado' : ''}
                    value={auth0ClientSecret}
                    onChange={(e) => setAuth0ClientSecret(e.target.value)}
                  />
                  <span className="text-xs text-gray-500">Copie do Auth0 Dashboard → Application → Settings</span>
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Callback URL</span>
                  <input
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.auth0?.callbackUrl || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, callbackUrl: e.target.value } })
                    }
                  />
                  <span className="text-xs text-gray-500">Cole em Allowed Callback URLs no Auth0</span>
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">JWT Redirect URL</span>
                  <input
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.auth0?.jwtRedirectUrl || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, jwtRedirectUrl: e.target.value } })
                    }
                  />
                  <span className="text-xs text-gray-500">URL do frontend para receber o token (ex.: /auth/callback)</span>
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Domínios permitidos (CSV)</span>
                  <input
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.auth0?.allowedDomains || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, allowedDomains: e.target.value } })
                    }
                    placeholder="empresa.com.br,empresa.com"
                  />
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Claim de roles</span>
                  <input
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.auth0?.rolesClaim || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, rolesClaim: e.target.value } })
                    }
                  />
                  <span className="text-xs text-gray-500">Nome do claim no ID token (ex.: https://glpi.etus.io/roles)</span>
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Role padrão</span>
                  <select
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                    value={settings.auth0?.defaultRole || 'REQUESTER'}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, defaultRole: e.target.value } })
                    }
                  >
                    {['ADMIN', 'TRIAGER', 'TECHNICIAN', 'REQUESTER'].map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Atualizar role no login</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.auth0?.updateRoleOnLogin)}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, updateRoleOnLogin: e.target.checked } })
                    }
                  />
                </label>
                <label className="text-sm text-gray-300">
                  <span className="block mb-2">Requer role mapeada</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.auth0?.requireRole)}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, requireRole: e.target.checked } })
                    }
                  />
                  <span className="text-xs text-gray-500 block">Se ativo, exige claim de roles no token</span>
                </label>
                <label className="text-sm text-gray-300 md:col-span-2">
                  <span className="block mb-2">Mapeamento de roles (Auth0 → plataforma)</span>
                  <textarea
                    className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white h-28"
                    value={settings.auth0?.roleMappingJson || '{}'}
                    onChange={(e) =>
                      setSettings({ ...settings, auth0: { ...settings.auth0, roleMappingJson: e.target.value } })
                    }
                  />
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>Valor do claim no Auth0 → role interno</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({ ...settings, auth0: { ...settings.auth0, roleMappingJson: auth0RoleMappingTemplate } })
                      }
                      className="text-etus-green hover:text-etus-green-dark"
                    >
                      Usar template
                    </button>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-etus-green text-gray-900 font-semibold"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <a
                href={`${import.meta.env.VITE_API_URL}/api/auth/saml/metadata`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200"
              >
                Ver metadata do SP
              </a>
            </div>
          </div>
        )}

        {activeTab === 'platform' && settings && (
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Nome do sistema</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.platform?.branding?.name || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: {
                        ...settings.platform,
                        branding: { ...settings.platform?.branding, name: e.target.value },
                      },
                    })
                  }
                />
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Logo URL</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.platform?.branding?.logoUrl || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: {
                        ...settings.platform,
                        branding: { ...settings.platform?.branding, logoUrl: e.target.value },
                      },
                    })
                  }
                />
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Timezone</span>
                <input
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.platform?.timezone || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, platform: { ...settings.platform, timezone: e.target.value } })
                  }
                />
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Calendário padrão</span>
                <select
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.platform?.businessCalendarDefaultId || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: { ...settings.platform, businessCalendarDefaultId: e.target.value },
                    })
                  }
                >
                  <option value="">Selecione...</option>
                  {calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Solicitante pode criar</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.platform?.ticketing?.allowRequesterCreate)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: {
                        ...settings.platform,
                        ticketing: { ...settings.platform?.ticketing, allowRequesterCreate: e.target.checked },
                      },
                    })
                  }
                />
              </label>
              <div className="text-sm text-gray-300 md:col-span-2">
                <span className="block mb-2">Tipos habilitados</span>
                <div className="grid grid-cols-2 gap-2">
                  {ticketTypes.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={settings.platform?.ticketing?.enabledTypes?.includes(type) || false}
                        onChange={(e) => {
                          const current = settings.platform?.ticketing?.enabledTypes || [];
                          const updated = e.target.checked
                            ? [...current, type]
                            : current.filter((item: string) => item !== type);
                          setSettings({
                            ...settings,
                            platform: {
                              ...settings.platform,
                              ticketing: { ...settings.platform?.ticketing, enabledTypes: updated },
                            },
                          });
                        }}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>
              <div className="text-sm text-gray-300 md:col-span-2">
                <span className="block mb-2">Prioridades habilitadas</span>
                <div className="grid grid-cols-2 gap-2">
                  {priorities.map((priority) => (
                    <label key={priority} className="flex items-center gap-2 text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={settings.platform?.ticketing?.enabledPriorities?.includes(priority) || false}
                        onChange={(e) => {
                          const current = settings.platform?.ticketing?.enabledPriorities || [];
                          const updated = e.target.checked
                            ? [...current, priority]
                            : current.filter((item: string) => item !== priority);
                          setSettings({
                            ...settings,
                            platform: {
                              ...settings.platform,
                              ticketing: { ...settings.platform?.ticketing, enabledPriorities: updated },
                            },
                          });
                        }}
                      />
                      {priority}
                    </label>
                  ))}
                </div>
              </div>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Socket habilitado</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.platform?.notifications?.socketEnabled)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: {
                        ...settings.platform,
                        notifications: { ...settings.platform?.notifications, socketEnabled: e.target.checked },
                      },
                    })
                  }
                />
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Retenção notificações (dias)</span>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.platform?.notifications?.retentionDays || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: {
                        ...settings.platform,
                        notifications: {
                          ...settings.platform?.notifications,
                          retentionDays: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Assistente habilitado</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.platform?.ai?.assistantEnabled)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: {
                        ...settings.platform,
                        ai: { ...settings.platform?.ai, assistantEnabled: e.target.checked },
                      },
                    })
                  }
                />
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Limite diário IA</span>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={settings.platform?.ai?.dailyLimit || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: {
                        ...settings.platform,
                        ai: { ...settings.platform?.ai, dailyLimit: Number(e.target.value) },
                      },
                    })
                  }
                />
              </label>
            </div>
            <div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-etus-green text-gray-900 font-semibold"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Data inicial</span>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={toolFilters.from}
                  onChange={(e) => setToolFilters({ ...toolFilters, from: e.target.value })}
                />
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Data final</span>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={toolFilters.to}
                  onChange={(e) => setToolFilters({ ...toolFilters, to: e.target.value })}
                />
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Time</span>
                <select
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={toolFilters.teamId}
                  onChange={(e) => setToolFilters({ ...toolFilters, teamId: e.target.value })}
                >
                  <option value="">Todos</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-300">
                <span className="block mb-2">Categoria</span>
                <select
                  className="w-full px-3 py-2 bg-gray-700/40 border border-gray-600 rounded-lg text-white"
                  value={toolFilters.categoryId}
                  onChange={(e) => setToolFilters({ ...toolFilters, categoryId: e.target.value })}
                >
                  <option value="">Todas</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={async () => {
                  await adminSettingsService.recalculateSla(toolFilters);
                  setSuccess('Job de recálculo enviado');
                }}
                className="px-4 py-2 rounded-lg bg-etus-green text-gray-900 font-semibold"
              >
                Recalcular SLA/Stats
              </button>
              <button
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-500 cursor-not-allowed"
                disabled
              >
                Reindexar métricas (em breve)
              </button>
              <a
                href="/users"
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200"
              >
                Gerenciar usuários
              </a>
              <a
                href={`${import.meta.env.VITE_API_URL}/api/admin/audit/export`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200"
              >
                Exportar auditoria
              </a>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 space-y-4">
            <button
              onClick={loadAudit}
              className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200"
            >
              Carregar auditoria
            </button>
            <div className="space-y-3">
              {auditItems.map((item) => (
                <div key={item.id} className="border border-gray-700/50 rounded-lg p-3 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span>{item.resource} - {item.action}</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-400">
                    {item.actor?.email || 'system'}
                  </div>
                </div>
              ))}
            </div>
            {auditCursor && (
              <button
                onClick={loadAudit}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200"
              >
                Carregar mais
              </button>
            )}
          </div>
        )}
      </div>
    </ModernLayout>
  );
};

export default SamlAdminPage;
