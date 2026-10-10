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
  description = "Password required by the admin panel and the CMS login"
  type        = string
  sensitive   = true
}

variable "agent_api_key" {
  description = "Key for the AI agent MCP server (/api/mcp). Empty disables it."
  type        = string
  sensitive   = true
  default     = ""
}

variable "telegram_bot_token" {
  description = "Token of the task board Telegram bot (task notifications)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "telegram_posts_bot_token" {
  description = "Token of the Telegram bot that sends scheduled posts. Empty disables Telegram posts."
  type        = string
  sensitive   = true
  default     = ""
}

variable "telegram_posts_webhook_secret" {
  description = "Secret Telegram sends to the posts bot webhook (/api/telegram/posts-webhook)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "discord_bot_token" {
  description = "Token of the Discord bot that sends scheduled posts. Empty disables Discord posts."
  type        = string
  sensitive   = true
  default     = ""
}

variable "instagram_user_id" {
  description = "Instagram account id for scheduled posts. Empty disables Instagram posts."
  type        = string
  sensitive   = true
  default     = ""
}

variable "instagram_access_token" {
  description = "First long-lived Instagram token; renewed tokens are stored in the database"
  type        = string
  sensitive   = true
  default     = ""
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
