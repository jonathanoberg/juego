import assert from 'node:assert/strict';
import { World } from '../public/engine.mjs';
import { ActorVM, asm, SYS } from '../public/actor-vm/machine.mjs';
import { ActorVM as SharedVM } from '../../../prototyping/actor-vm/machine.ts';
const quiet = { size: 20, growth: 0, regen: 0, diffusion: 0, animalSenseCost: 0, plantSenseCost: 0,
  metabolism: 0, memoryCost: 0, divisionChance: 0, matingChance: 0, mateDrive: 0, declineChance: 0 };
function blank(options = {}) {
  const w = new World(42, { ...quiet, ...options });
  w.cells.forEach(c => Object.assign(c, { f: 0, p: 0, a: null, spore: 0, plantId: null }));
  return w;
}
// Browser/runtime equivalence for the generated shared machine, not a separate implementation.
const words = [asm.load('A', SYS.READ_BODY), asm.load('B', 0), asm.sys, asm.load('A', SYS.GROW), asm.sys, asm.jump(-6)];
const environment = { body: () => 63, sense: () => ({ detected: false, direction: 0, strength: 0 }) };
const browser = new ActorVM(words), shared = new SharedVM(words);
for (let tick = 0; tick < 8; tick++) {
  assert.deepEqual(browser.runTick(tick, environment), shared.runTick(tick, environment));
  browser.completeAction(1); shared.completeAction(1);
  assert.deepEqual(browser.snapshot(), shared.snapshot());
}

const w = blank({ metabolism: .01 }), rabbit = w.newAnimal(undefined, { energy: .01, gender: 'female' });
w.cells[210].a = rabbit; w.cells[211].p = 3;
assert.equal(w.opt.controller, 'vm'); assert.equal(rabbit.species, 'rabbit');
w.step(); assert.equal(rabbit.vmTurn.reason, 'yield'); assert.equal(w.cells[211].p, 3, 'sensing does not graze');
w.step(); assert.equal(rabbit.vmTurn.action, 'eat'); assert.equal(rabbit.vmTurn.success, 1);
assert(w.cells[211].p < 3); assert(rabbit.energy > 0);
assert.equal(rabbit.brain.snapshot().sensations.energy.value, 0, 'eating does not rewrite the cached sensation');
const child = w.newAnimal(rabbit.genes); assert.notEqual(child.brain, rabbit.brain);
assert.deepEqual(child.brain.snapshot().sensations, {}, 'children have fresh perceptions');
assert.equal(w.newRabbit().species, 'rabbit', 'rabbit API names the concrete species');

// Founders must seek food while still juveniles, before they can seek mates.
const foragerWorld = blank({ metabolism: .04 }), forager = foragerWorld.newRabbit(undefined, { energy: 3, gender: 'female' });
foragerWorld.cells[210].a = forager; foragerWorld.cells[215].p = 5;
foragerWorld.step(); assert.equal(forager.vmTurn.reason, 'yield');
foragerWorld.step();
assert.notEqual(foragerWorld.cells[210].a, forager, 'a juvenile with founder energy moves toward distant food');
assert.equal(forager.vmTurn.action, 'move'); assert.equal(forager.vmTurn.success, 1);
assert.equal(foragerWorld.vmMoves, 1);
const growingWorld = blank({ metabolism: .04 }), growing = growingWorld.newRabbit(undefined, { energy: 3, gender: 'female' });
growingWorld.cells[210].a = growing; growingWorld.cells[211].p = 5;
growingWorld.step(); growingWorld.step();
assert(growing.size > 1, 'feeding target allows a meal to cross the growth threshold');
assert.equal(growing.vmTurn.action, 'eat');
const founders = new World(42, { size: 20 }), original = new Map(founders.cells.flatMap((c, i) => c.a ? [[c.a.id, i]] : []));
founders.step(); founders.step();
assert(founders.cells.some((c, i) => c.a && original.has(c.a.id) && original.get(c.a.id) !== i), 'seed-42 founders visibly move by tick two');

const breeding = blank({ matingChance: 1, gestationTicks: 1 });
breeding.cells[210].a = breeding.newRabbit(undefined, { size: 4, energy: 10, gender: 'male' });
breeding.cells[211].a = breeding.newRabbit(undefined, { size: 4, energy: 10, gender: 'female' });
for (let t = 0; t < 3; t++) breeding.step();
assert(breeding.sexualBirths > 0, 'host gestation works with VM parents');
for (const c of breeding.cells) if (c.a?.parentIds) {
  assert.equal(c.a.species, 'rabbit'); assert.equal(c.a.brain.snapshot().lastTick, -1, 'newborn acts next tick');
}
const spores = blank(), parent = spores.newPlant();
for (const i of [210, 211, 230, 231]) Object.assign(spores.cells[i], { p: 2, f: 5, plantId: parent.id });
for (let t = 0; t < 4; t++) spores.step();
assert(spores.sporesMade > 0, 'VM growth still permits square-based sporation');
const spore = spores.cells.find(c => c.spore);
assert.equal(spores.plants.get(spore.sporePlantId).brain.snapshot().lastTick, -1, 'spore brain remains dormant');

const passive = blank(), resting = passive.newAnimal(undefined, { energy: 0 }); passive.cells[210].a = resting; passive.cells[211].p = 3;
resting.brain = new ActorVM([asm.load('A', SYS.REST), asm.sys, asm.jump(-3)], { memoryWords: 128 });
passive.step(); assert.equal(passive.cells[211].p, 3, 'VM rest cannot secretly execute legacy grazing');

const plantWorld = blank({ growth: .5 }), plant = plantWorld.newPlant();
plantWorld.cells[210].p = 2; plantWorld.cells[210].f = 8; plantWorld.cells[210].plantId = plant.id;
plantWorld.step(); assert.equal(plant.vmTurn.reason, 'yield'); assert.equal(plantWorld.cells[210].p, 2);
plantWorld.step(); assert.equal(plant.vmTurn.action, 'grow'); assert(plantWorld.cells[210].p > 2);
assert.equal(plant.species, 'plant');
const restPlantWorld = blank({ growth: .5 }), restPlant = restPlantWorld.newPlant();
restPlant.brain = new ActorVM([asm.load('A', SYS.REST), asm.sys, asm.jump(-3)]);
Object.assign(restPlantWorld.cells[210], { p: 2, f: 8, plantId: restPlant.id });
restPlantWorld.step(); assert.equal(restPlantWorld.cells[210].p, 2, 'growth requires the VM action');
assert(restPlantWorld.cells[210].f < 8, 'maintenance is independent of VM choices');

// Eating damage, conflicts and capacity are still host-authoritative.
const invalid = blank(), blocked = invalid.newAnimal(undefined, { size: 10 }); invalid.cells[210].a = blocked;
invalid.cells[211].f = 10;
blocked.brain = new ActorVM([asm.load('A', SYS.MOVE), asm.load('B', 2), asm.sys]);
invalid.step(); assert.equal(invalid.cells[210].a, blocked); assert.equal(blocked.vmTurn.success, 0);

const poisoned = blank({ metabolism: .1 }), stalled = poisoned.newAnimal(undefined, { energy: 2 }); poisoned.cells[210].a = stalled;
stalled.brain = new ActorVM([15]); poisoned.step(); assert.equal(stalled.vmTurn.reason, 'fault'); assert(stalled.energy < 2);

// Both new policies, including reproduction, remain seed-repeatable and bounded.
function run(seed, count, size = 20) {
  const world = new World(seed, { size });
  for (let t = 0; t < count; t++) {
    world.step();
    for (const c of world.cells) {
      assert(world.total(c) <= 11 + 1e-8); assert(c.f >= -1e-8 && c.p >= -1e-8);
      if (c.a) { assert.equal(c.a.species, 'rabbit'); assert(!c.a.vmTurn?.fault); }
    }
    for (const p of world.plants.values()) assert(!p.vmTurn?.fault);
  }
  return { stats: world.stats, births: world.sexualBirths, spores: world.sporesMade,
    rabbits: world.cells.flatMap((c, i) => c.a ? [[i, c.a.id, c.a.energy, c.a.brain.snapshot()]] : []) };
}
for (const seed of [42, 123, 7]) assert.deepEqual(run(seed, 120), run(seed, 120));
const large = run(42, 20, 80); console.log('VM 80×80 tick 20:', large.stats);
console.log('Passed shared-VM parity, default VM controllers, plant growth, rabbit feeding, fresh offspring brains, failed actions, fault physiology, deterministic replay and capacity.');
