export function factorial(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('factorial requires a non-negative integer');
  }
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}
