BEGIN;
-- Preserve existing events: missing snapshots remain NULL and are never backfilled with current roles.
ALTER TABLE "AuditLog" ADD COLUMN "actorRole" "Role",
ADD COLUMN "actorEmployeeName" TEXT;
COMMIT;
