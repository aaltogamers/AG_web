# Bootstrap: creates only the resource group and storage account used by the
# main stack's remote backend. Run this once, then run the main stack from infra/.

resource "azurerm_resource_group" "state" {
  name     = var.resource_group_name
  location = var.location
  tags = {
    purpose   = "opentofu-state"
    managed_by = "opentofu-bootstrap"
  }
}

resource "azurerm_storage_account" "state" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.state.name
  location                 = azurerm_resource_group.state.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  tags = {
    purpose    = "opentofu-state"
    managed_by = "opentofu-bootstrap"
  }
}

resource "azurerm_storage_container" "state" {
  name                  = var.container_name
  storage_account_name  = azurerm_storage_account.state.name
  container_access_type = "private"
}
