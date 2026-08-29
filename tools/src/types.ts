export type FrontMatterFormat = 'yaml' | 'toml';

export interface PiattoConfig {
    configPath: string;
    configDir: string;
    packageRoot: string;
    siteRoot: string;
    contentRoot: string;
    site: {
        root: string;
        contentDir: string;
        hugoArgs: string[];
    };
    typst: {
        entry: string;
        generatedDir: string;
        fontPaths: string[];
        wordsPerMinute: number;
    };
}

export interface FrontMatterDocument {
    data: Record<string, unknown>;
    body: string;
    format: FrontMatterFormat;
    raw: string;
    delimiter: '---' | '+++';
}

export interface TypstManifest {
    version: 1;
    compiler: string;
    sourceHash: string;
    generatedAt: string;
    summary: string;
    plainText: string;
    wordCount: number;
    readingTime: number;
    headings: Array<{ depth: number; id: string; text: string }>;
    assets: string[];
}
