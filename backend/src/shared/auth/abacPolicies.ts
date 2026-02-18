import { Request } from 'express';
import prisma from '../../lib/prisma';
import { PERMISSIONS } from '../../domains/iam/services/authorization.service';

export const canAccessEmployeeByHierarchy = async (req: Request): Promise<boolean> => {
  const permissions = req.userPermissions || [];
  if (permissions.includes(PERMISSIONS.HR_EMPLOYEE_READ)) return true;

  const canReadTeam = permissions.includes(PERMISSIONS.MANAGER_TEAM_READ);
  const managerEmployeeId = req.userAttributes?.employeeId;
  const targetEmployeeId = req.params.id;

  if (!canReadTeam || !managerEmployeeId || !targetEmployeeId) {
    return false;
  }

  const target = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: { managerId: true },
  });

  return Boolean(target && target.managerId === managerEmployeeId);
};
