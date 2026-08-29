---
title: Markdown and Shortcode Showcase
date: 2023-10-05
draft: false
author: Piatto Authors
description: A visual reference for Markdown, Goldmark extensions, trusted HTML, Hugo shortcodes, and every shortcode included with Piatto.
tags: [Markdown, Shortcode, Hugo]
categories: [Writing]
withToc: true
cover: images/markdown-cover.png
---

This article is a visual reference for the Markdown syntax supported by Piatto's default configuration. It also renders the theme's `hint`, `icon`, and `bilibili` shortcodes instead of merely showing their source.

<!--more-->

## Headings

The page title comes from the `title` front matter field, so article content normally starts at level two. All six Markdown heading levels are shown below.

# Heading level one
## Heading level two
### Heading level three
#### Heading level four
##### Heading level five
###### Heading level six

## Paragraphs and line breaks

A blank line starts a new paragraph. A normal source line break remains part of the same paragraph.<br>
Two trailing spaces or an HTML `<br>` element create a hard line break.

A backslash escapes Markdown punctuation: \*this is not italic\* and \# this is not a heading.

## Emphasis, deletion, and inline code

This sentence contains *italic text*, **bold text**, ***bold italic text***, ~~deleted text~~, and `npm exec -- piatto dev`.

Markdown accepts Unicode text such as cafe, pi, and celebratory symbols. Browsers collapse repeated spaces according to normal HTML rules.

## Links

- Inline link: [Hugo](https://gohugo.io/ "Hugo website")
- Automatic link: <https://gohugo.io/>
- Email address: <hello@example.com>
- Reference link: [Piatto repository][piatto]
- In-page link: [Jump to the table](#tables)

[piatto]: https://github.com/zentialEdwardSu/hugo-theme-piatto "Piatto"

## Images

Keep important images in the article bundle and reference them relative to `index.md`. Piatto's image render hook finds the page resource and generates a width-limited WebP version.

![Abstract cover reused from an earlier example](images/markdown-cover.png "Bundled page resource")

Remote image URLs also work, but local page resources are more reliable and can be processed by Hugo.

## Blockquotes

> A useful example should show the final result as well as the source syntax.
>
> Blockquotes may still contain **emphasis**, `code`, and lists:
>
> - First item
> - Second item

Blockquotes can be nested:

> First level
>> Second level

## Lists

Unordered list:

- Article metadata
- Markdown content
  - Image resources
  - Download resources
- Generated output

Ordered list:

1. Create the page bundle
2. Write and preview the article
3. Validate and publish it

An ordered list may start at a specific number:

4. Build the site
5. Deploy `public/`

Task list:

- [x] Add a title and publication date
- [x] Write a useful description
- [ ] Publish the article

## Definition lists

Page bundle
: A directory whose `index.md` file owns adjacent images and downloads.

Shortcode
: Hugo syntax that invokes a reusable template component from content.
: A term may have more than one definition.

## Tables

| Alignment | Markdown | Typical content |
| :--- | :---: | ---: |
| Left | `:---` | Text |
| Center | `:---:` | Status |
| Right | `---:` | Numbers |

Table cells can contain *italic text*, **bold text**, [links](https://gohugo.io/), and `code`.

## Code

Inline code is useful for commands and filenames such as `hugo.toml`. Fenced blocks accept a language and Hugo highlighting options.

```ts {linenos=true,hl_lines=[2]}
const theme = 'piatto';
const command = `npm exec -- ${theme} check`;
console.log(command);
```

Indenting a block by four spaces also creates code:

    npm exec -- piatto post list
    npm exec -- piatto post validate

Hugo's built-in `highlight` shortcode is available as well:

{{< highlight toml >}}
[params]
  showReadingTime = true
{{< /highlight >}}

## Horizontal rules

The following three forms are equivalent. Piatto currently hides article horizontal rules visually, but they remain part of the document structure.

---

***

___

## Footnotes

A sentence can include a short footnote.[^short] Footnotes can also contain several paragraphs.[^long]

[^short]: This is a short footnote.

[^long]: This is the first paragraph of a longer footnote.

    Indentation continues the footnote and may include `inline code`.

## Trusted HTML

The example site enables `markup.goldmark.renderer.unsafe`, so trusted content can contain HTML.

<details>
  <summary>Open the HTML example</summary>
  <p><abbr title="HyperText Markup Language">HTML</abbr> supports <mark>highlighting</mark>, H<sub>2</sub>O, x<sup>2</sup>, <kbd>Ctrl</kbd> + <kbd>K</kbd>, and <samp>sample output</samp>.</p>
</details>

Do not enable or inject raw HTML when authors or content are not trusted.

## Theme shortcodes

### Hint

The first positional argument selects `Info`, `Warning`, or `Danger`; the optional second argument supplies a heading. The current template inserts the inner value as trusted HTML, so use HTML tags when formatting it.

{{% hint Info "Information" %}}
This is an <code>Info</code> hint with <strong>HTML formatting</strong>.
{{% /hint %}}

{{% hint Warning "Before cleaning" %}}
Run the Typst build again after <code>piatto typst clean</code>.
{{% /hint %}}

{{% hint Danger "Destructive work" %}}
Do not overwrite uncommitted article resources.
{{% /hint %}}

### Icon

The `icon` shortcode accepts the filename of a vendored Material Symbol: {{< icon name="warning" >}} `warning`, {{< icon name="check" >}} `check`, and {{< icon name="code" >}} `code`.

```go-html-template
{{</* icon name="warning" */>}}
```

### Bilibili

The `bilibili` shortcode accepts either a BV identifier or an AV identifier and emits a responsive player.

```go-html-template
{{</* bilibili BV1kE41147oo */>}}
```

{{< bilibili BV1kE41147oo >}}

## Hugo built-in shortcodes

Hugo also provides built-in shortcodes such as `figure`, `highlight`, `ref`, `relref`, `youtube`, `vimeo`, and `instagram`. Review Hugo's privacy settings before embedding third-party media.

## Invisible authoring controls

Markdown comments remain in the HTML source but are not displayed. Hugo's `<!--more-->` marker controls where `.Summary` ends; this article includes one immediately after its introduction.
