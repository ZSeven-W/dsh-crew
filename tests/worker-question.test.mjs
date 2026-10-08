import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installWorkerQuestionHandoff } from '../src/worker-question.mjs';
test('an unresolved question stops the runtime and remains visible to the caller', async () => {
  let handler, disposed = 0, published = 0;
  const ctx = { on(name, h, prepend) { assert.equal(name, 'user-questions/request'); assert.equal(prepend, true); handler = h; } };
  const job = { status: 'running', handle: { dispose() { disposed++; } } };
  installWorkerQuestionHandoff(ctx, job, () => published++);
  await assert.rejects(handler({ questions: [{ id: 'overwrite', question: 'Overwrite existing file?', options: [{ label: 'Yes' }, { label: 'No' }] }] }), /no option was selected automatically/);
  assert.equal(disposed, 1); assert.equal(published, 1); assert.equal(job.status, 'needs_input');
  assert.equal(job.questions[0].question, 'Overwrite existing file?');
  assert.equal(JSON.parse(job.result).needs_input, true);
});
