CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "function" ADD COLUMN "search_text" text;--> statement-breakpoint
ALTER TABLE "function" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
UPDATE "function" SET "search_text" = trim(both from concat_ws(E'\n', "slug", "contract"->>'description'));
