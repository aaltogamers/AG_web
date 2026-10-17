output "resource_group_name" {
  value = data.azurerm_resource_group.main.name
}

output "acr_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "acr_admin_username" {
  value     = azurerm_container_registry.main.admin_username
  sensitive = true
}

output "acr_admin_password" {
  value     = azurerm_container_registry.main.admin_password
  sensitive = true
}

output "web_app_name" {
  value = azurerm_linux_web_app.main.name
}

output "web_app_default_hostname" {
  value = azurerm_linux_web_app.main.default_hostname
}

output "postgresql_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgresql_database_name" {
  value = azurerm_postgresql_flexible_server_database.app.name
}

output "database_url" {
  value     = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}:${var.postgresql_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?sslmode=require"
  sensitive = true
}

output "media_base_url" {
  value = "${azurerm_storage_account.media.primary_blob_endpoint}${azurerm_storage_container.media.name}"
}

output "media_storage_connection_string" {
  value     = azurerm_storage_account.media.primary_connection_string
  sensitive = true
}
