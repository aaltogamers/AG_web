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

variable "admin_password" {
  description = "Password required by the admin-only analytics API (/api/analytics/stats)"
  type        = string
  sensitive   = true
}

variable "github_app_id" {
  description = "GitHub App ID used by Decap CMS to mint access tokens"
  type        = string
  sensitive   = true
}

variable "github_app_private_key_base64" {
  description = "GitHub App private key, base64-encoded PEM (used by Decap CMS via /api/auth)"
  type        = string
  sensitive   = true
}

variable "github_app_installation_id" {
  description = "GitHub App installation ID on the aaltogamers/AG_web repo"
  type        = string
  sensitive   = true
}

variable "app_settings" {
  description = "Additional app settings / environment variables for the web app"
  type        = map(string)
  default     = {}
  sensitive   = true
}
