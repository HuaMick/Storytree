# Cost backstop (ADR-0015 §5). A Cloud Scheduler job forces storytree-pg to
# STOPPED hourly, so an instance left running — by a crash, a forgotten manual
# start, or a future orchestrator bug — cannot quietly bleep ~$25/mo.
#
# Deliberately BLUNT: it stops unconditionally, with no idle-awareness. That is
# correct as a safety net but means it will also stop an instance you started
# manually within the hour (until the orchestrator's own wake-on-demand +
# idle-stop lands and this becomes a pure backstop). Start work with `db:up`
# (root package.json); it re-stops within ≤1h of that start regardless.
#
# Validated 2026-06-06: against a RUNNING instance the job succeeds and stops it
# (the sql-stopper SA issues the UPDATE). Against an ALREADY-STOPPED instance the
# Cloud SQL API returns a benign 400 ("properties other than activation policy
# ... when stopped") and the job logs a failed execution — harmless (it's a
# no-op) but expect failed runs in the job history during idle periods. An
# idle-aware version (a tiny Cloud Function: stop only if RUNNABLE) would remove
# that noise; deferred as disproportionate for a single-operator backstop.

resource "google_project_service" "scheduler" {
  service            = "cloudscheduler.googleapis.com"
  disable_on_destroy = false
}

# Dedicated least-privilege identity for the scheduler job. roles/cloudsql.editor
# grants cloudsql.instances.update (start/stop) but NOT delete (that's admin).
resource "google_service_account" "sql_stopper" {
  account_id   = "sql-stopper"
  display_name = "Cloud Scheduler — stops storytree-pg (cost backstop)"
}

resource "google_project_iam_member" "sql_stopper_editor" {
  project = var.project_id
  role    = "roles/cloudsql.editor"
  member  = "serviceAccount:${google_service_account.sql_stopper.email}"
}

resource "google_cloud_scheduler_job" "stop_db" {
  name        = "storytree-pg-stop-backstop"
  description = "Forces storytree-pg to STOPPED hourly (cost safety net)"
  region      = var.region
  schedule    = "0 * * * *" # top of every hour
  time_zone   = "Australia/Sydney"

  http_target {
    http_method = "PATCH"
    uri         = "https://sqladmin.googleapis.com/sql/v1beta4/projects/${var.project_id}/instances/${google_sql_database_instance.storytree.name}"
    headers     = { "Content-Type" = "application/json" }
    # Body is base64-encoded per the provider contract.
    body = base64encode(jsonencode({ settings = { activationPolicy = "NEVER" } }))
    oauth_token {
      # OAuth (not OIDC) — the target is a *.googleapis.com Google API.
      service_account_email = google_service_account.sql_stopper.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }

  retry_config {
    retry_count = 3
  }

  depends_on = [google_project_service.scheduler]
}
