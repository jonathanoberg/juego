export const memoryMethods={
 pruneMemory(a){const g=this.animalGenes(a);a.memory=(a.memory||[]).filter(m=>this.tick-m.tick<g.memoryTicks);if(!g.memoryTicks||!g.memoryCapacity)a.memory=[];if(a.memory.length>g.memoryCapacity)a.memory=a.memory.slice(-g.memoryCapacity);return a.memory;},
 remember(a,i,kind,amount=1){const g=this.animalGenes(a);this.pruneMemory(a);if(!g.memoryTicks||!g.memoryCapacity)return;a.memory=a.memory.filter(m=>m.i!==i);a.memory.push({i,kind,tick:this.tick,amount:Math.min(1,Math.max(.1,amount))});if(a.memory.length>g.memoryCapacity)a.memory.shift();},
 observeFood(a,i){this.pruneMemory(a);for(let q of [{i},...this.neighbors(i)]){let p=this.cells[q.i].p;if(p>0)this.remember(a,q.i,'food',p/3);else if(a.memory.some(m=>m.i===q.i&&m.kind==='food'))this.remember(a,q.i,'depleted');}},
 memoryBias(a,i){const g=this.animalGenes(a);if(i<0||!g.memoryStrength||!g.memoryTicks)return 0;let score=0;for(let m of this.pruneMemory(a)){let age=this.tick-m.tick,fade=Math.max(0,1-age/g.memoryTicks),distance=Math.hypot(i%this.n-m.i%this.n,Math.floor(i/this.n)-Math.floor(m.i/this.n));score+=(m.kind==='food'?1:-1)*m.amount*fade/(1+distance);}return score*g.memoryStrength;},
 reserveTicks(a,costs=this.upkeep(a)){const total=costs.base+costs.sensing+costs.memory;return total>0?Math.max(0,a.energy)/total:Infinity;},
 needsFood(a,meal,costs=this.upkeep(a)){return meal<costs.base+costs.sensing+costs.memory&&this.reserveTicks(a,costs)<this.animalGenes(a).foodReserveTicks;},
 upkeep(a){const g=this.animalGenes(a);return {base:g.metabolism*a.size,sensing:this.opt.animalSenseCost*g.radius*g.radius*a.size/10,memory:this.opt.memoryCost*this.pruneMemory(a).length*a.size/10};}
};
