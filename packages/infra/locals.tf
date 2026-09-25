locals {
  zone_name = "functhis.now"

  # Standard postgres URL: postgres://user:password@host[:port]/dbname?sslmode=require
  # URL-encode special characters in user and password (@ : / etc.).
  neon_url_match = regex(
    "^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\\d+))?/([^?]+)",
    var.neon_direct_url
  )
  neon_user     = local.neon_url_match[0]
  neon_password = local.neon_url_match[1]
  neon_host     = local.neon_url_match[2]
  neon_port     = tonumber(coalesce(local.neon_url_match[3], "5432"))
  neon_database = local.neon_url_match[4]

  neon_sslmode = can(regex("[?&]sslmode=([^&]+)", var.neon_direct_url)) ? regex("[?&]sslmode=([^&]+)", var.neon_direct_url)[0] : var.neon_sslmode

  hyperdrive_origin = {
    database = local.neon_database
    host     = local.neon_host
    password = local.neon_password
    port     = local.neon_port
    scheme   = "postgres"
    user     = local.neon_user
  }

  hostnames = {
    web = "functhis.now"
    mcp = "mcp.functhis.now"
  }

  worker_names = {
    web = "functhis-web"
    mcp = "functhis-mcp"
  }

  analytics_execution_dataset = "functhis_executions"
  artifacts_namespace         = "functhis-production"

  custom_domains = {
    web = {
      hostname = local.hostnames.web
      service  = local.worker_names.web
    }
    mcp = {
      hostname = local.hostnames.mcp
      service  = local.worker_names.mcp
    }
  }
}
