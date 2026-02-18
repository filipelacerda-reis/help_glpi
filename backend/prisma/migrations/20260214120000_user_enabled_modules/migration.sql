-- Add enabled modules column for per-user module permissions
ALTER TABLE "users"
ADD COLUMN "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
