import { createHash } from 'node:crypto';
import { access, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export async function exists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

export function assertInside(parent: string, candidate: string): void {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Path escapes the configured root: ${candidate}`);
    }
}

export async function writeAtomic(filePath: string, content: string | Uint8Array): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, content);
    try {
        await rename(temporary, filePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' && (error as NodeJS.ErrnoException).code !== 'EPERM') {
            throw error;
        }
        await rm(filePath, { force: true });
        await rename(temporary, filePath);
    }
}

export function sha256(value: string | Uint8Array): string {
    return createHash('sha256').update(value).digest('hex');
}

export function slugify(value: string): string {
    const slug = value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[\s_]+/gu, '-')
        .replace(/[^\p{Letter}\p{Number}-]+/gu, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
    if (!slug) throw new Error('The title does not produce a usable slug; pass --slug explicitly.');
    return slug;
}

export async function walkFiles(root: string, predicate: (filePath: string) => boolean = () => true): Promise<string[]> {
    if (!(await exists(root))) return [];
    const output: string[] = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const filePath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            output.push(...await walkFiles(filePath, predicate));
        } else if (entry.isFile() && predicate(filePath)) {
            output.push(filePath);
        }
    }
    return output;
}

export async function hashTree(root: string, excludedRoot?: string): Promise<string> {
    const files = (await walkFiles(root, (filePath) => !excludedRoot || !path.resolve(filePath).startsWith(path.resolve(excludedRoot))))
        .sort((a, b) => a.localeCompare(b));
    const hash = createHash('sha256');
    for (const file of files) {
        const info = await stat(file);
        hash.update(path.relative(root, file));
        hash.update(String(info.size));
        hash.update(await import('node:fs/promises').then(({ readFile }) => readFile(file)));
    }
    return hash.digest('hex');
}

export async function run(command: string, args: string[], options: { cwd: string; inherit?: boolean } ): Promise<number> {
    return await new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            stdio: options.inherit === false ? 'pipe' : 'inherit',
            shell: false,
        });
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
}

export function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
