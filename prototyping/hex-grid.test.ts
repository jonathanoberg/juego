import test from 'node:test';
import assert from 'node:assert/strict';
import { parent, children, baseCells, baseCenter, boundaryEdges, boundaryArea, neighbors, key, transforms, slots } from './hex-grid.ts';
import type { Cell } from './hex-grid.ts';

test('both transforms have determinant seven and compose to 7I', () => {
  for (const [a,b,c,d] of transforms) assert.equal(a*d-b*c,7);
  const [a,b,c,d]=transforms[0]!, [e,f,g,h]=transforms[1]!;
  assert.deepEqual([a*e+b*g,a*f+b*h,c*e+d*g,c*f+d*h],[7,0,0,7]);
  assert.deepEqual(baseCenter({level:2,q:3,r:-2}),{q:21,r:-14});
});
test('every sampled cell, including negative coordinates, has exactly one parent', () => {
  for(let level=0;level<8;level++) for(let q=-40;q<=40;q++) for(let r=-40;r<=40;r++) {
    const c={level,q,r}, p=parent(c);
    assert.deepEqual(children(p.cell)[p.slot],c);
    // Independently check all seven residue representatives, not just first match.
    const [a,b,cc,d]=transforms[level%2]!;
    const matches=slots.filter(s => (d*(q-s.q)-b*(r-s.r))%7===0 && (-cc*(q-s.q)+a*(r-s.r))%7===0);
    assert.equal(matches.length,1);
  }
});
test('each parent has seven distinct children with exact reverse addresses', () => {
  for(let level=1;level<=8;level++) for(let q=-10;q<=10;q++) for(let r=-10;r<=10;r++) {
    const c={level,q,r}, cs=children(c);
    assert.equal(new Set(cs.map(key)).size,7);
    cs.forEach((child,slot)=>assert.deepEqual(parent(child),{cell:c,slot}));
  }
});
test('recursive footprints are connected, have no holes, and have area 7^level', () => {
  for(let level=0;level<=4;level++) for(const [q,r] of [[0,0],[-2,1],[3,-4]]) {
    const cells=baseCells({level,q:q!,r:r!}), occupied=new Set(cells.map(key));
    assert.equal(occupied.size,7**level);
    const visited=new Set<string>(), todo=[cells[0]!];
    while(todo.length) { const c=todo.pop()!, k=key(c); if(visited.has(k))continue; visited.add(k); for(const n of neighbors(c))if(occupied.has(key(n))&&!visited.has(key(n)))todo.push(n); }
    assert.equal(visited.size,cells.length);
    const edges=boundaryEdges(cells);
    assert.ok(Math.abs(boundaryArea(edges)-7**level*3*Math.sqrt(3)/2)<1e-8);
    // Exactly one closed boundary loop proves no enclosed holes or disconnected islands.
    const vertex=(v:readonly number[])=>v.join(',');
    const next=new Map(edges.map(([a,b])=>[vertex(a),vertex(b)]));
    assert.equal(next.size,edges.length);
    let cursor=vertex(edges[0]![0]); const start=cursor, walked=new Set<string>();
    do { assert.ok(!walked.has(cursor)); walked.add(cursor); cursor=next.get(cursor)!; assert.ok(cursor); } while(cursor!==start);
    assert.equal(walked.size,edges.length);
  }
});
test('adjacent aggregate patches partition a complete fine-grid window', () => {
  for(let level=1;level<=3;level++) {
    const ownership=new Map<string,string>();
    for(let q=-10;q<=10;q++)for(let r=-10;r<=10;r++) {
      const c={level,q,r};
      for(const base of baseCells(c)) { const k=key(base); assert.ok(!ownership.has(k),'overlapping parents'); ownership.set(k,key(c)); }
    }
    for(let q=-12;q<=12;q++)for(let r=-12;r<=12;r++) {
      let c:Cell={level:0,q,r}; while(c.level<level)c=parent(c).cell;
      assert.equal(ownership.get(key({level:0,q,r})),key(c),'gap or inconsistent ownership');
    }
  }
});
test('invalid addresses and unsafe enumeration are rejected', () => {
  assert.throws(()=>parent({level:-1,q:0,r:0}));
  assert.throws(()=>parent({level:0,q:0.5,r:0}));
  assert.throws(()=>children({level:0,q:0,r:0}));
  assert.throws(()=>baseCells({level:6,q:0,r:0}));
  assert.throws(()=>children({level:1,q:Number.MAX_SAFE_INTEGER,r:0}));
});
