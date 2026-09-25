resource "cloudflare_secrets_store" "functhis" {
  account_id = var.account_id
  name       = "functhis-${var.env}"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [name]
  }
}

resource "cloudflare_secrets_store_secret" "better_auth_secret" {
  account_id = var.account_id
  store_id   = cloudflare_secrets_store.functhis.id
  name       = "BETTER_AUTH_SECRET"
  scopes     = ["workers"]
  value      = var.better_auth_secret
}

resource "cloudflare_secrets_store_secret" "github_client_id" {
  account_id = var.account_id
  store_id   = cloudflare_secrets_store.functhis.id
  name       = "GITHUB_CLIENT_ID"
  scopes     = ["workers"]
  value      = var.github_client_id
}

resource "cloudflare_secrets_store_secret" "github_client_secret" {
  account_id = var.account_id
  store_id   = cloudflare_secrets_store.functhis.id
  name       = "GITHUB_CLIENT_SECRET"
  scopes     = ["workers"]
  value      = var.github_client_secret
}
