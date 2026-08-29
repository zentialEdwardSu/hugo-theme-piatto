# hugo-theme-piatto

Piatto is a Hugo theme with Tailwind CSS v4, search, responsive layouts, and
native Typst-to-HTML articles.

## Requirements

- Hugo Extended 0.165.0 or later
- Node.js 22.18.0 or later
- npm

The Typst compiler is distributed as a Node dependency; a separate `typst`
binary or Python installation is not required.

## Installation

Add the theme as a submodule, then install its local npm package from your site
root:

```bash
git submodule add https://github.com/zentialEdwardSu/hugo-theme-piatto.git themes/piatto
npm install --save-dev ./themes/piatto
npm exec -- piatto init
```

Review the generated `piatto.config.toml`, then copy the required Hugo settings
from `themes/piatto/exampleSite/hugo.toml` into your site configuration. In
particular, Hugo must allow the generated `text/html` page resource through
`security.allowContent`.

## Development and build

```bash
npm exec -- piatto dev
npm exec -- piatto check
npm exec -- piatto build
```

In the theme repository, the equivalent commands are `npm run dev`,
`npm run check`, and `npm run build`. Hugo compiles `assets/css/main.css` with
its Tailwind pipeline during each build.

## Syntax highlighting

Piatto uses class-based Chroma output so its Vitesse Light Soft and Dark Soft
palettes can follow the site's color mode. Keep inline Chroma styles disabled:

```toml
[markup.highlight]
  noClasses = false
```

## Home hero component

The home page renders `layouts/partials/home-hero.html`. Add HTML or Markdown to
`content/_index.md` to replace the default centered statement. The component
also accepts trusted HTML from the page front matter through `heroHTML`.

Use the supplied split-layout classes for a media-and-copy hero:

```html
<div class="home-hero__split">
  <figure class="home-hero__media">
    <img src="/images/portrait.jpg" alt="Portrait description">
  </figure>
  <div class="home-hero__copy">
    <h1>Page title</h1>
    <p>Introduction.</p>
  </div>
</div>
```

Arbitrary HTML is allowed inside the component; these classes are optional.

## Navigation and list layouts

Tags and categories can share one primary-navigation entry without declaring a
manual Hugo menu entry. The target page displays both taxonomies as compact
term blocks:

```toml
[params.navigation]
  showTaxonomies = true
  taxonomyLabel = "Tags"
  taxonomyURL = "/tags/"
  tagsLabel = "Tags"
  categoriesLabel = "Categories"
```

The previous `showTags` and `showCategories` settings remain accepted, but now
produce the same combined taxonomy tab.

Use `params.navigation.tabs` for additional navigation tabs. A tab can select
the list layout used by its target section:

```toml
[[params.navigation.tabs]]
  name = "Notes"
  url = "/notes/"
  listStyle = "default"

[[params.navigation.tabs]]
  name = "Work"
  url = "/work/"
  listStyle = "cards"
  dataSource = "work"
```

The available list styles are:

- `default`: the compact, year-grouped article list used after opening an
  individual tag or category. The combined taxonomy index uses term blocks.
- `rich`: the large three-column editorial list used by Articles.
- `cards`: the two-column card grid used by Projects. Without `dataSource`,
  cards are built from the section's child pages. With `dataSource = "work"`,
  items are read from `data/work.json` and accept `name`, `description`, `link`,
  `icon`, `status`, and `tag` fields.

The target section may set the style directly in its `_index.md`; this takes
precedence over the tab setting:

```yaml
---
title: Notes
description: Short observations and working drafts.
listStyle: rich
---
```

Existing `menu.main` entries remain supported and are rendered before the
optional taxonomy links and custom tabs. Avoid declaring the same URL in both
`menu.main` and `params.navigation.tabs`.

## SEO and generative search

The theme derives one normalized description for HTML metadata, Open Graph,
Twitter Cards, JSON-LD, and the machine-readable site indexes. The precedence
is front matter `description`, the generated Typst summary, the Hugo summary,
then `params.description`. HTML and repeated whitespace are removed before the
description is truncated.

Set the canonical content and sharing image per page when needed:

```yaml
description: A concise description written for humans.
canonicalURL: https://example.com/original-article/
image: images/social-card.jpg
imageAlt: A useful description of the sharing image.
author: Author Name
keywords: [Hugo, Typst]
noindex: false
```

Copy `enableRobotsTXT`, `outputFormats`, and the `LLMS` / `LLMSFULL` home
outputs from `exampleSite/hugo.toml` into the site configuration. Hugo then
generates `/robots.txt`, `/llms.txt`, and `/llms-full.txt`. Keep the production
`baseURL` accurate because canonical URLs, sitemap references, and GEO indexes
all use it.

## Managing posts

```bash
npm exec -- piatto post new --type typst --title "My Article"
npm exec -- piatto post list
npm exec -- piatto post validate
npm exec -- piatto post publish my-article
```

Run `npm exec -- piatto --help` for rename, draft, hook, and targeted
Typst commands. `index.md` is always the metadata source. A Typst bundle sets
`typst: true` and uses `main.typ` as its entry point.

## Typst HTML

`piatto` compiles Typst to semantic HTML, extracts embedded images, and writes
ignored page resources under `generated/typst/`. The generated manifest powers
the table of contents, search text, summaries, word counts, and reading time.
Production builds fail when compilation fails or output is unavailable.

The theme scopes Typst and compiler styles under `.typst-content`. Add an
optional `typst.css` beside `main.typ` for article-specific overrides. Typst
HTML export is experimental; compiler versions are locked and upgrades must be
validated against the example article.

## Icons

The theme vendors only the Material Symbols it uses under
`assets/icons/material/` and inlines them at Hugo build time through
`layouts/partials/material-icon.html`. Configure social icons with a Material
Symbol name such as `mail` or `code`; use `{{</* icon name="warning" */>}}` in
Markdown content.

Use the CLI to add one or more icons. It downloads only icons that are not
already available from the site or theme and saves them under
`assets/icons/material/` beside `piatto.config.toml`:

```bash
npm exec -- piatto icon add arrow_back download
```

Downloads use `HTTPS_PROXY` (or lowercase `https_proxy`) and fall back to
`HTTP_PROXY` / `http_proxy`; `NO_PROXY` / `no_proxy` is honored. Pass
`--proxy http://127.0.0.1:7890` to override the environment for a command:

```bash
npm exec -- piatto icon add arrow_back --proxy http://127.0.0.1:7890
```

The command accepts official lowercase underscore names and fetches the 24 px
Outlined SVG from Google's Material Symbols repository. Icons remain fully
local after this step; the generated site makes no runtime icon requests.

## Credits

- Theme inspiration: [Hugo Digital Garden](https://github.com/paulmartins/hugo-digital-garden-theme)
- Typst integration reference: [astro-typst](https://github.com/OverflowCat/astro-typst)
- Syntax highlighting palettes: [Vitesse Theme](https://github.com/antfu/vscode-theme-vitesse) by Anthony Fu
- Icons: [Material Symbols](https://github.com/google/material-design-icons)
- Search approach: [fast search for Hugo](https://gist.github.com/cmod/5410eae147e4318164258742dd053993)
