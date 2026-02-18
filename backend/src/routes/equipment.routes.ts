import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { equipmentController } from '../controllers/equipment.controller';
import { authenticate, authorize, requireModuleAccess } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getAll);
router.get('/dashboard', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getDashboard);
router.get('/alerts', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getAlerts);
router.get('/assignments', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getAssignments);
router.get('/stock-locations', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.listStockLocations);
router.get('/stock-movements', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.listStockMovements);
router.get('/deliveries', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getDeliveries);
router.get('/assignments/:assignmentId/term.pdf', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.downloadDeliveryTermPdf);
router.get('/:id', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER, UserRole.TECHNICIAN), equipmentController.getById);

router.post('/', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.create);
router.post('/stock-locations', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.createStockLocation);
router.post('/stock-movements', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.createStockMovement);
router.patch('/:id', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.update);
router.patch('/deliveries/:deliveryId', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.updateDelivery);
router.delete('/:id', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN), equipmentController.delete);
router.post('/:id/assignments', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.assign);
router.post('/assignments/:assignmentId/return', authenticate, requireModuleAccess('EQUIPMENTS'), authorize(UserRole.ADMIN, UserRole.TRIAGER), equipmentController.returnAssignment);

export { router as equipmentRoutes };
