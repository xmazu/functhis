resource "cloudflare_workers_custom_domain" "hosts" {
  for_each   = var.enable_domains ? local.custom_domains : {}
  account_id = var.account_id
  zone_id    = data.cloudflare_zone.functhis.id
  hostname   = each.value.hostname
  service    = each.value.service
}
