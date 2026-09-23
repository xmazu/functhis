resource "cloudflare_r2_bucket" "artifacts" {
  account_id = var.account_id
  name       = "functhis-artifacts-${var.env}"
}
