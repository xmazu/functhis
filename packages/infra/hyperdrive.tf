resource "cloudflare_hyperdrive_config" "auth" {
  account_id = var.account_id
  name       = "functhis-auth-${var.env}"

  origin = local.hyperdrive_origin

  mtls = {
    sslmode = local.neon_sslmode
  }

  caching = {
    disabled = true
  }
}

resource "cloudflare_hyperdrive_config" "catalog" {
  account_id = var.account_id
  name       = "functhis-catalog-${var.env}"

  origin = local.hyperdrive_origin

  mtls = {
    sslmode = local.neon_sslmode
  }
}
