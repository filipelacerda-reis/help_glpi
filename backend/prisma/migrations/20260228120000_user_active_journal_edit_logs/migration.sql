ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "technician_journal_entries" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "journal_entry_edit_logs" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "editedById" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previous" JSONB NOT NULL,
  "next" JSONB NOT NULL,
  "reason" TEXT,
  CONSTRAINT "journal_entry_edit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_entry_edit_logs_entryId_idx" ON "journal_entry_edit_logs"("entryId");
CREATE INDEX IF NOT EXISTS "journal_entry_edit_logs_editedById_idx" ON "journal_entry_edit_logs"("editedById");
CREATE INDEX IF NOT EXISTS "journal_entry_edit_logs_editedAt_idx" ON "journal_entry_edit_logs"("editedAt");

DO $$ BEGIN
  ALTER TABLE "journal_entry_edit_logs" ADD CONSTRAINT "journal_entry_edit_logs_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "technician_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "journal_entry_edit_logs" ADD CONSTRAINT "journal_entry_edit_logs_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
