import { ActorVM } from './actor-vm/machine.mjs';
import { plantProgram, rabbitProgram, SENSE } from './actor-programs.mjs';
const clamp = value => Math.max(0, Math.min(100, value));
const direction = (world, from, to) => {
  if (from === to) return 8;
  const dx = Math.sign(to % world.n - from % world.n), dy = Math.sign(Math.floor(to / world.n) - Math.floor(from / world.n));
  return (Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8;
};
export const vmMethods = {
  brain(actor, species) {
    actor.species = species;
    actor.brain ??= new ActorVM(species === 'plant' ? plantProgram : rabbitProgram,
      { memoryWords: 128, stackWords: 16, precision: this.opt.vmPrecision, refreshTicks: this.opt.vmRefreshTicks });
    return actor.brain;
  },
  runBrain(actor, species, environment) {
    const brain = this.brain(actor, species), turn = brain.runTick(this.tick, environment, this.opt.vmBudget);
    actor.vmTurn = { tick: this.tick, reason: turn.reason, executed: turn.executed, action: turn.action?.kind || null, fault: turn.fault || null };
    return turn;
  },
  vmPlantDecisions() {
    this.ensurePlants();
    const groups = new Map();
    this.cells.forEach((c, i) => { if (c.p) { if (!groups.has(c.plantId)) groups.set(c.plantId, []); groups.get(c.plantId).push(i); } });
    this._vmPlantActions = new Map();
    for (const [id, cells] of groups) {
      const plant = this.plants.get(id);
      // One VM per plant identity, even if grazing splits its tissue. Networks
      // may share nutrients while retaining separate programs and ancestry.
      const turn = this.runBrain(plant, 'plant', {
        body: channel => channel === 'energy' ? clamp(cells.reduce((s, i) => s + this.cells[i].f, 0) * 10 / cells.length) : 0,
        sense: kind => {
          if (kind !== SENSE.NUTRIENTS) throw new Error('Unknown plant sense');
          const scores = Array(8).fill(0);
          for (const i of cells) for (const [d, signal] of this.sense(i, plant.genes.radius).entries()) scores[d] += signal.f - plant.genes.painWeight * signal.pain;
          const best = scores.indexOf(Math.max(...scores));
          return { detected: true, direction: best, strength: Math.round(clamp(Math.max(0, scores[best]))) };
        }
      });
      if (turn.action) {
        this._vmPlantActions.set(id, turn.action);
        plant.brain.completeAction(turn.action.kind === 'grow' ? 1 : 0);
      }
    }
  },
  rabbitObservation(i, a, kind, snapshot) {
    const genes = this.animalGenes(a);
    if (kind === SENSE.MATE) {
      if (a.gender !== 'male' || a.size < 6 || a.mating || !this.fertile(a) || this.reserveTicks(a) < genes.mateReserveTicks || this.random() >= genes.mateDrive)
        return { detected: false, direction: 8, strength: 0 };
      const mates = snapshot.flatMap((c, j) => c.a?.gender === 'female' && !c.a.mating && this.fertile(c.a) && Math.hypot(j % this.n - i % this.n, Math.floor(j / this.n) - Math.floor(i / this.n)) <= genes.radius ? [j] : []);
      mates.sort((x, y) => Math.hypot(x % this.n - i % this.n, Math.floor(x / this.n) - Math.floor(i / this.n)) - Math.hypot(y % this.n - i % this.n, Math.floor(y / this.n) - Math.floor(i / this.n)));
      if (!mates.length) return { detected: false, direction: 8, strength: 0 };
      a.seeking = snapshot[mates[0]].a.id;
      return { detected: true, direction: this.neighbors(i).some(q => q.i === mates[0]) ? 8 : direction(this, i, mates[0]), strength: 100 };
    }
    const neighbors = this.neighbors(i);
    const legal = neighbors.filter(q => !this.cells[q.i].a && this.total(this.cells[q.i]) + a.size <= 11);
    const edge = i % this.n === 0 || i % this.n === this.n - 1 || i < this.n || i >= this.n * (this.n - 1);
    if (kind === SENSE.FOOD) {
      this.observeFood(a, i);
      const reachable = [{ i }, ...neighbors].filter(q => snapshot[q.i].p > 0).sort((u, v) => snapshot[v.i].p - snapshot[u.i].p);
      if (reachable.length) return { detected: true, direction: direction(this, i, reachable[0].i), strength: 100 };
      const signals = this.sense(i, genes.radius);
      const options = this.shuffle(legal.map(q => ({ ...q, value: signals.find(s => s.label === q.label).p + this.memoryBias(a, q.i) })));
      options.sort((u, v) => v.value - u.value);
      if (options.length && (!edge || options[0].value > 0)) return { detected: true, direction: direction(this, i, options[0].i), strength: Math.min(70, Math.round(clamp(options[0].value * 5))) };
      return { detected: edge, direction: edge ? 9 : 8, strength: 0 };
    }
    if (kind === SENSE.SPACE) {
      const options = this.shuffle(legal).sort((u, v) => this.crowdAt(u.i, snapshot, i) - this.crowdAt(v.i, snapshot, i));
      return { detected: true, direction: edge ? 9 : options.length ? direction(this, i, options[0].i) : 8, strength: 100 };
    }
    throw new Error('Unknown rabbit sense');
  },
  vmRabbitStep(i, a, snapshot) {
    const startSize = a.size;
    const turn = this.runBrain(a, 'rabbit', {
      body: channel => {
        if (channel === 'energy') {
          // Cover development as well as maintenance. A reserve-only target kept
          // founders resting, then stopped meals far below the growth threshold.
          const costs = this.upkeep(a), upkeep = costs.base + costs.sensing + costs.memory;
          const target = 2 + a.size + upkeep * this.animalGenes(a).foodReserveTicks;
          return clamp(a.energy / target * 100);
        }
        if (channel === 'crowding') return this.animalGenes(a).crowdThreshold > 8 ? 0 : clamp(this.crowdAt(i, snapshot) / this.animalGenes(a).crowdThreshold * 100);
        return 0;
      },
      sense: kind => this.rabbitObservation(i, a, kind, snapshot)
    });
    let success = 0;
    if (turn.action) {
      const { kind, argument: d } = turn.action;
      const q = d === 8 ? { i } : this.neighbors(i).find(q => direction(this, i, q.i) === d);
      if (kind === 'eat' && q) {
        const meal = this.graze(q.i, .15 * a.size); a.energy += meal; success = Number(meal > 0);
        this.remember(a, q.i, this.cells[q.i].p > 0 ? 'food' : 'depleted', this.cells[q.i].p > 0 ? this.cells[q.i].p / 3 : 1);
      } else if (kind === 'move' && !this.isGestating(a)) {
        const edge = i % this.n === 0 || i % this.n === this.n - 1 || i < this.n || i >= this.n * (this.n - 1);
        if (d === 9 && edge) { this.cells[i].a = null; this.departures++; this.noteLoss(a, 'departures'); success = 1; }
        else if (d === 8) success = 1;
        else if (q && !this.cells[q.i].a && this.total(this.cells[q.i]) + a.size <= 11) {
          this.cells[i].a = null; this.cells[q.i].a = a; i = q.i; success = 1; this.vmMoves = (this.vmMoves || 0) + 1;
        }
      } else if (kind === 'rest') success = 1;
      a.brain.completeAction(success); a.vmTurn.success = success;
    }
    if (this.cells[i].a !== a) return;
    const c = this.cells[i], costs = this.upkeep(a);
    // Physiology advances even when the actor senses, rests, stalls or faults.
    a.energy -= costs.base + costs.sensing + costs.memory;
    if (a.energy < 0) {
      if (a.size > 1) { a.size = Math.max(1, a.size - .25); a.energy = .1; }
      else { this.noteLoss(a, 'starvationDeaths'); this.starvationDeaths++; c.a = null; return; }
    }
    if (this.lifeStage(a) !== 'declining' && a.energy > 2 + a.size && a.size < 10) {
      const growth = Math.min(.25, 10 - a.size, 11 - this.total(c)); a.size += growth; a.energy -= growth;
    }
    a.maxTicks = a.size >= 10 && startSize >= 10 ? (a.maxTicks || 0) + 1 : 0;
    this.divide(i);
  }
};
