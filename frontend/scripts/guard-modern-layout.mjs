import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');

const checks = [
  {
    file: 'src/App.tsx',
    mustNotInclude: [
      "import Layout from './components/Layout'",
      '<Layout />',
    ],
    mustInclude: ['<Outlet />'],
    hint: 'App.tsx deve usar Outlet/ModernLayout e nunca o Layout legado.',
  },
  {
    file: 'src/components/ModernLayout.tsx',
    mustNotInclude: [
      'from-gray-900',
      'via-gray-800',
      'bg-etus-green',
      'GLPI ETUS',
    ],
    mustInclude: ['bg-slate-50', 'bg-white/90'],
    hint: 'ModernLayout.tsx deve seguir o tema moderno (slate/indigo) sem classes legadas.',
  },
  {
    file: 'src/pages/MetricsPage.tsx',
    mustNotInclude: ['from-gray-900', 'bg-gray-800/50', 'sidebarCollapsed'],
    mustInclude: ['<ModernLayout', 'Métricas e Relatórios'],
    hint: 'MetricsPage.tsx deve usar ModernLayout e não layout manual legado.',
  },
];

const errors = [];

for (const check of checks) {
  const content = read(check.file);

  for (const forbidden of check.mustNotInclude) {
    if (content.includes(forbidden)) {
      errors.push(`${check.file}: encontrado trecho proibido -> ${forbidden}`);
    }
  }

  for (const required of check.mustInclude) {
    if (!content.includes(required)) {
      errors.push(`${check.file}: trecho obrigatório ausente -> ${required}`);
    }
  }
}

if (errors.length > 0) {
  console.error('\n[guard:modern-layout] Regressão detectada:');
  for (const err of errors) console.error(`- ${err}`);
  console.error('\nAjuste os arquivos para o padrão ModernLayout antes de build/deploy.');
  process.exit(1);
}

console.log('[guard:modern-layout] OK');
