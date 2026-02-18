import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Limpa todas as tabelas do banco de dados de teste
 * IMPORTANTE: Usar apenas em ambiente de teste!
 */
export async function resetDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetDatabase só pode ser usado em ambiente de teste!');
  }

  // Evita depender de delegates do Prisma Client gerado no momento do teste.
  // TRUNCATE CASCADE limpa tudo de forma consistente e rápida.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ticket_attachments",
      "ticket_comments",
      "ticket_tags",
      "ticket_observers",
      "ticket_relations",
      "ticket_status_history",
      "tickets",
      "notifications",
      "technician_journal_entries",
      "ticket_kb_articles",
      "kb_article_usage",
      "kb_articles",
      "kb_categories",
      "user_teams",
      "report_presets",
      "chat_messages",
      "chat_sessions",
      "ticket_sla_stats",
      "ticket_sla_instances",
      "asset_movements",
      "asset_ledgers",
      "stock_movements",
      "delivery_items",
      "deliveries",
      "stock_locations",
      "approvals",
      "invoices",
      "purchase_orders",
      "purchase_request_items",
      "purchase_requests",
      "vendors",
      "cost_centers",
      "equipment_assignments",
      "equipments",
      "case_tasks",
      "onboarding_cases",
      "offboarding_cases",
      "policy_acknowledgements",
      "policies",
      "employees",
      "user_attributes",
      "user_roles",
      "role_permissions",
      "roles",
      "permissions",
      "auth_provider_configs",
      "audit_events",
      "platform_audit_logs",
      "platform_settings",
      "teams",
      "tags",
      "categories",
      "users",
      "sla_policies",
      "automation_rules",
      "business_calendar_exceptions",
      "business_calendars"
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Fecha a conexão do Prisma
 */
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}
