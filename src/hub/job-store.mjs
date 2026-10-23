// Preserve Crew-owned session references and results across a component reload.
// Separate host processes never write the same file; DSH owns session storage.
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export function createHubJobStore(directory, logger, processId = process.pid) {
  const folder = join(directory, 'hub-jobs');
  const path = join(folder, `${processId}.json`);
  return {
    load() {
      try {
        const value = JSON.parse(readFileSync(path, 'utf8'));
        if (!Array.isArray(value)) throw new Error('invalid Crew job records');
        return value.filter(job => typeof job.id === 'string' && job.id.startsWith('hub-')
          && typeof job.sessionId === 'string' && typeof job.cwd === 'string');
      } catch (error) {
        if (error.code !== 'ENOENT') logger?.warn?.(`dsh-crew: cannot read job records: ${error.message}`);
        return [];
      }
    },
    save(jobs) {
      try {
        mkdirSync(folder, { recursive: true });
        writeFileSync(`${path}.pending`, JSON.stringify(jobs), 'utf8');
        renameSync(`${path}.pending`, path);
      } catch (error) { logger?.warn?.(`dsh-crew: cannot save job records: ${error.message}`); }
    },
  };
}
