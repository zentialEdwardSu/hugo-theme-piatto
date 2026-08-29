---
title: Piatto Theme Guide
date: 2026-08-20
draft: false
author: Piatto Authors
description: Install and configure Piatto, build a home hero, customize navigation and icons, and use every CLI command.
tags: [Piatto, Configuration, CLI]
categories: [Guides]
withToc: true
cover: images/theme-guide-cover.jpg
keepOrigin: true
---

This is the site-level reference for Piatto. It explains every configuration surface, the home hero, navigation and list behavior, SEO output, icon extension, and the complete CLI. For the article and project workflow, see [Writing Articles with Piatto](/articles/writing-with-piatto/).

<!--more-->

## Requirements and installation

Piatto requires Hugo Extended 0.165.0 or later, Node.js 22.18.0 or later, and npm. The Typst compiler is pinned as a Node dependency, so a separate Typst or Python installation is not required.

From a Hugo site root:

```powershell
git submodule add https://github.com/zentialEdwardSu/hugo-theme-piatto.git themes/piatto
npm install --save-dev ./themes/piatto
npm exec -- piatto init
```

The `theme` value must match the directory under `themes/`; the example above uses `theme = "piatto"`. The theme repository's own fixture uses `hugo-theme-piatto` because that is its directory name relative to `exampleSite`.

## Configuration map

| File | Required | Purpose |
| --- | :---: | --- |
| `hugo.toml` | Yes | Hugo settings, theme parameters, navigation, output formats, and security |
| `piatto.config.toml` | Yes | CLI paths, Hugo arguments, and Typst compilation settings |
| `package.json` | Recommended | Pins the local CLI and exposes convenient scripts |
| `content/_index.md` | Recommended | Home hero content or `heroHTML` |
| `content/<section>/_index.md` | As needed | Section title, description, `listStyle`, and `dataSource` |
| `data/*.json` | As needed | Data source for card lists such as Projects |
| `static/css/custom.css` | For customization | Overrides colors, typography, or components after the theme stylesheet |
| `assets/icons/material/*.svg` | When adding icons | Locally inlined Material Symbols |

## A complete `hugo.toml` starting point

The following example covers every configuration group directly used or required by the theme:

```toml
baseURL = "https://example.com/"
locale = "en-US"
title = "My Piatto Site"
theme = "piatto"
copyright = "MIT"
enableGitInfo = true
enableRobotsTXT = true
googleAnalytics = "G-MEASUREMENT_ID"

[build]
  [build.buildStats]
    enable = true
  [[build.cachebusters]]
    source = "assets/notwatching/hugo_stats\\.json"
    target = "css"
  [[build.cachebusters]]
    source = "package(-lock)?\\.json"
    target = "css"

[module]
  [[module.mounts]]
    source = "assets"
    target = "assets"
  [[module.mounts]]
    disableWatch = true
    source = "hugo_stats.json"
    target = "assets/notwatching/hugo_stats.json"

[security]
  allowContent = ["^text/(html|markdown|css|plain)$", "^application/json$"]
  [security.exec]
    allow = ["^(dart-)?sass$", "^go$", "^git$", "^node$", "^postcss$", "^tailwindcss$"]

[params]
  name = "Piatto"
  author = "Your Name"
  description = "A site for articles, projects, and Typst documents."
  initials = "PT"
  showReadingTime = true
  withToc = false
  dateFormatList = "2006-01-02"
  search = true
  recentPosts = true
  recentPostsCount = 4
  outOfDate = 12
  twitterSite = "@example"
  twitterCreator = "@author"

  [params.navigation]
    showTaxonomies = true
    taxonomyLabel = "Topics"
    taxonomyURL = "/tags/"
    tagsLabel = "Tags"
    categoriesLabel = "Categories"

    [[params.navigation.tabs]]
      name = "Articles"
      url = "/articles/"
      listStyle = "rich"

    [[params.navigation.tabs]]
      name = "Projects"
      url = "/projects/"
      listStyle = "cards"
      dataSource = "projects"

    [[params.navigation.tabs]]
      name = "Me"
      url = "/me/"

  [[params.social]]
    name = "GitHub"
    link = "https://github.com/example"
    icon = "code"
    rel = "me noopener noreferrer"

[outputs]
  home = ["HTML", "RSS", "JSON", "LLMS", "LLMSFULL"]

[outputFormats]
  [outputFormats.LLMS]
    mediaType = "text/plain"
    baseName = "llms"
    isPlainText = true
    notAlternative = true
  [outputFormats.LLMSFULL]
    mediaType = "text/plain"
    baseName = "llms-full"
    isPlainText = true
    notAlternative = true

[markup]
  [markup.highlight]
    noClasses = false
  [markup.goldmark.renderer]
    unsafe = true
  [markup.tableOfContents]
    startLevel = 1
    endLevel = 3
    ordered = false
```

Important details:

- Build stats, module mounts, and cache busters let Hugo and Tailwind CSS v4 discover template classes.
- `security.allowContent` permits generated Typst HTML, CSS, and JSON page resources.
- `markup.highlight.noClasses = false` enables Piatto's light and dark Chroma palettes.
- `unsafe = true` is appropriate only for trusted content. Disable it if raw HTML is unnecessary.
- `enableGitInfo` displays the Git update date and lets `outOfDate` show a warning after the configured number of months.
- `initials` is retained for compatibility; the current header displays `params.name`.
- The home outputs produce `/index.json`, `/llms.txt`, and `/llms-full.txt`. Set an accurate production `baseURL`.

Social `icon` values must name a Material Symbol available in the theme assets.

## `piatto.config.toml`

```toml
[site]
root = "."
contentDir = "content/articles"
hugoArgs = ["--gc"]

[typst]
entry = "main.typ"
generatedDir = "generated/typst"
fontPaths = []
wordsPerMinute = 220
```

| Key | Meaning |
| --- | --- |
| `site.root` | Hugo site root relative to the configuration file |
| `site.contentDir` | Article bundle directory relative to the Hugo root |
| `site.hugoArgs` | Arguments passed to every `dev`, `check`, and `build` Hugo process |
| `typst.entry` | Entry filename in each Typst page bundle |
| `typst.generatedDir` | CLI-owned output directory that should be ignored by Git |
| `typst.fontPaths` | Additional font directories resolved relative to the configuration file |
| `typst.wordsPerMinute` | Positive integer used to estimate Typst reading time |

In the theme repository, the fixture lives under `exampleSite`, so `site.root` is `exampleSite` and `hugoArgs` includes `--themesDir ../..`.

## `package.json`

A consuming site can expose concise scripts:

```json
{
  "private": true,
  "scripts": {
    "dev": "piatto dev",
    "check": "piatto check",
    "build": "piatto build"
  },
  "devDependencies": {
    "hugo-theme-piatto": "file:themes/piatto"
  }
}
```

Use `npm run dev` or `npm exec -- piatto ...` after installation. Commit the lockfile to keep the CLI, Typst compiler, and Tailwind versions reproducible.

## The home hero

The home page reads `content/_index.md`. The simplest hero supplies Markdown or trusted HTML directly:

```markdown
---
title: Home
---

<div class="home-hero__statement">
  <h1>Research notes and practical software guides.</h1>
  <a href="#recent-posts" class="home-hero__jump">Browse recent posts</a>
</div>
```

Use the supplied split classes for media and copy:

```html
<div class="home-hero__split">
  <figure class="home-hero__media">
    <img src="/images/portrait.jpg" alt="Portrait of the author">
  </figure>
  <div class="home-hero__copy">
    <h1>Your Name</h1>
    <p>Researcher, writer, and software builder.</p>
  </div>
</div>
```

Trusted `heroHTML` front matter takes precedence over home content, which takes precedence over the default statement built from `params.description`. `recentPosts` and `search` control the sections below the hero.

## Navigation and list configuration

Each `params.navigation.tabs` entry accepts `name`, `url`, and optional `listStyle` and `dataSource` values. Style resolution prefers the section `_index.md`, then a matching tab, then the Articles or Projects default, and finally `default`.

- `default`: compact, year-grouped entries; the taxonomy hub becomes tag and category clouds.
- `rich`: a three-column editorial article index with summaries, terms, and cover reveals.
- `cards` or `card`: a two-column card list from `data/<name>.json` or child pages.

`menu.main` and custom tabs can coexist, with menu entries rendered first. `showTaxonomies` controls the combined taxonomy tab.

## SEO, search, and machine-readable output

Description precedence is page `description`, Typst manifest summary, Hugo `.Summary`, then `params.description`. The canonical URL defaults to `.Permalink` and can be replaced by `canonicalURL`; sharing images use `image` and then `cover`.

Piatto generates consistent description, canonical, Open Graph, Twitter Card, and JSON-LD metadata. `noindex: true` emits `noindex,nofollow` and excludes a page from LLMS output. The home `index.json` powers client-side search.

## Custom colors, typography, and layout

The theme compiles `assets/css/main.css` with Tailwind CSS v4. Consuming sites should put normal overrides in `static/css/custom.css`, which loads after the theme stylesheet. Prefer semantic variables over individual component patches:

```css
:root {
  --piatto-canvas: #ffffff;
  --piatto-ink: #172033;
  --piatto-muted: #5d687a;
  --piatto-line: #ccd2dc;
  --piatto-soft: #f2f4f7;
  --piatto-accent: #006b5f;
  --radius-ui: 0.25rem;
}

.dark {
  --piatto-canvas: #111315;
  --piatto-ink: #f0f2f4;
  --piatto-accent: #73d7c9;
}
```

Edit `assets/css/main.css` directly only when maintaining a theme fork, and retain its `@source "hugo_stats.json"` directive. A consuming site's `layouts/` directory can override any theme template at the same path.

## Adding a new icon

Piatto neither loads an icon font nor fetches icons in the browser. Add one or
more official 24 px Outlined Material Symbols from the site root with:

```powershell
npm exec -- piatto icon add download arrow_back
```

Names use Google's lowercase underscore form. The command skips duplicate
arguments and symbols already available from either the site or theme, then
saves each missing SVG under `assets/icons/material/` beside
`piatto.config.toml`. A missing upstream symbol, invalid name, failed request,
or non-SVG response causes a nonzero exit without writing that download batch.

The downloader honors `HTTPS_PROXY` / `https_proxy`, falls back to
`HTTP_PROXY` / `http_proxy`, and applies `NO_PROXY` / `no_proxy`. An explicit
proxy overrides those environment variables for the command:

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
npm exec -- piatto icon add download

npm exec -- piatto icon add arrow_back --proxy http://127.0.0.1:7890
```

After download, render the symbol through the partial in templates or the
shortcode in Markdown.

Template usage:

```go-html-template
{{ partial "material-icon.html" (dict "name" "download" "class" "h-5 w-5") }}
```

Article usage:

```go-html-template
{{</* icon name="download" */>}}
```

Social links use the same value with `icon = "download"`. A missing SVG causes
a build error, so commit configuration and downloaded assets together. The
generated site continues to use only local inline SVG and makes no runtime icon
request.

## CLI overview

Every command searches upward from the current directory for `piatto.config.toml`. The global option can select another file explicitly:

```powershell
npm exec -- piatto --config path/to/piatto.config.toml doctor
npm exec -- piatto --help
```

### Initialization and diagnostics

```powershell
npm exec -- piatto init [directory]
npm exec -- piatto doctor
```

`init` creates a missing `piatto.config.toml`, `content/articles/`, and `data/`. It does not install packages or alter Git configuration. `doctor` reports Node, Hugo, and resolved site and content paths.

### Development, checks, and builds

```powershell
npm exec -- piatto dev --port 1414
npm exec -- piatto check [slug...]
npm exec -- piatto check --staged
npm exec -- piatto build --baseURL https://example.com/
```

`dev` compiles Typst, starts Hugo server, and watches article sources. A failed Typst rebuild preserves the last successful output. Additional arguments pass directly to Hugo.

`check` validates front matter, force-compiles selected Typst articles, and builds the complete Hugo site into a temporary directory. Slugs narrow content validation and Typst compilation, but not the final Hugo build. `--staged` is currently hook-compatible syntax and still checks the complete site.

`build` validates all articles, uses the Typst cache, and runs a minified production Hugo build.

### Article management

```powershell
npm exec -- piatto post new --title "Post title"
npm exec -- piatto post new --type typst --title "Paper" --slug paper --published
npm exec -- piatto post new --title "Guide" --description "Summary" --tags "Hugo,Docs" --categories "Guide" --date 2026-08-20
npm exec -- piatto post list
npm exec -- piatto post validate [slug...]
npm exec -- piatto post rename old-slug new-slug --update-links
npm exec -- piatto post draft slug
npm exec -- piatto post publish slug
```

`post new` supports `--title`, `--slug`, `--description`, comma-separated `--tags` and `--categories`, `--date YYYY-MM-DD`, `--type markdown|typst`, and `--published`. A non-interactive run requires a title; otherwise the CLI prompts for it.

`post list` displays slug, title, draft state, and type. `post validate` checks the required metadata, taxonomy arrays, and Typst entry file. `rename` reports matching old root-relative links unless `--update-links` is supplied. `draft` and `publish` only update front matter.

### Icon management

```powershell
npm exec -- piatto icon add <name...>
npm exec -- piatto icon add <name...> --proxy http://127.0.0.1:7890
```

`icon add` downloads only missing official Material Symbols and leaves existing
site or theme SVGs unchanged. See [Adding a new icon](#adding-a-new-icon) for
the destination and proxy environment variables.

### Typst management

```powershell
npm exec -- piatto typst build [slug...]
npm exec -- piatto typst build --force [slug...]
npm exec -- piatto typst clean
```

The normal build hashes the source tree and compiler version. `--force` ignores that cache. `clean` removes only the configured generated directory, never author sources or images; rebuild after cleaning.

### Git hook

```powershell
npm exec -- piatto hooks install
npm exec -- piatto hooks uninstall
```

Installation writes a Piatto-marked `.git/hooks/pre-commit` that calls `piatto check --staged`. The CLI refuses to overwrite an unmanaged hook, and uninstall removes only its own marked hook.

## Recommended validation order

```powershell
npm exec -- piatto doctor
npm exec -- piatto post validate
npm exec -- piatto check
npm exec -- piatto build
```

When changing the theme itself, also run `npm test` and inspect desktop, narrow, light, and dark layouts through `npm run dev`. Do not commit `public/`, `hugo_stats.json`, `coverage/`, or `generated/typst/`.
