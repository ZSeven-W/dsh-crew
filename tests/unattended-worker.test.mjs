// A hub worker must not wait on ask_user_question (#13).
//
// A hub worker is a runtime root in DSH, so the host lets it ask the human,
// and the Web answerer holds the question until someone answers it in that
// session. Nobody watches a worker session, so the tool call blocked until
// the orchestrator gave up. The hub now claims the worker's own requests and
// rejects them. That was checked end to end against DSH 0.1.5 with a
// scripted model: the worker gets the error and finishes, and an ordinary
// session in the same host still shows the question card.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { unattendedQuestion } from '../src/hub/index.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const hub = readFileSync(join(root, 'src/hub/index.mjs'), 'utf8');

test('the rejection is one the host restores as a UserQuestionError', () => {
  // dsh-user-questions restores a rejection only when name, message and
  // code are all strings; anything else loses its code on the way back.
  const error = unattendedQuestion();
  assert.equal(error.name, 'UserQuestionError');
  assert.equal(typeof error.message, 'string');
  assert.equal(typeof error.code, 'string');
  // The model must be told what to do instead, not just that it failed.
  assert.match(error.message, /final message/);
});

test('the worker claims its questions ahead of the Web answerer', () => {
  // On the worker's own agentCtx (so the listener is scoped to it and dies
  // with it), and prepended, so it runs before any answerer that would
  // otherwise hold the question.
  assert.ok(hub.includes("agentCtx.on('user-questions/request', () => Promise.reject(unattendedQuestion()), true);"));
});
