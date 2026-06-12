// Contract tests for the gcloud spawn shape (dbControl.ts).
//
// The contract under test is the CVE-2024-27980 / DEP0190 dance plus windowsHide — the
// exact combination whose absence caused the 2026-06-12 incident (a visible console window
// per spawn on the operator's desktop, closed by hand, killing the gcloud run):
//   • win32: gcloud is a .cmd shim, so the spawn MUST go through the shell — and because
//     args-with-shell is deprecated (DEP0190), the command MUST be ONE pre-joined string.
//   • everywhere else: a plain args array, no shell.
//   • BOTH: windowsHide true, so the detached studio server never pops a console window.
// No real gcloud anywhere: gcloudInvocation is pure, and spawnGcloud's pass-through is
// verified against a mocked node:child_process.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gcloudInvocation, spawnGcloud } from './dbControl';

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: spawnMock };
});

const ARGS = ['sql', 'instances', 'describe', 'storytree-pg', '--project', 'storytree-498613'];

describe('gcloudInvocation (the spawn contract, per platform)', () => {
  it('win32: ONE pre-joined command string, shell:true, windowsHide:true', () => {
    const inv = gcloudInvocation(ARGS, 'win32');
    expect(inv.command).toBe('gcloud sql instances describe storytree-pg --project storytree-498613');
    expect(inv.args).toEqual([]); // never args-with-shell (DEP0190)
    expect(inv.options.shell).toBe(true); // .cmd shims need the shell (CVE-2024-27980 hardening)
    expect(inv.options.windowsHide).toBe(true);
    expect(inv.options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
  });

  it.each(['linux', 'darwin'] as const)('%s: args array untouched, no shell, windowsHide:true', (platform) => {
    const inv = gcloudInvocation(ARGS, platform);
    expect(inv.command).toBe('gcloud');
    expect(inv.args).toEqual(ARGS);
    expect(inv.options.shell).toBe(false);
    expect(inv.options.windowsHide).toBe(true);
    expect(inv.options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
  });
});

describe('spawnGcloud', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockReturnValue({} as never);
  });

  it('passes the host platform invocation through to child_process.spawn verbatim', () => {
    spawnGcloud(ARGS);
    const expected = gcloudInvocation(ARGS); // host-platform shape
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(expected.command, expected.args, expected.options);
    // The incident pin, independent of host platform: windowsHide always set.
    const options = spawnMock.mock.calls[0]?.[2] as { windowsHide?: boolean };
    expect(options.windowsHide).toBe(true);
  });
});
