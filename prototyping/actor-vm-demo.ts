import { ActorVM, asm, SYS } from './actor-vm/machine.ts';

// A hungry animal requests eating; the host owns the food and body updates.
const program = [
  asm.load('A', SYS.READ_BODY), asm.load('B', 0), asm.sys,
  asm.load('C', 60), asm.load('D', 9), asm.less('B', 'C', 'D'),
  asm.load('A', SYS.REST), asm.sys, asm.jump(-9),
  asm.load('A', SYS.EAT), asm.load('B', 0), asm.sys, asm.jump(-13)
];
const animal = new ActorVM(program);
let energy = 48, food = 2;
const rows: object[] = [];
for (let tick = 0; tick < 10; tick++) {
  energy = Math.max(0, energy - 2);
  const turn = animal.runTick(tick, { body: () => energy, sense: () => ({ detected: false, direction: 0, strength: 0 }) });
  let success: number | undefined;
  if (turn.action) {
    success = turn.action.kind === 'eat' ? Number(food > 0) : 1;
    if (turn.action.kind === 'eat' && success) { food--; energy = Math.min(100, energy + 20); }
    animal.completeAction(success);
  }
  rows.push({ tick, exactEnergy: energy, feltEnergy: animal.snapshot().sensations.energy?.value,
    action: turn.action?.kind ?? turn.reason, success, food });
  if (tick === 4) {
    // Demonstrate a portable checkpoint; production would store program identity too.
    const copy = ActorVM.restore(JSON.parse(JSON.stringify(animal.snapshot())));
    if (JSON.stringify(copy.snapshot()) !== JSON.stringify(animal.snapshot())) throw new Error('Checkpoint mismatch');
  }
}
console.table(rows);
