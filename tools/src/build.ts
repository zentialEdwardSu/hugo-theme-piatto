import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import chokidar from 'chokidar';
import type { PiattoConfig } from './types.js';
import { buildTypst } from './typst.js';
import { validatePosts } from './posts.js';
import { formatError, run } from './utils.js';

export async function buildSite(config: PiattoConfig, passthrough: string[] = []): Promise<void> {
    const problems = await validatePosts(config);
    if (problems.length) throw new Error(`Content validation failed:\n${problems.map((item) => `  - ${item}`).join('\n')}`);
    const result = await buildTypst(config);
    console.log(`Typst: ${result.built} built, ${result.skipped} cached`);
    const code = await run('hugo', [...config.site.hugoArgs, '--minify', ...passthrough], { cwd: config.siteRoot });
    if (code !== 0) throw new Error(`Hugo exited with code ${code}`);
}

export async function checkSite(config: PiattoConfig, selected: string[] = []): Promise<void> {
    const problems = await validatePosts(config, selected);
    if (problems.length) throw new Error(`Content validation failed:\n${problems.map((item) => `  - ${item}`).join('\n')}`);
    const result = await buildTypst(config, selected, { force: true });
    console.log(`Typst check: ${result.built} compiled`);
    const destination = await mkdtemp(path.join(os.tmpdir(), 'piatto-hugo-'));
    try {
        const code = await run('hugo', [...config.site.hugoArgs, '--minify', '--destination', destination, '--cleanDestinationDir'], { cwd: config.siteRoot });
        if (code !== 0) throw new Error(`Hugo validation exited with code ${code}`);
    } finally {
        await rm(destination, { recursive: true, force: true });
    }
}

export async function devSite(config: PiattoConfig, passthrough: string[] = []): Promise<void> {
    const first = await buildTypst(config);
    console.log(`Typst: ${first.built} built, ${first.skipped} cached`);
    const hugo = spawn('hugo', ['server', ...config.site.hugoArgs, '--bind', '0.0.0.0', '--disableFastRender', ...passthrough], {
        cwd: config.siteRoot,
        stdio: 'inherit',
        shell: false,
    });
    hugo.once('error', (error) => console.error(`Unable to start Hugo: ${formatError(error)}`));

    let pending: NodeJS.Timeout | undefined;
    let compiling = false;
    let rerun = false;
    const rebuild = async () => {
        if (compiling) {
            rerun = true;
            return;
        }
        compiling = true;
        try {
            const result = await buildTypst(config);
            if (result.built) console.log(`Typst: rebuilt ${result.built} article(s)`);
        } catch (error) {
            console.error(`Typst: ${formatError(error)}\nKeeping the last successful output.`);
        } finally {
            compiling = false;
            if (rerun) {
                rerun = false;
                void rebuild();
            }
        }
    };
    const watcher = chokidar.watch(config.contentRoot, {
        ignoreInitial: true,
        ignored: (watchPath) => watchPath.includes(`${path.sep}${config.typst.generatedDir.split('/').join(path.sep)}${path.sep}`),
    });
    watcher.on('all', () => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => void rebuild(), 120);
    });

    const shutdown = async () => {
        await watcher.close();
        if (!hugo.killed) hugo.kill('SIGTERM');
    };
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
    await new Promise<void>((resolve, reject) => {
        hugo.once('exit', (code) => code === 0 || code === null ? resolve() : reject(new Error(`Hugo exited with code ${code}`)));
    });
    await watcher.close();
}

export function doctor(config: PiattoConfig): string[] {
    console.log(`Node.js: ${process.version}`);
    const checks: Array<[string, string, string[]]> = [['Hugo', 'hugo', ['version']]];
    const problems: string[] = [];
    for (const [name, command, args] of checks) {
        const result = spawnSync(command, args, { cwd: config.siteRoot, encoding: 'utf8', shell: false });
        if (result.error || result.status !== 0) problems.push(`${name} is unavailable`);
        else console.log(`${name}: ${(result.stdout || result.stderr).trim().split('\n')[0]}`);
    }
    console.log(`Site: ${config.siteRoot}`);
    console.log(`Content: ${config.contentRoot}`);
    return problems;
}
