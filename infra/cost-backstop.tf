# Cost backstop FLOOR (ADR-0015 §5). A Cloud Scheduler job forces storytree-pg to
# STOPPED once a DAY, so an instance left running — by a crash, a forgotten manual
# start, or a broken idle-checker — cannot quietly bleed ~$25/mo for more than a day.
#
# This is the BLUNT floor BEHIND the idle-aware function (idle-stop.tf), which does
# the real day-to-day stopping: it stops only after a sustained-idle window and so
# never kills a live session. Because the idle function is the primary mechanism,
# this cron was relaxed from hourly (which stopped the owner's instance mid-work) to
# DAILY, run at a quiet hour — its sole job now is to catch the case where the idle
# function is itself broken (then it's the last line of cost defense). It stays
# deliberately unconditional/dumb ON PURPOSE: a smarter floor that shared the idle
# function's code could share its bug. Start work with `db:up` (root package.json).
#
# Validated 2026-06-06: against a RUNNING instance the job succeeds and stops it
# (the sql-stopper SA issues the UPDATE). Against an ALREADY-STOPPED instance the
# Cloud SQL API returns a benign 400 ("properties other than activation policy
# ... when stopped") and the job logs a failed execution — harmless (it's a no-op).
# At a daily cadence that benign failure shows up at most once a day, not hourly.

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
  description = "Forces storytree-pg to STOPPED once daily (hard cost floor behind the idle-aware function)"
  region      = var.region
  schedule    = "30 4 * * *" # 04:30 Australia/Sydney — a quiet hour; daily floor only
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
