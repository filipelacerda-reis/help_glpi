/**
 * Tipos TypeScript para métricas enterprise no frontend
 */

export interface MetricsFilters {
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  teamId?: string;
  technicianId?: string;
  categoryId?: string;
  tags?: string[];
  priority?: string;
  status?: string | string[];
  slaStatus?: string;
  businessHours?: boolean;
  comparePreviousPeriod?: boolean;
}

export interface MetricsResponse {
  overview: {
    createdCount: number;
    resolvedCount: number;
    backlogCount: number;
    mtta: number | null;
    mttr: number | null;
    slaCompliancePercent: number;
    reopenRatePercent: number;
    fcrPercent: number;
    worklogByCategory: Array<{
      categoryName: string;
      totalMinutes: number;
    }>;
    trendCreatedVsResolved: Array<{
      date: string;
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
    sloStatus: 'MET' | 'NOT_MET'; // Status se a meta de SLO foi atingida
    byPriority: Array<{
      priority: string;
      compliancePercent: number;
      total: number;
      outOfSla: number;
    }>;
    byTeam: Array<{
      teamId: string;
      teamName: string;
      compliancePercent: number;
      total: number;
      outOfSla: number;
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

export interface ReportPreset {
  id: string;
  userId: string;
  name: string;
  description?: string;
  filters: MetricsFilters;
  createdAt: string;
  updatedAt: string;
}
