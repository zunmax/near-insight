/** SVG path through the points as a monotone cubic curve (Fritsch–Carlson): smooth, and never overshooting a point, so a
    curve never shows a value the data does not have. */
export function smoothPath(points: Array<{ x: number; y: number }>): string {
  const n = points.length;
  if (n === 0) return "";
  const first = points[0]!;
  if (n === 1) return `M${first.x.toFixed(2)},${first.y.toFixed(2)}`;
  const slopes = points.slice(1).map((p, i) => (p.y - points[i]!.y) / (p.x - points[i]!.x || 1));
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === n - 1) return slopes[n - 2]!;
    const a = slopes[i - 1]!;
    const b = slopes[i]!;
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M${first.x.toFixed(2)},${first.y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    const dx = (q.x - p.x) / 3;
    d += `C${(p.x + dx).toFixed(2)},${(p.y + tangents[i]! * dx).toFixed(2)} ${(q.x - dx).toFixed(2)},${(q.y - tangents[i + 1]! * dx).toFixed(2)} ${q.x.toFixed(2)},${q.y.toFixed(2)}`;
  }
  return d;
}
