export const N=20, dirs=[[0,-1,'N'],[1,-1,'NE'],[1,0,'E'],[1,1,'SE'],[0,1,'S'],[-1,1,'SW'],[-1,0,'W'],[-1,-1,'NW']];
export class World{
 constructor(seed=42,options={}){this.opt={radius:10,metabolism:.04,growth:.5,grace:6,regen:.01,diffusion:.08,divisionWait:5,divisionChance:.1,crowdThreshold:1,dartDistance:5,painWeight:6,painDecay:.8,reproductionAge:150,declineAge:220,declineChance:.25,declineAmount:.25,...options};this.seed=seed>>>0;this.tick=0;this.cells=Array.from({length:400},()=>({f:0,p:0,a:null,hunger:0,pain:0}));this.divisions=0;this.darts=0;this.ageDeaths=0;this.departures=0;this.nextId=1;for(let k=0;k<32;k++)this.pick(c=>!c.f).f=10;for(let k=0;k<12;k++)this.pick(c=>c.f===10&&!c.p).p=1;for(let k=0;k<7;k++)this.pick(c=>!c.a&&c.f+c.p<=10).a={id:this.nextId++,size:1,energy:3,age:0};this.history=[];this.record();}
 random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
 pick(pred){let a=this.cells.filter(pred);return a[Math.floor(this.random()*a.length)];}
 neighbors(i){let x=i%N,y=Math.floor(i/N);return dirs.map(([dx,dy,label])=>({x:x+dx,y:y+dy,label})).filter(q=>q.x>=0&&q.x<N&&q.y>=0&&q.y<N).map(q=>({...q,i:q.y*N+q.x}));}
 total(c){return c.f+c.p+(c.a?.size||0);}
 gradients(i,cells=this.cells){let out=dirs.map(d=>({label:d[2],f:0,p:0,a:0,pain:0})),x=i%N,y=Math.floor(i/N),r=this.opt.radius;for(let j=0;j<400;j++){if(j===i)continue;let dx=j%N-x,dy=Math.floor(j/N)-y,dist=Math.hypot(dx,dy);if(dist>r)continue;let angle=Math.atan2(dx,-dy),d=(Math.round(angle/(Math.PI/4))+8)%8,c=cells[j];out[d].f+=c.f/dist;out[d].p+=c.p/dist;out[d].a+=(c.a?.size||0)/dist;out[d].pain+=(c.pain||0)/dist;}return out;}
 shuffle(a){for(let k=a.length-1;k>0;k--){let j=Math.floor(this.random()*(k+1));[a[k],a[j]]=[a[j],a[k]];}return a;}
 networks(){let seen=new Set,groups=[];for(let i=0;i<400;i++){if(seen.has(i)||this.cells[i].p<=1e-9)continue;let group=[i];seen.add(i);for(let k=0;k<group.length;k++)for(let q of this.neighbors(group[k]))if(!seen.has(q.i)&&this.cells[q.i].p>1e-9){seen.add(q.i);group.push(q.i);}groups.push(group);}return groups;}
 diffuse(){// Snapshot fluxes: each source sends at most its food; each destination receives only available capacity.
 let flows=[],out=Array(400).fill(0),incoming=Array(400).fill(0),rate=Math.max(0,Math.min(1,this.opt.diffusion||0));
 for(let i=0;i<400;i++)for(let j of [i%20<19?i+1:-1,i<380?i+20:-1]){if(j<0)continue;let d=this.cells[i].f-this.cells[j].f,from=d>0?i:j,to=d>0?j:i,amount=Math.abs(d)*rate/4;if(amount>0){flows.push({from,to,amount});out[from]+=amount;incoming[to]+=amount;}}
 let delta=Array(400).fill(0);for(let q of flows){let c=this.cells[q.to],room=Math.max(0,Math.min(10-c.f,11-this.total(c))),amount=q.amount*Math.min(1,this.cells[q.from].f/(out[q.from]||1),room/(incoming[q.to]||1));delta[q.from]-=amount;delta[q.to]+=amount;}this.cells.forEach((c,i)=>c.f+=delta[i]);
 }
 damagePotential(i){let x=i%N,y=Math.floor(i/N),value=0;for(let j=0;j<400;j++){let pain=this.cells[j].pain||0;if(!pain)continue;let d=Math.hypot(j%N-x,Math.floor(j/N)-y);if(d<=this.opt.radius)value+=pain/Math.max(1,d);}return value;}
 graze(i,amount){let c=this.cells[i],meal=Math.max(0,Math.min(c.p,amount));c.p-=meal;c.pain=Math.min(10,(c.pain||0)+meal);return meal;}
 growPlants(signals){for(let group of this.shuffle(this.networks())){let mass=group.reduce((s,i)=>s+this.cells[i].p,0),available=group.reduce((s,i)=>s+this.cells[i].f,0),maintenance=.01*mass,used=0;
 const consume=amount=>{let remaining=amount;for(let i of group){let take=Math.min(this.cells[i].f,remaining);this.cells[i].f-=take;remaining-=take;if(remaining<1e-12)break;}used+=amount-remaining;return amount-remaining;};
 let paid=consume(Math.min(available,maintenance)),fed=paid+1e-9>=maintenance;
 for(let i of group){let c=this.cells[i];c.hunger=fed?0:c.hunger+1;if(c.hunger>this.opt.grace)c.p=Math.max(0,c.p-.15);}
 if(!fed)continue;
 // Thread growth transfers existing biomass; the rest of the connected network feeds the tip.
 let candidates=[];for(let i of group)for(let q of this.neighbors(i))if(this.cells[q.i].p===0&&11-this.total(this.cells[q.i])>=.2){let signal=signals[i].find(g=>g.label===q.label).f;candidates.push({...q,from:i,foodScore:this.cells[q.i].f+signal,score:this.cells[q.i].f+signal-this.opt.painWeight*this.damagePotential(q.i)});}
 candidates=candidates.filter(q=>q.foodScore>0);this.shuffle(candidates);candidates.sort((a,b)=>b.score-a.score);let tip=candidates[0];
 if(tip&&tip.foodScore>0&&mass>=1.5){let donors=group.filter(i=>this.cells[i].p>.4).sort((a,b)=>this.cells[b].p-this.cells[a].p);if(donors.length){this.cells[donors[0]].p-=.2;this.cells[tip.i].p=.2;this.cells[tip.i].hunger=0;group.push(tip.i);}}
 // No stored energy: connected food is converted into mass where growth has room.
 let budget=this.opt.growth*group.length;for(let i of this.shuffle([...group])){let c=this.cells[i],need=Math.min(this.opt.growth,budget,10-c.p,Math.max(0,11-this.total(c))+c.f);if(need<=0)continue;let food=group.reduce((s,j)=>s+this.cells[j].f,0),amount=Math.min(need,food); // Consumption can free local capacity.
 let local=Math.min(c.f,amount);c.f-=local;let other=amount-local,room=Math.max(0,11-this.total(c));let actual=Math.min(amount,room);if(actual<local){c.f+=local-actual;local=actual;other=0;}else other=actual-local;
 consume(other);c.p+=actual;budget-=actual;if(budget<=0)break;}
 }}
 divide(i){let c=this.cells[i],a=c.a;if(!a||(a.age||0)>=this.opt.reproductionAge||a.size<10||(a.maxTicks||0)<this.opt.divisionWait)return false;
 const size=a.size*.3,choices=this.neighbors(i).filter(q=>!this.cells[q.i].a&&this.total(this.cells[q.i])+size<=11);
 if(!choices.length||this.opt.divisionChance<=0||this.random()>=this.opt.divisionChance)return false;
 let target=choices[Math.floor(this.random()*choices.length)].i;
 const daughter=()=>({id:this.nextId++,parentId:a.id,size,energy:Math.max(0,a.energy)*.3,maxTicks:0,age:0});
 c.a=daughter();this.cells[target].a=daughter();this.divisions++;return true;
 }
 ageAnimal(i){let c=this.cells[i],a=c.a;if(!a)return false;a.age=(a.age||0)+1;
 if(a.age>=Math.max(this.opt.reproductionAge,this.opt.declineAge)&&this.opt.declineChance>0&&this.opt.declineAmount>0&&this.random()<this.opt.declineChance){a.size-=this.opt.declineAmount;a.maxTicks=0;if(a.size<1){c.a=null;this.ageDeaths++;return false;}}return true;}
 lifeStage(a){return (a.age||0)>=Math.max(this.opt.reproductionAge,this.opt.declineAge)?'declining':(a.age||0)>=this.opt.reproductionAge?'post-reproductive':'reproductive';}
 crowdAt(i,cells=this.cells,exclude=-1){return this.neighbors(i).filter(q=>q.i!==exclude&&cells[q.i].a).length;}
 dart(i,snapshot){let a=this.cells[i].a,threshold=this.opt.crowdThreshold;
 if(!a||threshold>8||this.crowdAt(i,snapshot)<threshold)return i;
 const limit=Math.max(1,Math.min(10,Math.floor(this.opt.dartDistance))),seen=new Set([i]),queue=[{i,steps:0}],choices=[];
 for(let k=0;k<queue.length;k++){let node=queue[k];if(node.steps>=limit)continue;
 if(node.i%N===0||node.i%N===N-1||node.i<N||node.i>=N*(N-1))choices.push({i:-1,steps:node.steps+1,crowd:0,pressure:0,food:0});
 for(let q of this.neighbors(node.i)){if(seen.has(q.i)||this.cells[q.i].a||this.total(this.cells[q.i])+a.size>11)continue;
 seen.add(q.i);let next={i:q.i,steps:node.steps+1};queue.push(next);
 let crowd=this.crowdAt(q.i,snapshot,i);if(crowd<this.crowdAt(i,snapshot)){let signals=this.gradients(q.i,snapshot);choices.push({...next,crowd,pressure:signals.reduce((s,g)=>s+g.a,0),food:this.cells[q.i].p+signals.reduce((s,g)=>s+g.p,0)});}
 }}
 this.shuffle(choices);choices.sort((a,b)=>a.crowd-b.crowd||a.pressure-b.pressure||b.food-a.food||b.steps-a.steps);
 if(!choices.length)return i;let target=choices[0].i;this.cells[i].a=null;if(target<0)this.departures++;else this.cells[target].a=a;this.darts++;return target;
 }
 step(){for(let c of this.cells){c.pain=(c.pain||0)*this.opt.painDecay;if(c.pain<1e-8)c.pain=0;}this.diffuse();
 const snapshot=this.cells.map(c=>({...c,a:c.a?{...c.a}:null})),signals=snapshot.map((_,i)=>this.gradients(i,snapshot));
 this.growPlants(signals);
 const animals=this.shuffle(snapshot.flatMap((c,i)=>c.a?[{i,id:c.a.id}]:[]));
 for(let {i,id} of animals){let c=this.cells[i],a=c.a;if(!a||a.id!==id)continue;if(!this.ageAnimal(i))continue;const startSize=a.size,origin=i;i=this.dart(i,snapshot);if(i<0)continue;c=this.cells[i];const darted=i!==origin;let targets=[{i},...this.neighbors(i)].sort((u,v)=>this.cells[v.i].p-this.cells[u.i].p),food=targets.find(q=>this.cells[q.i].p>0),meal=0;if(food){meal=this.graze(food.i,.15*a.size);a.energy+=meal;}
 a.energy-=this.opt.metabolism*a.size;
 if(a.energy<0){if(a.size>1){a.size=Math.max(1,a.size-.25);a.energy=.1;}else{c.a=null;continue;}}
 if(this.lifeStage(a)!=='declining'&&a.energy>2+a.size&&a.size<10){let grow=Math.min(.25,10-a.size,11-this.total(c));a.size+=grow;a.energy-=grow;}
 a.maxTicks=a.size>=10&&startSize>=10?(a.maxTicks||0)+1:0;
 if(this.divide(i))continue;
 if(meal===0&&!darted){let choices=this.neighbors(i).filter(q=>!this.cells[q.i].a&&this.total(this.cells[q.i])+a.size<=11);if(i%N===0||i%N===N-1||i<N||i>=N*(N-1))choices.push({i:-1});this.shuffle(choices);choices.sort((u,v)=>{let score=q=>q.i<0?0:this.cells[q.i].p*2+signals[i].find(s=>s.label===q.label).p;return score(v)-score(u);});if(choices.length){c.a=null;if(choices[0].i<0)this.departures++;else this.cells[choices[0].i].a=a;}}
 }
 for(let c of this.cells)if(this.opt.regen>0)c.f+=Math.min(this.opt.regen,10-c.f,11-this.total(c));this.tick++;this.record();}
 record(){let s=this.cells.reduce((s,c)=>({food:s.food+c.f,plant:s.plant+c.p,animals:s.animals+!!c.a,mass:s.mass+(c.a?.size||0)}),{food:0,plant:0,animals:0,mass:0});this.stats=s;this.history.push(s);if(this.history.length>400)this.history.shift();}
}
