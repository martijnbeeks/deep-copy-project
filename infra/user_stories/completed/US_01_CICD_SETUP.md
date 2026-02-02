# Story US_01 — Setup GitHub Actions for AWS CDK Deployment

**Status:** ✅ COMPLETED
**Role:** DevOps Engineer

### Context
Currently, deployments are performed manually from a local machine using `cdk deploy`. This is error-prone and requires local credentials. We want to automate this process so that merging code to the `main` branch triggers a deployment. The user also wants to receive email notifications on failure.

### Goal
Implement a GitHub Actions workflow that automatically deploys the CDK stack to AWS (eu-west-1) whenever changes are pushed to `main`. The system should use AWS OIDC (OpenID Connect) for secure, keyless authentication.

### Dependency
None.

### Current Implementation
- No `.github/workflows` directory exists.
- Deployment is manual via `commands.txt` instructions.
- CDK code is in `cdk/lib/deep-copy-stack.ts`.

### Desired Implementation
- **Infrastructure (CDK):**
    - Add an IAM OIDC Identity Provider for GitHub Actions (if not already present).
    - Add an IAM Role (`GitHubDeployRole`) trusted by the `martijnbeeks/deep-copy-infra` repository.
    - Permissions: The role should have sufficient permissions to deploy the stack (AdministratorAccess or specific CDK permissions).
- **CI/CD (GitHub Actions):**
    - Create `.github/workflows/deploy.yml`.
    - Steps:
        1. Checkout code.
        2. Setup Node.js.
        3. Install dependencies (`cdk` folder).
        4. Configure AWS Credentials using `aws-actions/configure-aws-credentials` and the OIDC role.
        5. Run `npx cdk deploy --require-approval never`.
- **Notifications:**
    - Rely on GitHub's native "Workflow failed" email notifications (default behavior for repo owners).

### Execution Phases

#### Phase 1: Implementation (Code Written)
1.  **Update CDK Stack**: Edit `cdk/lib/deep-copy-stack.ts` to include:
    - `iam.OpenIdConnectProvider` (for `token.actions.githubusercontent.com`).
    - `iam.Role` with `WebIdentityPrincipal`.
    - Output the Role ARN so we can use it in the GitHub workflow.
2.  **Create Workflow**: Create `.github/workflows/deploy.yml` configured to use the Role ARN.

#### Phase 2: Deployment & Verification (Manual Step Required)
1.  **Manual Deploy**: The user **must** run `cdk deploy` locally one last time to provision the IAM Role and OIDC Provider.
2.  **Verify**: Push a change (or the workflow file itself) to `main`.
3.  **Check**: Confirm the GitHub Action runs successfully.
4.  **Failure Test (Optional)**: Intentionally break the build to verify GitHub sends an email.

### Task
1.  [ ] Modify `cdk/lib/deep-copy-stack.ts` to add OIDC Provider and Deploy Role.
2.  [ ] Create `.github/workflows/deploy.yml` with the correct AWS Region (`eu-west-1`) and Role ARN construction.
3.  [ ] Instruct user to run `cdk deploy` locally.

### Constraints
- Repo: `martijnbeeks/deep-copy-infra`
- Region: `eu-west-1`
- Account: `613663743323`

### Acceptance Criteria
- [ ] `cdk deploy` works locally to create the IAM resources.
- [ ] GitHub Action `deploy.yml` exists.
- [ ] GitHub Action succeeds on push to `main` (after initial manual deploy).

