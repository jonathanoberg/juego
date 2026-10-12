/** Planar aperture-7 prototype. Axial basis vectors meet at 60 degrees.
 * Level 0 is the base grid. Parent footprints are unions, not regular hexes.
 */
export interface Cell { level: number; q: number; r: number }
export interface Axial { q: number; r: number }
export const slots: readonly Axial[] = [
  { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 },
  { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
];
type Matrix = readonly [number, number, number, number];
// Determinant 7; M+ M- = 7I. Alternating rotations are ±19.1066 degrees.
export const transforms: readonly Matrix[] = [[2, -1, 1, 3], [3, 1, -1, 2]];
function validate(c: Cell): void {
  if (!Number.isSafeInteger(c.level) || c.level < 0 ||
      !Number.isSafeInteger(c.q) || !Number.isSafeInteger(c.r)) throw new Error('Invalid cell address');
}
function transform(level: number): Matrix { return transforms[level % 2]!; }
function apply(m: Matrix, p: Axial): Axial {
  const q = m[0] * p.q + m[1] * p.r, r = m[2] * p.q + m[3] * p.r;
  if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) throw new Error('Coordinate overflow');
  return { q, r };
}
export function key(c: Cell): string { return `${c.level}:${c.q}:${c.r}`; }
export function children(c: Cell): Cell[] {
  validate(c);
  if (c.level === 0) throw new Error('Base cells have no children');
  const center = apply(transform(c.level - 1), c);
  return slots.map(d => { const child = { level: c.level - 1, q: center.q + d.q, r: center.r + d.r }; validate(child); return child; });
}
export function parent(c: Cell): { cell: Cell; slot: number } {
  validate(c);
  const [a, b, cc, d] = transform(c.level);
  const inverse: Matrix = [d, -b, -cc, a];
  for (let slot = 0; slot < slots.length; slot++) {
    const offset = slots[slot]!;
    const p = apply(inverse, { q: c.q - offset.q, r: c.r - offset.r });
    if (p.q % 7 === 0 && p.r % 7 === 0) {
      const cell = { level: c.level + 1, q: p.q / 7 || 0, r: p.r / 7 || 0 };
      validate(cell); return { cell, slot };
    }
  }
  throw new Error('No parent: aggregation partition is invalid');
}
export function neighbors(c: Cell): Cell[] {
  validate(c);
  return slots.slice(1).map(d => { const n = { ...c, q: c.q + d.q, r: c.r + d.r }; validate(n); return n; });
}
export function baseCenter(c: Cell): Axial {
  validate(c);
  let p: Axial = c;
  for (let level = c.level - 1; level >= 0; level--) p = apply(transform(level), p);
  return p;
}
/** Enumeration is for small verification windows, not production world storage. */
export function baseCells(c: Cell): Cell[] {
  validate(c);
  if (c.level > 5) throw new Error('Prototype enumeration limited to level 5');
  return c.level === 0 ? [c] : children(c).flatMap(baseCells);
}
// Integer vertices: physical x = X/2, y = Y*sqrt(3)/2 meters.
export type Vertex = readonly [number, number];
export type Edge = readonly [Vertex, Vertex];
const corners: readonly Vertex[] = [[2,0],[1,1],[-1,1],[-2,0],[-1,-1],[1,-1]];
const vk = (v: Vertex): string => `${v[0]},${v[1]}`;
export function boundaryEdges(cells: readonly Cell[]): Edge[] {
  const edges = new Map<string, Edge>();
  const seen = new Set<string>();
  for (const c of cells) {
    validate(c);
    if (c.level !== 0 || seen.has(key(c))) throw new Error('Expected unique base cells');
    seen.add(key(c));
    const vs = corners.map(([x,y]): Vertex => [3*c.q+x,c.q+2*c.r+y]);
    for (let i=0;i<6;i++) {
      const a=vs[i]!, b=vs[(i+1)%6]!, forward=`${vk(a)}>${vk(b)}`, reverse=`${vk(b)}>${vk(a)}`;
      if (edges.has(reverse)) edges.delete(reverse); else edges.set(forward,[a,b]);
    }
  }
  return [...edges.values()];
}
export function boundaryArea(edges: readonly Edge[]): number {
  const twiceArea = edges.reduce((sum, [[x,y],[xx,yy]]) => sum+x*yy-xx*y, 0);
  return twiceArea*Math.sqrt(3)/8;
}
