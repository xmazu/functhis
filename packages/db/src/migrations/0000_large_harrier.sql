CREATE TYPE "public"."package_scope_kind" AS ENUM('user', 'organization');--> statement-breakpoint
CREATE TYPE "public"."package_visibility" AS ENUM('private', 'organization', 'library');--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_code" (
	"client_id" text,
	"device_code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_polled_at" timestamp,
	"oauth_client_id" text,
	"polling_interval" integer,
	"resources" text[],
	"scope" text,
	"status" text NOT NULL,
	"user_code" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"alg" text,
	"created_at" timestamp NOT NULL,
	"crv" text,
	"expires_at" timestamp,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"private_key" text NOT NULL,
	"public_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_access_token" (
	"authorization_code_id" text,
	"client_id" text NOT NULL,
	"confirmation" jsonb,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" text,
	"refresh_id" text,
	"requested_user_info_claims" text[],
	"resources" text[],
	"revoked" timestamp,
	"scopes" text[] NOT NULL,
	"session_id" text,
	"token" text NOT NULL,
	"user_id" text,
	CONSTRAINT "oauth_access_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_client" (
	"application_type" text,
	"backchannel_logout_session_required" boolean,
	"backchannel_logout_uri" text,
	"client_credentials_scopes" text[] DEFAULT '{}',
	"client_discovery_id" text,
	"client_id" text NOT NULL,
	"client_secret" text,
	"contacts" text[],
	"created_at" timestamp,
	"disabled" boolean DEFAULT false,
	"dpop_bound_access_tokens" boolean DEFAULT false,
	"enable_end_session" boolean,
	"grant_types" text[],
	"icon" text,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jwks" text,
	"jwks_uri" text,
	"metadata" jsonb,
	"name" text,
	"policy" text,
	"post_logout_redirect_uris" text[],
	"redirect_uris" text[] NOT NULL,
	"reference_id" text,
	"require_pkce" boolean,
	"response_types" text[],
	"scopes" text[],
	"skip_consent" boolean,
	"software_id" text,
	"software_statement" text,
	"software_version" text,
	"subject_type" text,
	"token_endpoint_auth_method" text,
	"tos" text,
	"updated_at" timestamp,
	"uri" text,
	"user_id" text,
	CONSTRAINT "oauth_client_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_client_assertion" (
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_client_resource" (
	"client_id" text NOT NULL,
	"created_at" timestamp,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metadata" jsonb,
	"resource_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_consent" (
	"client_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" text,
	"requested_user_info_claims" text[],
	"resources" text[],
	"scopes" text[] NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_token" (
	"auth_time" timestamp,
	"authorization_code_id" text,
	"client_id" text NOT NULL,
	"confirmation" jsonb,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" text,
	"requested_user_info_claims" text[],
	"resources" text[],
	"revoked" timestamp,
	"rotated_at" timestamp,
	"rotation_replay_expires_at" timestamp,
	"rotation_replay_response" text,
	"scopes" text[] NOT NULL,
	"session_id" text,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "oauth_refresh_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_resource" (
	"access_token_ttl" integer,
	"allowed_scopes" text[],
	"created_at" timestamp,
	"custom_claims" jsonb,
	"disabled" boolean DEFAULT false,
	"dpop_bound_access_tokens_required" boolean DEFAULT false,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"metadata" jsonb,
	"name" text NOT NULL,
	"policy_version" integer DEFAULT 1,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"updated_at" timestamp,
	CONSTRAINT "oauth_resource_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logo" text,
	"metadata" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"count" integer NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"active_organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"handle" text NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution" (
	"caller_user_id" text,
	"cpu_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"function_id" text,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_version_id" text NOT NULL,
	"request_bytes" integer,
	"response_bytes" integer,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_version" (
	"artifact_key" text NOT NULL,
	"bundle_hash" text NOT NULL,
	"contracts" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"git_dirty" boolean DEFAULT false NOT NULL,
	"git_sha" text,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" text NOT NULL,
	"runtime_version" text NOT NULL,
	"semver" text NOT NULL,
	"source_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_version_id" text,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"owner_user_id" text NOT NULL,
	"scope_kind" "package_scope_kind" DEFAULT 'user' NOT NULL,
	"slug" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"visibility" "package_visibility" DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "function" (
	"contract" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"export_name" text NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" text NOT NULL,
	"path" text NOT NULL,
	"search_text" text,
	"slug" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_refresh_id_oauth_refresh_token_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "public"."oauth_refresh_token"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client" ADD CONSTRAINT "oauth_client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_resource" ADD CONSTRAINT "oauth_client_resource_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_resource" ADD CONSTRAINT "oauth_client_resource_resource_id_oauth_resource_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."oauth_resource"("identifier") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_caller_user_id_user_id_fk" FOREIGN KEY ("caller_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_function_id_function_id_fk" FOREIGN KEY ("function_id") REFERENCES "public"."function"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_package_version_id_package_version_id_fk" FOREIGN KEY ("package_version_id") REFERENCES "public"."package_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_version" ADD CONSTRAINT "package_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_version" ADD CONSTRAINT "package_version_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "function" ADD CONSTRAINT "function_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deviceCode_deviceCode_uidx" ON "device_code" USING btree ("device_code");--> statement-breakpoint
CREATE UNIQUE INDEX "deviceCode_userCode_uidx" ON "device_code" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_clientId_idx" ON "oauth_access_token" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_sessionId_idx" ON "oauth_access_token" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_userId_idx" ON "oauth_access_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_authorizationCodeId_idx" ON "oauth_access_token" USING btree ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_refreshId_idx" ON "oauth_access_token" USING btree ("refresh_id");--> statement-breakpoint
CREATE INDEX "oauthClient_userId_idx" ON "oauth_client" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauthClientResource_clientId_resourceId_uidx" ON "oauth_client_resource" USING btree ("client_id","resource_id");--> statement-breakpoint
CREATE INDEX "oauthClientResource_clientId_idx" ON "oauth_client_resource" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthClientResource_resourceId_idx" ON "oauth_client_resource" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "oauthConsent_clientId_idx" ON "oauth_consent" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthConsent_userId_idx" ON "oauth_consent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_clientId_idx" ON "oauth_refresh_token" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_sessionId_idx" ON "oauth_refresh_token" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_userId_idx" ON "oauth_refresh_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_authorizationCodeId_idx" ON "oauth_refresh_token" USING btree ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "execution_package_version_id_idx" ON "execution" USING btree ("package_version_id");--> statement-breakpoint
CREATE INDEX "execution_created_at_idx" ON "execution" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "execution_caller_user_id_idx" ON "execution" USING btree ("caller_user_id");--> statement-breakpoint
CREATE INDEX "package_version_package_id_idx" ON "package_version" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "package_version_package_id_semver_uidx" ON "package_version" USING btree ("package_id","semver");--> statement-breakpoint
CREATE UNIQUE INDEX "package_user_scope_slug_uidx" ON "package" USING btree ("owner_user_id","slug") WHERE "package"."scope_kind" = 'user';--> statement-breakpoint
CREATE UNIQUE INDEX "package_org_scope_slug_uidx" ON "package" USING btree ("organization_id","slug") WHERE "package"."scope_kind" = 'organization';--> statement-breakpoint
CREATE INDEX "package_owner_user_id_idx" ON "package" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "package_organization_id_idx" ON "package" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "function_package_id_slug_uidx" ON "function" USING btree ("package_id","slug");--> statement-breakpoint
CREATE INDEX "function_package_id_idx" ON "function" USING btree ("package_id");