-- HR operational workflows
CREATE TYPE "HrCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "HrCaseType" AS ENUM ('ONBOARDING', 'OFFBOARDING');
CREATE TYPE "HrTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

CREATE TABLE "onboarding_cases" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "HrCaseStatus" NOT NULL DEFAULT 'OPEN',
  "ownerUserId" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboarding_cases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "onboarding_cases_idempotencyKey_key" ON "onboarding_cases"("idempotencyKey");
CREATE INDEX "onboarding_cases_employeeId_idx" ON "onboarding_cases"("employeeId");
CREATE INDEX "onboarding_cases_ownerUserId_idx" ON "onboarding_cases"("ownerUserId");
CREATE INDEX "onboarding_cases_status_idx" ON "onboarding_cases"("status");
ALTER TABLE "onboarding_cases"
ADD CONSTRAINT "onboarding_cases_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "onboarding_cases"
ADD CONSTRAINT "onboarding_cases_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "offboarding_cases" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "HrCaseStatus" NOT NULL DEFAULT 'OPEN',
  "ownerUserId" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "terminationDate" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT,
  "itsmTicketId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offboarding_cases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "offboarding_cases_idempotencyKey_key" ON "offboarding_cases"("idempotencyKey");
CREATE INDEX "offboarding_cases_employeeId_idx" ON "offboarding_cases"("employeeId");
CREATE INDEX "offboarding_cases_ownerUserId_idx" ON "offboarding_cases"("ownerUserId");
CREATE INDEX "offboarding_cases_status_idx" ON "offboarding_cases"("status");
CREATE INDEX "offboarding_cases_terminationDate_idx" ON "offboarding_cases"("terminationDate");
ALTER TABLE "offboarding_cases"
ADD CONSTRAINT "offboarding_cases_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offboarding_cases"
ADD CONSTRAINT "offboarding_cases_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "case_tasks" (
  "id" TEXT NOT NULL,
  "caseType" "HrCaseType" NOT NULL,
  "caseId" TEXT NOT NULL,
  "onboardingCaseId" TEXT,
  "offboardingCaseId" TEXT,
  "title" TEXT NOT NULL,
  "status" "HrTaskStatus" NOT NULL DEFAULT 'TODO',
  "assigneeUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "evidenceUrl" TEXT,
  "notes" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "case_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "case_tasks_caseType_caseId_idx" ON "case_tasks"("caseType", "caseId");
CREATE INDEX "case_tasks_onboardingCaseId_idx" ON "case_tasks"("onboardingCaseId");
CREATE INDEX "case_tasks_offboardingCaseId_idx" ON "case_tasks"("offboardingCaseId");
CREATE INDEX "case_tasks_assigneeUserId_idx" ON "case_tasks"("assigneeUserId");
CREATE INDEX "case_tasks_status_idx" ON "case_tasks"("status");
ALTER TABLE "case_tasks"
ADD CONSTRAINT "case_tasks_onboardingCaseId_fkey"
FOREIGN KEY ("onboardingCaseId") REFERENCES "onboarding_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_tasks"
ADD CONSTRAINT "case_tasks_offboardingCaseId_fkey"
FOREIGN KEY ("offboardingCaseId") REFERENCES "offboarding_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_tasks"
ADD CONSTRAINT "case_tasks_assigneeUserId_fkey"
FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "policies" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "contentUrl" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "policies_key_key" ON "policies"("key");
CREATE INDEX "policies_active_idx" ON "policies"("active");

CREATE TABLE "policy_acknowledgements" (
  "policyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedByUserId" TEXT,
  "metadataJson" JSONB,
  CONSTRAINT "policy_acknowledgements_pkey" PRIMARY KEY ("policyId", "employeeId")
);
CREATE INDEX "policy_acknowledgements_employeeId_idx" ON "policy_acknowledgements"("employeeId");
CREATE INDEX "policy_acknowledgements_acknowledgedByUserId_idx" ON "policy_acknowledgements"("acknowledgedByUserId");
ALTER TABLE "policy_acknowledgements"
ADD CONSTRAINT "policy_acknowledgements_policyId_fkey"
FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_acknowledgements"
ADD CONSTRAINT "policy_acknowledgements_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_acknowledgements"
ADD CONSTRAINT "policy_acknowledgements_acknowledgedByUserId_fkey"
FOREIGN KEY ("acknowledgedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
