# US_01 Implementation Summary - Setup GitHub Actions Deployment

## What Changed
- **CDK Stack (`cdk/lib/deep-copy-stack.ts`)**:
    - Added `iam.OpenIdConnectProvider` for GitHub Actions.
    - Added `iam.Role` named `DeepCopy-GitHubDeployRole` with `AdministratorAccess` (needed for CDK deployments), trusted by the `martijnbeeks/deep-copy-infra` repo.
    - Added `CfnOutput` for the new Role ARN.
- **GitHub Actions (`.github/workflows/deploy.yml`)**:
    - Created a new workflow that triggers on push to `main`.
    - Configured OIDC authentication using `aws-actions/configure-aws-credentials` and the `DeepCopy-GitHubDeployRole`.
    - Runs `npx cdk deploy --all --require-approval never`.

## What Did NOT Change
- The existing Lambda functions, API Gateway, and other infrastructure resources remain unchanged.
- Existing deployment method (`cdk deploy` locally) still works but is now supplemented by CI/CD.

## New Risks / Tech Debt
- **AdministratorAccess**: The GitHub Actions role has full admin access. This is common for CDK deployments but should ideally be scoped down in the future if stricter security is required.
- **Role Name Hardcoding**: The role name `DeepCopy-GitHubDeployRole` is hardcoded in both CDK and the GitHub workflow. Changing it requires updating both places.

## Next Steps
- **Manual Sync**: The user must run `cdk deploy` locally **once** to provision the IAM Role and OIDC Provider before the GitHub Action can succeed.

