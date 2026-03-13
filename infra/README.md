## Infra

This folder contains the Opentofu/Terraform configuration for the AG Web Azure infrastructure.

### First-time setup (bootstrap the remote state backend)

The main stack uses an Azure Storage Account backend for state (`ag-web-rg`, `agwebtfstate`, `tfstate`). Because the backend is initialized before any resources in `main.tf` are created, you must create that resource group and storage account once using the **bootstrap** stack.

1. **From the repo root**, go to the bootstrap config and create a tfvars file:

   ```powershell
   cd infra\bootstrap
   copy terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars and set subscription_id to your Azure subscription ID.
   ```

2. **Initialize and apply the bootstrap stack** (uses local state only):

   ```powershell
   tofu init
   tofu apply
   ```

3. **Return to the main infra** and run the main stack:

   ```powershell
   cd ..
   tofu init
   tofu apply
   ```

The bootstrap stack in `infra/bootstrap/` creates only:

- Resource group: `ag-web-rg`
- Storage account: `agwebtfstate`
- Container: `tfstate`

After that, the main stack can use the remote backend and create the rest of the resources.

---

### GitHub Actions secrets

These workflows use secrets: **Infrastructure (OpenTofu)** (`infra.yml`) and **Build docker image and deploy to Azure App Service** (`build_and_deploy.yml`). Configure them in the repo under **Settings → Secrets and variables → Actions**.

| Secret | Used by | What it is | How to get it |
|--------|---------|------------|----------------|
| **ARM_CLIENT_ID** | infra, build_and_deploy | Azure service principal **Application (client) ID** | From the service principal (see below). In Azure Portal: **Microsoft Entra ID → App registrations** → your app → **Application (client) ID**. |
| **ARM_CLIENT_SECRET** | infra, build_and_deploy | Service principal **client secret** | When creating the SP (see below), the `password` in the JSON output. In Portal: **App registrations** → your app → **Certificates & secrets** → create a new client secret. |
| **ARM_SUBSCRIPTION_ID** | infra, build_and_deploy | Azure **subscription ID** | `az account show --query id -o tsv` or **Azure Portal → Subscriptions** → copy Subscription ID. |
| **ARM_TENANT_ID** | infra, build_and_deploy | Azure AD **tenant ID** (directory ID) | From the service principal JSON (see below) as `tenant`. In Portal: **Microsoft Entra ID → Overview** → Tenant ID. |
| **POSTGRESQL_ADMIN_PASSWORD** | infra | Admin password for the PostgreSQL Flexible Server | You choose it. Must satisfy [Azure PostgreSQL password rules](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-compute-storage#password-requirements). Stored in OpenTofu state and used by the web app via `DATABASE_URL`. |
| **REGISTRY_LOGIN_SERVER** | build_and_deploy | Azure Container Registry **login server** (full hostname) | After infra is applied: ACR name is the project prefix with `acr` and no hyphens (e.g. `ag-web` → `agwebacr`). Login server: **`<acr-name>.azurecr.io`** (e.g. `agwebacr.azurecr.io`). Or: `az acr list -g ag-web-rg --query "[0].loginServer" -o tsv`. |
| **WEBAPP_NAME** | build_and_deploy | Name of the **Web App** (App Service) | From OpenTofu: **`<project_name>-app-<environment>`** (default: `ag-web-app-prod`). Or: `az webapp list -g ag-web-rg --query "[0].name" -o tsv`. |
| **RESOURCE_GROUP** | build_and_deploy | **Resource group** that contains the web app and ACR | From OpenTofu: **`<project_name>-rg`** (default: `ag-web-rg`). |

#### Create the service principal (for ARM_* secrets)

Use one service principal for both workflows. Run in [Azure Cloud Shell](https://shell.azure.com) or locally after `az login`:

```bash
# Replace <SUBSCRIPTION_ID> with your subscription ID
az ad sp create-for-rbac \
  --name "ag-web-github-actions" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID> \
  --sdk-auth
```

The JSON output gives you:

- **clientId** → `ARM_CLIENT_ID`
- **clientSecret** → `ARM_CLIENT_SECRET`
- **subscriptionId** → `ARM_SUBSCRIPTION_ID`
- **tenantId** → `ARM_TENANT_ID`

For a narrower scope (e.g. only the resource group), use:

```bash
az ad sp create-for-rbac \
  --name "ag-web-github-actions" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/ag-web-rg
```

#### Order of setup

1. Add **ARM_CLIENT_ID**, **ARM_CLIENT_SECRET**, **ARM_SUBSCRIPTION_ID**, **ARM_TENANT_ID**, and **POSTGRESQL_ADMIN_PASSWORD** so the **infra** workflow can run.
2. Run the infra workflow (or apply OpenTofu locally) so the ACR and Web App exist.
3. Add **REGISTRY_LOGIN_SERVER**, **WEBAPP_NAME**, and **RESOURCE_GROUP** so **build_and_deploy** can push images and restart the app.

