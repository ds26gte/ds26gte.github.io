#set page(numbering: "1")
#set math.mat(delim: "[")
#set math.vec(delim: "[")

Proof that the single-variable linear-regression predictor
derived using the general matrix-based multiple
regression algorithm gives the same results as the original Pyret
implementation.

Given: a set of inputs ${x, ...}$ and their corresponding outputs
${y, ...}$.

Let

$ X = mat(1, x; dot, dot; dot, dot; dot, dot) ,
  Y = mat(y; dot; dot; dot) $

Using the multiple-regression algorithm, we get

$ B = vec(alpha, beta) = (X^T X)^(-1) X^T Y.
quad quad (1) $

and the predictor function is $y = alpha + beta x$.

We have

$ X^T = mat(1, dot, dot, dot; x, dot, dot, dot) $

$ therefore X^T X = mat(1, dot, dot, dot; x, dot, dot, dot)
                    mat(1, x; dot, dot; dot, dot; dot, dot) =
                    mat(n, Sigma x; Sigma x, Sigma x^2) $

We then have

$ "det" X^T X &= n Sigma x^2 - (Sigma x)^2 = Delta "(say)" \

"and" quad quad "cof" X^T X &=
   mat(Sigma x^2, - Sigma x; - Sigma x, n) $

The adjoint of a matrix is the transpose of its cofactor matrix. So

$ "adj" X^T X = ("cof" X^T X)^T $

But $"cof" X^T X$ is diagonally symmetric, so its transpose is itself. So

$ "adj" X^T X = "cof" X^T X $

The inverse of a matrix is its adjoint divided by its determinant. So

$ (X^T X)^(-1) = ("adj" X^T X) / Delta =
(1/Delta) mat(Sigma x^2, - Sigma x; - Sigma x, n) $

Putting all this in (1), we have

$ B &= (1/Delta) mat(Sigma x^2, -Sigma x; -Sigma x, n)
mat(1, dot, dot, dot; x, dot, dot, dot)
mat(y; dot; dot; dot) \

    &= (1/Delta) mat(Sigma x^2, -Sigma x; -Sigma x, n)
    mat(Sigma y; Sigma x y) \

    &= (1/Delta)
    mat(Sigma x^2 Sigma y - Sigma x Sigma x y;
    - Sigma x Sigma y + n Sigma x y) $

$ therefore alpha &= (Sigma x^2 Sigma y - Sigma x Sigma x y) /
                     (n Sigma x^2 - (Sigma x)^2) \

 "and" beta &= (n Sigma x y - Sigma x Sigma y) /
               (n Sigma x^2 - (Sigma x)^2) quad quad "(2)" $

 Back to the original Pyret implementation. There we have

 $ beta &= (Sigma x y - (Sigma x Sigma y)/n) / (Sigma x^2- (Sigma x)^2/n) \

 &= (n Sigma x y - Sigma x Sigma y) /
    (n Sigma x^2 - (Sigma x)^2) $

 $

  "and" quad quad alpha &= macron(y) - beta macron(x) \

   &= ((Sigma y)/n) -
      ((n Sigma x y - Sigma x Sigma y) / (n Sigma x^2 - (Sigma x)^2))
      ((Sigma x)/n) \

   &= ((Sigma y)/n) -
      ((n Sigma x Sigma x y - (Sigma x)^2 Sigma y) /
      (n (n Sigma x^2 - (Sigma x)^2))) \

   &= (Sigma y (n Sigma x^2 - (Sigma x)^2) - n Sigma x Sigma x y +
          (Sigma x)^2 Sigma y) / (n (n Sigma x^2 - (Sigma x)^2)) \

   &= (n Sigma x^2 Sigma y - (Sigma x)^2 Sigma y - n Sigma x Sigma x y
          + (Sigma x)^2 Sigma y) / (n (n Sigma x^2 - (Sigma x)^2)) \

   &= (n Sigma x^2 Sigma y - n Sigma x Sigma x y) /
            (n (n Sigma x^2 - (Sigma x)^2)) \

   & = (Sigma x^2 Sigma y - Sigma x Sigma x y) / (n Sigma x^2 - (Sigma x)^2)

   $

But these match exactly the values for $alpha, beta$ in (2).
$quad quad$ QED.
