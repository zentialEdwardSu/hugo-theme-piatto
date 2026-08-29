---
title: Writing Articles with Piatto
date: 2025-05-18
draft: false
author: Piatto Authors
description: A practical workflow for page bundles, front matter, custom navigation tabs, article indexes, taxonomies, and project cards.
tags: [Piatto, Hugo, CLI]
categories: [Guides]
withToc: true
cover: images/writing-cover.jpg
---

Piatto treats every article as a Hugo page bundle. Metadata and Markdown live in `index.md`, images and downloads sit beside it, and a Typst article adds `main.typ`. The CLI creates, validates, and changes these bundles without relying on shell-specific commands.

<!--more-->

## The shortest workflow

Run these commands from the site root:

```powershell
npm exec -- piatto post new --title "My First Article" --slug my-first-article --tags "Hugo,Writing" --categories "Notes"
npm exec -- piatto dev
```

New articles are drafts unless `--published` is supplied. When the article is ready:

```powershell
npm exec -- piatto post validate my-first-article
npm exec -- piatto post publish my-first-article
npm exec -- piatto check my-first-article
```

`publish` only changes `draft` to `false`; it does not deploy the site.

## Page bundle structure

A Markdown article normally looks like this:

```text
content/articles/my-first-article/
|-- index.md
`-- images/
    `-- cover.jpg
```

A Typst article adds its source and generated resources:

```text
content/articles/research-note/
|-- index.md
|-- main.typ
|-- typst.css          # optional
|-- ref.bib            # optional
|-- images/
`-- generated/typst/   # managed output; ignore it in Git
```

Do not create articles as `content/articles/slug.md`. The Piatto CLI discovers page bundles by finding `index.md` files.

## Article front matter

A complete Markdown article can begin with the following fields:

```yaml
---
title: My First Article
description: Explain the problem this article solves in one sentence.
date: 2025-05-18
draft: false
author: Your Name
tags: [Hugo, Writing]
categories: [Guides]
withToc: true
cover: images/cover.jpg
keepOrigin: false
canonicalURL: https://example.com/articles/my-first-article/
image: images/social-card.jpg
imageAlt: A useful description of the social image
keywords: [Piatto, Hugo theme]
noindex: false
---
```

| Field | Purpose |
| --- | --- |
| `title`, `date` | Required metadata checked by the CLI |
| `description` | Preferred list summary and SEO description |
| `draft` | Excludes unfinished work from normal production output |
| `tags`, `categories` | Create taxonomy pages and feed the lists and search index |
| `withToc` | Enables the Hugo or Typst table of contents |
| `nowordtime` | Hides reading time and word count on that article |
| `cover` | Page resource used in the article header, rich list, and default social image |
| `keepOrigin` | Skips Hugo resizing and WebP conversion for the header cover |
| `katex` | Loads KaTeX for a Markdown article |
| `typst` | Uses compiled `main.typ` output instead of Markdown content |
| `canonicalURL` | Overrides the canonical URL |
| `image`, `imageAlt` | Override the sharing image and its alternative text |
| `keywords` | Override SEO keywords; tags are the fallback |
| `noindex`, `robots` | Control search-engine indexing directives |
| `twitterCreator` | Override the page-level Twitter/X author account |

The site-level `params.showReadingTime` is the global switch, while `nowordtime` disables it for one article. A page-level `withToc` value overrides the site default.

## Writing Markdown and adding resources

Write the body after front matter and resolve resources from the article directory:

```markdown
![Chart description](images/chart.png)

[Download the data](files/result.csv)
```

The image render hook processes local image resources and emits a width-limited WebP. Set `keepOrigin: true` only when a cover must retain the original file.

See [Markdown and Shortcode Showcase](/articles/markdown-syntax/) for rendered examples of every theme shortcode.

## Writing Typst

Create a Typst page bundle with:

```powershell
npm exec -- piatto post new --type typst --title "Research Note" --slug research-note
```

`index.md` remains the metadata source, while the article body belongs in `main.typ`. The CLI serializes front matter into the `piatto-frontmatter` input:

```typ
#let meta = json(bytes(sys.inputs.at("piatto-frontmatter", default: "{}")))
= #meta.at("title", default: "Untitled")
```

`piatto dev` watches Typst sources. You can also run `piatto typst build research-note`. The managed output contains `body.html`, `style.css`, `toc.html`, `manifest.json`, and extracted assets.

## Article indexes and year groups

`content/articles/_index.md` supplies the article section heading and list style:

```yaml
---
title: Articles
description: Notes, guides, and long-form writing.
listStyle: rich
---
```

Articles are sorted by publication date and grouped by year. The four core example articles deliberately span 2023 through 2026. Available list styles are:

- `rich`: the three-column editorial list used by the main Articles section.
- `default`: a compact year-grouped list used for taxonomy terms.
- `cards`: a two-column card grid sourced from child pages or a data file.

A section's `_index.md` value takes precedence over the matching navigation tab.

## Tags and categories

Enable the combined taxonomy entry in `hugo.toml`:

```toml
[params.navigation]
  showTaxonomies = true
  taxonomyLabel = "Topics"
  taxonomyURL = "/tags/"
  tagsLabel = "Tags"
  categoriesLabel = "Categories"
```

The taxonomy hub shows both tags and categories. Opening a term displays its articles grouped by year. The older `showTags` and `showCategories` parameters remain compatible, but new sites should use `showTaxonomies`.

## Creating a custom navigation tab

Create the target section first:

```text
content/notes/
`-- _index.md
```

Then add a tab in `hugo.toml`:

```toml
[[params.navigation.tabs]]
  name = "Notes"
  url = "/notes/"
  listStyle = "default"
```

A data-backed card section can be declared in the same way:

```toml
[[params.navigation.tabs]]
  name = "Uses"
  url = "/uses/"
  listStyle = "cards"
  dataSource = "uses"
```

The latter reads `data/uses.json`. Traditional `menu.main` entries are still rendered before custom tabs. Avoid declaring the same URL in both places.

## The Projects list

The example site's Projects tab uses a data-backed card list:

```toml
[[params.navigation.tabs]]
  name = "Projects"
  url = "/projects/"
  listStyle = "cards"
  dataSource = "projects"
```

The corresponding `data/projects.json` is an array of objects:

```json
[
  {
    "name": "Theme documentation",
    "description": "Guides and runnable examples for Piatto.",
    "link": "https://example.com/",
    "icon": "/images/project-icon.svg",
    "status": "Working",
    "tag": ["Hugo", "Docs"]
  }
]
```

Always provide `name` and `link`. The `description`, `icon`, `status`, and `tag` fields are optional. Cards without an icon show the first letter of the name. Colored states recognize `Planning`, `Working`/`Doing`, `Pending`, `Done`, and `Canceled`/`Cancelled`.

Without `dataSource`, the `cards` layout reads child pages and uses their `title`, `description`, `icon`, `status`, and `tags`. Data files suit external projects; child pages suit projects that need local detail pages.

## Checks before publishing

```powershell
npm exec -- piatto post list
npm exec -- piatto post validate
npm exec -- piatto check
npm exec -- piatto build
```

Finally, use `piatto dev` to inspect light, dark, and narrow layouts. `check` builds into a temporary directory, whereas `build` performs the production Hugo build.
