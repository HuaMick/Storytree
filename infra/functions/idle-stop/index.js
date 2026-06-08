// Idle-aware auto-stop for Cloud SQL `storytree-pg` (ADR-0015 §5).
//
// Cloud Scheduler pings this HTTP function every ~15 min. It stops the instance
// ONLY after IDLE_MINUTES with zero database connections — so it never stops an
// instance you're actively using. As long as the Cloud SQL Auth Proxy / a live
// session holds a connection, the idle timer effectively "counts from the last
// request" and the instance stays up. The blunt DAILY cron in cost-backstop.tf
// is the hard floor that catches the case where this checker is itself broken.
//
// Fail-safe stance: on ANY error, or when metric data is missing, we DO NOT stop
// (killing a live session because the checker hiccuped is the failure mode the
// owner hit). We log loudly so a broken checker is visible, and the daily floor
// still caps a genuinely-forgotten instance.

import { GoogleAuth } from 'google-auth-library';
import * as ff from '@google-cloud/functions-framework';

const PROJECT = process.env.PROJECT_ID;
const INSTANCE = process.env.INSTANCE_NAME;
const IDLE_MINUTES = Math.max(1, Number(process.env.IDLE_MINUTES ?? '60'));

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

async function gapi(client, url, opts = {}) {
  const res = await client.request({ url, ...opts });
  return res.data;
}

/**
 * Peak DB connections over the last `IDLE_MINUTES`, plus whether the metric
 * pipeline actually delivered any samples. No samples => "unknown", not "idle":
 * a freshly-started instance has no metric data yet, and we must not stop it.
 */
async function peakConnections(client) {
  const end = new Date();
  const start = new Date(end.getTime() - IDLE_MINUTES * 60_000);
  const filter =
    'metric.type="cloudsql.googleapis.com/database/network/connections" ' +
    `AND resource.labels.database_id="${PROJECT}:${INSTANCE}"`;
  const params = new URLSearchParams({
    filter,
    'interval.startTime': start.toISOString(),
    'interval.endTime': end.toISOString(),
    'aggregation.alignmentPeriod': `${IDLE_MINUTES * 60}s`,
    'aggregation.perSeriesAligner': 'ALIGN_MAX',
    'aggregation.crossSeriesReducer': 'REDUCE_MAX',
  });
  const data = await gapi(
    client,
    `https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries?${params.toString()}`,
  );
  let sawData = false;
  let max = 0;
  for (const series of data.timeSeries ?? []) {
    for (const pt of series.points ?? []) {
      sawData = true;
      const v = Number(pt.value?.int64Value ?? pt.value?.doubleValue ?? 0);
      if (v > max) max = v;
    }
  }
  return { sawData, max };
}

export async function idleStop(req, res) {
  const tag = `[idle-stop ${INSTANCE}]`;
  try {
    if (!PROJECT || !INSTANCE) {
      throw new Error('PROJECT_ID and INSTANCE_NAME env vars are required');
    }
    const client = await auth.getClient();

    // 1. Current instance state — if it's not actually up, there's nothing to do
    //    (and we avoid the benign "can't patch a stopped instance" 400 noise).
    const inst = await gapi(
      client,
      `https://sqladmin.googleapis.com/sql/v1beta4/projects/${PROJECT}/instances/${INSTANCE}`,
    );
    const state = inst.state; // RUNNABLE | STOPPED | PENDING_CREATE | ...
    const policy = inst.settings?.activationPolicy; // ALWAYS | NEVER
    if (state !== 'RUNNABLE' || policy === 'NEVER') {
      console.log(`${tag} not running (state=${state}, policy=${policy}); nothing to do.`);
      res.status(200).json({ action: 'noop', reason: 'not-running', state, policy });
      return;
    }

    // 2. Activity over the idle window.
    const { sawData, max } = await peakConnections(client);
    if (!sawData) {
      console.warn(
        `${tag} no connection-metric samples for the last ${IDLE_MINUTES} min ` +
          '(instance may be freshly started or metrics delayed) — NOT stopping this cycle.',
      );
      res.status(200).json({ action: 'noop', reason: 'no-metric-data', idleMinutes: IDLE_MINUTES });
      return;
    }
    if (max > 0) {
      console.log(
        `${tag} ACTIVE — ${max} peak connection(s) in the last ${IDLE_MINUTES} min; leaving instance UP.`,
      );
      res.status(200).json({ action: 'noop', reason: 'active', peakConnections: max, idleMinutes: IDLE_MINUTES });
      return;
    }

    // 3. Idle for the whole window → stop.
    console.warn(`${tag} IDLE for ${IDLE_MINUTES} min (0 connections) — STOPPING instance.`);
    await gapi(
      client,
      `https://sqladmin.googleapis.com/sql/v1beta4/projects/${PROJECT}/instances/${INSTANCE}`,
      { method: 'PATCH', data: { settings: { activationPolicy: 'NEVER' } } },
    );
    console.warn(`${tag} stop requested (activationPolicy=NEVER).`);
    res.status(200).json({ action: 'stopped', idleMinutes: IDLE_MINUTES });
  } catch (err) {
    // Fail LOUD, fail SAFE: never stop on error — the daily hard backstop is the floor.
    console.error(
      `${tag} ERROR — leaving instance untouched; daily backstop remains the cost floor:`,
      err?.stack || err,
    );
    res.status(500).json({ action: 'error', error: String(err?.message || err) });
  }
}

ff.http('idleStop', idleStop);
