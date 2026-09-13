export function percentile(numbers, p) {
  numbers.sort((a, b) => a - b);
  const idx = Math.floor((numbers.length * p) / 100);
  return numbers[idx];
}
