export const matingMethods={
 seekMate(i,snapshot){const a=this.cells[i].a;if(!a)return {i,engaged:false};a.seeking=null;const genes=this.animalGenes(a);
 if(a.gender!=='male'||a.size<6||a.mating||!this.fertile(a)||genes.mateDrive<=0)return {i,engaged:false};
 const available=new Set(this.cells.flatMap(c=>c.a&&!c.a.mating?[c.a.id]:[])),females=[];for(let j=0;j<this.cells.length;j++){const b=snapshot[j].a;if(!b||b.gender!=='female'||b.mating||!this.fertile(b)||!available.has(b.id))continue;
 if(Math.hypot(j%this.n-i%this.n,Math.floor(j/this.n)-Math.floor(i/this.n))<=genes.radius)females.push({i:j,id:b.id});}
 if(!females.length||this.random()>=genes.mateDrive)return {i,engaged:false};
 const visited=new Set([i]),queue=[{i,first:i}];for(let k=0;k<queue.length;k++){let node=queue[k],target=females.find(f=>this.neighbors(node.i).some(q=>q.i===f.i));if(target){a.seeking=target.id;if(node.first!==i){this.cells[i].a=null;this.cells[node.first].a=a;}return {i:node.first,engaged:true};}
 for(let q of this.shuffle(this.neighbors(node.i))){if(Math.hypot(q.x-i%this.n,q.y-Math.floor(i/this.n))>genes.radius||visited.has(q.i)||this.cells[q.i].a||this.total(this.cells[q.i])+a.size>11)continue;visited.add(q.i);queue.push({i:q.i,first:node.i===i?q.i:node.first});}}
 return {i,engaged:false};
 },
 fertile(a){return a.size>=4&&(a.age||0)<this.animalGenes(a).reproductionAge;},
 updateMating(snapshot){
 const live=new Map(this.cells.flatMap((c,i)=>c.a?[[c.a.id,{i,a:c.a}]]:[]));
 for(const g of [...this.gestations]){let parents=g.parents.map(id=>live.get(id));if(parents.some(p=>!p)){for(let p of parents)if(p)p.a.mating=null;this.gestations=this.gestations.filter(x=>x!==g);continue;}
 if(--g.remaining>0)continue;
 let spots=[...new Set(parents.flatMap(p=>this.neighbors(p.i).map(q=>q.i)))].filter(i=>!this.cells[i].a&&!this.cells[i].spore&&this.total(this.cells[i])+1<=11);this.shuffle(spots);spots.sort((i,j)=>(this.cells[i].p>0)-(this.cells[j].p>0));
 for(let i of spots){if(!g.litter||parents.some(p=>p.a.energy<.5))break;let genes=this.inheritAnimal(parents[0].a.genes,parents[1].a.genes),child=this.newAnimal(genes,{size:1,energy:1,parentIds:[...g.parents],generation:Math.max(...parents.map(p=>p.a.generation||0))+1,birthCell:i});this.cells[i].a=child;this.noteBirth(child);for(let p of parents){p.a.energy-=.5;p.a.lastSexBirth=this.tick;}g.litter--;this.sexualBirths++;}
 if(!g.litter){for(let p of parents)p.a.mating=null;this.gestations=this.gestations.filter(x=>x!==g);}else g.remaining=1;
 }
 const next=new Map();
 for(let i=0;i<this.cells.length;i++){let a=this.cells[i].a;if(!a||snapshot[i]?.a?.id!==a.id||a.mating||!this.fertile(a))continue;
 for(let q of this.neighbors(i)){let b=this.cells[q.i].a;if(q.i<=i||!b||snapshot[q.i]?.a?.id!==b.id||b.mating||!this.fertile(b)||a.gender===b.gender)continue;
 let key=[a.id,b.id].sort((x,y)=>x-y).join(':'),ticks=(this.contacts.get(key)||0)+1;next.set(key,ticks);if(ticks<2)continue;
 let chance=(a.genes.matingChance+b.genes.matingChance)/2;if(chance<=0||this.random()>=chance)continue;
 const g={id:this.nextMating++,parents:[a.id,b.id],remaining:Math.max(a.genes.gestationTicks,b.genes.gestationTicks),litter:1+Math.floor(this.random()*2)};this.gestations.push(g);a.mating=g.id;b.mating=g.id;this.matings++;next.delete(key);break;
 }}this.contacts=next;
 }
};
