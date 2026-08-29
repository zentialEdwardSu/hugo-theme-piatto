#let conf(
  title: none,
  authors: (),
  abstract: [],
  doc,
) = context {
  if target() == "html" {
    html.elem("header", attrs: (class: "typst-document-header"))[
      #html.elem("h1")[#title]
      #html.elem("div", attrs: (class: "typst-authors"))[
        #for author in authors {
          html.elem("p")[
            #strong(author.name) \
            #author.affiliation \
            #link("mailto:" + author.email)
          ]
        }
      ]
      #html.elem("section", attrs: (class: "typst-abstract"))[
        #strong[Abstract] \
        #abstract
      ]
    ]
    doc
  } else {
    set page(margin: 0pt)
    set align(center)
    text(17pt, title)

    let count = authors.len()
    let ncols = calc.min(count, 3)
    grid(
      columns: (1fr,) * ncols,
      row-gutter: 24pt,
      ..authors.map(author => [
        #author.name \
        #author.affiliation \
        #link("mailto:" + author.email)
      ]),
    )

    par(justify: false)[
      *Abstract* \
      #abstract
    ]

    set align(left)
    doc
  }
}
