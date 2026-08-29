import path from 'node:path';
import { Command, Option } from 'commander';
import { loadConfig, defaultConfig } from './config.js';
import { buildSite, checkSite, devSite, doctor } from './build.js';
import { buildTypst, cleanTypst } from './typst.js';
import { createPost, discoverPosts, initSite, renamePost, setDraft, validatePosts, type NewPostOptions } from './posts.js';
import { installHook, uninstallHook } from './hooks.js';
import { addMaterialIcons } from './icons.js';
import { formatError } from './utils.js';

const program = new Command();
program
    .name('piatto')
    .description('Cross-platform content and build tools for Hugo Theme Piatto')
    .version('0.1.0')
    .option('-c, --config <path>', 'path to piatto.config.toml');

const config = () => loadConfig(program.opts<{ config?: string }>().config);

program.command('init')
    .description('initialize a site without installing packages or changing Git configuration')
    .argument('[directory]', 'site root', '.')
    .action(async (directory: string) => {
        const root = path.resolve(directory);
        await initSite(root, defaultConfig);
        console.log(`Initialized Piatto site at ${root}`);
    });

program.command('doctor')
    .description('check local prerequisites and resolved paths')
    .action(async () => {
        const problems = doctor(await config());
        if (problems.length) throw new Error(problems.join('\n'));
    });

program.command('build')
    .description('compile Typst and run a production Hugo build')
    .allowUnknownOption(true)
    .argument('[hugoArgs...]', 'additional Hugo arguments')
    .action(async (hugoArgs: string[]) => buildSite(await config(), hugoArgs));

program.command('dev')
    .description('watch Typst sources and run the Hugo development server')
    .allowUnknownOption(true)
    .argument('[hugoArgs...]', 'additional Hugo server arguments')
    .action(async (hugoArgs: string[]) => devSite(await config(), hugoArgs));

program.command('check')
    .description('validate content, compile Typst, and build Hugo into a temporary directory')
    .option('--staged', 'hook-compatible check (currently validates the full site)')
    .argument('[slugs...]', 'optional post slugs')
    .action(async (slugs: string[]) => checkSite(await config(), slugs));

const post = program.command('post').description('manage article bundles');
post.command('new')
    .description('create a Markdown or Typst article bundle')
    .option('--title <title>')
    .option('--slug <slug>')
    .option('--description <description>')
    .option('--tags <tags>', 'comma-separated tags')
    .option('--categories <categories>', 'comma-separated categories')
    .option('--date <date>', 'publication date in YYYY-MM-DD format')
    .addOption(new Option('--type <type>').choices(['markdown', 'typst']).default('markdown'))
    .option('--published', 'create with draft=false')
    .action(async (options: NewPostOptions & { published?: boolean }) => {
        const bundle = await createPost(await config(), { ...options, draft: !options.published });
        console.log(`Created ${bundle}`);
    });
post.command('list')
    .description('list article bundles')
    .action(async () => {
        const posts = await discoverPosts(await config());
        console.table(posts.map((item) => ({ slug: item.slug, title: item.data.title, draft: item.data.draft ?? false, type: item.data.typst === true ? 'typst' : 'markdown' })));
    });
post.command('validate')
    .description('validate article front matter and bundle structure')
    .argument('[slugs...]')
    .action(async (slugs: string[]) => {
        const problems = await validatePosts(await config(), slugs);
        if (problems.length) throw new Error(problems.join('\n'));
        console.log('Posts are valid.');
    });
post.command('rename')
    .description('rename an article bundle')
    .argument('<from>')
    .argument('<to>')
    .option('--update-links', 'update matching root-relative links in Markdown and Typst sources')
    .action(async (from: string, to: string, options: { updateLinks?: boolean }) => {
        await renamePost(await config(), from, to, options.updateLinks);
        console.log(`Renamed ${from} to ${to}`);
    });
post.command('draft')
    .description('mark an article as a draft')
    .argument('<slug>')
    .action(async (slug: string) => setDraft(await config(), slug, true));
post.command('publish')
    .description('mark an article as published; this does not deploy the site')
    .argument('<slug>')
    .action(async (slug: string) => setDraft(await config(), slug, false));

const typst = program.command('typst').description('compile Typst article bundles');
typst.command('build')
    .argument('[slugs...]')
    .option('--force', 'ignore the source hash cache')
    .action(async (slugs: string[], options: { force?: boolean }) => {
        const result = await buildTypst(await config(), slugs, options);
        console.log(`Typst: ${result.built} built, ${result.skipped} cached`);
    });
typst.command('clean')
    .description('remove only Piatto-managed Typst output directories')
    .action(async () => {
        const count = await cleanTypst(await config());
        console.log(`Removed ${count} generated ${count === 1 ? 'directory' : 'directories'}.`);
    });

const hooks = program.command('hooks').description('manage the optional validation hook');
hooks.command('install').action(async () => console.log(`Installed ${await installHook(await config())}`));
hooks.command('uninstall').action(async () => console.log(await uninstallHook(await config()) ? 'Removed Piatto hook.' : 'No Piatto hook installed.'));

const icon = program.command('icon').description('manage local Material Symbol SVGs');
icon.command('add')
    .description('download missing 24 px Outlined Material Symbols')
    .argument('<names...>', 'lowercase underscore icon names')
    .option('--proxy <url>', 'HTTP or HTTPS proxy URL (overrides proxy environment variables)')
    .action(async (names: string[], options: { proxy?: string }) => {
        const result = await addMaterialIcons(await config(), names, options);
        for (const name of result.added) console.log(`Added ${name}.svg`);
        for (const name of result.skipped) console.log(`Already available: ${name}.svg`);
        if (result.added.length) console.log(`Icon directory: ${result.directory}`);
    });

program.parseAsync().catch((error) => {
    console.error(`piatto: ${formatError(error)}`);
    process.exitCode = 1;
});
