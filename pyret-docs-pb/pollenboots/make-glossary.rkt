#lang racket

(require txexpr)
(require pollen/core)
(require pollen/decode)

(require "utils.rkt")
(require "common-tags.rkt")

(provide (all-defined-out))

(define (make-index-element style content tag plainseq entryseq desc)
  ; using, for now: tag plainseq entryseq
  ; (printf "### make-index-element ~s ~s ~s\n" tag plainseq entryseq)
  (define alpha-tag (first plainseq))
  (define tag-1 (second tag))
  (make-gloss alpha-tag tag-1 (first entryseq)))

(define gloss make-gloss)

(define (custom-index-block)
  `(output-glossary-1 ()))

;Glossary

(define (glossary-handler doc)

  (define curr-mod "nodoc")

  (define here-path-from-project-root (calc-here-path-from-project-root))

  (define project-root-from-here-path (to-project-root here-path-from-project-root))

  (define glossary-entries '())

  (define-values (doc-without-module-tag module-tag)
    (splitf-txexpr doc
      (lambda (tx) (and (txexpr? tx) (eq? (get-tag tx) 'module-tag-1)))))

  (unless (null? module-tag)
    (set! curr-mod
      (car (get-elements (car module-tag)))))

  (set! doc doc-without-module-tag)

  (define-values (doc-without-glossary-defs glossary-defs)
    (splitf-txexpr doc
      (lambda (tx) (and (txexpr? tx) (eq? (get-tag tx) 'gloss-1)))))

  ; (printf "### here-path-from-project-root = ~s\n" here-path-from-project-root)
  ; (printf "### project-root-from-here-path = ~s\n" project-root-from-here-path)

  (for ([tx glossary-defs])
    (let* ([item-values (get-elements tx)]
           [item-alpha (first item-values)]
           [item-sluggified (second item-values)]
           [item (third item-values)])
      (set! glossary-entries
        (cons (list (string-append curr-mod ":" item-alpha) item-alpha item
                    (string-append here-path-from-project-root "#" item-sluggified))
              glossary-entries))))

  (when (pair? glossary-entries)

    (call-with-output-file (build-path *project-root* "_glossary.rkt")
      (lambda (o)
        (for ([x glossary-entries])
          (write x o)
          (newline o)))
      #:exists 'append)

    )

  (define *sorted-glossary* '())

  (define (read-glossary)
    (define globals-list (read-globals))

    (let ([a (assoc 'glossary globals-list)])
      (when a (set! *sorted-glossary* (cdr a))))

    )

  (read-glossary)

  (define (output-glossary-func)
    ; (printf "### output-glossary-func\n")

    (if (null? *sorted-glossary*) `(div ())
        (let ()

            (define (get-item-first-letter item)
              (let ([n (string-length item)])
                (if (= n 0) #\*
                    (let ([c0 (string-ref item 0)])
                      (if (char-alphabetic? c0)
                          (if (char-lower-case? c0) c0 (char-downcase c0))
                          #\*)))))

            (define list-of-subglossaries
              (group-by
                (lambda (x)
                  (let* ([item (second x)])
                    (get-item-first-letter item)))
                *sorted-glossary*))

            (define glossary-cell-alist
              (let ([the-letters (cons #\* (string->list "abcdefghijklmnopqrstuvwxyz"))])
                (map (lambda (c) (list c (box #f) (box #f))) the-letters)))

            (define glossary-exp '())

            (define alpha-row-exp '())

            ; (printf "### starting main stuff\n")

            (for ([subglossary list-of-subglossaries])
              (let* ([any-entry (first subglossary)] ;guaranteed to have >= 1 entry
                     [any-item (second any-entry)]
                     [any-item-first-letter (get-item-first-letter any-item)]
                     [c (assoc any-item-first-letter glossary-cell-alist)]
                     [cb (second c)]
                     [alpha-link (third c)])
                (unless (unbox cb)
                  (set-box! cb subglossary)
                  (set-box! alpha-link (format "_glossary-alpha-index-~a" (first c)))
                  )))

            ; (printf "### main stuff II\n")
            ; (printf "### glossary-cell-alist = ~s\n" glossary-cell-alist)

            ; discard empty subglossaries
            (set! glossary-cell-alist
              (filter (lambda (glossary-cell)
                        (unbox (second glossary-cell))) glossary-cell-alist))

            (for ([glossary-cell glossary-cell-alist])
              ; (printf "### doing a glossary-cell ~s\n" glossary-cell)
              (let* ([glossary-anchor (unbox (third glossary-cell))]
                     [glossary (unbox (second glossary-cell))]
                     [first-glossary-entry (first glossary)])
                ; (printf "### glossary-anchor = ~s\n" glossary-anchor)
                ; (printf "### glossary = ~s\n" glossary)
                ; (printf "### first-glossary-entry = ~s\n" first-glossary-entry)
                (set! glossary-exp
                  (cons `(div ([class "glossary-sep"]) (a ([name ,glossary-anchor])))
                        glossary-exp))
                (let ([prev-item "NON_EXISTENT"]
                      [number-seen 0])
                  (for ([glossary-entry glossary])
                    (let ([suffix '()]
                          [curr-item (third glossary-entry)])
                      (cond [(equal? curr-item prev-item)
                             (set! number-seen (+ number-seen 1))
                             (set! suffix (list (format " (~a)" (+ number-seen 1))))]
                            [else (set! prev-item curr-item)
                                  (set! number-seen 0)])
                      (set! glossary-exp
                        (cons `(li () (a ([href ,(fourth glossary-entry)] [class "indexlink"])
                                         ,(third glossary-entry)
                                         ,@suffix
                                         ))
                              glossary-exp)))))))

            ; (printf "### glossary-exp = ~s\n" glossary-exp)

            (set! glossary-exp (reverse glossary-exp))

            (set! alpha-row-exp
              (map (lambda (glossary-cell)
                     `(a ([href ,(string-append "#" (unbox (third glossary-cell)))])
                         ,(string (char-upcase (first glossary-cell)))))
                   glossary-cell-alist))

            ; (printf "### alpha-row-exp = ~s\n" alpha-row-exp)

            ; `(div ())

            `(div ()
                  (a ([name "(part._.Glossary)"]))
                  (div ([class "nested alpha-row"])
                       ,@(add-between alpha-row-exp '(span ([class "quad"]) " · ")))
                  (ul ([class "glossary content-body"])
                      ,@glossary-exp))

            ; `(div ()
            ;       (ul ()
            ;           ,@glossary-exp))

            )

    ))

  (define (output-ref-gloss xx)
    ; (printf "### output-ref-gloss ~s ~s\n" xx curr-mod)
    ; (printf "### *sorted-glossary* = ~s\n" *sorted-glossary*)
    (let* ([item-alpha (first xx)]
           [item-mod (let ([y (second xx)])
                       (if (string=? y "nodoc") curr-mod y))]
           [item (third xx)]
           [mod:item (string-append item-mod ":" item-alpha)]
           [nodoc:item (string-append "nodoc:" item-alpha)]
           [items-gloss (or (assoc mod:item *sorted-glossary*)
                            (assoc nodoc:item *sorted-glossary*))]
           [href (if (list? items-gloss) (fourth items-gloss) "missing_gloss")]
           )
      ; (printf "### mod:item = ~s\n" mod:item)
      (set! href (string-append project-root-from-here-path href))
      ; (printf "### items-gloss = ~s\n" items-gloss)
      ; (printf "### href = ~s\n" href)
      `(a ([href ,href]) ,item)))

  (define (process-glossary tx)
    (case (get-tag tx)
      [(output-glossary-1)
       (output-glossary-func)]
      [(ref-gloss-1) (output-ref-gloss (get-elements tx))]
      [else tx]))

  (decode doc-without-glossary-defs #:txexpr-proc process-glossary)
  )
