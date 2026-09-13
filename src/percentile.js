export function percentile(numbers, p) {
  // 入力配列をその場でソートする
  numbers.sort((a, b) => a - b);
  const idx = Math.floor((numbers.length * p) / 100);
  return numbers[idx];
}
