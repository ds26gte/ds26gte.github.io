#import "@preview/gentle-clues:0.8.0": *

#let title(tytle) = [
#align(center, text(17pt)[#tytle] )
]

#let plain(doc) = [
#set heading(
  numbering: "1."
  )
#set page(
  margin: (
    top: 1in,
    bottom: 1in,
    left: 1.25in,
    right: 1.25in,
  ),
  numbering: "1"
)
#doc
]
