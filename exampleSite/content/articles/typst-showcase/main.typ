#import "./conf.typ": conf

// Piatto passes index.md front matter to Typst through sys.inputs.
#let meta = json(bytes(sys.inputs.at("piatto-frontmatter", default: "{}")))

#show: conf.with(
  title: meta.at("title", default: "Typst Showcase"),
  authors: (
    (
      name: "Ada Lovelace",
      affiliation: "Example Research Group",
      email: "ada@example.com",
    ),
    (
      name: "Alan Turing",
      affiliation: "Piatto Documentation Team",
      email: "alan@example.com",
    ),
  ),
  abstract: [
    This article exercises the Typst features supported by Piatto's native HTML
    pipeline. Its title comes from `index.md`; its body, table of contents,
    search text, summary, images, word count, and reading time are generated
    from this file.
  ],
)

#let badge(body) = html.elem(
  "span",
  attrs: (style: "display:inline-block;padding:.1rem .4rem;border:1px solid currentColor"),
)[#body]

= Text and links

Typst supports _emphasis_, *strong text*, `inline code`, smart punctuation,
and #link("https://typst.app/docs/")[ordinary links]. A reusable function can
produce custom output such as #badge[HTML export].

#quote(block: true, attribution: [Piatto])[
  Author in Typst, publish through Hugo, and keep the result searchable.
]

== Lists

- A bullet item
- A second item
  - A nested item
  - Another nested item
- A final item

1. Create the article bundle.
2. Edit `main.typ`.
3. Run `piatto typst build` or `piatto dev`.

== Mathematics

Inline mathematics works naturally: $a^2 + b^2 = c^2$.

A displayed equation is exported as semantic math content:

$
  integral_0^oo e^(-x^2) dif x = sqrt(pi) / 2
$

The Basel problem gives another compact example:

$
  sum_(n=1)^oo 1 / n^2 = pi^2 / 6
$

== Tables

#table(
  columns: (1.4fr, 1fr, 2fr),
  table.header([*Source*], [*Required*], [*Purpose*]),
  [`index.md`], [Yes], [Hugo metadata and the Typst switch],
  [`main.typ`], [Yes], [Typst article source],
  [`typst.css`], [No], [Article-specific HTML style overrides],
  [`generated/typst/`], [Generated], [HTML, CSS, manifest, TOC, and assets],
)

== Code

Typst raw blocks are emitted as code blocks:

```typ
#let meta = json(bytes(sys.inputs.at("piatto-frontmatter")))
= #meta.at("title")
```

== Figure and page assets

#figure(
  image("images/vantu.jpg", width: 70%),
  caption: [A bundled image compiled and extracted by Piatto.],
) <sample-figure>

Figure @sample-figure demonstrates that assets referenced by Typst are copied
into `generated/typst/assets/` with content-derived names.

== Footnotes and references

Footnotes remain part of the HTML document.#footnote[
  The generated manifest also includes plain text and a calculated reading time.
]

Bibliography citations work too: quantum computing is an active field
@zhang2023quantum, while artificial intelligence affects many disciplines
@li2021ai.

== Front matter contract

The metadata file is still `index.md`. Set `typst: true`, keep the Markdown
body empty, and read any extra values through `sys.inputs`:

```typ
#let meta = json(bytes(sys.inputs.at("piatto-frontmatter", default: "{}")))
#let title = meta.at("title", default: "Untitled")
```

Piatto sanitizes exported HTML, scopes compiler CSS under `.typst-content`, and
uses the last successful generated output if recompilation fails during `dev`.
Production `build` and `check` fail if valid output cannot be produced.

== Bibliography

#bibliography("ref.bib")
