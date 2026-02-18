import { Router } from 'express';
import { authenticate, requireModuleAccess, requirePermission } from '../middleware/auth';
import { corporateModulesController } from '../controllers/corporateModules.controller';
import { PERMISSIONS } from '../domains/iam/services/authorization.service';
import { financeOperationsController } from '../domains/finance/controllers/financeOperations.controller';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requireModuleAccess('FINANCE'),
  requirePermission(PERMISSIONS.FINANCE_READ),
  corporateModulesController.getFinanceOverview
);

router.get(
  '/asset-ledgers',
  authenticate,
  requireModuleAccess('FINANCE'),
  requirePermission(PERMISSIONS.FINANCE_READ),
  financeOperationsController.listAssetLedgers
);
router.post(
  '/asset-ledgers',
  authenticate,
  requireModuleAccess('FINANCE'),
  requirePermission(PERMISSIONS.FINANCE_WRITE),
  financeOperationsController.createAssetLedger
);
router.post(
  '/asset-movements',
  authenticate,
  requireModuleAccess('FINANCE'),
  requirePermission(PERMISSIONS.FINANCE_WRITE),
  financeOperationsController.registerAssetMovement
);
router.get(
  '/depreciation-report',
  authenticate,
  requireModuleAccess('FINANCE'),
  requirePermission(PERMISSIONS.FINANCE_READ),
  financeOperationsController.depreciationReport
);

export { router as financeRoutes };
