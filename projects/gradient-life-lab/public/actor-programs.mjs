import { asm, SYS } from './actor-vm/machine.mjs';
// Direction convention: 0..7 = N..NW, 8 = current cell, 9 = leave the world.
export const SENSE = { FOOD: 0, SPACE: 1, MATE: 2, NUTRIENTS: 3 };
function program(build) {
  const words = [], labels = new Map(), links = [];
  const p = {
    emit: (...w) => words.push(...w),
    label: name => labels.set(name, words.length),
    jump(name) { links.push([words.length, name, 'jump']); words.push(0); },
    less(left, right, name) { links.push([words.length, name, 'load']); words.push(0, asm.less(left, right, 'D')); },
    call(code, input) { words.push(asm.load('A', code)); if (input !== undefined) words.push(asm.load('B', input)); words.push(asm.sys); }
  };
  build(p);
  for (const [i, name, type] of links) {
    if (!labels.has(name)) throw new Error(`Missing label ${name}`);
    words[i] = type === 'load' ? asm.load('D', labels.get(name)) : asm.jump(labels.get(name) - i - 1);
  }
  return Object.freeze(words);
}
export const plantProgram = program(p => {
  p.label('start'); p.call(SYS.SENSE, SENSE.NUTRIENTS);
  p.call(SYS.GROW); p.jump('start');
});
export const rabbitProgram = program(p => {
  p.label('start'); p.call(SYS.READ_BODY, 3); // Crowd discomfort, 0..100.
  p.emit(asm.load('C', 100)); p.less('B', 'C', 'energy');
  p.call(SYS.SENSE, SENSE.SPACE); p.call(SYS.MOVE); p.jump('start');
  p.label('energy'); p.call(SYS.READ_BODY, 0);
  p.emit(asm.load('C', 100)); p.less('B', 'C', 'food');
  p.call(SYS.SENSE, SENSE.MATE);
  p.emit(asm.load('A', 1)); p.less('C', 'A', 'rest');
  p.call(SYS.MOVE); p.jump('start');
  p.label('food'); p.call(SYS.SENSE, SENSE.FOOD);
  p.emit(asm.load('A', 80)); p.less('C', 'A', 'move');
  p.call(SYS.EAT); p.jump('start');
  p.label('move'); p.call(SYS.MOVE); p.jump('start');
  p.label('rest'); p.call(SYS.REST, 0); p.jump('start');
});
