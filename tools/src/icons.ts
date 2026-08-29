import path from 'node:path';
import type { Dispatcher } from 'undici';
import { EnvHttpProxyAgent, ProxyAgent, fetch } from 'undici';
import type { PiattoConfig } from './types.js';
import { exists, writeAtomic } from './utils.js';

const materialSymbolsBaseUrl = 'https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/';
const maximumIconSize = 256 * 1024;

interface IconResponse {
    ok: boolean;
    status: number;
    statusText: string;
    text(): Promise<string>;
}

type IconRequest = (url: string, options: { dispatcher?: Dispatcher; signal: AbortSignal }) => Promise<IconResponse>;

export interface AddMaterialIconsOptions {
    proxy?: string;
    environment?: NodeJS.ProcessEnv;
    request?: IconRequest;
    sourceBaseUrl?: string;
}

export interface AddMaterialIconsResult {
    added: string[];
    skipped: string[];
    directory: string;
}

export interface MaterialIconProxySettings {
    httpProxy?: string;
    httpsProxy?: string;
    noProxy?: string;
}

export function materialIconProxySettings(environment: NodeJS.ProcessEnv): MaterialIconProxySettings {
    const httpProxy = environment.http_proxy ?? environment.HTTP_PROXY;
    const httpsProxy = environment.https_proxy ?? environment.HTTPS_PROXY ?? httpProxy;
    const noProxy = environment.no_proxy ?? environment.NO_PROXY;
    return { httpProxy, httpsProxy, noProxy };
}

function validateProxy(proxy: string): string {
    let parsed: URL;
    try {
        parsed = new URL(proxy);
    } catch {
        throw new Error(`Invalid proxy URL: ${proxy}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('The icon proxy must use an http:// or https:// URL.');
    }
    return parsed.toString();
}

function createDispatcher(proxy: string | undefined, environment: NodeJS.ProcessEnv): Dispatcher | undefined {
    if (proxy) return new ProxyAgent(validateProxy(proxy));
    const settings = materialIconProxySettings(environment);
    if (!settings.httpProxy && !settings.httpsProxy) return undefined;
    if (settings.httpProxy) validateProxy(settings.httpProxy);
    if (settings.httpsProxy) validateProxy(settings.httpsProxy);
    return new EnvHttpProxyAgent({
        httpProxy: settings.httpProxy ?? '',
        httpsProxy: settings.httpsProxy ?? '',
        noProxy: settings.noProxy ?? '',
    });
}

export function validateMaterialIconName(name: string): string {
    const normalized = name.trim();
    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalized)) {
        throw new Error(`Invalid Material Symbol name "${name}". Use its lowercase underscore name, for example "arrow_back".`);
    }
    return normalized;
}

export function materialIconUrl(name: string, sourceBaseUrl = materialSymbolsBaseUrl): string {
    const base = sourceBaseUrl.endsWith('/') ? sourceBaseUrl : `${sourceBaseUrl}/`;
    return new URL(`${name}/materialsymbolsoutlined/${name}_24px.svg`, base).toString();
}

function validateSvg(name: string, content: string): string {
    const svg = content.trim();
    if (Buffer.byteLength(svg) > maximumIconSize) {
        throw new Error(`Material Symbol "${name}" is unexpectedly large.`);
    }
    if (!/^<svg\b[^>]*>[\s\S]*<\/svg>$/i.test(svg)) {
        throw new Error(`Material Symbol "${name}" did not return a valid SVG.`);
    }
    return `${svg}\n`;
}

async function downloadIcon(name: string, request: IconRequest, dispatcher: Dispatcher | undefined, sourceBaseUrl?: string): Promise<string> {
    const response = await request(materialIconUrl(name, sourceBaseUrl), {
        dispatcher,
        signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Material Symbol "${name}" was not found in Google's 24 px Outlined set.`);
        }
        throw new Error(`Unable to download Material Symbol "${name}": HTTP ${response.status} ${response.statusText}`.trim());
    }
    return validateSvg(name, await response.text());
}

export async function addMaterialIcons(config: PiattoConfig, names: string[], options: AddMaterialIconsOptions = {}): Promise<AddMaterialIconsResult> {
    const normalized = [...new Set(names.map(validateMaterialIconName))];
    if (!normalized.length) throw new Error('At least one Material Symbol name is required.');

    const directory = path.join(config.configDir, 'assets', 'icons', 'material');
    const themeDirectory = path.join(config.packageRoot, 'assets', 'icons', 'material');
    const skipped: string[] = [];
    const missing: string[] = [];
    for (const name of normalized) {
        const availableLocally = await exists(path.join(directory, `${name}.svg`));
        const availableFromTheme = path.resolve(directory) !== path.resolve(themeDirectory)
            && await exists(path.join(themeDirectory, `${name}.svg`));
        (availableLocally || availableFromTheme ? skipped : missing).push(name);
    }
    if (!missing.length) return { added: [], skipped, directory };

    const dispatcher = createDispatcher(options.proxy, options.environment ?? process.env);
    const request = options.request ?? ((url, requestOptions) => fetch(url, requestOptions));
    try {
        const downloads = new Map<string, string>();
        for (const name of missing) {
            downloads.set(name, await downloadIcon(name, request, dispatcher, options.sourceBaseUrl));
        }
        await Promise.all([...downloads].map(([name, svg]) => writeAtomic(path.join(directory, `${name}.svg`), svg)));
        return { added: missing, skipped, directory };
    } finally {
        await dispatcher?.close();
    }
}
