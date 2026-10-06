import { execFileSync } from 'node:child_process';

function validPid(pid) {
  return typeof pid === 'number' && Number.isInteger(pid) && pid > 0 && pid <= 0x7fffffff;
}

function query(pid, field, { platform = process.platform, run = execFileSync } = {}) {
  if (!validPid(pid)) return { ok: false, reason: 'bad-pid' };
  // PowerShell + the first CIM query can exceed ps's 3s budget on a cold
  // Windows host. Keep a finite Windows budget without treating that cold
  // start as evidence that the command line is unavailable.
  const options = { encoding: 'utf8', timeout: platform === 'win32' ? 10_000 : 3000, maxBuffer: 256 * 1024, windowsHide: true };
  try {
    if (platform !== 'win32') {
      const value = String(run('ps', ['-p', String(pid), '-o', field === 'name' ? 'comm=' : 'command='], options) ?? '').trim();
      return value === '' ? { ok: false, reason: 'no-such-process' } : { ok: true, [field]: value };
    }
    // Only a validated numeric PID is interpolated. CIM returns the real
    // executable name and full command line; tasklist cannot supply the latter.
    const script = "$ErrorActionPreference = 'Stop'; "
      + '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; '
      + `$entry = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -Property ProcessId,Name,CommandLine; `
      + "if ($null -eq $entry) { 'null' } else { "
      + '$entry | Select-Object ProcessId, Name, CommandLine | ConvertTo-Json -Compress }';
    const output = String(run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], options) ?? '')
      .replace(/^\ufeff/, '').trim();
    let record;
    try { record = JSON.parse(output); }
    catch { return { ok: false, reason: 'process-query-failed', detail: 'CIM returned invalid JSON' }; }
    if (record === null) return { ok: false, reason: 'no-such-process' };
    const value = record?.[field === 'name' ? 'Name' : 'CommandLine'];
    if (record?.ProcessId !== pid || typeof value !== 'string' || value.trim() === '') {
      // A null CommandLine can mean insufficient access, not a missing process.
      return { ok: false, reason: 'process-query-failed', detail: 'CIM did not return the requested process field' };
    }
    return { ok: true, [field]: value.trim() };
  } catch (error) {
    if (platform !== 'win32' && error?.status === 1) return { ok: false, reason: 'no-such-process' };
    return { ok: false, reason: platform === 'win32' ? 'process-query-failed' : 'ps-failed', detail: error?.message ?? String(error) };
  }
}

export function readProcessName(pid, options) { return query(pid, 'name', options); }
export function readProcessCommand(pid, options) { return query(pid, 'command', options); }

function executableName(value) {
  return String(value).split(/[\\/]/).pop().toLowerCase();
}

export function detectOrchestrator({ env = process.env, parentPid = process.ppid, readName = readProcessName } = {}) {
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT) return 'claude-code';
  try {
    const info = readName(parentPid);
    if (!info.ok) return 'unknown';
    const name = executableName(info.name);
    if (name.includes('claude')) return 'claude-code';
    if (name.includes('codex')) return 'codex';
    return name || 'unknown';
  } catch { return 'unknown'; }
}
