import { Router } from 'express';
import { authenticate, requireModuleAccess, requirePermission } from '../middleware/auth';
import { corporateModulesController } from '../controllers/corporateModules.controller';
import { PERMISSIONS } from '../domains/iam/services/authorization.service';
import { financeOperationsController } from '../domains/finance/controllers/financeOperations.controller';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_READ),
  corporateModulesController.getProcurementOverview
);

router.get(
  '/cost-centers',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_READ),
  financeOperationsController.listCostCenters
);
router.post(
  '/cost-centers',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_WRITE),
  financeOperationsController.createCostCenter
);
router.get(
  '/vendors',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_READ),
  financeOperationsController.listVendors
);
router.post(
  '/vendors',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_WRITE),
  financeOperationsController.createVendor
);
router.post(
  '/purchase-requests',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_WRITE),
  financeOperationsController.createPurchaseRequest
);
router.get(
  '/purchase-requests/:prId',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_READ),
  financeOperationsController.getPurchaseRequest
);
router.post(
  '/purchase-requests/:prId/approve',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  financeOperationsController.decidePrApproval
);
router.post(
  '/purchase-orders',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_WRITE),
  financeOperationsController.createPurchaseOrder
);
router.post(
  '/purchase-orders/:poId/approve',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  financeOperationsController.decidePoApproval
);
router.post(
  '/invoices',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.FINANCE_WRITE),
  financeOperationsController.createInvoice
);
router.post(
  '/invoices/:invoiceId/approve',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  financeOperationsController.decideInvoiceApproval
);
router.get(
  '/approvals',
  authenticate,
  requireModuleAccess('PROCUREMENT'),
  requirePermission(PERMISSIONS.PROCUREMENT_READ),
  financeOperationsController.listApprovals
);

export { router as procurementRoutes };
