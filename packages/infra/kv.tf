resource "cloudflare_workers_kv_namespace" "bundles" {
  account_id = var.account_id
  title      = "functhis-bundles-${var.env}"
}
