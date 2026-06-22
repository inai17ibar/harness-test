export function average(arr) {
  if (arr.length === 0) return NaN;
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}
