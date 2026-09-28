ALTER TABLE "package" ADD COLUMN "source_kind" text DEFAULT 'hosted_function' NOT NULL;--> statement-breakpoint
ALTER TABLE "package_version" ADD COLUMN "host_allowlist" text[];--> statement-breakpoint
ALTER TABLE "package_version" ADD COLUMN "strict_output" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "search_id" text;--> statement-breakpoint
CREATE INDEX "execution_search_id_idx" ON "execution" USING btree ("search_id");--> statement-breakpoint
CREATE TABLE "org_catalog_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"ranking_share_opt_in" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "org_catalog_settings" ADD CONSTRAINT "org_catalog_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "capability_source" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"credential_name" text,
	"current_generation" integer DEFAULT 0 NOT NULL,
	"endpoint" text NOT NULL,
	"health" text DEFAULT 'ready' NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"last_error" text,
	"organization_id" text NOT NULL,
	"package_id" text,
	"schema_hash" text,
	"slug" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "capability_source" ADD CONSTRAINT "capability_source_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_source" ADD CONSTRAINT "capability_source_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capability_source_org_slug_uidx" ON "capability_source" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "capability_source_organization_id_idx" ON "capability_source" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "capability_source_package_id_idx" ON "capability_source" USING btree ("package_id");--> statement-breakpoint
CREATE TABLE "capability_generation" (
	"contract_bundle" jsonb NOT NULL,
	"contract_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"generation" integer NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL
);--> statement-breakpoint
ALTER TABLE "capability_generation" ADD CONSTRAINT "capability_generation_source_id_capability_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."capability_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capability_generation_source_generation_uidx" ON "capability_generation" USING btree ("source_id","generation");--> statement-breakpoint
CREATE INDEX "capability_generation_source_id_idx" ON "capability_generation" USING btree ("source_id");--> statement-breakpoint
CREATE TABLE "capability_graph_edge" (
	"confidence" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"from_id" text NOT NULL,
	"generation" integer NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provenance" text NOT NULL,
	"to_id" text NOT NULL,
	"type" text NOT NULL,
	"weight" double precision NOT NULL
);--> statement-breakpoint
ALTER TABLE "capability_graph_edge" ADD CONSTRAINT "capability_graph_edge_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capability_graph_edge_uidx" ON "capability_graph_edge" USING btree ("organization_id","from_id","to_id","type","generation");--> statement-breakpoint
CREATE INDEX "capability_graph_edge_org_idx" ON "capability_graph_edge" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "capability_graph_edge_from_idx" ON "capability_graph_edge" USING btree ("from_id");--> statement-breakpoint
CREATE INDEX "capability_graph_edge_to_idx" ON "capability_graph_edge" USING btree ("to_id");--> statement-breakpoint
CREATE TABLE "search_event" (
	"caller_user_id" text,
	"catalog_generation" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"execution_outcome" text DEFAULT 'not_called' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"query_hash" text NOT NULL,
	"selected_capability_id" text
);--> statement-breakpoint
ALTER TABLE "search_event" ADD CONSTRAINT "search_event_caller_user_id_user_id_fk" FOREIGN KEY ("caller_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_event" ADD CONSTRAINT "search_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_event_organization_id_idx" ON "search_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "search_event_created_at_idx" ON "search_event" USING btree ("created_at");--> statement-breakpoint
CREATE TABLE "search_exposure" (
	"capability_id" text NOT NULL,
	"exact_channel" boolean DEFAULT false NOT NULL,
	"graph_channel" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lexical_channel" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"search_event_id" text NOT NULL,
	"vector_channel" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
ALTER TABLE "search_exposure" ADD CONSTRAINT "search_exposure_search_event_id_search_event_id_fk" FOREIGN KEY ("search_event_id") REFERENCES "public"."search_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_exposure_event_idx" ON "search_exposure" USING btree ("search_event_id");--> statement-breakpoint
CREATE INDEX "search_exposure_capability_idx" ON "search_exposure" USING btree ("capability_id");--> statement-breakpoint
CREATE TABLE "execute_idempotency" (
	"body_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"organization_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"status" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "execute_idempotency" ADD CONSTRAINT "execute_idempotency_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "execute_idempotency_org_key_uidx" ON "execute_idempotency" USING btree ("organization_id","key");--> statement-breakpoint
CREATE INDEX "execute_idempotency_updated_at_idx" ON "execute_idempotency" USING btree ("updated_at");
