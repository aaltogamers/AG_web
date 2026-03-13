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

