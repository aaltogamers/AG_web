variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "location" {
  description = "Azure region for the state backend resources"
  type        = string
  default     = "swedencentral"
}

variable "resource_group_name" {
  description = "Name of the resource group for the state storage account"
  type        = string
  default     = "ag-web-rg"
}

variable "storage_account_name" {
  description = "Name of the storage account for Terraform/Opentofu state"
  type        = string
  default     = "agwebtfstate"
}

variable "container_name" {
  description = "Name of the blob container for state files"
  type        = string
  default     = "tfstate"
}
