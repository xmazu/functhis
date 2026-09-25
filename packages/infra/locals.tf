locals {
  zone_name = "functhis.now"

  # Standard postgres URL: postgres://user:password@host[:port]/dbname?sslmode=require
  # URL-encode special characters in user and password (@ : / etc.).
  neon_url_match = regex(
    "^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\\d+))?/([^?]+)",
    var.neon_direct_url
  )
  neon_user     = urldecode(local.neon_url_match[0])
  neon_password = urldecode(local.neon_url_match[1])
  neon_host     = local.neon_url_match[2]
  neon_port     = local.neon_url_match[3] != "" ? tonumber(local.neon_url_match[3]) : 5432
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

  hostnames = var.env == "production" ? {
    web = "functhis.now"
    mcp   = "mcp.functhis.now"
    } : {
    web = "preview.functhis.now"
    mcp   = "mcp.preview.functhis.now"
  }

  worker_names = var.env == "production" ? {
    web = "functhis-web"
    mcp   = "functhis-mcp"
    } : {
    web = "functhis-web-preview"
    mcp   = "functhis-mcp-preview"
  }

  analytics_execution_dataset = var.env == "production" ? "functhis_executions" : "functhis_executions_preview"

  artifacts_namespace = var.env == "production" ? "functhis-production" : "functhis-preview"

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
