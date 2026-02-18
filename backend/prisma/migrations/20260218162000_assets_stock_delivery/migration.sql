-- Assets stock and delivery operational flow
CREATE TYPE "StockMovementType" AS ENUM ('IN','OUT','TRANSFER');
CREATE TYPE "DeliveryStatus" AS ENUM ('SCHEDULED','IN_TRANSIT','DELIVERED','RETURNED','CANCELLED');

CREATE TABLE "stock_locations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_locations_name_key" ON "stock_locations"("name");
CREATE INDEX "stock_locations_active_idx" ON "stock_locations"("active");

CREATE TABLE "deliveries" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "courier" TEXT,
  "tracking" TEXT,
  "proofUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "deliveries_assignmentId_key" ON "deliveries"("assignmentId");
CREATE INDEX "deliveries_employeeId_idx" ON "deliveries"("employeeId");
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");
CREATE INDEX "deliveries_scheduledAt_idx" ON "deliveries"("scheduledAt");
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_assignmentId_fkey"
FOREIGN KEY ("assignmentId") REFERENCES "equipment_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "delivery_items" (
  "deliveryId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("deliveryId","equipmentId")
);
CREATE INDEX "delivery_items_equipmentId_idx" ON "delivery_items"("equipmentId");
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_deliveryId_fkey"
FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "fromLocationId" TEXT,
  "toLocationId" TEXT,
  "type" "StockMovementType" NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" TEXT,
  "deliveryId" TEXT,
  "notes" TEXT,
  "metadataJson" JSONB,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movements_equipmentId_idx" ON "stock_movements"("equipmentId");
CREATE INDEX "stock_movements_fromLocationId_idx" ON "stock_movements"("fromLocationId");
CREATE INDEX "stock_movements_toLocationId_idx" ON "stock_movements"("toLocationId");
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");
CREATE INDEX "stock_movements_ts_idx" ON "stock_movements"("ts");
CREATE INDEX "stock_movements_deliveryId_idx" ON "stock_movements"("deliveryId");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fromLocationId_fkey"
FOREIGN KEY ("fromLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_toLocationId_fkey"
FOREIGN KEY ("toLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_deliveryId_fkey"
FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
