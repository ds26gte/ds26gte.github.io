#lang racket

(require txexpr)
(require pollen/core)
(require pollen/decode)

(require "utils.rkt")

(provide (all-defined-out))

;ToC

(define (table-of-contents)
  ; (printf "### table-of-contents of ~s\n" (select-from-metas 'here-path (current-metas)))
  ; (txexpr 'table-of-contents-1 '() '())
  `(table-of-contents-1 ()))

; ToDo: if table-of-contents called, don't insert include-section bodily, otherwise do

(define (toc-handler doc)
  ; (printf "** doing toc-handler ~s \n"  false )

  ; (printf "$$ resetting toc-entries\n")
  (define toc-entries (make-parameter '()))

  (define (collect-toc-entries doc)
    ; (printf "doing collect-toc-entries ~s\n"  false )

    (define (collect-toc-entries-from-include-section inc-file)
      ; (printf "doing collect-toc-entries-from-include-section ~s\n" inc-file)
      (let* ([html-filename (string-append "./"
                              (regexp-replace "\\.poly.pm$" inc-file ".html"))]
             [idoc (get-doc inc-file)])
        (define-values (_ section-txs)
          (splitf-txexpr idoc
            (lambda (x) (and (txexpr? x)
                        (string=? (attr-ref x 'tocentry "no") "yes")))))
        (for ([tx section-txs])
          (let ([level (attr-ref tx 'toclevel)]
                [sharp-id (string-append html-filename "#" (attr-ref tx 'id))]
                [title (get-elements tx)])
            (toc-entries (cons (list level sharp-id title) (toc-entries)))))))

    ; (printf "*** doing IV ~s\n" doc)

    (define section-txs
      (extract-tags
        (begin ;(printf "*** validating ~s\n" doc)
          (validate-txexpr doc))
        '(title-1 section-1 include-section-1)))

    ; (printf "*** doing V\n")

    (for ([tx section-txs])
      (case (get-tag tx)
        [(title-1 section-1)
         #f
         #;(let ([level (attr-ref tx 'level)]
               [id (attr-ref tx 'id)]
               [title (get-elements tx)])
           (toc-entries (cons (list level (string-append "#" id) title) (toc-entries))))
         ]
        [(include-section-1)
         (let ([inc-file (attr-ref tx 'incfile)])
           (collect-toc-entries-from-include-section inc-file))])))

  (collect-toc-entries doc)

  ; (printf "*** done collect-toc-entries\n")

  (define toc-used? false)

  (define (replace-sections tx)

    (define (output-toc)
      (let ([tocitems '()])
        (for ([toc-entry (toc-entries)])
          ; (printf "adding tocentry ~s\n" toc-entry)
          (set! tocitems
            (cons `(li ([class ,(string-append "indent" (first toc-entry))])
                       (a ([href ,(second toc-entry)]) ,@(third toc-entry)))
                  tocitems)))
        `(ul ([class "toclist"]) ,@tocitems)))

    (case (get-tag tx)
      [(table-of-contents-1)
       (set! toc-used? true)
       (output-toc)]
      [(title-1)
       `(h1 ([id ,(attr-ref tx 'id)] [toclevel "1"] [tocentry "yes"])
            ,@(get-elements tx))]
      [(section-1)
       (let ([level (attr-ref tx 'level)])
         (define h-tag (h-tag-at-depth level))
         `(,h-tag ([id ,(attr-ref tx 'id)] [toclevel ,level] [tocentry "yes"])
                  ,@(get-elements tx)))]
      [(include-section-1)
       (if toc-used? `(span ([class "includesection"]))
           (let* ([incfile (attr-ref tx 'incfile)]
                  [htmlfile (string-append "./"
                              (regexp-replace "\\.poly.pm$" incfile ".html"))]
                  [doc (get-doc incfile)]
                  [link-text (doc-title doc)]
                  )
             ; (printf "### incfile = ~s\n" incfile)
             `(div () (a ((href ,htmlfile)) ,link-text))
             )
           ; (let* ([incfile (attr-ref tx 'incfile)]
           ;        [idoc (get-doc incfile)]
           ;        [idoc (change-tag idoc 'root 'div)]
           ;        [idoc (change-tag idoc 'title 'h1)]
           ;        )
           ;   idoc
           ;   )
           )]

      [else tx]))

  (decode doc #:txexpr-proc replace-sections))
