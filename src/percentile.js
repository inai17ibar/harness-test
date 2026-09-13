
export function percentile(numbers, p) {
  if (numbers.length === 0) return NaN;
  // 入力配列は変更しない（median.js と揃える）
  const sorted = [...numbers].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length * p) / 100)),
  );
  return sorted[idx];
}
