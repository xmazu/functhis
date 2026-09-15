output "account_id" {
  value = var.account_id
}

output "env" {
  value = var.env
}

output "hyperdrive_auth_id" {
  value       = cloudflare_hyperdrive_config.auth.id
  description = "Bind as HYPERDRIVE on functhis-console"
}

output "hyperdrive_catalog_id" {
  value       = cloudflare_hyperdrive_config.catalog.id
  description = "Bind as HYPERDRIVE on functhis-web (and runtime later)"
}

output "kv_bundles_namespace_id" {
  value       = cloudflare_workers_kv_namespace.bundles.id
  description = "KV namespace for compiled bundles; bind on functhis-runtime when roadmap 4 ships"
}

output "secrets_store_id" {
  value       = cloudflare_secrets_store.functhis.id
  description = "Secrets Store for console Worker bindings"
}

output "artifacts_namespace" {
  value       = local.artifacts_namespace
  description = "Wrangler artifacts binding namespace (create via wrangler artifacts namespaces create)"
}

output "worker_names" {
  value = local.worker_names
}

output "hostnames" {
  value = local.hostnames
}
