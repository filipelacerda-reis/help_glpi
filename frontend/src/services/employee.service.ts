import { api } from './api';

export interface Employee {
  id: string;
  name: string;
  cpf: string;
  roleTitle: string;
  teamId?: string | null;
  hireDate?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  activeAssignmentsCount?: number;
  team?: {
    id: string;
    name: string;
  } | null;
}

export interface EmployeeAssetAssignment {
  id: string;
  assignedAt: string;
  expectedReturnAt?: string | null;
  returnedAt?: string | null;
  deliveryCondition: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED';
  returnCondition?: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | null;
  deliveryTermNumber?: string | null;
  notes?: string | null;
  equipment: {
    id: string;
    invoiceNumber: string;
    purchaseDate: string;
    equipmentType: string;
    assetTag: string;
    value: number | string;
    serialNumber?: string | null;
    brand?: string | null;
    model?: string | null;
    status: string;
    condition: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED';
    warrantyEndDate?: string | null;
  };
}

export interface EmployeeDetails extends Employee {
  assignments: EmployeeAssetAssignment[];
}

export type EmployeeEquipmentsFilter = 'ACTIVE' | 'RETURNED' | 'ALL';
export type EmployeeEquipmentsSortBy = 'ASSIGNED_AT' | 'RETURNED_AT' | 'ASSET_TAG' | 'EQUIPMENT_TYPE';
export type EmployeeEquipmentsSortDir = 'asc' | 'desc';

export interface CreateEmployeeDto {
  name: string;
  cpf: string;
  roleTitle: string;
  teamId?: string | null;
  hireDate?: string | null;
  active?: boolean;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

export const employeeService = {
  async getAll(filters?: { teamId?: string; active?: boolean; query?: string }) {
    const response = await api.get<Employee[]>('/employees', { params: filters });
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<EmployeeDetails>(`/employees/${id}`);
    return response.data;
  },

  async create(data: CreateEmployeeDto) {
    const response = await api.post<Employee>('/employees', data);
    return response.data;
  },

  async update(id: string, data: UpdateEmployeeDto) {
    const response = await api.patch<Employee>(`/employees/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    await api.delete(`/employees/${id}`);
  },

  async downloadEquipmentsPdf(
    id: string,
    params?: {
      filter?: EmployeeEquipmentsFilter;
      sortBy?: EmployeeEquipmentsSortBy;
      sortDir?: EmployeeEquipmentsSortDir;
      query?: string;
    }
  ) {
    const response = await api.get(`/employees/${id}/equipments.pdf`, {
      params,
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};
