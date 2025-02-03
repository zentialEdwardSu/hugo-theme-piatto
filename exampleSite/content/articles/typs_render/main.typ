#import "./conf.typ": conf
#show: conf.with(
  title: [
    Towards Improved Modelling
  ],
  authors: (
    (
      name: "Theresa Tungsten",
      affiliation: "Artos Institute",
      email: "tung@artos.edu",
    ),
    (
      name: "Eugene Deklan",
      affiliation: "Honduras State",
      email: "e.deklan@hstate.hn",
    ),
  ),
  abstract: lorem(80),
)
#let alert(body) = text(red, weight: "bold")[#body]

= Introduction

#lorem(250)


== Text Formatting
You can use _italic_, *bold*, and `monospace` text easily. You can also #alert[highlight] text with custom functions.

== Mathematical Formulas
Typst has excellent support for mathematical typesetting. Here is an example:

$
E = m c^2 
$

And here is a more complex equation:

$
sum_(n=1)^oo 1/n^2 = pi^2/6 
$

== Lists
Typst supports both ordered and unordered lists:

- Item 1
- Item 2
  - Subitem 2.1
  - Subitem 2.2
- Item 3

1. First item
2. Second item
3. Third item

== Tables
You can create tables easily:

#table(
  columns: (1fr, 1fr, 1fr),
  [Header 1], [Header 2], [Header 3],
  [Row 1, Col 1], [Row 1, Col 2], [Row 1, Col 3],
  [Row 2, Col 1], [Row 2, Col 2], [Row 2, Col 3],
)

== References and Footnotes
You can reference sections, figures, and tables. For example, see @sample.

#figure(
  image("images/vantu.jpg", width: 300pt),
  caption: [A sample image],
) <sample>

You can also add footnotes like this: #footnote[This is a footnote.]

== Custom Functions
Typst allows you to define custom functions. Here's an example:

#let greeting(name) = text(blue)[Hello, #name!]

#greeting("World")

== Colors
You can use colors in your document:

#text(fill: rgb("#1f77b4"))[This text is blue.]

== Conclusion
Typst is a powerful and flexible typesetting system that combines the best features of traditional systems like LaTeX with modern ease of use.

#lorem(50)

== References
Typst supports IEEE-style references. Here are some examples:

- Quantum computing is a rapidly growing field @zhang2023quantum.
- Autonomous driving systems rely heavily on deep reinforcement learning @wang2022deep.
- Artificial intelligence is transforming modern society @li2021ai.
- Blockchain technology is being used to secure IoT networks @chen2023blockchain.

== Bibliography
#bibliography("ref.bib")