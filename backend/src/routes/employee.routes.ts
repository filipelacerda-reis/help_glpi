import { Router } from 'express';
import { employeeController } from '../controllers/employee.controller';
import { authenticate, requireAbac, requireAnyPermission, requireModuleAccess, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../domains/iam/services/authorization.service';
import { canAccessEmployeeByHierarchy } from '../shared/auth/abacPolicies';

const router = Router();

router.get(
  '/',
  authenticate,
  requireModuleAccess('EMPLOYEES'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_READ),
  employeeController.getAll
);
router.get(
  '/:id',
  authenticate,
  requireModuleAccess('EMPLOYEES'),
  requireAnyPermission([PERMISSIONS.HR_EMPLOYEE_READ, PERMISSIONS.MANAGER_TEAM_READ]),
  requireAbac(canAccessEmployeeByHierarchy, 'Sem acesso a este colaborador'),
  employeeController.getById
);
router.get(
  '/:id/equipments.pdf',
  authenticate,
  requireModuleAccess('EMPLOYEES'),
  requireAnyPermission([PERMISSIONS.HR_EMPLOYEE_READ, PERMISSIONS.MANAGER_TEAM_READ]),
  requireAbac(canAccessEmployeeByHierarchy, 'Sem acesso a este colaborador'),
  employeeController.downloadEquipmentsPdf
);
router.post(
  '/',
  authenticate,
  requireModuleAccess('EMPLOYEES'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_WRITE),
  employeeController.create
);
router.patch(
  '/:id',
  authenticate,
  requireModuleAccess('EMPLOYEES'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_WRITE),
  employeeController.update
);
router.delete(
  '/:id',
  authenticate,
  requireModuleAccess('EMPLOYEES'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_WRITE),
  employeeController.delete
);

export { router as employeeRoutes };
