/**
 * Picks an unbiased integer index in `[0, count)`.
 *
 * api-design.md section 5 requires selection to use an unbiased integer over
 * this range without rounding an inclusive upper bound. `Math.random()`
 * always returns a value in `[0, 1)`, so multiplying by `count` and flooring
 * keeps every index from 0 through `count - 1` reachable with equal width,
 * and can never reach `count` itself.
 */
export const pickRandomIndex = (count: number): number =>
  Math.floor(Math.random() * count);
