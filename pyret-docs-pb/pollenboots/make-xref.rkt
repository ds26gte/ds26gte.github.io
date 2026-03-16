#lang racket

(require txexpr)
(require pollen/decode)

(require "utils.rkt")

(provide (all-defined-out))

(define (seclink #:tag-prefixes [tag-prefixes #f] . elems)
  ; (printf "### seclink tp= ~s ee= ~s\n" tag-prefixes elems)
  (cond [(not tag-prefixes) `(seclink-1 () ,@elems)]
        [(list? tag-prefixes) `(seclink-1 ([tag-prefixes ,(car tag-prefixes)]) ,@elems)]
        [else `(seclink-1 ([tag-prefixes ,tag-prefixes]) ,@elems)]))

(define (xxref attribs . elems)
  (let ([item (first elems)])
    `(xxref-1 () ,item)))

(define (xref-handler doc)

  (define here-path-from-project-root (calc-here-path-from-project-root))

  (define xref-name-entries '())

  (define-values (_ name-defs)
    (splitf-txexpr doc
      (λ (tx) (and (txexpr? tx)
                   (member (get-tag tx) '(h1 h2 h3 h4 h5 h6))
                   (attrs-have-key? tx 'id)))))

  (for ([tx name-defs])
    (let ([xref-name (attr-ref tx 'id)])
      ; (printf "### calling string-join on ~s\n" (get-elements tx))
      (set! xref-name-entries
        (cons (list xref-name 
                    (string-append
                                here-path-from-project-root "#" xref-name)
                    (get-elements tx)
                    ; (string-join (get-elements tx) "")
                    )
              xref-name-entries))))

  (when (pair? xref-name-entries)
    (call-with-output-file (build-path *project-root* "_xref.rkt")
      (λ (o)
        (for ([x xref-name-entries])
          (write x o) (newline o)))
      #:exists 'append)
    )

  (define *globals-list* (read-globals))
  (define xref-entries (let ([a (assoc 'xref *globals-list*)])
                         (if a (cdr a) '())))

  (define project-root-from-here (point-to-project-root here-path-from-project-root))

  (define (replace-secrefs tx)
    (define this-tag (get-tag tx))
    (case this-tag
      [(secref seclink-1 ;xxref-1
               )
       ; (printf "### doing replace-secrefs ~s\n" tx)
       (define this-tag-elems (get-elements tx))
       ; (printf "### this-tag-elems = ~s\n" this-tag-elems)
       (define num-this-tag-elems (length this-tag-elems))
       (let* ([name (first this-tag-elems)]
              [xref (assoc name xref-entries)]
              [url (if xref (second xref) "UnDeFiNeD")]
              [text (cond [(and (eq? this-tag 'seclink-1)
                                (>= num-this-tag-elems 1))
                           ; (printf "this-tag-elems = ~s\n" this-tag-elems)
                           (add-between (cdr this-tag-elems) " ")]
                          [xref (third xref)]
                          [else (list "UnDeFiNeD")])])
         (set! url (string-append project-root-from-here url))
         ; (printf "### text is ~s\n" text)
         `(a ([href ,url]) ,@text))]
      [else tx]))

  (decode doc #:txexpr-proc replace-secrefs)

  )
