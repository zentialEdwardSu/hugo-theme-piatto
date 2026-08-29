import { execFileSync } from 'node:child_process';
import { chmod, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { PiattoConfig } from './types.js';
import { exists, writeAtomic } from './utils.js';

const marker = '# piatto-managed-pre-commit-v1';

function hookPath(config: PiattoConfig): string {
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd: config.configDir, encoding: 'utf8' }).trim();
    return path.resolve(config.configDir, gitDir, 'hooks', 'pre-commit');
}

export async function installHook(config: PiattoConfig): Promise<string> {
    const target = hookPath(config);
    if (await exists(target)) {
        const current = await readFile(target, 'utf8');
        if (current.includes(marker)) return target;
        throw new Error(`Refusing to overwrite existing hook: ${target}`);
    }
    const script = `#!/bin/sh\n${marker}\nnpm exec -- piatto check --staged\n`;
    await writeAtomic(target, script);
    await chmod(target, 0o755);
    return target;
}

export async function uninstallHook(config: PiattoConfig): Promise<boolean> {
    const target = hookPath(config);
    if (!(await exists(target))) return false;
    const current = await readFile(target, 'utf8');
    if (!current.includes(marker)) throw new Error(`Refusing to remove unmanaged hook: ${target}`);
    await rm(target);
    return true;
}
