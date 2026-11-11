-- Rename the existing column without losing data
ALTER TABLE "workout"
RENAME COLUMN "updated" TO "updated_at";

-- Recreate the index with the new column name
DROP INDEX "workout_user_id_updated_idx";

CREATE INDEX "workout_user_id_updated_at_idx"
ON "workout"("user_id", "updated_at");