variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "ag-web"
}

variable "location" {
  description = "Azure region – cheap EU region"
  type        = string
  default     = "swedencentral"
}

variable "environment" {
  description = "Environment name (e.g. prod, staging)"
  type        = string
  default     = "prod"
}

variable "docker_image_tag" {
  description = "Tag for the container image"
  type        = string
  default     = "latest"
}

variable "postgresql_admin_password" {
  description = "Admin password for PostgreSQL Flexible Server"
  type        = string
  sensitive   = true
}

variable "app_settings" {
  description = "Additional app settings / environment variables for the web app"
  type        = map(string)
  default     = {}
  sensitive   = true
}
