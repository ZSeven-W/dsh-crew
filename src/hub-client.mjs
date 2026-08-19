// Client for the in-host workers-hub jobs API. When a DSH web instance with the
// dsh-crew bundle is running, jobs run inside it (sessions visible in the
// Web UI); otherwise the MCP server falls back to standalone runtimes.

import { readGlobalConfig } from './install/install.mjs';

const BASE = (process.env.DSH_CREW_HUB ?? readGlobalConfig().hub_url).replace(/\/$/, '');
const API = `${BASE}/_dsh/dsh-crew`;

let lastProbe = { at: 0, ok: false };

export async function hubAvailable() {
  if (Date.now() - lastProbe.at < 10_000) return lastProbe.ok;
  try {
    const res = await fetch(`${API}/ping`, { signal: AbortSignal.timeout(800) });
    const body = await res.json();
    lastProbe = { at: Date.now(), ok: res.ok && body?.service === 'dsh-crew-hub' };
  } catch {
    lastProbe = { at: Date.now(), ok: false };
  }
  return lastProbe.ok;
}

async function call(path, init) {
  const res = await fetch(`${API}${path}`, init);
  const body = await res.json();
  if (!res.ok || body.ok === false) throw new Error(body.error ?? `hub request failed (${res.status})`);
  return body;
}

/**
 * One long-poll may never outlive the runtime's request timeouts. Node's
 * fetch (undici) aborts a request whose response headers have not arrived
 * within 300 s, and the hub sends nothing until the job settles — so a
 * `?wait=2700` poll dies at five minutes with a bare "fetch failed" while the
 * job keeps running server-side. Measured on 2026-08-19: dispatches of 2 s and
 * 4 m 03 s returned normally; 14 m, 22 m, 35 m and 41 m all failed that way.
 * Slicing the wait keeps every individual request short enough that no
 * runtime, proxy or load balancer can cut it.
 */
const MAX_POLL_SLICE_SECONDS = 60;

export const hub = {
  spawn: (spec) => call('/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(spec),
  }).then((b) => b.job),
  list: () => call('/jobs').then((b) => b.jobs),
  // `waitSeconds = 0` keeps the plain "read it now" semantics; anything longer
  // is served by repeated short waits until the job settles or the budget ends.
  get: async (id, waitSeconds = 0) => {
    const deadline = Date.now() + waitSeconds * 1000;
    for (;;) {
      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      const slice = waitSeconds <= 0 ? 0 : Math.max(1, Math.min(MAX_POLL_SLICE_SECONDS, remaining));
      const job = await call(`/jobs/${id}?wait=${slice}`).then((b) => b.job);
      if (job.status !== 'running' || waitSeconds <= 0 || Date.now() >= deadline) return job;
    }
  },
  cancel: (id) => call(`/jobs/${id}/cancel`, { method: 'POST' }).then((b) => b.job),
};
