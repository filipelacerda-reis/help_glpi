import { api } from './api';

export type EquipmentType =
  | 'NOTEBOOK'
  | 'DESKTOP'
  | 'MONITOR'
  | 'KEYBOARD'
  | 'MOUSE'
  | 'HEADSET'
  | 'HUB_USB'
  | 'DOCK'
  | 'PHONE'
  | 'TABLET'
  | 'CHARGER'
  | 'OTHER';

export type EquipmentStatus =
  | 'IN_STOCK'
  | 'ASSIGNED'
  | 'MAINTENANCE'
  | 'RETIRED'
  | 'LOST';

export type EquipmentCondition = 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED';

export interface EquipmentAssignment {
  id: string;
  equipmentId: string;
  employeeId: string;
  assignedAt: string;
  expectedReturnAt?: string | null;
  returnedAt?: string | null;
  deliveryCondition: EquipmentCondition;
  returnCondition?: EquipmentCondition | null;
  deliveryTermNumber?: string | null;
  notes?: string | null;
  equipment?: Equipment;
  employee?: {
    id: string;
    name: string;
    cpf: string;
    roleTitle: string;
    team?: {
      id: string;
      name: string;
    } | null;
  };
}

export interface Equipment {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  equipmentType: EquipmentType;
  assetTag: string;
  value: number | string;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  warrantyEndDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  assignments?: EquipmentAssignment[];
}

export interface CreateEquipmentDto {
  invoiceNumber: string;
  purchaseDate: string;
  equipmentType: EquipmentType;
  assetTag: string;
  value: number;
  serialNumber?: string;
  brand?: string;
  model?: string;
  status?: EquipmentStatus;
  condition?: EquipmentCondition;
  warrantyEndDate?: string | null;
  notes?: string;
}

export interface UpdateEquipmentDto extends Partial<CreateEquipmentDto> {}

export interface AssignEquipmentDto {
  employeeId: string;
  assignedAt?: string;
  expectedReturnAt?: string | null;
  deliveryCondition?: EquipmentCondition;
  deliveryTermNumber?: string;
  notes?: string;
}

export interface ReturnAssignmentDto {
  returnedAt?: string;
  returnCondition?: EquipmentCondition;
  finalStatus?: EquipmentStatus;
  notes?: string;
}

export interface EquipmentDashboardData {
  totalEquipments: number;
  totalValue: number;
  assignedCount: number;
  inStockCount: number;
  maintenanceCount: number;
  retiredOrLostCount: number;
  expiringWarrantyCount: number;
  overdueReturnCount: number;
  byType: Array<{
    equipmentType: EquipmentType;
    count: number;
    totalValue: number;
  }>;
}

export interface EquipmentAlertsData {
  generatedAt: string;
  warrantyExpiring: Array<{
    id: string;
    assetTag: string;
    equipmentType: EquipmentType;
    warrantyEndDate: string;
    daysToExpire: number;
    assignedTo?: string;
  }>;
  overdueReturns: Array<{
    assignmentId: string;
    assetTag: string;
    equipmentType: EquipmentType;
    employeeName: string;
    expectedReturnAt: string;
    daysOverdue: number;
  }>;
}

export const equipmentService = {
  async getAll(filters?: {
    status?: EquipmentStatus;
    equipmentType?: EquipmentType;
    query?: string;
  }) {
    const response = await api.get<Equipment[]>('/equipments', { params: filters });
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<Equipment>(`/equipments/${id}`);
    return response.data;
  },

  async create(data: CreateEquipmentDto) {
    const response = await api.post<Equipment>('/equipments', data);
    return response.data;
  },

  async update(id: string, data: UpdateEquipmentDto) {
    const response = await api.patch<Equipment>(`/equipments/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    await api.delete(`/equipments/${id}`);
  },

  async assign(equipmentId: string, data: AssignEquipmentDto) {
    const response = await api.post<EquipmentAssignment>(
      `/equipments/${equipmentId}/assignments`,
      data
    );
    return response.data;
  },

  async returnAssignment(assignmentId: string, data: ReturnAssignmentDto) {
    const response = await api.post<EquipmentAssignment>(
      `/equipments/assignments/${assignmentId}/return`,
      data
    );
    return response.data;
  },

  async getAssignments(filters?: {
    employeeId?: string;
    equipmentId?: string;
    activeOnly?: boolean;
  }) {
    const response = await api.get<EquipmentAssignment[]>('/equipments/assignments', {
      params: filters,
    });
    return response.data;
  },

  async getDashboard(days?: number) {
    const response = await api.get<EquipmentDashboardData>('/equipments/dashboard', {
      params: days ? { days } : undefined,
    });
    return response.data;
  },

  async getAlerts(days?: number) {
    const response = await api.get<EquipmentAlertsData>('/equipments/alerts', {
      params: days ? { days } : undefined,
    });
    return response.data;
  },

  async downloadAssignmentTermPdf(assignmentId: string) {
    const response = await api.get(`/equipments/assignments/${assignmentId}/term.pdf`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};
