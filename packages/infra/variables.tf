variable "account_id" {
  type        = string
  description = "Cloudflare account ID"
}

variable "env" {
  type        = string
  description = "Deployment environment"

  validation {
    condition     = var.env == "production"
    error_message = "env must be production"
  }
}

variable "neon_direct_url" {
  type        = string
  sensitive   = true
  description = "Neon direct (unpooled) postgres URL for Hyperdrive origin. URL-encode special characters in the password."
}

variable "neon_sslmode" {
  type        = string
  default     = "require"
  description = "Postgres TLS mode for Hyperdrive when sslmode is not present in neon_direct_url"

  validation {
    condition     = contains(["require", "verify-ca", "verify-full"], var.neon_sslmode)
    error_message = "neon_sslmode must be require, verify-ca, or verify-full"
  }
}

variable "better_auth_secret" {
  type        = string
  sensitive   = true
  description = "Better Auth secret (Secrets Store + Hyperdrive is separate)"
}

variable "github_client_id" {
  type        = string
  sensitive   = true
  description = "GitHub OAuth client ID"
}

variable "github_client_secret" {
  type        = string
  sensitive   = true
  description = "GitHub OAuth client secret"
}

variable "functhis_secrets_key" {
  type        = string
  sensitive   = true
  description = "32-byte base64 key used to encrypt customer secrets in Postgres"
}

variable "enable_domains" {
  type        = bool
  default     = false
  description = "Attach Workers custom domains (enable after first wrangler deploy)"
}
