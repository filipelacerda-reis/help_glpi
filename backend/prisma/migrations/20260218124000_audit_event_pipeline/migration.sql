-- Immutable audit events (append-only)
CREATE TABLE "audit_events" (
  "id" TEXT NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "requestId" TEXT,
  "domain" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "metadataJson" JSONB,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_ts_idx" ON "audit_events"("ts");
CREATE INDEX "audit_events_domain_action_idx" ON "audit_events"("domain", "action");
CREATE INDEX "audit_events_resourceType_resourceId_idx" ON "audit_events"("resourceType", "resourceId");
CREATE INDEX "audit_events_requestId_idx" ON "audit_events"("requestId");

ALTER TABLE "audit_events"
ADD CONSTRAINT "audit_events_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce append-only behavior
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_event_mutation();
