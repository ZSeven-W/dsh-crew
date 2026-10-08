/** Stop an unattended worker and hand its unresolved request back to its caller. */
export function installWorkerQuestionHandoff(agentCtx, job, publish) {
  agentCtx.on('user-questions/request', (request) => {
    const questions = Array.isArray(request?.questions) ? request.questions.slice(0, 16).map(q => ({
      id: String(q.id ?? '').slice(0, 200),
      question: String(q.question ?? '').slice(0, 4000),
      ...(typeof q.detail === 'string' ? { detail: q.detail.slice(0, 12000) } : {}),
      ...(Array.isArray(q.options) ? { options: q.options.slice(0, 32).map(o => ({ label: String(o.label ?? '').slice(0, 500) })) } : {}),
    })) : [];
    job.status = 'needs_input';
    job.questions = questions;
    job.result = JSON.stringify({ needs_input: true, questions, instruction: 'Obtain the required answer or approval from the user, then dispatch a new task with that answer. An unanswered question grants no permission.' });
    job.error = 'Worker stopped for an unresolved question; no option was selected automatically.';
    publish();
    // Dispose the runtime, not merely tell the model to stop: it must not run
    // another step after an unanswered overwrite/permission question.
    try { Promise.resolve(job.handle?.dispose()).catch(() => {}); } catch {}
    const error = new Error(job.error + ' Return the unresolved question to the orchestrator.');
    error.name = 'UserQuestionError'; error.code = 'UNATTENDED_WORKER';
    return Promise.reject(error);
  }, true);
}
