# infra — storytree runtime store (Terraform)

Provisions the one Cloud SQL Postgres that holds the runtime store (events, claims,
IDs, node rollup, DBOS durable state, comments) per [ADR-0015](../docs/decisions/0015-gcp-hosting-cloud-sql-event-store.md).
The corpus + guidance stay in git, not here.

**No service-account keys.** Auth is keyless: user ADC for Terraform, IAM database
auth for the app. See ADR-0015 §3.

## One-time auth (keyless)

```bash
gcloud config set project storytree-498613
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project storytree-498613
gcloud services enable sqladmin.googleapis.com
```

## Provision

```bash
cp terraform.tfvars.example terraform.tfvars   # set operator_email
terraform init
terraform plan
terraform apply
terraform output instance_connection_name      # the non-secret string sessions need
```

## Cost posture — stop when idle (ADR-0015 §5)

Stop/start is out-of-band (not in Terraform, so it isn't treated as drift):

```bash
gcloud sql instances patch storytree-pg --activation-policy NEVER    # stop  → ~$3-5/mo (storage only)
gcloud sql instances patch storytree-pg --activation-policy ALWAYS   # start → ~1-2 min cold start
```

Scriptable via Cloud Scheduler later. Tear the whole thing down with `terraform destroy`.

## Connect locally (after apply)

```bash
# Auth Proxy as a sidecar; app then talks to localhost:5432 with IAM auth.
cloud-sql-proxy --auto-iam-authn $(terraform output -raw instance_connection_name)
```
