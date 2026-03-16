#lang racket

; (require txexpr)
(require pollen/decode)

(provide (all-defined-out))

(define (decode-paragraphs-1 xx)
  (define (br-becomes-space xx)
    (decode-linebreaks xx " "))
  (decode-paragraphs xx #:linebreak-proc br-becomes-space))

