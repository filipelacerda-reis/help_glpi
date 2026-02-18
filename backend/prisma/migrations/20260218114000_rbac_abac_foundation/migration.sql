-- RBAC + ABAC foundation
ALTER TABLE "employees"
ADD COLUMN "managerId" TEXT;

ALTER TABLE "employees"
ADD CONSTRAINT "employees_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "employees_managerId_idx" ON "employees"("managerId");

CREATE TABLE "permissions" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

CREATE TABLE "roles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

CREATE TABLE "role_permissions" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

ALTER TABLE "role_permissions"
ADD CONSTRAINT "role_permissions_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
ADD CONSTRAINT "role_permissions_permissionId_fkey"
FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_roles" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId", "roleId")
);

CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

ALTER TABLE "user_roles"
ADD CONSTRAINT "user_roles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles"
ADD CONSTRAINT "user_roles_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_attributes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeId" TEXT,
  "businessUnit" TEXT,
  "costCenterId" TEXT,
  "location" TEXT,
  "managerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_attributes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_attributes_userId_key" ON "user_attributes"("userId");
CREATE INDEX "user_attributes_employeeId_idx" ON "user_attributes"("employeeId");
CREATE INDEX "user_attributes_costCenterId_idx" ON "user_attributes"("costCenterId");
CREATE INDEX "user_attributes_managerUserId_idx" ON "user_attributes"("managerUserId");

ALTER TABLE "user_attributes"
ADD CONSTRAINT "user_attributes_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_attributes"
ADD CONSTRAINT "user_attributes_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_attributes"
ADD CONSTRAINT "user_attributes_managerUserId_fkey"
FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
