-- Finance operational foundation
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED','CONVERTED_TO_PO');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT','APPROVED','REJECTED','CLOSED');
CREATE TYPE "InvoiceStatus" AS ENUM ('REGISTERED','APPROVED','REJECTED','PAID');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE "ApprovalEntityType" AS ENUM ('PR','PO','INVOICE');
CREATE TYPE "AssetLedgerStatus" AS ENUM ('ACTIVE','TRANSFERRED','WRITTEN_OFF','LOST');
CREATE TYPE "AssetMovementType" AS ENUM ('TRANSFER','WRITE_OFF','LOSS','RETURN');
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE');

CREATE TABLE "cost_centers" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");
CREATE INDEX "cost_centers_ownerUserId_idx" ON "cost_centers"("ownerUserId");
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "vendors" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "contactEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendors_taxId_key" ON "vendors"("taxId");
CREATE INDEX "vendors_name_idx" ON "vendors"("name");

CREATE TABLE "purchase_requests" (
  "id" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "costCenterId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "purchase_requests_idempotencyKey_key" ON "purchase_requests"("idempotencyKey");
CREATE INDEX "purchase_requests_requesterUserId_idx" ON "purchase_requests"("requesterUserId");
CREATE INDEX "purchase_requests_costCenterId_idx" ON "purchase_requests"("costCenterId");
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requesterUserId_fkey"
FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_costCenterId_fkey"
FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "purchase_request_items" (
  "id" TEXT NOT NULL,
  "prId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "assetCategory" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_request_items_prId_idx" ON "purchase_request_items"("prId");
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_prId_fkey"
FOREIGN KEY ("prId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "purchase_orders" (
  "id" TEXT NOT NULL,
  "prId" TEXT,
  "vendorId" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "purchase_orders_idempotencyKey_key" ON "purchase_orders"("idempotencyKey");
CREATE INDEX "purchase_orders_prId_idx" ON "purchase_orders"("prId");
CREATE INDEX "purchase_orders_vendorId_idx" ON "purchase_orders"("vendorId");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_prId_fkey"
FOREIGN KEY ("prId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "poId" TEXT,
  "vendorId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'REGISTERED',
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_idempotencyKey_key" ON "invoices"("idempotencyKey");
CREATE UNIQUE INDEX "invoices_vendorId_number_key" ON "invoices"("vendorId","number");
CREATE INDEX "invoices_poId_idx" ON "invoices"("poId");
CREATE INDEX "invoices_vendorId_idx" ON "invoices"("vendorId");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_poId_fkey"
FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "approvals" (
  "id" TEXT NOT NULL,
  "entityType" "ApprovalEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "step" INTEGER NOT NULL,
  "approverUserId" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "decidedAt" TIMESTAMP(3),
  "decisionNotes" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "approvals_idempotencyKey_key" ON "approvals"("idempotencyKey");
CREATE INDEX "approvals_entityType_entityId_step_idx" ON "approvals"("entityType","entityId","step");
CREATE INDEX "approvals_approverUserId_status_idx" ON "approvals"("approverUserId","status");
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approverUserId_fkey"
FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "asset_ledgers" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "acquisitionDate" TIMESTAMP(3) NOT NULL,
  "acquisitionValue" DECIMAL(14,2) NOT NULL,
  "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
  "usefulLifeMonths" INTEGER NOT NULL,
  "residualValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "AssetLedgerStatus" NOT NULL DEFAULT 'ACTIVE',
  "costCenterId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_ledgers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "asset_ledgers_equipmentId_key" ON "asset_ledgers"("equipmentId");
CREATE INDEX "asset_ledgers_costCenterId_idx" ON "asset_ledgers"("costCenterId");
CREATE INDEX "asset_ledgers_status_idx" ON "asset_ledgers"("status");
ALTER TABLE "asset_ledgers" ADD CONSTRAINT "asset_ledgers_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_ledgers" ADD CONSTRAINT "asset_ledgers_costCenterId_fkey"
FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "asset_movements" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "assetLedgerId" TEXT,
  "type" "AssetMovementType" NOT NULL,
  "fromCostCenterId" TEXT,
  "toCostCenterId" TEXT,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataJson" JSONB,
  CONSTRAINT "asset_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "asset_movements_equipmentId_idx" ON "asset_movements"("equipmentId");
CREATE INDEX "asset_movements_assetLedgerId_idx" ON "asset_movements"("assetLedgerId");
CREATE INDEX "asset_movements_type_idx" ON "asset_movements"("type");
CREATE INDEX "asset_movements_ts_idx" ON "asset_movements"("ts");
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_assetLedgerId_fkey"
FOREIGN KEY ("assetLedgerId") REFERENCES "asset_ledgers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_fromCostCenterId_fkey"
FOREIGN KEY ("fromCostCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_toCostCenterId_fkey"
FOREIGN KEY ("toCostCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
