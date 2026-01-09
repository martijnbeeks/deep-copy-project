# US_14: Developer IAM User

**Status:** ✅ COMPLETED
**Created:** 2026-01-09
**Complexity:** S

---

## Problem Statement
The user requires a new IAM user specifically for a developer. This user must have access to the AWS Console, and requires read permissions for S3 and Secrets Manager. Crucially, this user must NOT have permissions to delete the CloudFormation stack or modify any resources (read-only/audit access).

## Success Criteria
- [ ] An IAM User `DeveloperUser` is created in the CDK stack.
- [ ] The user has `ReadOnlyAccess` AWS Managed Policy attached (providing Console, S3, Secrets Manager read access).
- [ ] The user effectively cannot delete stacks or modify resources (ensured by ReadOnly nature).
- [ ] Output the IAM User Name in CloudFormation Outputs.

---

## Research Summary
### Files Identified
| File | Lines | Purpose | Relevance |
|------|-------|---------|-----------|
| `cdk/lib/deep-copy-stack.ts` | 1-647 | Main Stack Definition | PRIMARY - Add IAM User here |

### Code Flow
Current stack defines resources (S3, DynamoDB, Lambdas) but no human IAM users.
We need to add a `new iam.User(...)` construct.

### Security & Permissions
- **ReadOnlyAccess**: This AWS Managed Policy provides read-only access to ensuring no resource mutation.
- **Console Access**: Requires a Login Profile. CDK `iam.User` supports a `password` property or `passwordResetRequired`. However, hardcoding passwords is bad.
  - *Strategy*: We will create the user with `passwordResetRequired: true` if possible, or simply create the user and allow the administrator (The User) to set the initial password via AWS Console/CLI after deployment. Storing passwords in CDK code is insecure.
  - *Correction*: `iam.User` in CDK v2 allows `password` which is a `SecretValue`. We can generate a random password or ask the user.
  - *Better Approach*: Create the user. The Root user (current user) can set the password manually or we can use a SecretsManager secret if absolutely needed. For simplicity and security, we'll create the user and output the name; the user can then `aws iam create-login-profile` manually or via console.
  - *Refined Plan*: We will just create the user and permissions. The prompt asks for a plan *to make* this account.

### Affected Files
| File | Change Type | Lines Affected | Risk |
|------|-------------|----------------|------|
| `cdk/lib/deep-copy-stack.ts` | MODIFY | ~640 (end of file) | LOW - Adding new independent resource |

---

## Implementation Plan

### Pre-Implementation Checklist
- [ ] Branch created: `feature/US_14_developer_iam_user`
- [ ] Verify `aws-cdk-lib/aws-iam` usage for User.

### Tasks

#### Task 1: Add Developer IAM User
**File:** `cdk/lib/deep-copy-stack.ts`
**Description:** Add an `iam.User` resource with `ReadOnlyAccess`.

**Current Code:**
```typescript
// End of file
    new CfnOutput(this, 'CognitoIssuer', { value: issuerUrl });
  }
}
```

**Target Code:**
```typescript
    // ... existing outputs

    // Developer Read-Only User
    const developerUser = new iam.User(this, 'DeveloperUser', {
      userName: 'deep-copy-developer',
    });

    developerUser.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
    // Explicitly allow Console access if needed, but ReadOnlyAccess usually suffices for permissions.
    // For actual Login Profile (password), it's best managed outside CDK or via Secret, 
    // but the requirement is just "new account to login". 
    // We will ensure the user exists and has permissions.

    new CfnOutput(this, 'DeveloperUserName', { value: developerUser.userName });
  }
}
```
*Note*: The user will need to set the password manually using `aws iam create-login-profile --user-name deep-copy-developer --password <password> --password-reset-required`. This is standard security practice.

**Validation:**
```bash
npx cdk synth
```

### Post-Implementation Checklist
- [ ] `npx cdk synth` passes.
- [ ] Verify generated template contains `AWS::IAM::User` and `AWS::IAM::ManagedPolicy`.

---

## Testing Strategy

### Existing Tests to Verify
- `npx cdk synth` (infrastructure code validation)

### New Tests Required
- None (Infrastructure change, validated by CloudFormation)

### Manual Testing Steps
1. Deploy the stack: `npx cdk deploy`
2. Sign in to AWS Console with root/admin.
3. Verify user `deep-copy-developer` exists in IAM.
4. Verify `ReadOnlyAccess` policy is attached.
5. Set a password for the user manually: `aws iam create-login-profile --user-name deep-copy-developer --password <TemporaryPassword> --password-reset-required`
6. Try to login as `deep-copy-developer`.
7. Verify access to S3 buckets (List/Read).
8. Verify access to Secrets Manager (GetSecretValue).
9. **Negative Test**: Try to delete a Lambda function or S3 bucket -> Should Fail.

---

## Rollback Plan
If issues arise:
1. Revert changes in `cdk/lib/deep-copy-stack.ts`.
2. Redeploy: `npx cdk deploy`.
3. (Optional) Manually delete the IAM User if CloudFormation fails to remove it cleanly (unlikely).

---

## Out of Scope
- [ ] Automating password creation/distribution (Security risk to store in cleartext/Git).
- [ ] Creating separate groups (Direct attachment is sufficient for single user).
- [ ] Fine-grained policy restrictions beyond `ReadOnlyAccess` (User asked for general read, ensuring no delete).

