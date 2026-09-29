ALTER TABLE "org_catalog_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "capability_graph_edge" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "search_event" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "search_exposure" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "org_catalog_settings" CASCADE;--> statement-breakpoint
DROP TABLE "capability_graph_edge" CASCADE;--> statement-breakpoint
DROP TABLE "search_event" CASCADE;--> statement-breakpoint
DROP TABLE "search_exposure" CASCADE;--> statement-breakpoint
DROP INDEX "execution_search_id_idx";--> statement-breakpoint
ALTER TABLE "package" ALTER COLUMN "source_kind" SET DEFAULT 'hosted_function';--> statement-breakpoint
ALTER TABLE "capability_source" ALTER COLUMN "health" SET DEFAULT 'ready';--> statement-breakpoint
ALTER TABLE "execution" DROP COLUMN "search_id";