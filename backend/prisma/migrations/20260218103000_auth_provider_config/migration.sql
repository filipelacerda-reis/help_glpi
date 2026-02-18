-- Auth provider config with single active provider enforcement
CREATE TYPE "AuthProvider" AS ENUM ('SAML_GOOGLE', 'AUTH0');

CREATE TABLE "auth_provider_configs" (
  "id" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "samlMetadataUrl" TEXT,
  "samlEntityId" TEXT,
  "samlCallbackUrl" TEXT,
  "auth0Domain" TEXT,
  "auth0ClientId" TEXT,
  "auth0CallbackUrl" TEXT,
  "auth0Audience" TEXT,
  "auth0ClientSecret" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_provider_configs_provider_key" ON "auth_provider_configs"("provider");
CREATE INDEX "auth_provider_configs_enabled_idx" ON "auth_provider_configs"("enabled");

-- Guarantees at most one enabled provider in database level
CREATE UNIQUE INDEX "auth_provider_configs_single_enabled_idx"
ON "auth_provider_configs" ((enabled))
WHERE enabled = true;

ALTER TABLE "auth_provider_configs"
ADD CONSTRAINT "auth_provider_configs_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
