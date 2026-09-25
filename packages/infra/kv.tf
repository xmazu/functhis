resource "cloudflare_workers_kv_namespace" "bundles" {
  account_id = var.account_id
  title      = "functhis-bundles-${var.env}"
}

resource "cloudflare_workers_kv_namespace" "hot" {
  account_id = var.account_id
  title      = "functhis-hot-${var.env}"
}
