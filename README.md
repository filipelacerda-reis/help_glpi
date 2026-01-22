# GLPI ETUS - Sistema de Gestão de Tickets

Sistema completo de gestão de tickets estilo GLPI, desenvolvido para uso interno da empresa Etus. Permite criação, triagem, atribuição e acompanhamento de tickets com suporte a times, categorias dinâmicas, upload de imagens, sistema de notificações, processamento assíncrono com filas (BullMQ), SLA, automações, base de conhecimento, diário do técnico, assistente virtual de primeiro atendimento e **deflexão de tickets com IA (RAG)**.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [Instalação e Configuração](#instalação-e-configuração)
  - [Desenvolvimento Local](#desenvolvimento-local)
  - [Produção (VM)](#produção-vm)
- [Deploy em Produção](#deploy-em-produção)
- [Configuração de Ambiente](#configuração-de-ambiente)
- [Uso do Sistema](#uso-do-sistema)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)

## 🎯 Visão Geral

O GLPI ETUS é uma aplicação full-stack que permite:

- **Criação de Tickets**: Usuários podem criar tickets com descrição formatada, imagens, categoria e prioridade
- **Triagem Automática**: Tickets são vinculados a times durante a criação
- **Gestão de Times**: Administradores podem criar times e gerenciar membros
- **Atribuição de Tickets**: Líderes de time e triagistas podem atribuir tickets a técnicos
- **Sistema de Notificações**: Notificações em tempo real para comentários, mudanças de status, atribuições e mudanças de time
- **Upload de Arquivos**: Suporte a upload de imagens em tickets e comentários
- **Dashboard de Métricas**: Administradores podem visualizar métricas enterprise completas
- **Assistente Virtual**: Chat-bot de primeiro atendimento com integração OpenAI/Gemini
- **Diário do Técnico**: Sistema de registro de atividades e métricas pessoais para técnicos
- **Deflexão de Tickets com IA (RAG)**: Sugestões automáticas de soluções usando Google Gemini baseadas na Base de Conhecimento

## 🛠 Tecnologias Utilizadas

### Backend

- **Node.js** (v20+): Runtime JavaScript
- **TypeScript**: Linguagem de programação
- **Express.js**: Framework web
- **Prisma ORM**: ORM para PostgreSQL
- **PostgreSQL**: Banco de dados relacional
- **JWT**: Autenticação e autorização
- **bcryptjs**: Hash de senhas
- **Zod**: Validação de schemas
- **Multer**: Upload de arquivos
- **dotenv**: Gerenciamento de variáveis de ambiente
- **BullMQ**: Sistema de filas assíncronas baseado em Redis
- **ioredis**: Cliente Redis para filas e cache
- **Socket.io**: Comunicação em tempo real (WebSocket) para notificações
- **Helmet**: Segurança HTTP (headers de proteção)
- **express-rate-limit**: Rate limiting de requisições
- **Winston**: Sistema de logging estruturado
- **OpenAI SDK**: Integração com ChatGPT (gpt-4o-mini)
- **Google Generative AI**: Integração com Gemini (gemini-2.5-flash) como fallback

### Frontend

- **React** (v18+): Biblioteca JavaScript para interfaces
- **TypeScript**: Linguagem de programação
- **Vite**: Build tool e dev server
- **React Router**: Roteamento
- **TailwindCSS**: Framework CSS utilitário
- **Axios**: Cliente HTTP
- **Socket.io Client**: Comunicação em tempo real (WebSocket) para notificações
- **Recharts**: Gráficos e visualizações
- **React Quill**: Editor de texto rico
- **DOMPurify**: Sanitização de HTML para segurança
- **Marked**: Parser de Markdown
- **Lucide React**: Ícones

### Infraestrutura

- **Docker**: Containerização
- **Docker Compose**: Orquestração de containers
- **PostgreSQL 15**: Banco de dados relacional
- **Redis 7**: Cache e sistema de filas (BullMQ)
- **Nginx**: Reverse proxy (produção)
- **Cloudflare Tunnel**: Acesso público seguro (produção)

## 🏗 Arquitetura do Sistema

```
┌─────────────────┐
│   Frontend      │
│   (React/Vite)  │
│   Port: 5173    │
└────────┬────────┘
         │ HTTP/REST
         │ WebSocket (Socket.io)
         │
┌────────▼────────┐
│    Backend      │
│  (Express/TS)   │
│   Port: 8080    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────────┐
│PostgreSQL│ │  Redis   │
│Port:5432 │ │Port:6379 │
└─────────┘ └───────────┘
         │
    ┌────┴────┐
    │ Workers │
    │(BullMQ) │
    └─────────┘
         │
    ┌────┴────┐
    │  LLMs   │
    │OpenAI/  │
    │ Gemini  │
    └─────────┘
```

### Fluxo de Autenticação

1. Usuário faz login no frontend
2. Frontend envia credenciais para `/api/auth/login`
3. Backend valida credenciais e retorna JWT token + refresh token
4. Frontend armazena tokens e inclui JWT em requisições subsequentes
5. Backend valida token em cada requisição protegida
6. Quando o token expira, frontend pode usar refresh token para obter novo token

### Sistema de Comunicação em Tempo Real (Socket.io)

O sistema utiliza **Socket.io** para comunicação bidirecional em tempo real entre frontend e backend:

- **Notificações Instantâneas**: Notificações são enviadas via WebSocket quando eventos ocorrem (comentários, mudanças de status, atribuições)
- **Sem Polling**: Elimina a necessidade de polling HTTP, reduzindo carga no servidor
- **Conexão Persistente**: Conexão WebSocket mantida durante toda a sessão do usuário
- **Autenticação**: Socket.io valida tokens JWT na conexão para garantir segurança
- **Reconexão Automática**: Cliente reconecta automaticamente em caso de perda de conexão

**Eventos Suportados:**
- `new_notification`: Nova notificação criada para o usuário
- Outros eventos podem ser adicionados conforme necessário

**Benefícios:**
- ✅ Atualizações instantâneas sem delay
- ✅ Redução de carga no servidor (sem polling constante)
- ✅ Melhor experiência do usuário
- ✅ Escalável e eficiente

### Sistema de Filas Assíncronas (BullMQ)

O sistema utiliza **BullMQ** com **Redis** para processamento assíncrono de tarefas pesadas:

- **Fila de Email**: Processa envio de notificações e emails (preparado para integração com serviços de email)
- **Fila de SLA**: Processa cálculos e atualizações de SLA em background
- **Fila de Automações**: Processa regras de automação de forma assíncrona

**Benefícios:**
- ✅ Resposta HTTP imediata (não espera processamento pesado)
- ✅ Processamento paralelo de múltiplos jobs
- ✅ Retry automático em caso de falha
- ✅ Workers podem rodar em processos/máquinas separadas
- ✅ Escalabilidade horizontal

**Workers:**
- Workers podem ser iniciados separadamente: `npm run workers` ou `npm run workers:dev`
- Em produção, workers podem rodar em processos separados para melhor performance

### Sistema de Permissões e Perfis de Usuário

O sistema possui 4 perfis de usuário com diferentes níveis de acesso:

#### REQUESTER (Solicitante)
**Pode:**
- ✅ Criar tickets com descrição formatada (Rich Text), imagens e anexos
- ✅ Visualizar seus próprios tickets
- ✅ Adicionar comentários públicos em seus tickets
- ✅ Adicionar imagens em tickets e comentários
- ✅ Avaliar satisfação (CSAT) em tickets fechados
- ✅ Visualizar notificações relacionadas aos seus tickets
- ✅ Visualizar base de conhecimento
- ✅ Usar assistente virtual de primeiro atendimento

**Não pode:**
- ❌ Ver tickets de outros usuários (exceto se for observador)
- ❌ Atribuir técnicos ou mudar status/prioridade/time
- ❌ Adicionar comentários internos
- ❌ Gerenciar usuários, times, categorias, SLA ou automações
- ❌ Acessar métricas e relatórios

#### TECHNICIAN (Técnico)
**Pode (tudo que REQUESTER pode, mais):**
- ✅ Visualizar tickets atribuídos a ele
- ✅ Visualizar tickets do seu time (mesmo não atribuídos)
- ✅ Assumir tickets não atribuídos do seu time
- ✅ Atualizar status de tickets atribuídos a ele
- ✅ Adicionar comentários (públicos e internos) em tickets do time
- ✅ Adicionar worklogs (registro de tempo trabalhado)
- ✅ Adicionar/remover tags em tickets do time
- ✅ Adicionar observadores em tickets do time
- ✅ Mover tickets entre times (se membro de múltiplos times)
- ✅ Visualizar histórico completo e relacionamentos de tickets
- ✅ Vincular artigos KB a tickets
- ✅ Acessar diário pessoal de atividades e métricas

**Não pode:**
- ❌ Atribuir tickets a outros técnicos
- ❌ Mudar prioridade de tickets
- ❌ Ver tickets de outros times (exceto se for observador)
- ❌ Gerenciar usuários, times, categorias, SLA ou automações
- ❌ Acessar métricas e relatórios

#### TRIAGER (Triagista)
**Pode (tudo que TECHNICIAN pode, mais):**
- ✅ Ver todos os tickets do sistema
- ✅ Atribuir técnicos a qualquer ticket
- ✅ Mudar prioridade, time e status de qualquer ticket
- ✅ Adicionar comentários em qualquer ticket
- ✅ Adicionar/remover tags e observadores em qualquer ticket
- ✅ Ver métricas básicas de atendimento
- ✅ Gerenciar base de conhecimento (criar/editar artigos e categorias)

**Não pode:**
- ❌ Gerenciar usuários, times ou categorias
- ❌ Acessar métricas enterprise completas
- ❌ Criar/editar automações ou SLA
- ❌ Deletar tickets ou usuários

#### ADMIN (Administrador)
**Pode (tudo que TRIAGER pode, mais):**
- ✅ Acesso total ao sistema
- ✅ Gerenciar usuários (CRUD completo)
- ✅ Gerenciar times (CRUD completo)
- ✅ Gerenciar categorias (CRUD completo)
- ✅ Gerenciar tags (CRUD completo)
- ✅ Acessar todas as métricas e relatórios enterprise
- ✅ Criar/editar/deletar automações
- ✅ Criar/editar/deletar políticas de SLA
- ✅ Criar/editar calendários de negócio
- ✅ Gerenciar base de conhecimento (visualizar, criar, editar, deletar)
- ✅ Criar/editar/deletar presets de relatórios
- ✅ Exportar dados (quando implementado)

## 📁 Estrutura do Projeto

```
GLPI_ETUS/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Schema do banco de dados
│   │   ├── migrations/            # Migrations do Prisma
│   │   └── seed.ts                # Script de seed
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts             # Configuração de variáveis de ambiente
│   │   ├── controllers/           # Controladores HTTP
│   │   ├── services/              # Lógica de negócio
│   │   │   ├── assistant/         # Serviços do assistente virtual
│   │   │   │   ├── chat.service.ts
│   │   │   │   └── llm.service.ts
│   │   │   └── technicianJournal.service.ts
│   │   ├── routes/                # Definição de rotas
│   │   │   └── assistant.routes.ts
│   │   ├── middleware/            # Middlewares (auth, error, logger)
│   │   ├── utils/                 # Utilitários (upload, logger, team)
│   │   ├── lib/
│   │   │   ├── prisma.ts          # Cliente Prisma
│   │   │   ├── openaiClient.ts    # Cliente OpenAI
│   │   │   └── geminiClient.ts    # Cliente Gemini
│   │   ├── workers/               # Workers BullMQ
│   │   └── index.ts               # Entry point
│   ├── uploads/                   # Arquivos enviados
│   │   ├── tickets/               # Anexos de tickets
│   │   └── journal/               # Anexos do diário
│   ├── Dockerfile                  # Dockerfile para produção
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── logo-etus-green.png    # Logo da Etus
│   ├── src/
│   │   ├── components/            # Componentes React
│   │   │   ├── FloatingChatWidget.tsx  # Widget de chat flutuante
│   │   │   ├── SupportAssistant.tsx    # Componente de assistente (legado)
│   │   │   └── metrics/            # Componentes de métricas
│   │   ├── pages/                 # Páginas da aplicação
│   │   │   ├── MyJournalPage.tsx  # Diário do técnico
│   │   │   └── CreateTicketPage.tsx
│   │   ├── contexts/              # Context API (Auth)
│   │   ├── services/              # Serviços de API
│   │   │   └── assistant.service.ts
│   │   ├── types/                 # TypeScript types
│   │   ├── index.css              # Estilos globais
│   │   └── main.tsx               # Entry point
│   ├── Dockerfile                  # Dockerfile para produção
│   └── package.json
├── docker-compose.yml              # Configuração Docker (desenvolvimento)
├── docker-compose.prod.yml         # Configuração Docker (produção)
├── deploy-on-vm.sh                # Script de deploy em produção
├── start.ps1                       # Script de inicialização (Windows)
└── README.md                       # Esta documentação
```

## ✨ Funcionalidades

### Gestão de Tickets

- ✅ Criação de tickets com título, descrição formatada (Rich Text Editor), categoria, prioridade e time
- ✅ **Tipos de tickets**:
  - `INCIDENT`: Incidente (padrão)
  - `SERVICE_REQUEST`: Solicitação de Serviço
  - `PROBLEM`: Problema
  - `CHANGE`: Mudança
  - `TASK`: Tarefa
  - `QUESTION`: Dúvida
- ✅ **Tipos de infraestrutura** (opcional):
  - `LOCAL`: Infraestrutura local
  - `NUVEM`: Infraestrutura em nuvem
  - `HIBRIDA`: Infraestrutura híbrida
  - `ESTACAO_TRABALHO`: Estação de trabalho
  - `REDE_LOCAL`: Rede local
  - `SERVIDOR_FISICO`: Servidor físico
- ✅ **Gestão de Projetos**: 
  - Data de entrega (`dueDate`)
  - Estimativa de tempo (`estimatedMinutes`)
  - Campos personalizados (`customFields` em JSON)
- ✅ Upload de múltiplos arquivos/imagens por ticket e comentário (máx. 5MB cada, até 10 arquivos)
- ✅ Atualização de status, prioridade, técnico atribuído e time
- ✅ **Status disponíveis**: OPEN, IN_PROGRESS, WAITING_REQUESTER, WAITING_THIRD_PARTY, RESOLVED, CLOSED
- ✅ **Prioridades**: LOW, MEDIUM, HIGH, CRITICAL
- ✅ Sistema de comentários (públicos e internos) com formatação rica
- ✅ Upload de imagens em comentários
- ✅ Histórico completo de alterações (Audit Trail) com rastreamento de todos os eventos
- ✅ Relacionamentos entre tickets (duplicata, filho/pai, causado por, bloqueado por)
- ✅ Sistema de observadores (multi-seleção com autocomplete)
- ✅ Worklogs (registro de tempo trabalhado) com descrição e vinculação ao diário do técnico
- ✅ CSAT (Pesquisa de Satisfação do Cliente) com score de 1-5 e comentários opcionais
- ✅ Vinculação de artigos da Base de Conhecimento
- ✅ Sugestões automáticas de artigos KB durante criação
- ✅ Filtros avançados por status, prioridade, time, técnico, categoria, tags, tipo e data
- ✅ Busca e ordenação de tickets
- ✅ Rastreamento de primeira resposta e resolução com métricas de tempo

### Assistente Virtual de Primeiro Atendimento

- ✅ Chat-bot flutuante disponível em todas as páginas
- ✅ Integração com OpenAI (gpt-4o-mini) como principal
- ✅ Fallback automático para Google Gemini (gemini-2.5-flash) em caso de erro/quota
- ✅ Histórico de conversas persistido no banco de dados
- ✅ Geração automática de ticket a partir do chat
- ✅ Pré-preenchimento de título e descrição do ticket com histórico do chat
- ✅ Interface moderna com botão flutuante no canto inferior direito
- ✅ Painel de chat minimizável e expansível
- ✅ Suporte a múltiplas sessões de chat por usuário

### Deflexão de Tickets com IA (RAG)

- ✅ **Geração Automática de Soluções**: Sistema RAG (Retrieval-Augmented Generation) usando Google Gemini
- ✅ **Busca Inteligente**: Busca artigos relevantes na Base de Conhecimento baseado no título e descrição
- ✅ **Respostas Conversacionais**: Soluções geradas em linguagem natural e amigável (não apenas documentação)
- ✅ **Ativação Automática**: Aparece automaticamente durante criação de ticket após 1.5s de inatividade
- ✅ **Interface Intuitiva**: Card visual com solução formatada em Markdown e botões de ação
- ✅ **Ações Rápidas**: Botões "Isso resolveu meu problema!" (navega sem criar ticket) e "Ignorar"
- ✅ **Integração N8N**: Suporte opcional para workflows customizados via webhooks
- ✅ **Tratamento de Erros**: Falhas não bloqueiam a criação do ticket
- ✅ **Otimização**: Debounce inteligente para evitar chamadas excessivas à API

### Diário do Técnico

- ✅ Entradas manuais com título, descrição, tags e anexos
- ✅ Entradas automáticas para:
  - Worklogs registrados
  - Mudanças de status de tickets
  - Comentários em tickets
- ✅ Resumo diário automático de atividades
- ✅ Métricas pessoais:
  - Tickets trabalhados
  - Tempo total trabalhado
  - Tickets resolvidos
  - Tempo médio de resolução
- ✅ Filtros por data, tags e tipo de entrada
- ✅ Timeline visual de atividades
- ✅ Upload de anexos para entradas manuais

### Gestão de Times

- ✅ Criação e edição de times com descrição
- ✅ Adição/remoção de membros
- ✅ Definição de líderes de time (TeamRole: MEMBER, LEAD)
- ✅ Associação de times com categorias específicas
- ✅ Associação de times com tipos de tickets específicos
- ✅ Membros podem assumir tickets não atribuídos do seu time
- ✅ Líderes podem atribuir tickets a membros
- ✅ Membros podem mover tickets entre times (se membro de múltiplos times)
- ✅ Validação: times com tickets não podem ser excluídos

### Sistema de Notificações

- ✅ Notificações para comentários
- ✅ Notificações para mudanças de status
- ✅ Notificações para atribuições
- ✅ Notificações para mudanças de time
- ✅ Contador de notificações não lidas
- ✅ Marcação de notificações como lidas
- ✅ Notificações em tempo real via Socket.io (WebSocket)
- ✅ Atualização instantânea sem necessidade de polling

### Gestão Administrativa

- ✅ CRUD completo de usuários com roles (REQUESTER, TECHNICIAN, TRIAGER, ADMIN)
- ✅ CRUD completo de categorias (com hierarquia pai/filho)
- ✅ CRUD completo de times com gestão de membros e líderes
- ✅ CRUD completo de tags organizadas por grupos (FEATURE, AREA, ENV, PLATFORM, SOURCE, IMPACT, RC, STATUS_REASON, WORK, QUESTION, INFRA)
- ✅ Dashboard de métricas básicas (tickets por status, prioridade, time)
- ✅ Dashboard de métricas enterprise com múltiplas abas:
  - **Visão Geral**: Resumo executivo, tickets por status/prioridade/time
  - **Performance**: Tempo médio de resolução, primeira resposta, SLA compliance
  - **Análise de Backlog**: Tickets em aberto, capacidade, tendências
  - **Análise por Time**: Métricas detalhadas por time
  - **Análise por Técnico**: Performance individual
  - **Análise por Categoria**: Distribuição e tendências
  - **Análise por Tags**: Agrupamento e análise
- ✅ Filtros avançados de relatórios (data, status, prioridade, time, técnico, categoria, tags, tipo)
- ✅ Presets de relatórios (salvar/carregar filtros personalizados)
- ✅ Visualização de estatísticas por time, técnico, categoria e tag
- ✅ Análise de SLA e compliance com métricas de SLO (Service Level Objective)
- ✅ Análise de backlog e capacidade
- ✅ Drill-down: clique em elementos dos gráficos para ver tickets específicos

### Sistema de SLA (Service Level Agreement)

- ✅ Calendários de negócio configuráveis (horários de trabalho por dia da semana, timezone, feriados)
- ✅ Políticas de SLA baseadas em time, categoria, prioridade, tipo de ticket e time solicitante
- ✅ **SLO (Service Level Objective)**: Meta de compliance configurável por política (padrão 98.5%)
- ✅ **Status SLO**: Cálculo automático de `sloStatus` ('MET' | 'BREACHED') comparando compliance atual com target
- ✅ **SLO por política**: Cada política de SLA possui seu próprio `targetCompliance` e cálculo de status
- ✅ **SLO agregado**: Cálculo de SLO global e por time/prioridade nas métricas enterprise
- ✅ Cálculo automático de business time (horas úteis) considerando calendário e feriados
- ✅ Rastreamento de primeira resposta e resolução
- ✅ Pausa/retomada automática de SLA (quando ticket está em espera)
- ✅ Alertas de violação de SLA
- ✅ Interface administrativa para criar, editar, inativar e excluir políticas
- ✅ Validação de segurança: políticas vinculadas a tickets não podem ser excluídas
- ✅ Visualização de status de SLA em tickets (RUNNING, PAUSED, BREACHED, MET, CANCELLED)
- ✅ Página de administração em `/sla` (apenas ADMIN)
- ✅ Histórico completo de instâncias de SLA por ticket

### Motor de Automação

- ✅ Regras configuráveis baseadas em eventos (habilitadas/desabilitadas)
- ✅ **Eventos disponíveis**:
  - `ON_TICKET_CREATED`: Quando um ticket é criado
  - `ON_TICKET_UPDATED`: Quando um ticket é atualizado
  - `ON_STATUS_CHANGED`: Quando o status muda
  - `ON_PRIORITY_CHANGED`: Quando a prioridade muda
  - `ON_TEAM_CHANGED`: Quando o time muda
  - `ON_SLA_BREACH`: Quando o SLA é violado
  - `ON_SLA_MET`: Quando o SLA é cumprido
  - `ON_COMMENT_ADDED`: Quando um comentário é adicionado
- ✅ **Ações disponíveis**:
  - Definir time (`SET_TEAM`)
  - Definir prioridade (`SET_PRIORITY`)
  - Definir status (`SET_STATUS`)
  - Atribuir técnico (`ASSIGN_TECHNICIAN`)
  - Adicionar tag (`ADD_TAG`)
  - Disparar SLA (`TRIGGER_SLA`)
- ✅ Condições personalizáveis em JSON (filtros por campos do ticket)
- ✅ Processamento assíncrono via filas (BullMQ) para melhor performance
- ✅ Interface administrativa para gerenciar regras (`/automations`)
- ✅ Registro de automações executadas no histórico do ticket
- ✅ Documentação completa na Base de Conhecimento

### Base de Conhecimento (KB)

- ✅ Categorias hierárquicas de artigos (estrutura pai/filho)
- ✅ Artigos com status (Rascunho, Publicado, Arquivado)
- ✅ Sistema de tags para organização
- ✅ Conteúdo em Markdown/HTML com renderização rica
- ✅ Sugestões automáticas durante criação de tickets (baseadas em título/descrição)
- ✅ Vinculação de artigos a tickets
- ✅ Rastreamento de uso de artigos (quem usou, quando, em qual ticket)
- ✅ Interface administrativa para criar, editar, visualizar e deletar artigos (ADMIN/TRIAGER)
- ✅ Busca de artigos por título, conteúdo, categoria e tags
- ✅ Visualização pública de artigos publicados
- ✅ **Deflexão de Tickets com IA (RAG)**: Geração automática de soluções usando Google Gemini
  - Busca artigos relevantes na Base de Conhecimento
  - Gera soluções em linguagem natural e conversacional
  - Aparece automaticamente durante criação de ticket (debounce de 1.5s)
  - Botões para marcar como resolvido ou continuar criando o ticket
  - Integração opcional com N8N para workflows customizados

### Componentes de Interface Avançados

- ✅ **Rich Text Editor**: Editor de texto formatado (React Quill) para descrições e comentários
- ✅ **File Upload**: Upload de múltiplos arquivos com preview e validação de tipo/tamanho
- ✅ **User Autocomplete**: Campo de busca inteligente para seleção múltipla de usuários (observadores)
- ✅ **HTML Sanitization**: Sanitização automática de conteúdo HTML (DOMPurify) para segurança (XSS prevention)
- ✅ **Floating Chat Widget**: Widget de chat flutuante com animações e estados (minimizado/expandido)
- ✅ **Markdown Renderer**: Renderização de conteúdo Markdown em artigos KB
- ✅ **Gráficos Interativos**: Visualizações com Recharts e drill-down para análise detalhada
- ✅ **Filtros Dinâmicos**: Sistema de filtros avançados com presets salvos
- ✅ **Timeline Visual**: Visualização cronológica de atividades no diário do técnico

### Segurança e Performance

- ✅ **Rate Limiting**: Limite de 1000 requisições por IP a cada 15 minutos
- ✅ **Helmet**: Headers de segurança HTTP configurados
- ✅ **CORS**: Configuração de Cross-Origin Resource Sharing
- ✅ **Validação de Input**: Validação rigorosa com Zod em todos os endpoints
- ✅ **Request Logging**: Sistema de logging estruturado com Winston e correlation IDs
- ✅ **Error Handling**: Tratamento centralizado de erros com mensagens apropriadas
- ✅ **Observabilidade Avançada**: Categorização de erros (VALIDATION, BUSINESS, AUTH, SYSTEM) para logs inteligentes
  - Erros de validação/negócio: logados como `warn` (esperados)
  - Erros de autenticação/sistema: logados como `error` (requerem atenção)
- ✅ **Processamento Assíncrono**: Tarefas pesadas processadas em background via filas

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 20+ e npm
- Docker e Docker Compose
- Git

### Desenvolvimento Local

#### 1. Clone o repositório

```bash
git clone <repository-url>
cd glpi-etus
```

#### 2. Configure o Backend

```bash
cd backend

# Instale as dependências
npm install

# Copie o arquivo .env.example para .env (se existir)
# Ou crie um arquivo .env com as seguintes variáveis:

# DATABASE_URL=postgresql://glpi_etus:glpi_etus_password@localhost:5432/glpi_etus?schema=public
# JWT_SECRET=seu-secret-key-aqui
# JWT_REFRESH_SECRET=seu-refresh-secret-key-aqui
# OPENAI_API_KEY=sua-chave-openai (opcional, para assistente virtual)
# GEMINI_API_KEY=sua-chave-gemini (opcional, para fallback do assistente)
```

#### 3. Configure o Frontend

```bash
cd ../frontend

# Instale as dependências
npm install
```

#### 4. Inicie o Banco de Dados e Redis

```bash
# Na raiz do projeto
docker-compose up -d postgres redis
```

**Nota:** O Redis é necessário para o sistema de filas (BullMQ). Certifique-se de que ambos os containers estão rodando.

#### 5. Execute as Migrations

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

#### 6. (Opcional) Popule o banco com dados de teste

```bash
npm run db:seed
```

#### 7. Inicie os Servidores

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**Linux/Mac:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Workers (Opcional, mas recomendado)
cd backend
npm run workers:dev
```

**Nota:** Os workers processam tarefas assíncronas (SLA, automações, emails). Em desenvolvimento, você pode habilitar workers automaticamente definindo `ENABLE_WORKERS=true` no `.env` do backend, ou rodá-los em um terminal separado para melhor observabilidade.

#### 8. Acesse a aplicação

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080

**Usuários padrão (após seed):**
- Admin: `admin@example.com` / `admin123`
- Triagista: `triager@example.com` / `triager123`
- Técnico: `technician@example.com` / `technician123`
- Solicitante: `requester@example.com` / `requester123`

### Produção (VM)

Para deploy em produção usando Docker Compose e Cloudflare Tunnels:

1. Prepare a VM (Ubuntu/Debian)
2. Instale Docker e Docker Compose
3. Configure Cloudflare Tunnel (se necessário)
4. Use `docker-compose.prod.yml` para produção
5. Execute o script `deploy-on-vm.sh` para deploy automatizado

## 🚀 Deploy em Produção

### Script de Deploy Automatizado

O projeto inclui um script de deploy automatizado (`deploy-on-vm.sh`) que:

1. **Cria backup** do banco de dados e arquivos
2. **Sincroniza arquivos** via rsync (preservando .env e Cloudflare Tunnel)
3. **Reconstrói imagens Docker** (build automático)
4. **Executa migrations** do Prisma
5. **Verifica serviços** e diretórios

**Uso:**
```bash
chmod +x deploy-on-vm.sh
./deploy-on-vm.sh
```

**Configuração:**
- Código fonte: `/home/filipe_lacerda/glpi_atualizado`
- Diretório de produção: `/opt/glpi-etus`
- Arquivos preservados: `.env`, `cloudflared-config/`, `cloudflared-credentials/`

**Nota:** O script preserva automaticamente arquivos críticos de produção (.env e configurações do Cloudflare Tunnel) e não os sobrescreve durante o deploy.

## ⚙️ Configuração de Ambiente

### Variáveis de Ambiente do Backend

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão do PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | Secret para assinatura de tokens JWT | `seu-secret-forte` |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens | `seu-refresh-secret` |
| `JWT_EXPIRES_IN` | Tempo de expiração do token | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Tempo de expiração do refresh token | `7d` |
| `NODE_ENV` | Ambiente de execução | `development` ou `production` |
| `PORT` | Porta do servidor backend | `8080` |
| `FRONTEND_URL` | URL do frontend (para CORS) | `http://localhost:5173` |
| `REDIS_HOST` | Host do Redis | `localhost` |
| `REDIS_PORT` | Porta do Redis | `6379` |
| `REDIS_PASSWORD` | Senha do Redis (opcional) | (vazio) |
| `REDIS_DB` | Número do banco Redis | `0` |
| `MAX_FILE_SIZE` | Tamanho máximo de arquivo em bytes | `5242880` (5MB) |
| `MAX_FILES` | Número máximo de arquivos por upload | `10` |
| `LOG_LEVEL` | Nível de logging (debug, info, warn, error) | `info` |
| `ENABLE_WORKERS` | Habilitar workers automaticamente | `false` |
| `OPENAI_API_KEY` | Chave da API OpenAI (para assistente virtual) | `sk-...` |
| `GEMINI_API_KEY` | Chave da API Google Gemini (fallback do assistente e RAG) | `AIzaSy...` |
| `N8N_QUERY_WEBHOOK` | Webhook do N8N para consultas de IA (opcional) | `https://...` |
| `N8N_INGEST_WEBHOOK` | Webhook do N8N para ingestão de dados (opcional) | `https://...` |

### Admin Console / SSO (novo)

- Configurações administrativas (incluindo SAML) são persistidas no banco em `platform_settings`.
- Segredos são criptografados com `CONFIG_ENCRYPTION_KEY` (obrigatório em produção).
- Consulte:
  - `docs/admin-console.md`
  - `docs/sso-google-workspace.md`

### Variáveis de Ambiente do Frontend

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `VITE_API_URL` | URL da API backend | `http://localhost:8080` |

## 📖 Uso do Sistema

### Assistente Virtual

1. **Acesse qualquer página** da aplicação (exceto login)
2. **Clique no botão verde** no canto inferior direito
3. **Converse com o assistente** sobre sua dúvida ou problema
4. **Se não resolver**, clique em "Não resolveu? Abrir chamado"
5. **Complete os dados** do ticket que será pré-preenchido com o histórico do chat

### Diário do Técnico

1. **Acesse "Meu Diário"** no menu (apenas técnicos)
2. **Visualize suas atividades** do dia/semana/mês
3. **Crie entradas manuais** clicando em "+ Nova Entrada"
4. **Adicione tags e anexos** às entradas
5. **Visualize métricas pessoais** no topo da página

### Acessar Relatórios e Métricas Enterprise

1. Faça login como **ADMIN**
2. Acesse **Métricas** no menu
3. Use os filtros no topo para personalizar o período e critérios
4. Navegue pelas abas para diferentes visualizações
5. Clique em elementos dos gráficos para fazer drill-down aos tickets
6. Use "Salvar como modelo" para salvar os filtros atuais

### Configurar Automações

1. Acesse **Admin** → **Automações**
2. Clique em **Criar Nova Regra**
3. Configure evento, condições e ações
4. Marque **Habilitado** para ativar
5. Clique em **Salvar**

### Gerenciar Políticas de SLA

1. Acesse **Admin** → **SLA** (apenas ADMIN)
2. Crie calendários de negócio (se necessário)
3. Crie políticas de SLA baseadas em critérios
4. Configure tempos de resolução e primeira resposta
5. Ative/desative políticas conforme necessário

### Gerenciar Base de Conhecimento

1. Acesse **Admin** → **Base de Conhecimento** (ADMIN ou TRIAGER)
2. Crie categorias hierárquicas
3. Crie artigos com conteúdo em Markdown/HTML
4. Publique artigos para aparecerem nas sugestões
5. Vincule artigos a tickets quando relevante

### Usar Deflexão de Tickets com IA (RAG)

1. **Configure a API Key do Gemini** no `.env` do backend:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```

2. **Popule a Base de Conhecimento** com artigos relevantes (opcional, mas recomendado):
   ```bash
   # Executar seed de artigos de teste
   cd backend
   npx tsx prisma/seed-kb-articles.ts
   ```

3. **Ao criar um ticket**:
   - Digite o título (mínimo 5 caracteres) e descrição
   - Aguarde 1.5 segundos após parar de digitar
   - Uma solução gerada pela IA aparecerá automaticamente
   - Se a solução resolver, clique em "Isso resolveu meu problema!"
   - Se não resolver, clique em "Ignorar" e continue criando o ticket

4. **A solução é gerada** usando:
   - Artigos relevantes da Base de Conhecimento
   - Google Gemini (gemini-2.5-flash) para processamento
   - Linguagem natural e conversacional

## 🔌 API Endpoints

### Autenticação

- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Fazer login (retorna access token e refresh token)
- `POST /api/auth/refresh` - Renovar access token usando refresh token

### Tickets

- `GET /api/tickets` - Listar tickets (com filtros)
- `GET /api/tickets/:id` - Obter ticket específico
- `POST /api/tickets` - Criar ticket
- `PATCH /api/tickets/:id` - Atualizar ticket
- `POST /api/tickets/:id/comments` - Adicionar comentário
- `GET /api/tickets/:id/comments` - Listar comentários

### Assistente Virtual

- `POST /api/assistant/session` - Criar ou obter sessão de chat
- `POST /api/assistant/message` - Enviar mensagem ao assistente
- `POST /api/assistant/escalate` - Escalar chat para ticket (deprecated - usar redirecionamento)

### Diário do Técnico

- `GET /api/me/journal` - Listar entradas do diário
- `POST /api/me/journal` - Criar entrada manual
- `GET /api/me/metrics` - Obter métricas pessoais

### Times

- `GET /api/teams` - Listar times
- `GET /api/teams/:id` - Obter time específico
- `POST /api/teams` - Criar time (Admin)
- `PATCH /api/teams/:id` - Atualizar time (Admin)
- `DELETE /api/teams/:id` - Deletar time (Admin)

### Categorias

- `GET /api/categories` - Listar categorias
- `GET /api/categories/:id` - Obter categoria específica
- `POST /api/categories` - Criar categoria (Admin)
- `PATCH /api/categories/:id` - Atualizar categoria (Admin)
- `DELETE /api/categories/:id` - Deletar categoria (Admin)

### Tags

- `GET /api/tags` - Listar tags
- `POST /api/tags` - Criar tag (Admin)
- `PATCH /api/tags/:id` - Atualizar tag (Admin)
- `DELETE /api/tags/:id` - Deletar tag (Admin)

### Notificações

- `GET /api/notifications` - Listar notificações do usuário
- `GET /api/notifications/unread-count` - Contar não lidas
- `PATCH /api/notifications/:id/read` - Marcar como lida
- `PATCH /api/notifications/read-all` - Marcar todas como lidas

### Admin

- `GET /api/admin/metrics` - Obter métricas básicas (Admin)
- `GET /api/admin/metrics/enterprise` - Obter métricas enterprise completas (Admin)
- `GET /api/users` - Listar usuários (Admin)
- `POST /api/users` - Criar usuário (Admin)
- `PATCH /api/users/:id` - Atualizar usuário (Admin)
- `DELETE /api/users/:id` - Deletar usuário (Admin)

### Presets de Relatórios

- `GET /api/report-presets` - Listar presets do usuário atual
- `POST /api/report-presets` - Criar preset
- `PUT /api/report-presets/:id` - Atualizar preset
- `DELETE /api/report-presets/:id` - Deletar preset

### Automações

- `GET /api/automation-rules` - Listar regras de automação
- `GET /api/automation-rules/:id` - Obter regra específica
- `POST /api/automation-rules` - Criar regra (Admin)
- `PUT /api/automation-rules/:id` - Atualizar regra (Admin)
- `DELETE /api/automation-rules/:id` - Deletar regra (Admin)

### Base de Conhecimento

- `GET /api/kb/categories` - Listar categorias
- `POST /api/kb/categories` - Criar categoria (Admin/Triager)
- `GET /api/kb/articles` - Buscar artigos
- `POST /api/kb/articles` - Criar artigo (Admin/Triager)
- `POST /api/kb/suggestions` - Obter sugestões de artigos
- `POST /api/kb/ai-solution` - Gerar solução via IA (RAG) baseada na KB

### SLA

- `GET /api/sla/calendars` - Listar calendários de negócio
- `POST /api/sla/calendars` - Criar calendário (Admin)
- `GET /api/sla/policies` - Listar políticas de SLA
- `POST /api/sla/policies` - Criar política de SLA (Admin)

## 🔧 Troubleshooting

### Backend não inicia

```bash
# Verifique se o banco está rodando
docker-compose ps

# Verifique os logs
cd backend
npm run dev
```

### Erro de conexão com banco

```bash
# Verifique se o DATABASE_URL está correto
# Verifique se o container do banco está rodando
docker-compose ps db

# Verifique os logs do banco
docker-compose logs db
```

### Frontend não conecta ao backend

```bash
# Verifique a variável VITE_API_URL
# Verifique se o backend está rodando na porta correta
# Verifique CORS no backend
```

### Assistente Virtual não responde

```bash
# Verifique se as chaves de API estão configuradas
# Verifique os logs do backend para erros da API
docker-compose logs backend | grep -i "openai\|gemini\|assistant"

# Verifique se as dependências estão instaladas
cd backend
npm list openai @google/generative-ai
```

### Deflexão de Tickets (RAG) não funciona

```bash
# Verifique se GEMINI_API_KEY está configurada
echo $GEMINI_API_KEY

# Verifique logs do backend
docker-compose logs backend | grep -i "gemini\|rag\|ai-solution"

# Verifique se há artigos na Base de Conhecimento
# Acesse a interface web e verifique se há artigos publicados

# Verifique se o modelo está correto (deve ser gemini-2.5-flash)
# Verifique logs: deve aparecer "Chamando Gemini para gerar solução RAG"
```

### Erro de permissão no upload

```bash
# Verifique permissões da pasta uploads
cd backend
chmod -R 755 uploads
```

### Erro de conexão com Redis

```bash
# Verifique se o container Redis está rodando
docker-compose ps redis

# Verifique os logs do Redis
docker-compose logs redis
```

### Workers não processam jobs

```bash
# Verifique se os workers estão rodando
cd backend
npm run workers:dev

# Verifique se o Redis está acessível
docker exec glpi_etus_redis redis-cli ping
```

## 📝 Notas Adicionais

- **Autenticação**: O sistema usa JWT para autenticação. Tokens expiram em 1 hora por padrão, com refresh token válido por 7 dias.
- **Uploads**: Limitados a 5MB por arquivo, máximo 10 arquivos por ticket/comentário. Formatos suportados: JPEG, PNG, GIF, WEBP.
- **Assistente Virtual**: Usa OpenAI (gpt-4o-mini) como principal e Google Gemini (gemini-2.5-flash) como fallback automático.
- **Deflexão de Tickets (RAG)**: Usa Google Gemini (gemini-2.5-flash) para gerar soluções baseadas na Base de Conhecimento. Requer `GEMINI_API_KEY` configurada.
- **Logs**: Sistema de logging estruturado com Winston, correlation IDs e níveis configuráveis (debug, info, warn, error). Categorização automática de erros para logs inteligentes.
- **Socket.io**: Comunicação em tempo real via WebSocket para notificações instantâneas, sem necessidade de polling.
- **Processamento Assíncrono**: Tarefas pesadas (SLA, automações, emails) são processadas em background via filas BullMQ.
- **Timezone**: O sistema usa UTC para armazenamento de datas, com conversão para timezone local no frontend.
- **Business Hours**: Cálculo de SLA considera apenas horas úteis conforme calendários de negócio configurados.
- **Validação**: Todos os endpoints validam entrada com Zod schemas antes de processar.
- **Segurança**: Headers de segurança HTTP (Helmet), rate limiting, sanitização de HTML e validação rigorosa de inputs.

## 📄 Licença

Este projeto é de uso interno da Etus.

## 🚀 Deploy via GitLab

Para instruções detalhadas sobre deploy em produção usando GitLab, consulte o guia completo:

**[📖 DEPLOY_GITLAB.md](./DEPLOY_GITLAB.md)**

O guia inclui:
- Deploy manual via GitLab
- Configuração de CI/CD automatizado
- Setup inicial na VM
- Troubleshooting de deploy
- Rollback e recuperação

## 🤖 Integração com N8N (Opcional)

Para configurar integração com N8N para workflows customizados de IA, consulte:

**[📖 N8N_INTEGRATION.md](./N8N_INTEGRATION.md)**

O guia inclui:
- Configuração de webhooks no N8N
- Integração com modelos de IA (OpenAI, Gemini, etc.)
- Formato de requisições e respostas
- Troubleshooting e monitoramento

## 👥 Suporte

Para suporte, entre em contato com a equipe de desenvolvimento.
