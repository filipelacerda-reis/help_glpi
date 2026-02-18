import { Router } from 'express';
import { authenticate, requireModuleAccess, requirePermission } from '../middleware/auth';
import { corporateModulesController } from '../controllers/corporateModules.controller';
import { PERMISSIONS } from '../domains/iam/services/authorization.service';
import { hrOperationsController } from '../domains/hr/controllers/hrOperations.controller';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_READ),
  corporateModulesController.getHrOverview
);

router.get(
  '/cases',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_READ),
  hrOperationsController.listCases
);
router.get(
  '/cases/:caseType/:caseId',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_READ),
  hrOperationsController.getCaseDetails
);
router.post(
  '/onboarding-cases',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_WRITE),
  hrOperationsController.createOnboardingCase
);
router.post(
  '/offboarding-cases',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_WRITE),
  hrOperationsController.createOffboardingCase
);
router.patch(
  '/tasks/:taskId',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_WRITE),
  hrOperationsController.updateTask
);
router.get(
  '/policies',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_READ),
  hrOperationsController.listPolicies
);
router.post(
  '/policies',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_WRITE),
  hrOperationsController.createPolicy
);
router.post(
  '/policies/:policyId/acknowledge',
  authenticate,
  requireModuleAccess('HR'),
  requirePermission(PERMISSIONS.HR_EMPLOYEE_READ),
  hrOperationsController.acknowledgePolicy
);

export { router as hrRoutes };
