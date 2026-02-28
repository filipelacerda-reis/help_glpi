import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, MessageSquare } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModernLayout from '../components/ModernLayout';
import { adminSettingsService } from '../services/adminSettings.service';

const IntegrationsAdminPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    enabled: false,
    botToken: '',
    signingSecret: '',
  });

  const webhookUrl = useMemo(() => {
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}/api/webhooks/slack/interactions`;
  }, []);

  useEffect(() => {
    const loadSlackSettings = async () => {
      try {
        const data = await adminSettingsService.getSlackSettings();
        setForm({
          enabled: Boolean(data.enabled),
          botToken: data.botToken || '',
          signingSecret: data.signingSecret || '',
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar configurações de integração');
      } finally {
        setLoading(false);
      }
    };

    loadSlackSettings();
  }, []);

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Não foi possível copiar a URL');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminSettingsService.updateSlackSettings({
        enabled: form.enabled,
        botToken: form.botToken === '***' ? undefined : form.botToken || undefined,
        signingSecret:
          form.signingSecret === '***' ? undefined : form.signingSecret || undefined,
      });
      setSuccess('Configurações do Slack salvas com sucesso');
      const refreshed = await adminSettingsService.getSlackSettings();
      setForm({
        enabled: Boolean(refreshed.enabled),
        botToken: refreshed.botToken || '',
        signingSecret: refreshed.signingSecret || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar configurações do Slack');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModernLayout
      title="Integrações"
      subtitle="Conecte seu Help Desk a ferramentas externas"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => navigate('/admin/sso')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              location.pathname.startsWith('/admin')
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'
            }`}
          >
            Administração
          </button>
          <button
            type="button"
            onClick={() => navigate('/integrations')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              location.pathname.startsWith('/integrations')
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'
            }`}
          >
            Integrações
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {success}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Integração Slack
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Receba chamados enviados a partir de um modal no Slack.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                form.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
              aria-pressed={form.enabled}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  form.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Carregando configurações...
            </p>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Ativar Integração Slack
                </span>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {form.enabled
                    ? 'Integração ativa: novos envios no modal gerarão tickets.'
                    : 'Integração desativada: webhooks recebidos serão ignorados.'}
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Slack Bot Token
                </span>
                <input
                  type="password"
                  value={form.botToken}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, botToken: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="xoxb-..."
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Slack Signing Secret
                </span>
                <input
                  type="password"
                  value={form.signingSecret}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, signingSecret: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="********"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Webhook URL
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700/30"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </label>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-all shadow-sm hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModernLayout>
  );
};

export default IntegrationsAdminPage;
