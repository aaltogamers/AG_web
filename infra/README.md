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

### Main stack: `terraform.tfvars` (variables and where to get them)

Before running the main stack (e.g. `tofu apply` from `infra/`), copy the example file and set your values:

```powershell
cd infra
copy terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

| Variable                      | What it is                                               | Where to get it                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **subscription_id**           | Azure subscription ID                                    | Same as **ARM_SUBSCRIPTION_ID**: run `az account show --query id -o tsv` or in **Azure Portal → Subscriptions** copy the Subscription ID.                                                                                                                                                                                   |
| **postgresql_admin_password** | Admin password for the PostgreSQL Flexible Server        | You choose it. Must satisfy [Azure PostgreSQL password rules](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-compute-storage#password-requirements). Use a strong password; it is stored in OpenTofu state and used by the app via `DATABASE_URL`.                                             |
| **admin_password**            | Password gating the admin-only analytics API (`/api/analytics/stats`) and the Statistics tab in the admin panel | You choose it. Any strong secret. Exposed to the app as the `ADMIN_PASSWORD` environment variable. |
| **app_settings**              | Optional extra environment variables for the Next.js app | Key-value map. See **RCON** and **GitHub App (CMS)** below for the main optional variables. |

**Note:** Do not commit `terraform.tfvars` (it contains secrets). It is typically listed in `.gitignore`.

#### RCON (Minecraft / game server)

If the app talks to a game server via RCON, set in `app_settings`:

- **RCON_IP** — server hostname or IP
- **RCON_PASSWORD** — RCON password (from your server config)
- **RCON_PORT** — e.g. `25575` (from your server config)

#### GitHub App credentials (APP_ID, PRIVATE_KEY, INSTALLATION_ID)

Used by the **CMS** (Decap/Netlify-style editor at `/admin`). After editors sign in with Firebase, the app uses a GitHub App to issue an installation access token so the CMS can read/write content in this repo via the GitHub API. Set these in `app_settings` only if you use the CMS.

| Variable | What it is | Where to get it |
|----------|------------|-----------------|
| **APP_ID** | GitHub App’s numeric Application ID | **GitHub** → **Settings** (of the user or org that owns the app) → **Developer settings** → **GitHub Apps** → your app → on the app’s **General** page, the **App ID** is shown near the top. For an org-owned app: **&lt;org&gt; → Settings → Developer settings → GitHub Apps** → your app. |
| **PRIVATE_KEY** | The app’s private key, **base64-encoded** | Same app page → **Private keys** → **Generate a private key** → download the `.pem` file. The app expects the key in env as **base64**: encode the entire PEM contents (including `-----BEGIN/END-----` and newlines). Example (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\your-app.pem"))`. Use the single-line base64 string as the value for `PRIVATE_KEY`. |
| **INSTALLATION_ID** | ID of the **installation** of that app on the repo/org | After installing the app on the repo or org: **Organization** → **Third-party access** (or **GitHub Apps**) → **Configure** next to your app → the URL is `https://github.com/organizations/<org>/settings/installations/<INSTALLATION_ID>`. The number at the end is the Installation ID. For a **user** install: **GitHub → Settings → Applications → Installed GitHub Apps** → Configure → URL has the ID. Or via API (with a valid token): `GET https://api.github.com/repos/<owner>/<repo>/installation` — the JSON response has `"id": <INSTALLATION_ID>`. |

All three are required together for the CMS backend (`/api/auth`) to issue tokens to the editor.

---

### GitHub Actions secrets

These workflows use secrets: **Infrastructure (OpenTofu)** (`infra.yml`) and **Build docker image and deploy to Azure App Service** (`build_and_deploy.yml`). Configure them in the repo under **Settings → Secrets and variables → Actions**.

| Secret                        | Used by                 | What it is                                                | How to get it                                                                                                                                                                                                                                           |
| ----------------------------- | ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ARM_CLIENT_ID**             | infra, build_and_deploy | Azure service principal **Application (client) ID**       | From the service principal (see below). In Azure Portal: **Microsoft Entra ID → App registrations** → your app → **Application (client) ID**.                                                                                                           |
| **ARM_CLIENT_SECRET**         | infra, build_and_deploy | Service principal **client secret**                       | When creating the SP (see below), the `password` in the JSON output. In Portal: **App registrations** → your app → **Certificates & secrets** → create a new client secret.                                                                             |
| **ARM_SUBSCRIPTION_ID**       | infra, build_and_deploy | Azure **subscription ID**                                 | `az account show --query id -o tsv` or **Azure Portal → Subscriptions** → copy Subscription ID.                                                                                                                                                         |
| **ARM_TENANT_ID**             | infra, build_and_deploy | Azure AD **tenant ID** (directory ID)                     | From the service principal JSON (see below) as `tenant`. In Portal: **Microsoft Entra ID → Overview** → Tenant ID.                                                                                                                                      |
| **POSTGRESQL_ADMIN_PASSWORD** | infra                   | Admin password for the PostgreSQL Flexible Server         | You choose it. Must satisfy [Azure PostgreSQL password rules](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-compute-storage#password-requirements). Stored in OpenTofu state and used by the web app via `DATABASE_URL`.  |
| **ADMIN_PASSWORD**            | infra                   | Password for the admin-only analytics API                 | You choose it. Any strong secret. Exposed to the web app as the `ADMIN_PASSWORD` environment variable, and required by the Statistics tab in the admin panel.                                                                                           |
| **REGISTRY_LOGIN_SERVER**     | build_and_deploy        | Azure Container Registry **login server** (full hostname) | After infra is applied: ACR name is the project prefix with `acr` and no hyphens (e.g. `ag-web` → `agwebacr`). Login server: **`<acr-name>.azurecr.io`** (e.g. `agwebacr.azurecr.io`). Or: `az acr list -g ag-web-rg --query "[0].loginServer" -o tsv`. |
| **WEBAPP_NAME**               | build_and_deploy        | Name of the **Web App** (App Service)                     | From OpenTofu: **`<project_name>-app-<environment>`** (default: `ag-web-app-prod`). Or: `az webapp list -g ag-web-rg --query "[0].name" -o tsv`.                                                                                                        |
| **RESOURCE_GROUP**            | build_and_deploy        | **Resource group** that contains the web app and ACR      | From OpenTofu: **`<project_name>-rg`** (default: `ag-web-rg`).                                                                                                                                                                                          |

#### Create the service principal (for ARM\_\* secrets)

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

1. Add **ARM_CLIENT_ID**, **ARM_CLIENT_SECRET**, **ARM_SUBSCRIPTION_ID**, **ARM_TENANT_ID**, **POSTGRESQL_ADMIN_PASSWORD**, and **ADMIN_PASSWORD** so the **infra** workflow can run.
2. Run the infra workflow (or apply OpenTofu locally) so the ACR and Web App exist.
3. Add **REGISTRY_LOGIN_SERVER**, **WEBAPP_NAME**, and **RESOURCE_GROUP** so **build_and_deploy** can push images and restart the app.
