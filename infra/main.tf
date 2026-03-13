locals {
  prefix = var.project_name
  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "opentofu"
  }
}

# ──────────────────────────────────────────────
# Resource Group (created by bootstrap; main stack uses it)
# ──────────────────────────────────────────────
data "azurerm_resource_group" "main" {
  name = "${local.prefix}-rg"
}

# ──────────────────────────────────────────────
# Azure Container Registry (Basic SKU – cheapest)
# ──────────────────────────────────────────────
resource "azurerm_container_registry" "main" {
  name                = replace("${local.prefix}acr", "-", "")
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
  tags                = local.tags
}

# ──────────────────────────────────────────────
# App Service Plan (Linux, B1 – cheapest non-free)
# ──────────────────────────────────────────────
resource "azurerm_service_plan" "main" {
  name                = "${local.prefix}-plan"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"
  tags                = local.tags
}

# ──────────────────────────────────────────────
# Web App for Containers
# ──────────────────────────────────────────────
resource "azurerm_linux_web_app" "main" {
  name                = "${local.prefix}-app-${var.environment}"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true
  tags                = local.tags

  site_config {
    always_on                          = true
    health_check_path                  = "/"
    health_check_eviction_time_in_min  = 2

    application_stack {
      docker_registry_url      = "https://${azurerm_container_registry.main.login_server}"
      docker_image_name        = "ag-web-container:${var.docker_image_tag}"
      docker_registry_username = azurerm_container_registry.main.admin_username
      docker_registry_password = azurerm_container_registry.main.admin_password
    }
  }

  app_settings = merge(
    {
      WEBSITES_PORT                       = "3000"
      DOCKER_ENABLE_CI                    = "true"
      WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
      DATABASE_URL                        = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}:${var.postgresql_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?sslmode=require"
    },
    var.app_settings,
  )
}

# ──────────────────────────────────────────────
# PostgreSQL Flexible Server (Burstable B1ms – cheapest)
# ──────────────────────────────────────────────
resource "azurerm_postgresql_flexible_server" "main" {
  name                          = "${local.prefix}-pg"
  resource_group_name           = data.azurerm_resource_group.main.name
  location                      = data.azurerm_resource_group.main.location
  version                       = "16"
  administrator_login           = "pgadmin"
  administrator_password        = var.postgresql_admin_password
  public_network_access_enabled = true
  storage_mb                    = 32768
  zone                          = "1"
  tags                          = local.tags

  sku_name = "B_Standard_B1ms"
}

# Allow Azure services to connect (e.g. App Service → PostgreSQL)
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "agweb"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# ──────────────────────────────────────────────
# Container Registry Webhook → restart web app on push
# ──────────────────────────────────────────────
resource "azurerm_container_registry_webhook" "cd" {
  name                = "cdwebhook"
  registry_name       = azurerm_container_registry.main.name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location
  service_uri         = "https://${azurerm_linux_web_app.main.site_credential[0].name}:${azurerm_linux_web_app.main.site_credential[0].password}@${azurerm_linux_web_app.main.default_hostname}/api/registry/webhook"
  actions             = ["push"]
  scope               = "ag-web-container:latest"
  status              = "enabled"
  tags                = local.tags
}
