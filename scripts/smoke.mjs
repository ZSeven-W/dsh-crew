// Smoke test: dispatch one cheap flash job to verify the installation.
// Probes the hub first (if DSH web instance is running); falls back to
// standalone mode. Always exercises the path the user actually installed.

import { hubAvailable, hub } from '../src/hub-client.mjs';
import { readGlobalConfig } from '../src/install/install.mjs';

try {
  const hubUrl = process.env.DSH_CREW_HUB ?? readGlobalConfig().hub_url;
  const isHubUp = await hubAvailable();

  if (isHubUp) {
    // Dispatch through the hub
    console.log(`hub at ${hubUrl} is reachable, using hub mode`);
    const job = await hub.spawn({
      task: 'Reply with exactly the word: ok',
      tier: 'flash',
      effort: 'off',
      cwd: process.cwd(),
      source: 'smoke',
    });
    console.log(`spawned ${job.id} ...`);
    const result = await hub.get(job.id, 120);
    if (result.status === 'done') {
      console.log(`worker replied: ${result.result}`);
      console.log('smoke test passed — configuration OK');
    } else if (result.status === 'running') {
      // The wait returns early once the job settles, so this is a real timeout.
      console.error(`smoke test failed: job ${job.id} still running after 120s`);
      console.error('Hint: it is still live in the DSH instance — check its session for what is stuck');
      process.exit(1);
    } else {
      console.error(`smoke test failed: status=${result.status} error=${result.error}`);
      console.error('Hint: check the DSH instance logs and verify DeepSeek provider credentials');
      process.exit(1);
    }
  } else {
    // Fall back to standalone mode
    console.log(`no hub at ${hubUrl}, falling back to standalone mode`);

    try {
      const { startJob, waitJob, jobView } = await import('../src/jobs.mjs');
      const job = await startJob({
        task: 'Reply with exactly the word: ok',
        tier: 'flash',
        effort: 'off',
        cwd: process.cwd(),
      });
      console.log(`spawned ${job.id} (deepseek-v4-flash) ...`);
      await waitJob(job.id, 120_000);
      const v = jobView(job, { withResult: true });
      if (v.status === 'done') {
        console.log(`worker replied: ${v.result}`);
        console.log('smoke test passed — configuration OK');
      } else {
        console.error(`smoke test failed: status=${v.status} error=${v.error}`);
        console.error('Hint: DEEPSEEK_API_KEY missing or invalid in env or ~/.config/dsh-crew/.env, or runtime not installed');
        process.exit(1);
      }
    } catch (err) {
      // The standalone runtime lives in this package's own node_modules; the
      // @deepseek-ai/* packages are peerDependencies, so an installed copy of
      // the plugin has none of them and the dynamic import above is what tells
      // us so. Anything else here is a dispatch failure, not a missing runtime.
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
        console.error('smoke test failed: the standalone runtime is not installed in this copy');
        console.error('Hint: run "pnpm install" from a source checkout, or start a DSH instance to use hub mode');
      } else {
        console.error(`smoke test failed: ${err.message}`);
        console.error('Hint: DEEPSEEK_API_KEY missing or invalid in env or ~/.config/dsh-crew/.env');
      }
      process.exit(1);
    }
  }
} catch (err) {
  console.error(`smoke test failed: ${err.message}`);
  process.exit(1);
}
