import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActorVM, asm, SYS } from './actor-vm/machine.ts';
import type { Environment } from './actor-vm/machine.ts';

const world: Environment = { body: () => 63, sense: () => ({ detected: false, direction: 0, strength: 0 }) };
const readEnergy = [asm.load('A', SYS.READ_BODY), asm.load('B', 0), asm.sys,
  asm.load('A', SYS.YIELD), asm.sys, asm.jump(-6)];

test('body sensation is coarse, cached between ticks, and refreshes after three ticks', () => {
  let energy = 63, samples = 0;
  const environment = { ...world, body: () => { samples++; return energy; } };
  const vm = new ActorVM(readEnergy);
  vm.runTick(0, environment); assert.equal(vm.snapshot().registers.B, 60);
  energy = 24;
  vm.runTick(1, environment); vm.runTick(2, environment);
  assert.equal(vm.snapshot().registers.B, 60); assert.equal(samples, 1);
  vm.runTick(3, environment); assert.equal(vm.snapshot().registers.B, 20); assert.equal(samples, 2);
});

test('repeated reads within a tick share the same sensation', () => {
  let samples = 0;
  const program = [asm.load('A', 1), asm.load('B', 0), asm.sys, asm.move('C', 'B'), asm.load('B', 0), asm.sys, asm.halt];
  const vm = new ActorVM(program);
  vm.runTick(0, { ...world, body: () => ++samples === 1 ? 63 : 10 });
  assert.equal(samples, 1); assert.equal(vm.snapshot().registers.C, 60); assert.equal(vm.snapshot().registers.B, 60);
});

test('actors have independent registers, stack and memory', () => {
  const program = [asm.load('A', 42), asm.store('A', 100), 7, asm.halt]; // PSH A
  const first = new ActorVM(program), second = new ActorVM(program);
  first.runTick(0, world);
  assert.equal(second.snapshot().registers.A, 0); assert.equal(second.snapshot().memory[100], 0);
  assert.deepEqual(second.snapshot().stack, []); assert.deepEqual(first.snapshot().stack, [42]);
});

test('16bitjs arithmetic wraps to unsigned 16 bits and branches execute', () => {
  const program = [asm.load('A', 255), asm.add('A', 'A'), asm.add('A', 'A'), asm.add('A', 'A'),
    asm.add('A', 'A'), asm.add('A', 'A'), asm.add('A', 'A'), asm.add('A', 'A'), asm.add('A', 'A'), asm.add('A', 'A'), asm.halt];
  const vm = new ActorVM(program); vm.runTick(0, world);
  assert.equal(vm.snapshot().registers.A, (255 * 512) & 65535);
  const branch = new ActorVM([asm.load('A', 1), asm.load('B', 2), asm.load('D', 5), asm.less('A', 'B', 'D'), asm.load('C', 99), asm.halt]);
  branch.runTick(0, world); assert.equal(branch.snapshot().registers.C, 0);
});

test('budget pauses an infinite loop and cannot be replenished in the same tick', () => {
  const vm = new ActorVM([asm.jump(-1)]);
  assert.deepEqual(vm.runTick(0, world, 5), { reason: 'budget', executed: 5 });
  assert.throws(() => vm.runTick(0, world), /once/);
  assert.equal(vm.runTick(1, world, 5).executed, 5);
});

test('sensing yields, actions wait for host completion, and result is readable', () => {
  const vm = new ActorVM([asm.load('A', 2), asm.load('B', 0), asm.sys, asm.load('A', 3), asm.sys,
    asm.load('A', 8), asm.sys, asm.halt]);
  const environment = { ...world, sense: () => ({ detected: true, direction: 2, strength: 70 }) };
  assert.equal(vm.runTick(0, environment).reason, 'yield');
  assert.deepEqual(vm.runTick(1, environment).action, { kind: 'move', argument: 2 });
  assert.equal(vm.runTick(2, environment).reason, 'waiting');
  vm.completeAction(1); assert.equal(vm.runTick(3, environment).reason, 'halted');
  assert.equal(vm.snapshot().registers.B, 1);
});

test('missing detection is explicit and clears old sensory values', () => {
  const vm = new ActorVM([asm.load('C', 99), asm.load('D', 1), asm.load('A', 2), asm.sys]);
  vm.runTick(0, world);
  assert.deepEqual(['B', 'C', 'D'].map(r => vm.snapshot().registers[r]), [0, 0, 0]);
});

test('JSON checkpoint preserves execution, perception, memory and pending action', () => {
  const vm = new ActorVM(readEnergy); vm.runTick(0, world);
  const restored = ActorVM.restore(JSON.parse(JSON.stringify(vm.snapshot())));
  assert.deepEqual(restored.runTick(1, world), vm.runTick(1, world));
  assert.deepEqual(restored.snapshot(), vm.snapshot());
  const pending = new ActorVM([asm.load('A', 4), asm.sys, asm.halt]); pending.runTick(0, world);
  const resumed = ActorVM.restore(JSON.parse(JSON.stringify(pending.snapshot())));
  assert.equal(resumed.runTick(1, world).reason, 'waiting'); resumed.completeAction(0);
  assert.equal(resumed.runTick(2, world).reason, 'halted');
  const invalid = vm.snapshot(); invalid.memory[0] = 0;
  assert.throws(() => ActorVM.restore(invalid), /Modified/);
});

test('invalid instructions, protected code, memory bounds, stack and division fault locally', () => {
  for (const program of [[15], [0xfd], [0xfc06], [asm.store('A', 0)], [asm.load('B', 255), asm.read('A', 1023)], [8], [0x304], [asm.jump(-2)]]) {
    const vm = new ActorVM(program, { memoryWords: 256 });
    assert.equal(vm.runTick(0, world).reason, 'fault');
    assert.equal(vm.runTick(1, world).reason, 'fault');
    assert.deepEqual(ActorVM.restore(JSON.parse(JSON.stringify(vm.snapshot()))).snapshot(), vm.snapshot());
  }
});
