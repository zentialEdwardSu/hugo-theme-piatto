#!/usr/bin/env node

// tools/src/cli.ts
import path8 from "path";
import { Command, Option } from "commander";

// tools/src/config.ts
import { readFile } from "fs/promises";
import path2 from "path";
import { fileURLToPath } from "url";
import TOML from "@iarna/toml";

// tools/src/utils.ts
import { createHash } from "crypto";
import { access, mkdir, readdir, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { spawn } from "child_process";
async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
function assertInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes the configured root: ${candidate}`);
  }
}
async function writeAtomic(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, content);
  try {
    await rename(temporary, filePath);
  } catch (error) {
    if (error.code !== "EEXIST" && error.code !== "EPERM") {
      throw error;
    }
    await rm(filePath, { force: true });
    await rename(temporary, filePath);
  }
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function slugify(value) {
  const slug = value.normalize("NFKC").toLocaleLowerCase().replace(/[\s_]+/gu, "-").replace(/[^\p{Letter}\p{Number}-]+/gu, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("The title does not produce a usable slug; pass --slug explicitly.");
  return slug;
}
async function walkFiles(root, predicate = () => true) {
  if (!await exists(root)) return [];
  const output = [];
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
async function hashTree(root, excludedRoot) {
  const files = (await walkFiles(root, (filePath) => !excludedRoot || !path.resolve(filePath).startsWith(path.resolve(excludedRoot)))).sort((a, b) => a.localeCompare(b));
  const hash = createHash("sha256");
  for (const file of files) {
    const info = await stat(file);
    hash.update(path.relative(root, file));
    hash.update(String(info.size));
    hash.update(await import("fs/promises").then(({ readFile: readFile6 }) => readFile6(file)));
  }
  return hash.digest("hex");
}
async function run(command, args, options) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: options.inherit === false ? "pipe" : "inherit",
      shell: false
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

// tools/src/config.ts
async function findConfig(start) {
  let current = path2.resolve(start);
  while (true) {
    const candidate = path2.join(current, "piatto.config.toml");
    if (await exists(candidate)) return candidate;
    const parent = path2.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("Unable to find piatto.config.toml. Run `piatto init` from the site root.");
}
function stringArray(value, field) {
  if (value === void 0) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value;
}
async function loadConfig(explicitPath) {
  const configPath = explicitPath ? path2.resolve(explicitPath) : await findConfig(process.cwd());
  const configDir = path2.dirname(configPath);
  const parsed = TOML.parse(await readFile(configPath, "utf8"));
  const root = parsed.site?.root ?? ".";
  const contentDir = parsed.site?.contentDir ?? "content/articles";
  const siteRoot = path2.resolve(configDir, root);
  const packageRoot = path2.resolve(path2.dirname(fileURLToPath(import.meta.url)), "..");
  const wordsPerMinute = parsed.typst?.wordsPerMinute ?? 220;
  if (!Number.isInteger(wordsPerMinute) || wordsPerMinute <= 0) {
    throw new Error("typst.wordsPerMinute must be a positive integer.");
  }
  return {
    configPath,
    configDir,
    packageRoot,
    siteRoot,
    contentRoot: path2.resolve(siteRoot, contentDir),
    site: {
      root,
      contentDir,
      hugoArgs: stringArray(parsed.site?.hugoArgs, "site.hugoArgs")
    },
    typst: {
      entry: parsed.typst?.entry ?? "main.typ",
      generatedDir: parsed.typst?.generatedDir ?? "generated/typst",
      fontPaths: stringArray(parsed.typst?.fontPaths, "typst.fontPaths").map((fontPath) => path2.resolve(configDir, fontPath)),
      wordsPerMinute
    }
  };
}
var defaultConfig = `[site]
root = "."
contentDir = "content/articles"
hugoArgs = ["--gc"]

[typst]
entry = "main.typ"
generatedDir = "generated/typst"
fontPaths = []
wordsPerMinute = 220
`;

// tools/src/build.ts
import { mkdtemp, rm as rm3 } from "fs/promises";
import os from "os";
import path5 from "path";
import { spawn as spawn2, spawnSync } from "child_process";
import chokidar from "chokidar";

// tools/src/typst.ts
import { mkdir as mkdir3, readFile as readFile4, rename as rename3, rm as rm2 } from "fs/promises";
import path4 from "path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { toHtml } from "hast-util-to-html";
import { toText } from "hast-util-to-text";
import postcss from "postcss";
import prefixSelector from "postcss-prefix-selector";

// tools/src/posts.ts
import { mkdir as mkdir2, readFile as readFile3, readdir as readdir2, rename as rename2 } from "fs/promises";
import path3 from "path";
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";

// tools/src/frontmatter.ts
import { readFile as readFile2 } from "fs/promises";
import TOML2 from "@iarna/toml";
import YAML from "yaml";
function parseFrontMatter(raw) {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = normalized.startsWith("---\n") ? "---" : normalized.startsWith("+++\n") ? "+++" : void 0;
  if (!delimiter) throw new Error("Expected YAML (---) or TOML (+++) front matter.");
  const newlineIndex = normalized.indexOf("\n");
  const closing = normalized.indexOf(`
${delimiter}`, newlineIndex);
  if (closing < 0) throw new Error(`Unclosed ${delimiter} front matter.`);
  const frontMatter = normalized.slice(newlineIndex + 1, closing);
  const closingEnd = normalized.indexOf("\n", closing + delimiter.length + 1);
  const body = closingEnd < 0 ? "" : normalized.slice(closingEnd + 1);
  const data = delimiter === "---" ? YAML.parse(frontMatter) : TOML2.parse(frontMatter);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Front matter must be an object.");
  return {
    data,
    body,
    format: delimiter === "---" ? "yaml" : "toml",
    raw: frontMatter,
    delimiter
  };
}
async function readFrontMatter(filePath) {
  return parseFrontMatter(await readFile2(filePath, "utf8"));
}
function scalar(value, format) {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return format === "yaml" ? JSON.stringify(value) : JSON.stringify(value);
}
function setFrontMatterValue(document, key, value) {
  const separator = document.format === "yaml" ? ":" : "=";
  const expression = new RegExp(`^(\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*${separator})[^\\n]*(.*)$`, "mi");
  const replacement = `$1 ${scalar(value, document.format)}$2`;
  const raw = expression.test(document.raw) ? document.raw.replace(expression, replacement) : `${document.raw.replace(/\s*$/, "")}
${key} ${separator} ${scalar(value, document.format)}`;
  return `${document.delimiter}
${raw}
${document.delimiter}
${document.body}`;
}
async function updateFrontMatterValue(filePath, key, value) {
  const document = await readFrontMatter(filePath);
  await writeAtomic(filePath, setFrontMatterValue(document, key, value));
}
function createYamlFrontMatter(data, body = "") {
  return `---
${YAML.stringify(data, { lineWidth: 0 })}---
${body}`;
}

// tools/src/posts.ts
async function ask(prompt) {
  const input = createInterface({ input: stdin, output: stdout });
  try {
    return (await input.question(prompt)).trim();
  } finally {
    input.close();
  }
}
async function discoverPosts(config2) {
  const indexes = await walkFiles(config2.contentRoot, (filePath) => path3.basename(filePath).toLowerCase() === "index.md");
  const records = [];
  for (const indexPath of indexes) {
    const document = await readFrontMatter(indexPath);
    records.push({
      slug: path3.relative(config2.contentRoot, path3.dirname(indexPath)).split(path3.sep).join("/"),
      bundle: path3.dirname(indexPath),
      indexPath,
      data: document.data
    });
  }
  return records.sort((a, b) => a.slug.localeCompare(b.slug));
}
function csv(value) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}
async function createPost(config2, options) {
  const title = options.title ?? (stdin.isTTY ? await ask("Title: ") : "");
  if (!title) throw new Error("A title is required. Pass --title when running non-interactively.");
  const kind = options.type ?? "markdown";
  const slug = options.slug ? slugify(options.slug) : slugify(title);
  const bundle = path3.resolve(config2.contentRoot, slug);
  assertInside(config2.contentRoot, bundle);
  if (await exists(bundle)) throw new Error(`Post already exists: ${slug}`);
  await mkdir2(path3.join(bundle, "images"), { recursive: true });
  const frontMatter = {
    title,
    description: options.description ?? "",
    date: options.date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    draft: options.draft ?? true,
    tags: csv(options.tags),
    categories: csv(options.categories),
    withToc: true
  };
  if (kind === "typst") frontMatter.typst = true;
  await writeAtomic(path3.join(bundle, "index.md"), createYamlFrontMatter(frontMatter, kind === "markdown" ? "\n" : ""));
  if (kind === "typst") {
    const starter = `// Hugo front matter is available through sys.inputs.
#let meta = json(bytes(sys.inputs.at("piatto-frontmatter")))

= ${title}

Start writing here.
`;
    await writeAtomic(path3.join(bundle, config2.typst.entry), starter);
  }
  return bundle;
}
async function validatePosts(config2, selected = []) {
  const problems = [];
  const posts = await discoverPosts(config2);
  const wanted = new Set(selected);
  for (const post2 of posts) {
    if (wanted.size && !wanted.has(post2.slug)) continue;
    if (typeof post2.data.title !== "string" || !post2.data.title.trim()) problems.push(`${post2.slug}: title is required`);
    if (!post2.data.date) problems.push(`${post2.slug}: date is required`);
    if (post2.data.tags !== void 0 && !Array.isArray(post2.data.tags)) problems.push(`${post2.slug}: tags must be an array`);
    if (post2.data.categories !== void 0 && !Array.isArray(post2.data.categories)) problems.push(`${post2.slug}: categories must be an array`);
    if (post2.data.typst === true && !await exists(path3.join(post2.bundle, config2.typst.entry))) {
      problems.push(`${post2.slug}: typst is enabled but ${config2.typst.entry} is missing`);
    }
  }
  for (const slug of selected) {
    if (!posts.some((post2) => post2.slug === slug)) problems.push(`${slug}: post not found`);
  }
  return problems;
}
async function setDraft(config2, slug, draft) {
  const indexPath = path3.resolve(config2.contentRoot, slug, "index.md");
  assertInside(config2.contentRoot, indexPath);
  if (!await exists(indexPath)) throw new Error(`Post not found: ${slug}`);
  await updateFrontMatterValue(indexPath, "draft", draft);
}
async function renamePost(config2, from, to, updateLinks = false) {
  const source = path3.resolve(config2.contentRoot, from);
  const targetSlug = slugify(to);
  const target = path3.resolve(config2.contentRoot, targetSlug);
  assertInside(config2.contentRoot, source);
  assertInside(config2.contentRoot, target);
  if (!await exists(path3.join(source, "index.md"))) throw new Error(`Post not found: ${from}`);
  if (await exists(target)) throw new Error(`Target already exists: ${targetSlug}`);
  await rename2(source, target);
  const normalizedFrom = from.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  const section = path3.basename(config2.site.contentDir.replaceAll("\\", "/"));
  const replacements = [
    [`/${normalizedFrom}/`, `/${targetSlug}/`],
    [`/${section}/${normalizedFrom}/`, `/${section}/${targetSlug}/`]
  ];
  const references = [];
  for (const file of await walkFiles(config2.contentRoot, (filePath) => /\.(md|typ)$/i.test(filePath))) {
    const content = await readFile3(file, "utf8");
    if (!replacements.some(([oldPath]) => content.includes(oldPath))) continue;
    references.push(path3.relative(config2.siteRoot, file));
    if (updateLinks) {
      const updated = replacements.reduce((result, [oldPath, newPath]) => result.replaceAll(oldPath, newPath), content);
      await writeAtomic(file, updated);
    }
  }
  if (references.length && !updateLinks) {
    console.warn(`Renamed post, but found references to its previous URL:
${references.map((item) => `  ${item}`).join("\n")}`);
  }
}
async function initSite(root, configText) {
  const configPath = path3.join(root, "piatto.config.toml");
  if (!await exists(configPath)) await writeAtomic(configPath, configText);
  await mkdir2(path3.join(root, "content", "articles"), { recursive: true });
  await mkdir2(path3.join(root, "data"), { recursive: true });
}

// tools/src/typst.ts
var compilerVersion = "typst.ts-node-compiler@0.8.0-rc3";
var compiler;
var compilerKey = "";
function getCompiler(config2) {
  const key = JSON.stringify([config2.siteRoot, config2.typst.fontPaths]);
  if (!compiler || key !== compilerKey) {
    compiler = NodeCompiler.create({
      workspace: config2.siteRoot,
      fontArgs: config2.typst.fontPaths.length ? [{ fontPaths: config2.typst.fontPaths }] : void 0
    });
    compilerKey = key;
  }
  return compiler;
}
function diagnosticText(instance, error) {
  try {
    return JSON.stringify(instance.fetchDiagnostics(error), null, 2);
  } catch {
    return String(error);
  }
}
function safeUrl(value, image) {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("javascript:") || normalized.startsWith("vbscript:")) return false;
  if (normalized.startsWith("data:")) return image && /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(value);
  return /^(?:https?:|mailto:|tel:|#|\/|\.\.?\/)/i.test(value) || !/^[a-z][a-z\d+.-]*:/i.test(value);
}
function assetExtension(mime) {
  const extensions = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg"
  };
  return extensions[mime.toLowerCase()] ?? "bin";
}
function sanitizeTree(root, assetPrefix) {
  const blocked = /* @__PURE__ */ new Set(["script", "iframe", "object", "embed", "base", "link", "form", "input"]);
  const headings = [];
  const assets = [];
  const ids = /* @__PURE__ */ new Map();
  const uniqueId = (text) => {
    const base = text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "") || "section";
    const count = ids.get(base) ?? 0;
    ids.set(base, count + 1);
    return count ? `${base}-${count + 1}` : base;
  };
  const visit = (node) => {
    if (node.type === "element" && node.tagName && blocked.has(node.tagName.toLowerCase())) return void 0;
    if (node.properties) {
      for (const key of Object.keys(node.properties)) {
        if (/^on/i.test(key)) delete node.properties[key];
      }
      for (const key of ["href", "src"]) {
        const raw = node.properties[key];
        if (typeof raw !== "string") continue;
        const isImage = key === "src" && node.tagName === "img";
        if (!safeUrl(raw, isImage)) {
          delete node.properties[key];
          continue;
        }
        const data = /^data:(image\/(?:png|jpe?g|gif|webp|svg\+xml));base64,(.+)$/is.exec(raw);
        if (data) {
          const content = Buffer.from(data[2], "base64");
          const name = `${sha256(content).slice(0, 20)}.${assetExtension(data[1])}`;
          if (!assets.some((asset) => asset.name === name)) assets.push({ name, content });
          node.properties[key] = `${assetPrefix}/assets/${name}`;
        }
      }
    }
    if (node.children) node.children = node.children.map(visit).filter((child) => Boolean(child));
    if (node.type === "element" && node.tagName && /^h[1-6]$/.test(node.tagName)) {
      node.properties ??= {};
      const text = toText(node).trim();
      const id = typeof node.properties.id === "string" && node.properties.id ? node.properties.id : uniqueId(text);
      node.properties.id = id;
      headings.push({ depth: Number(node.tagName.slice(1)), id, text });
    }
    return node;
  };
  visit(root);
  return { headings, assets };
}
function findElement(root, tagName) {
  if (root.type === "element" && root.tagName === tagName) return root;
  for (const child of root.children ?? []) {
    const found = findElement(child, tagName);
    if (found) return found;
  }
  return void 0;
}
function collectStyle(root) {
  const head = findElement(root, "head");
  return (head?.children ?? []).filter((node) => node.tagName === "style").flatMap((node) => node.children ?? []).filter((node) => node.type === "text").map((node) => node.value ?? "").join("\n");
}
async function scopeCss(css) {
  if (!css.trim()) return "";
  const result = await postcss([
    prefixSelector({
      prefix: ".typst-content",
      transform(prefix, selector, prefixedSelector) {
        if (selector === "html" || selector === "body" || selector === ":root") return prefix;
        if (selector.startsWith(prefix)) return selector;
        return prefixedSelector;
      }
    })
  ]).process(css, { from: void 0 });
  return result.css;
}
function countWords(text) {
  const segmenter = new Intl.Segmenter(void 0, { granularity: "word" });
  return Array.from(segmenter.segment(text)).filter((segment) => segment.isWordLike).length;
}
function makeToc(headings) {
  if (!headings.length) return "";
  return `<nav class="typst-toc"><ol>${headings.map((heading) => `<li class="typst-toc-level-${heading.depth}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`).join("")}</ol></nav>`;
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
async function replaceGeneratedDirectory(target, stage) {
  const backup = `${target}.${process.pid}.old`;
  await rm2(backup, { recursive: true, force: true });
  if (await exists(target)) await rename3(target, backup);
  try {
    await rename3(stage, target);
    await rm2(backup, { recursive: true, force: true });
  } catch (error) {
    if (await exists(backup)) await rename3(backup, target);
    throw error;
  }
}
async function compileTypstPost(config2, post2, options = {}) {
  const entry = path4.join(post2.bundle, config2.typst.entry);
  if (!await exists(entry)) throw new Error(`${post2.slug}: missing ${config2.typst.entry}`);
  const generated = path4.join(post2.bundle, config2.typst.generatedDir);
  const sourceHash = sha256(`${await hashTree(post2.bundle, generated)}
${compilerVersion}`);
  const manifestPath = path4.join(generated, "manifest.json");
  if (!options.force && await exists(manifestPath)) {
    try {
      const current = JSON.parse(await readFile4(manifestPath, "utf8"));
      if (current.sourceHash === sourceHash) return "skipped";
    } catch {
    }
  }
  const instance = getCompiler(config2);
  const compiled = instance.compileHtml({
    mainFilePath: entry,
    inputs: { "piatto-frontmatter": JSON.stringify(post2.data) },
    resetRead: true
  });
  if (!compiled.result) {
    compiled.printDiagnostics();
    throw new Error(`${post2.slug}: Typst compilation failed`);
  }
  const warnings = compiled.takeWarnings();
  if (warnings) console.warn(`${post2.slug}: Typst warnings
${diagnosticText(instance, warnings)}`);
  const rendered = instance.tryHtml(compiled.result);
  if (!rendered.result) {
    rendered.printDiagnostics();
    throw new Error(`${post2.slug}: Typst HTML export failed`);
  }
  const root = rendered.result.hast();
  const body = findElement(root, "body");
  if (!body) throw new Error(`${post2.slug}: Typst output has no body element`);
  const { headings, assets } = sanitizeTree(body, config2.typst.generatedDir.replaceAll("\\", "/"));
  const wrapper = {
    type: "element",
    tagName: "article",
    properties: { className: ["typst-content"] },
    children: body.children ?? []
  };
  const plainText = toText(wrapper).replace(/\s+/g, " ").trim();
  const wordCount = countWords(plainText);
  const description = typeof post2.data.description === "string" ? post2.data.description.trim() : "";
  const manifest = {
    version: 1,
    compiler: compilerVersion,
    sourceHash,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    summary: description || `${plainText.slice(0, 177)}${plainText.length > 177 ? "\u2026" : ""}`,
    plainText,
    wordCount,
    readingTime: Math.max(1, Math.ceil(wordCount / config2.typst.wordsPerMinute)),
    headings,
    assets: assets.map((asset) => `assets/${asset.name}`)
  };
  if (options.write === false) return "built";
  const stage = `${generated}.${process.pid}.tmp`;
  await rm2(stage, { recursive: true, force: true });
  await mkdir3(path4.join(stage, "assets"), { recursive: true });
  const compilerCss = collectStyle(root);
  const articleCssPath = path4.join(post2.bundle, "typst.css");
  const articleCss = await exists(articleCssPath) ? await readFile4(articleCssPath, "utf8") : "";
  const style = await scopeCss([compilerCss, articleCss].filter(Boolean).join("\n"));
  await Promise.all([
    writeAtomic(path4.join(stage, "body.html"), toHtml(wrapper)),
    writeAtomic(path4.join(stage, "toc.html"), makeToc(headings)),
    writeAtomic(path4.join(stage, "style.css"), style),
    writeAtomic(path4.join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}
`),
    ...assets.map((asset) => writeAtomic(path4.join(stage, "assets", asset.name), asset.content))
  ]);
  await replaceGeneratedDirectory(generated, stage);
  instance.evictCache(30);
  return "built";
}
async function buildTypst(config2, selected = [], options = {}) {
  const posts = (await discoverPosts(config2)).filter((post2) => post2.data.typst === true && (!selected.length || selected.includes(post2.slug)));
  if (selected.length) {
    const found = new Set(posts.map((post2) => post2.slug));
    const missing = selected.filter((slug) => !found.has(slug));
    if (missing.length) throw new Error(`Typst post not found: ${missing.join(", ")}`);
  }
  let built = 0;
  let skipped = 0;
  for (const post2 of posts) {
    const result = await compileTypstPost(config2, post2, options);
    if (result === "built") built += 1;
    else skipped += 1;
  }
  return { built, skipped };
}
async function cleanTypst(config2) {
  let cleaned = 0;
  for (const post2 of await discoverPosts(config2)) {
    const generated = path4.join(post2.bundle, config2.typst.generatedDir);
    if (await exists(generated)) {
      await rm2(generated, { recursive: true, force: true });
      cleaned += 1;
    }
  }
  return cleaned;
}

// tools/src/build.ts
async function buildSite(config2, passthrough = []) {
  const problems = await validatePosts(config2);
  if (problems.length) throw new Error(`Content validation failed:
${problems.map((item) => `  - ${item}`).join("\n")}`);
  const result = await buildTypst(config2);
  console.log(`Typst: ${result.built} built, ${result.skipped} cached`);
  const code = await run("hugo", [...config2.site.hugoArgs, "--minify", ...passthrough], { cwd: config2.siteRoot });
  if (code !== 0) throw new Error(`Hugo exited with code ${code}`);
}
async function checkSite(config2, selected = []) {
  const problems = await validatePosts(config2, selected);
  if (problems.length) throw new Error(`Content validation failed:
${problems.map((item) => `  - ${item}`).join("\n")}`);
  const result = await buildTypst(config2, selected, { force: true });
  console.log(`Typst check: ${result.built} compiled`);
  const destination = await mkdtemp(path5.join(os.tmpdir(), "piatto-hugo-"));
  try {
    const code = await run("hugo", [...config2.site.hugoArgs, "--minify", "--destination", destination, "--cleanDestinationDir"], { cwd: config2.siteRoot });
    if (code !== 0) throw new Error(`Hugo validation exited with code ${code}`);
  } finally {
    await rm3(destination, { recursive: true, force: true });
  }
}
async function devSite(config2, passthrough = []) {
  const first = await buildTypst(config2);
  console.log(`Typst: ${first.built} built, ${first.skipped} cached`);
  const hugo = spawn2("hugo", ["server", ...config2.site.hugoArgs, "--bind", "0.0.0.0", "--disableFastRender", ...passthrough], {
    cwd: config2.siteRoot,
    stdio: "inherit",
    shell: false
  });
  hugo.once("error", (error) => console.error(`Unable to start Hugo: ${formatError(error)}`));
  let pending;
  let compiling = false;
  let rerun = false;
  const rebuild = async () => {
    if (compiling) {
      rerun = true;
      return;
    }
    compiling = true;
    try {
      const result = await buildTypst(config2);
      if (result.built) console.log(`Typst: rebuilt ${result.built} article(s)`);
    } catch (error) {
      console.error(`Typst: ${formatError(error)}
Keeping the last successful output.`);
    } finally {
      compiling = false;
      if (rerun) {
        rerun = false;
        void rebuild();
      }
    }
  };
  const watcher = chokidar.watch(config2.contentRoot, {
    ignoreInitial: true,
    ignored: (watchPath) => watchPath.includes(`${path5.sep}${config2.typst.generatedDir.split("/").join(path5.sep)}${path5.sep}`)
  });
  watcher.on("all", () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => void rebuild(), 120);
  });
  const shutdown = async () => {
    await watcher.close();
    if (!hugo.killed) hugo.kill("SIGTERM");
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  await new Promise((resolve, reject) => {
    hugo.once("exit", (code) => code === 0 || code === null ? resolve() : reject(new Error(`Hugo exited with code ${code}`)));
  });
  await watcher.close();
}
function doctor(config2) {
  console.log(`Node.js: ${process.version}`);
  const checks = [["Hugo", "hugo", ["version"]]];
  const problems = [];
  for (const [name, command, args] of checks) {
    const result = spawnSync(command, args, { cwd: config2.siteRoot, encoding: "utf8", shell: false });
    if (result.error || result.status !== 0) problems.push(`${name} is unavailable`);
    else console.log(`${name}: ${(result.stdout || result.stderr).trim().split("\n")[0]}`);
  }
  console.log(`Site: ${config2.siteRoot}`);
  console.log(`Content: ${config2.contentRoot}`);
  return problems;
}

// tools/src/hooks.ts
import { execFileSync } from "child_process";
import { chmod, readFile as readFile5, rm as rm4 } from "fs/promises";
import path6 from "path";
var marker = "# piatto-managed-pre-commit-v1";
function hookPath(config2) {
  const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], { cwd: config2.configDir, encoding: "utf8" }).trim();
  return path6.resolve(config2.configDir, gitDir, "hooks", "pre-commit");
}
async function installHook(config2) {
  const target = hookPath(config2);
  if (await exists(target)) {
    const current = await readFile5(target, "utf8");
    if (current.includes(marker)) return target;
    throw new Error(`Refusing to overwrite existing hook: ${target}`);
  }
  const script = `#!/bin/sh
${marker}
npm exec -- piatto check --staged
`;
  await writeAtomic(target, script);
  await chmod(target, 493);
  return target;
}
async function uninstallHook(config2) {
  const target = hookPath(config2);
  if (!await exists(target)) return false;
  const current = await readFile5(target, "utf8");
  if (!current.includes(marker)) throw new Error(`Refusing to remove unmanaged hook: ${target}`);
  await rm4(target);
  return true;
}

// tools/src/icons.ts
import path7 from "path";
import { EnvHttpProxyAgent, ProxyAgent, fetch } from "undici";
var materialSymbolsBaseUrl = "https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/";
var maximumIconSize = 256 * 1024;
function materialIconProxySettings(environment) {
  const httpProxy = environment.http_proxy ?? environment.HTTP_PROXY;
  const httpsProxy = environment.https_proxy ?? environment.HTTPS_PROXY ?? httpProxy;
  const noProxy = environment.no_proxy ?? environment.NO_PROXY;
  return { httpProxy, httpsProxy, noProxy };
}
function validateProxy(proxy) {
  let parsed;
  try {
    parsed = new URL(proxy);
  } catch {
    throw new Error(`Invalid proxy URL: ${proxy}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("The icon proxy must use an http:// or https:// URL.");
  }
  return parsed.toString();
}
function createDispatcher(proxy, environment) {
  if (proxy) return new ProxyAgent(validateProxy(proxy));
  const settings = materialIconProxySettings(environment);
  if (!settings.httpProxy && !settings.httpsProxy) return void 0;
  if (settings.httpProxy) validateProxy(settings.httpProxy);
  if (settings.httpsProxy) validateProxy(settings.httpsProxy);
  return new EnvHttpProxyAgent({
    httpProxy: settings.httpProxy ?? "",
    httpsProxy: settings.httpsProxy ?? "",
    noProxy: settings.noProxy ?? ""
  });
}
function validateMaterialIconName(name) {
  const normalized = name.trim();
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`Invalid Material Symbol name "${name}". Use its lowercase underscore name, for example "arrow_back".`);
  }
  return normalized;
}
function materialIconUrl(name, sourceBaseUrl = materialSymbolsBaseUrl) {
  const base = sourceBaseUrl.endsWith("/") ? sourceBaseUrl : `${sourceBaseUrl}/`;
  return new URL(`${name}/materialsymbolsoutlined/${name}_24px.svg`, base).toString();
}
function validateSvg(name, content) {
  const svg = content.trim();
  if (Buffer.byteLength(svg) > maximumIconSize) {
    throw new Error(`Material Symbol "${name}" is unexpectedly large.`);
  }
  if (!/^<svg\b[^>]*>[\s\S]*<\/svg>$/i.test(svg)) {
    throw new Error(`Material Symbol "${name}" did not return a valid SVG.`);
  }
  return `${svg}
`;
}
async function downloadIcon(name, request, dispatcher, sourceBaseUrl) {
  const response = await request(materialIconUrl(name, sourceBaseUrl), {
    dispatcher,
    signal: AbortSignal.timeout(2e4)
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Material Symbol "${name}" was not found in Google's 24 px Outlined set.`);
    }
    throw new Error(`Unable to download Material Symbol "${name}": HTTP ${response.status} ${response.statusText}`.trim());
  }
  return validateSvg(name, await response.text());
}
async function addMaterialIcons(config2, names, options = {}) {
  const normalized = [...new Set(names.map(validateMaterialIconName))];
  if (!normalized.length) throw new Error("At least one Material Symbol name is required.");
  const directory = path7.join(config2.configDir, "assets", "icons", "material");
  const themeDirectory = path7.join(config2.packageRoot, "assets", "icons", "material");
  const skipped = [];
  const missing = [];
  for (const name of normalized) {
    const availableLocally = await exists(path7.join(directory, `${name}.svg`));
    const availableFromTheme = path7.resolve(directory) !== path7.resolve(themeDirectory) && await exists(path7.join(themeDirectory, `${name}.svg`));
    (availableLocally || availableFromTheme ? skipped : missing).push(name);
  }
  if (!missing.length) return { added: [], skipped, directory };
  const dispatcher = createDispatcher(options.proxy, options.environment ?? process.env);
  const request = options.request ?? ((url, requestOptions) => fetch(url, requestOptions));
  try {
    const downloads = /* @__PURE__ */ new Map();
    for (const name of missing) {
      downloads.set(name, await downloadIcon(name, request, dispatcher, options.sourceBaseUrl));
    }
    await Promise.all([...downloads].map(([name, svg]) => writeAtomic(path7.join(directory, `${name}.svg`), svg)));
    return { added: missing, skipped, directory };
  } finally {
    await dispatcher?.close();
  }
}

// tools/src/cli.ts
var program = new Command();
program.name("piatto").description("Cross-platform content and build tools for Hugo Theme Piatto").version("0.1.0").option("-c, --config <path>", "path to piatto.config.toml");
var config = () => loadConfig(program.opts().config);
program.command("init").description("initialize a site without installing packages or changing Git configuration").argument("[directory]", "site root", ".").action(async (directory) => {
  const root = path8.resolve(directory);
  await initSite(root, defaultConfig);
  console.log(`Initialized Piatto site at ${root}`);
});
program.command("doctor").description("check local prerequisites and resolved paths").action(async () => {
  const problems = doctor(await config());
  if (problems.length) throw new Error(problems.join("\n"));
});
program.command("build").description("compile Typst and run a production Hugo build").allowUnknownOption(true).argument("[hugoArgs...]", "additional Hugo arguments").action(async (hugoArgs) => buildSite(await config(), hugoArgs));
program.command("dev").description("watch Typst sources and run the Hugo development server").allowUnknownOption(true).argument("[hugoArgs...]", "additional Hugo server arguments").action(async (hugoArgs) => devSite(await config(), hugoArgs));
program.command("check").description("validate content, compile Typst, and build Hugo into a temporary directory").option("--staged", "hook-compatible check (currently validates the full site)").argument("[slugs...]", "optional post slugs").action(async (slugs) => checkSite(await config(), slugs));
var post = program.command("post").description("manage article bundles");
post.command("new").description("create a Markdown or Typst article bundle").option("--title <title>").option("--slug <slug>").option("--description <description>").option("--tags <tags>", "comma-separated tags").option("--categories <categories>", "comma-separated categories").option("--date <date>", "publication date in YYYY-MM-DD format").addOption(new Option("--type <type>").choices(["markdown", "typst"]).default("markdown")).option("--published", "create with draft=false").action(async (options) => {
  const bundle = await createPost(await config(), { ...options, draft: !options.published });
  console.log(`Created ${bundle}`);
});
post.command("list").description("list article bundles").action(async () => {
  const posts = await discoverPosts(await config());
  console.table(posts.map((item) => ({ slug: item.slug, title: item.data.title, draft: item.data.draft ?? false, type: item.data.typst === true ? "typst" : "markdown" })));
});
post.command("validate").description("validate article front matter and bundle structure").argument("[slugs...]").action(async (slugs) => {
  const problems = await validatePosts(await config(), slugs);
  if (problems.length) throw new Error(problems.join("\n"));
  console.log("Posts are valid.");
});
post.command("rename").description("rename an article bundle").argument("<from>").argument("<to>").option("--update-links", "update matching root-relative links in Markdown and Typst sources").action(async (from, to, options) => {
  await renamePost(await config(), from, to, options.updateLinks);
  console.log(`Renamed ${from} to ${to}`);
});
post.command("draft").description("mark an article as a draft").argument("<slug>").action(async (slug) => setDraft(await config(), slug, true));
post.command("publish").description("mark an article as published; this does not deploy the site").argument("<slug>").action(async (slug) => setDraft(await config(), slug, false));
var typst = program.command("typst").description("compile Typst article bundles");
typst.command("build").argument("[slugs...]").option("--force", "ignore the source hash cache").action(async (slugs, options) => {
  const result = await buildTypst(await config(), slugs, options);
  console.log(`Typst: ${result.built} built, ${result.skipped} cached`);
});
typst.command("clean").description("remove only Piatto-managed Typst output directories").action(async () => {
  const count = await cleanTypst(await config());
  console.log(`Removed ${count} generated ${count === 1 ? "directory" : "directories"}.`);
});
var hooks = program.command("hooks").description("manage the optional validation hook");
hooks.command("install").action(async () => console.log(`Installed ${await installHook(await config())}`));
hooks.command("uninstall").action(async () => console.log(await uninstallHook(await config()) ? "Removed Piatto hook." : "No Piatto hook installed."));
var icon = program.command("icon").description("manage local Material Symbol SVGs");
icon.command("add").description("download missing 24 px Outlined Material Symbols").argument("<names...>", "lowercase underscore icon names").option("--proxy <url>", "HTTP or HTTPS proxy URL (overrides proxy environment variables)").action(async (names, options) => {
  const result = await addMaterialIcons(await config(), names, options);
  for (const name of result.added) console.log(`Added ${name}.svg`);
  for (const name of result.skipped) console.log(`Already available: ${name}.svg`);
  if (result.added.length) console.log(`Icon directory: ${result.directory}`);
});
program.parseAsync().catch((error) => {
  console.error(`piatto: ${formatError(error)}`);
  process.exitCode = 1;
});
