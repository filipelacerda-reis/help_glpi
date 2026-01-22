/**
 * Tipos TypeScript para a API de métricas avançadas
 */

export interface MetricsFilters {
  startDate?: string; // ISO string (inclusive)
  endDate?: string; // ISO string (exclusive ou inclusive)
  teamId?: string;
  technicianId?: string; // id do usuário responsável
  categoryId?: string;
  tags?: string[]; // array de tag names ou IDs
  priority?: string; // P1, P2, P3, etc. ou LOW, MEDIUM, HIGH, CRITICAL
  status?: string | string[]; // open, in_progress, pending, closed, etc.
  slaStatus?: string; // IN, OUT, NONE
  businessHours?: boolean; // true|false
  comparePreviousPeriod?: boolean; // true|false
}

export interface MetricsResponse {
  overview: {
    createdCount: number;
    resolvedCount: number;
    backlogCount: number;
    mtta: number | null; // minutos/hora úteis
    mttr: number | null;
    slaCompliancePercent: number; // 0–100
    reopenRatePercent: number;
    trendCreatedVsResolved: Array<{
      date: string; // yyyy-mm-dd
      created: number;
      resolved: number;
    }>;
    priorityDistribution: Array<{
      priority: string;
      count: number;
    }>;
    ticketsByRequesterTeam: Array<{
      teamId: string;
      teamName: string;
      count: number;
    }>;
  };

  byTeam: {
    items: Array<{
      teamId: string;
      teamName: string;
      created: number;
      resolved: number;
      backlog: number;
      mtta: number | null;
      mttr: number | null;
      slaCompliancePercent: number;
      reopenRatePercent: number;
    }>;
  };

  byTechnician: {
    items: Array<{
      technicianId: string;
      technicianName: string;
      teamId: string | null;
      teamName: string | null;
      assigned: number;
      resolved: number;
      backlog: number;
      mtta: number | null;
      mttr: number | null;
      timeInStatus?: {
        inProgress?: number;
        pendingUser?: number;
        pendingThirdParty?: number;
      };
      slaCompliancePercent: number;
      reopenRatePercent: number;
    }>;
  };

  byCategoryAndTag: {
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      count: number;
      mttr: number | null;
      slaCompliancePercent: number;
      reopenRatePercent: number;
    }>;
    byTag: Array<{
      tag: string;
      count: number;
      mttr: number | null;
      slaCompliancePercent: number;
      reopenRatePercent: number;
    }>;
  };

  sla: {
    globalCompliancePercent: number;
    targetCompliance: number; // Meta de SLO em porcentagem
    sloStatus: 'MET' | 'BREACHED'; // Status se a meta de SLO foi atingida
    byPriority: Array<{
      priority: string;
      compliancePercent: number;
      total: number;
      outOfSla: number;
      targetCompliance: number;
      sloStatus: 'MET' | 'BREACHED';
    }>;
    byTeam: Array<{
      teamId: string;
      teamName: string;
      compliancePercent: number;
      total: number;
      outOfSla: number;
      targetCompliance: number;
      sloStatus: 'MET' | 'BREACHED';
    }>;
    violationBuckets: Array<{
      bucket: 'UP_TO_1H' | 'BETWEEN_1H_4H' | 'MORE_THAN_4H';
      count: number;
    }>;
  };

  backlog: {
    totalOpen: number;
    avgAgeMinutes: number | null;
    ageBuckets: Array<{
      bucket: '0_8H' | '8H_24H' | '1_3D' | '3_7D' | 'GT_7D';
      count: number;
    }>;
    byTeam: Array<{
      teamId: string;
      teamName: string;
      count: number;
      avgAgeMinutes: number | null;
    }>;
    oldestTickets: Array<{
      ticketId: string;
      title: string;
      createdAt: string;
      ageMinutes: number;
      teamId: string | null;
      teamName: string | null;
      priority: string | null;
    }>;
  };

  // Opcional: comparação com período anterior
  comparison?: {
    overview: {
      createdCount: number;
      resolvedCount: number;
      mtta: number | null;
      mttr: number | null;
      slaCompliancePercent: number;
    };
  };
}

