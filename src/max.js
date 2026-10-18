export function max(arr) {
  if (arr.length === 0) return undefined;
  return arr.reduce((a, b) => (a > b ? a : b));
}
