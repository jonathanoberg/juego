import{plantTraits,animalTraits,genome,inherit}from'./genetics.mjs';
import{matingMethods}from'./mating.mjs';
export const N=20, dirs=[[0,-1,'N'],[1,-1,'NE'],[1,0,'E'],[1,1,'SE'],[0,1,'S'],[-1,1,'SW'],[-1,0,'W'],[-1,-1,'NW']];
export class World{
 constructor(seed=42,options={}){this.opt={radius:10,metabolism:.04,growth:.5,grace:6,regen:.01,diffusion:.08,divisionWait:5,divisionChance:.1,crowdThreshold:5,dartDistance:3,painWeight:6,painDecay:.8,reproductionAge:150,declineAge:220,declineChance:.25,declineAmount:.25,matingChance:.1,gestationTicks:5,plantMutationChance:.05,animalMutationChance:.05,mutationPercent:10,...options};Object.defineProperty(this,'opt',{value:Object.freeze(this.opt),writable:false});this.initialPlantGenes=genome(this.opt,plantTraits);this.initialAnimalGenes=genome(this.opt,animalTraits);this.plants=new Map();this.nextPlantId=1;this.contacts=new Map();this.gestations=[];this.nextMating=1;this.matings=0;this.sexualBirths=0;this.seed=seed>>>0;this.tick=0;this.cells=Array.from({length:400},()=>({f:0,p:0,a:null,hunger:0,pain:0,spore:0}));this.divisions=0;this.darts=0;this.ageDeaths=0;this.departures=0;this.squareTicks=Array(400).fill(0);this.squareParents=Array(400).fill('');this.sporesMade=0;this.germinations=0;this.nextId=1;for(let k=0;k<32;k++)this.pick(c=>!c.f).f=10;for(let k=0;k<12;k++)this.pick(c=>c.f===10&&!c.p).p=1;for(let k=0;k<7;k++)this.pick(c=>!c.a&&c.f+c.p<=10).a={id:this.nextId++,size:1,energy:3,age:0};for(let c of this.cells){if(c.p)c.plantId=this.newPlant().id;if(c.a)this.animalGenes(c.a);}this.history=[];this.record();}
 newPlant(genes=this.initialPlantGenes,parentIds=[]){if(!Array.isArray(parentIds))parentIds=parentIds?[parentIds]:[];let p={id:this.nextPlantId++,genes:Object.freeze({...genes}),parentIds:[...parentIds],generation:parentIds.length?Math.max(...parentIds.map(id=>this.plants.get(id)?.generation||0))+1:0};this.plants.set(p.id,p);return p;}
 ensurePlants(){for(let group of this.networks()){let existing=group.find(i=>this.cells[i].plantId&&this.plants.has(this.cells[i].plantId)),id=existing===undefined?null:this.cells[existing].plantId;for(let i of group)if(!this.cells[i].plantId||!this.plants.has(this.cells[i].plantId)){id??=this.newPlant().id;this.cells[i].plantId=id;}}}
 plantGenes(c){return this.plants.get(c.plantId)?.genes||this.initialPlantGenes;}
 animalGenes(a){if(!a.genes)a.genes=Object.freeze({...this.initialAnimalGenes});if(!a.gender)a.gender=this.random()<.5?'female':'male';return a.genes;}
 newAnimal(genes=this.initialAnimalGenes,values={}){return {id:this.nextId++,size:1,energy:3,age:0,maxTicks:0,generation:0,gender:this.random()<.5?'female':'male',genes:Object.freeze({...genes}),...values};}
 inheritAnimal(a,b=null){return inherit(this,'animal',a,b);}
 random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
 pick(pred){let a=this.cells.filter(pred);return a[Math.floor(this.random()*a.length)];}
 neighbors(i){let x=i%N,y=Math.floor(i/N);return dirs.map(([dx,dy,label])=>({x:x+dx,y:y+dy,label})).filter(q=>q.x>=0&&q.x<N&&q.y>=0&&q.y<N).map(q=>({...q,i:q.y*N+q.x}));}
 total(c){return c.f+c.p+(c.a?.size||0)+(c.spore||0);}
 sense(i,radius){if(!this._snapshot)return this.gradients(i,this.cells,radius);let key=i+':'+radius;if(!this._signalCache.has(key))this._signalCache.set(key,this.gradients(i,this._snapshot,radius));return this._signalCache.get(key);}
 gradients(i,cells=this.cells,radius=this.opt.radius){let out=dirs.map(d=>({label:d[2],f:0,p:0,a:0,pain:0})),x=i%N,y=Math.floor(i/N),r=radius;for(let j=0;j<400;j++){if(j===i)continue;let dx=j%N-x,dy=Math.floor(j/N)-y,dist=Math.hypot(dx,dy);if(dist>r)continue;let angle=Math.atan2(dx,-dy),d=(Math.round(angle/(Math.PI/4))+8)%8,c=cells[j];out[d].f+=c.f/dist;out[d].p+=c.p/dist;out[d].a+=(c.a?.size||0)/dist;out[d].pain+=(c.pain||0)/dist;}return out;}
 shuffle(a){for(let k=a.length-1;k>0;k--){let j=Math.floor(this.random()*(k+1));[a[k],a[j]]=[a[j],a[k]];}return a;}
 networks(){let seen=new Set,groups=[];for(let i=0;i<400;i++){if(seen.has(i)||this.cells[i].p<=1e-9)continue;let group=[i];seen.add(i);for(let k=0;k<group.length;k++)for(let q of this.neighbors(group[k]))if(!seen.has(q.i)&&this.cells[q.i].p>1e-9){seen.add(q.i);group.push(q.i);}groups.push(group);}return groups;}
 diffuse(){// Snapshot fluxes: each source sends at most its food; each destination receives only available capacity.
 let flows=[],out=Array(400).fill(0),incoming=Array(400).fill(0),rate=Math.max(0,Math.min(1,this.opt.diffusion||0));
 for(let i=0;i<400;i++)for(let j of [i%20<19?i+1:-1,i<380?i+20:-1]){if(j<0)continue;let d=this.cells[i].f-this.cells[j].f,from=d>0?i:j,to=d>0?j:i,amount=Math.abs(d)*rate/4;if(amount>0){flows.push({from,to,amount});out[from]+=amount;incoming[to]+=amount;}}
 let delta=Array(400).fill(0);for(let q of flows){let c=this.cells[q.to],room=Math.max(0,Math.min(10-c.f,11-this.total(c))),amount=q.amount*Math.min(1,this.cells[q.from].f/(out[q.from]||1),room/(incoming[q.to]||1));delta[q.from]-=amount;delta[q.to]+=amount;}this.cells.forEach((c,i)=>c.f+=delta[i]);
 }
 damagePotential(i,radius=this.opt.radius){let x=i%N,y=Math.floor(i/N),value=0;for(let j=0;j<400;j++){let pain=this.cells[j].pain||0;if(!pain)continue;let d=Math.hypot(j%N-x,Math.floor(j/N)-y);if(d<=radius)value+=pain/Math.max(1,d);}return value;}
 graze(i,amount){let c=this.cells[i],meal=Math.max(0,Math.min(c.p,amount));c.p-=meal;c.pain=Math.min(10,(c.pain||0)+meal);return meal;}
 growPlants(signals){this.ensurePlants();for(let group of this.shuffle(this.networks())){let mass=group.reduce((s,i)=>s+this.cells[i].p,0),available=group.reduce((s,i)=>s+this.cells[i].f,0),maintenance=.01*mass,used=0;
 const consume=amount=>{let remaining=amount;for(let i of group){let take=Math.min(this.cells[i].f,remaining);this.cells[i].f-=take;remaining-=take;if(remaining<1e-12)break;}used+=amount-remaining;return amount-remaining;};
 let paid=consume(Math.min(available,maintenance)),fed=paid+1e-9>=maintenance;
 for(let i of group){let c=this.cells[i];c.hunger=fed?0:c.hunger+1;if(c.hunger>this.plantGenes(c).grace)c.p=Math.max(0,c.p-.15);}
 if(!fed)continue;
 // Thread growth transfers existing biomass; the rest of the connected network feeds the tip.
 let candidates=[];for(let i of group)for(let q of this.neighbors(i))if(this.cells[q.i].p===0&&!this.cells[q.i].spore&&11-this.total(this.cells[q.i])>=.2){let genes=this.plantGenes(this.cells[i]),signal=this.sense(i,genes.radius).find(g=>g.label===q.label).f;candidates.push({...q,from:i,foodScore:this.cells[q.i].f+signal,score:this.cells[q.i].f+signal-genes.painWeight*this.damagePotential(q.i,genes.radius)});}
 candidates=candidates.filter(q=>q.foodScore>0);this.shuffle(candidates);candidates.sort((a,b)=>b.score-a.score);let tip=candidates[0];
 if(tip&&tip.foodScore>0&&mass>=1.5){let donors=group.filter(i=>this.cells[i].p>.4).sort((a,b)=>this.cells[b].p-this.cells[a].p);if(donors.length){this.cells[donors[0]].p-=.2;this.cells[tip.i].p=.2;this.cells[tip.i].plantId=this.cells[tip.from].plantId;this.cells[tip.i].hunger=0;group.push(tip.i);}}
 // No stored energy: connected food is converted into mass where growth has room.
 let budget=group.reduce((s,i)=>s+this.plantGenes(this.cells[i]).growth,0);for(let i of this.shuffle([...group])){let c=this.cells[i],need=Math.min(this.plantGenes(c).growth,budget,10-c.p,Math.max(0,11-this.total(c))+c.f);if(need<=0)continue;let food=group.reduce((s,j)=>s+this.cells[j].f,0),amount=Math.min(need,food); // Consumption can free local capacity.
 let local=Math.min(c.f,amount);c.f-=local;let other=amount-local,room=Math.max(0,11-this.total(c));let actual=Math.min(amount,room);if(actual<local){c.f+=local-actual;local=actual;other=0;}else other=actual-local;
 consume(other);c.p+=actual;budget-=actual;if(budget<=0)break;}
 }}
 sporeStatus(i){let c=this.cells[i],counts={plants:0,animals:0,spores:0};for(let q of this.neighbors(i)){let n=this.cells[q.i];counts.plants+=n.p>0;counts.animals+=!!n.a;counts.spores+=!!n.spore;}return {ready:!!c.spore&&!c.a&&c.p===0&&c.f>0&&!counts.plants&&!counts.animals,food:c.f,ownAnimal:!!c.a,...counts};}
 germinateSpores(){const snapshot=this.cells.map(c=>({...c}));for(let i=0;i<400;i++){let c=this.cells[i],before=snapshot[i];if(!before.spore||before.a||before.p>0||before.f<=0)continue;
 if(this.neighbors(i).every(q=>snapshot[q.i].p===0&&!snapshot[q.i].a)){c.spore=0;c.p=1;c.plantId=c.sporePlantId||this.newPlant().id;c.sporePlantId=null;c.hunger=0;this.germinations++;}}
 }
 squareCells(i){return i%N<N-1&&i<N*(N-1)?[i,i+1,i+N,i+N+1]:[];}
 reproducePlants(){this.ensurePlants();const eligible=[];
 for(let i=0;i<400;i++){let square=this.squareCells(i),full=square.length===4&&square.every(j=>this.cells[j].p>0&&!this.cells[j].spore);let signature=full?square.map(j=>this.cells[j].plantId).join(':'):'';this.squareTicks[i]=full?(signature===this.squareParents[i]?this.squareTicks[i]+1:1):0;this.squareParents[i]=signature;if(this.squareTicks[i]>=3)eligible.push({anchor:i,square});}
 // At most one spore per connected network; only cells in a qualifying square may become spores.
 for(let group of this.networks()){let members=new Set(group),squares=this.shuffle(eligible.filter(q=>q.square.every(i=>members.has(i))));
 let chosen=squares.find(q=>q.square.some(i=>this.cells[i].p>=1));if(!chosen)continue;
 let choices=chosen.square.filter(i=>this.cells[i].p>=1),i=choices[Math.floor(this.random()*choices.length)],c=this.cells[i];const parentIds=[...new Set(chosen.square.map(j=>this.cells[j].plantId))];c.sporePlantId=this.newPlant(inherit(this,'plant',parentIds.map(id=>this.plants.get(id).genes)),parentIds).id;c.plantId=null;c.p=0;c.spore=1;c.hunger=0;this.sporesMade++;
 for(let anchor=0;anchor<400;anchor++)if(this.squareCells(anchor).some(i=>members.has(i)))this.squareTicks[anchor]=0;
 }}
 divide(i){let c=this.cells[i],a=c.a;if(!a)return false;let genes=this.animalGenes(a);if(a.mating||a.lastSexBirth===this.tick||(a.age||0)>=genes.reproductionAge||a.size<10||(a.maxTicks||0)<genes.divisionWait)return false;
 const size=a.size*.3,choices=this.neighbors(i).filter(q=>!this.cells[q.i].a&&this.total(this.cells[q.i])+size<=11);
 if(!choices.length||genes.divisionChance<=0||this.random()>=genes.divisionChance)return false;
 let target=choices[Math.floor(this.random()*choices.length)].i;
 const daughter=()=>this.newAnimal(this.inheritAnimal(genes),{parentId:a.id,generation:(a.generation||0)+1,size,energy:Math.max(0,a.energy)*.3});
 c.a=daughter();this.cells[target].a=daughter();this.divisions++;return true;
 }
 ageAnimal(i){let c=this.cells[i],a=c.a;if(!a)return false;let genes=this.animalGenes(a);a.age=(a.age||0)+1;
 if(a.age>=Math.max(genes.reproductionAge,genes.declineAge)&&genes.declineChance>0&&genes.declineAmount>0&&this.random()<genes.declineChance){a.size-=genes.declineAmount;a.maxTicks=0;if(a.size<1){c.a=null;this.ageDeaths++;return false;}}return true;}
 lifeStage(a){let genes=this.animalGenes(a);return (a.age||0)>=Math.max(genes.reproductionAge,genes.declineAge)?'declining':(a.age||0)>=genes.reproductionAge?'post-reproductive':'reproductive';}
 crowdAt(i,cells=this.cells,exclude=-1){return this.neighbors(i).filter(q=>q.i!==exclude&&cells[q.i].a).length;}
 dart(i,snapshot){let a=this.cells[i].a;if(!a)return i;let genes=this.animalGenes(a),threshold=genes.crowdThreshold;
 if(!a||threshold>8||this.crowdAt(i,snapshot)<threshold)return i;
 const limit=Math.max(1,Math.min(10,Math.floor(genes.dartDistance))),seen=new Set([i]),queue=[{i,steps:0}],choices=[];
 for(let k=0;k<queue.length;k++){let node=queue[k];if(node.steps>=limit)continue;
 if(node.i%N===0||node.i%N===N-1||node.i<N||node.i>=N*(N-1))choices.push({i:-1,steps:node.steps+1,crowd:0,pressure:0,food:0});
 for(let q of this.neighbors(node.i)){if(seen.has(q.i)||this.cells[q.i].a||this.total(this.cells[q.i])+a.size>11)continue;
 seen.add(q.i);let next={i:q.i,steps:node.steps+1};queue.push(next);
 let crowd=this.crowdAt(q.i,snapshot,i);if(crowd<this.crowdAt(i,snapshot)){let signals=this.gradients(q.i,snapshot,genes.radius);choices.push({...next,crowd,pressure:signals.reduce((s,g)=>s+g.a,0),food:this.cells[q.i].p+signals.reduce((s,g)=>s+g.p,0)});}
 }}
 this.shuffle(choices);choices.sort((a,b)=>a.crowd-b.crowd||a.pressure-b.pressure||b.food-a.food||b.steps-a.steps);
 if(!choices.length)return i;let target=choices[0].i;this.cells[i].a=null;if(target<0)this.departures++;else this.cells[target].a=a;this.darts++;return target;
 }
 step(){for(let c of this.cells){c.pain=(c.pain||0)*this.opt.painDecay;if(c.pain<1e-8)c.pain=0;}this.diffuse();this.germinateSpores();
 for(let i=0;i<400;i++)if(this.cells[i].a)this.ageAnimal(i);
 const snapshot=this.cells.map(c=>({...c,a:c.a?{...c.a}:null})),signals=snapshot.map((_,i)=>this.gradients(i,snapshot));
 this._snapshot=snapshot;this._signalCache=new Map();this.growPlants(signals);this.updateMating(snapshot);
 const animals=this.shuffle(snapshot.flatMap((c,i)=>c.a?[{i,id:c.a.id}]:[]));
 for(let {i,id} of animals){let c=this.cells[i],a=c.a;if(!a||a.id!==id)continue;const genes=this.animalGenes(a);const startSize=a.size,origin=i;i=a.mating?i:this.dart(i,snapshot);if(i<0)continue;c=this.cells[i];const darted=i!==origin;let targets=[{i},...this.neighbors(i)].sort((u,v)=>this.cells[v.i].p-this.cells[u.i].p),food=targets.find(q=>this.cells[q.i].p>0),meal=0;if(food){meal=this.graze(food.i,.15*a.size);a.energy+=meal;}
 a.energy-=genes.metabolism*a.size;
 if(a.energy<0){if(a.size>1){a.size=Math.max(1,a.size-.25);a.energy=.1;}else{c.a=null;continue;}}
 if(this.lifeStage(a)!=='declining'&&a.energy>2+a.size&&a.size<10){let grow=Math.min(.25,10-a.size,11-this.total(c));a.size+=grow;a.energy-=grow;}
 a.maxTicks=a.size>=10&&startSize>=10?(a.maxTicks||0)+1:0;
 if(this.divide(i))continue;
 if(meal===0&&!darted&&!a.mating){let choices=this.neighbors(i).filter(q=>!this.cells[q.i].a&&this.total(this.cells[q.i])+a.size<=11);if(i%N===0||i%N===N-1||i<N||i>=N*(N-1))choices.push({i:-1});this.shuffle(choices);choices.sort((u,v)=>{let score=q=>q.i<0?0:this.cells[q.i].p*2+this.sense(i,genes.radius).find(s=>s.label===q.label).p;return score(v)-score(u);});if(choices.length){c.a=null;if(choices[0].i<0)this.departures++;else this.cells[choices[0].i].a=a;}}
 }
 this.reproducePlants();
 for(let c of this.cells)if(this.opt.regen>0)c.f+=Math.min(this.opt.regen,10-c.f,11-this.total(c));this.tick++;this._snapshot=null;this._signalCache=null;this.record();}
 record(){let s=this.cells.reduce((s,c)=>({food:s.food+c.f,plant:s.plant+c.p,spores:s.spores+(c.spore?1:0),animals:s.animals+!!c.a,mass:s.mass+(c.a?.size||0)}),{food:0,plant:0,spores:0,animals:0,mass:0});this.stats=s;this.history.push(s);if(this.history.length>400)this.history.shift();}
}

Object.assign(World.prototype,matingMethods);
