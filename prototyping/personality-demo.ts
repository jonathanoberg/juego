import { PrototypeWorld } from './engine.ts';
import { PrototypePersonalities } from './personality.ts';
import { personalityFixture, flamebringerTemplate } from './personality-scenario.ts';
const data = personalityFixture();
const world = new PrototypeWorld(data, { next: () => 0 });
const minds = new PrototypePersonalities(data.entities, [flamebringerTemplate], data.definitions);
const alice = 'character:alice', sword = 'item:sword';
world.equip(alice, sword); world.attack({ actorId: alice, weaponId: sword, targetId: 'creature:target' }); minds.process(world.events());
console.log(minds.blurt(sword, world.now));
world.advance(180); minds.evaluateInactivity(sword, alice, world.now);
console.log('Relationship:', minds.snapshot(sword).relationships[0]);
const adapter = { async respond(ctx: import('../core/game/personality.ts').DialogueContext) {
  return ctx.relationship.resentment > 0 ? 'Three minutes without a fight. I am practically cutlery.' : 'I was forged for this.';
} };
console.log('Alice: You seem annoyed.');
console.log('Flamebringer:', await minds.talk(sword, alice, 'You seem annoyed.', world.now, [], adapter));
console.log('Other sword relationships:', minds.snapshot('item:second-flamebringer').relationships);
