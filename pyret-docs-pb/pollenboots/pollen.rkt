#lang racket

(require txexpr)
; (require pollen/core)
; (require pollen/file)
(require pollen/decode)
(require pollen/misc/tutorial)
(require pollen/tag)
; (require pollen/setup)
; (require racket/date)

; remember to provide everything from here:
(require "utils.rkt")
(require "nice-paragraphs.rkt")
(require "common-tags.rkt")
(require "make-toc.rkt")
(require "make-glossary.rkt")
(require "make-xref.rkt")

; (printf "## current-metas is ~s\n" (current-metas))

; (printf "## processing ~s\n" here)

(provide [all-defined-out])

(provide [all-from-out "utils.rkt"
                       "nice-paragraphs.rkt"
                       "common-tags.rkt"
                       "make-toc.rkt"
                       "make-glossary.rkt"
                       "make-xref.rkt"
                       ])

(define (root . elts)
  (let* ([doc `(root ,@elts)]
         [doc (toc-handler doc)]
         [doc (glossary-handler doc)]
         [doc (xref-handler doc)])
    ; (printf "starting root decode of ~s\n" doc)
    (decode doc ;decode-elements elts?
            #:txexpr-elements-proc decode-paragraphs-1
            #:exclude-tags '(pre)
            #:string-proc (compose1 smart-quotes smart-dashes))))
