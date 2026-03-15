terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Local backend only – this stack creates the remote backend resources.
  backend "local" {
    path = "bootstrap.tfstate"
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}
