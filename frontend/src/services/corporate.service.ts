import { api } from './api';

export interface CorporateFilters {
  months: 3 | 6 | 12;
  comparePrevious: boolean;
}

interface ComparisonMetric {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
}

export interface FinanceOverview {
  totalAssetValue: number;
  assignedAssetValue: number;
  inStockAssetValue: number;
  openTickets: number;
  assignments: {
    active: number;
    returned: number;
  };
  byType: Array<{
    type: string;
    count: number;
    totalValue: number;
  }>;
  purchasesByMonth: Array<{
    month: string;
    total: number;
  }>;
  periodMonths: number;
  comparison: {
    purchases: ComparisonMetric;
  } | null;
}

export interface HrOverview {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  activeAssignments: number;
  newHiresLast30Days: number;
  byTeam: Array<{
    team: string;
    count: number;
  }>;
  byRole: Array<{
    roleTitle: string;
    count: number;
  }>;
  employeesWithAssets: number;
  hiresByMonth: Array<{
    month: string;
    total: number;
  }>;
  periodMonths: number;
  comparison: {
    hires: ComparisonMetric;
  } | null;
}

export interface ProcurementOverview {
  pendingOperationalTickets: number;
  activeAssignments: number;
  overdueReturns: number;
  warrantyExpiring45Days: number;
  replacementDemandByType: Array<{
    type: string;
    count: number;
  }>;
  retiredOrLostCount: number;
  openTicketsByMonth: Array<{
    month: string;
    total: number;
  }>;
  periodMonths: number;
  comparison: {
    pendingTickets: ComparisonMetric;
  } | null;
}

export const corporateService = {
  async getFinanceOverview(filters: CorporateFilters): Promise<FinanceOverview> {
    const response = await api.get<FinanceOverview>('/finance/overview', { params: filters });
    return response.data;
  },

  async getHrOverview(filters: CorporateFilters): Promise<HrOverview> {
    const response = await api.get<HrOverview>('/hr/overview', { params: filters });
    return response.data;
  },

  async getProcurementOverview(filters: CorporateFilters): Promise<ProcurementOverview> {
    const response = await api.get<ProcurementOverview>('/procurement/overview', { params: filters });
    return response.data;
  },
};
