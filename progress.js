/* Fuel Lab v0.4 — private weight and weekly progress.
   Computes summaries client-side from the existing cached food, Health and weight logs.
   Nothing here uploads private data or extrapolates missing days. */
(function(){
'use strict';
const fmt=n=>Number(n).toLocaleString('en-IE',{maximumFractionDigits:1});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=s=>new Date(s+'T12:00:00');
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function weekDates(now,offset){
 const d=localDate(now),weekday=(d.getDay()+6)%7;
 d.setDate(d.getDate()-weekday+offset*7);
 return Array.from({length:7},(_,i)=>{let v=new Date(d);v.setDate(v.getDate()+i);return iso(v);});
}
const shortDate=s=>localDate(s).toLocaleDateString('en-IE',{day:'numeric',month:'short'});
const dayLabel=s=>localDate(s).toLocaleDateString('en-IE',{weekday:'short'});
function summarize({entries=[],activity=[],weights=[],prefs={kcal:2470},today,offset=0}){
 const dates=weekDates(today,Math.min(0,Math.trunc(offset)||0));
 const days=dates.map(date=>{
  const foods=entries.filter(e=>e.date===date);
  const energy=activity.find(a=>a.date===date&&a.kind==='Daily Active');
  return {date,foods:foods.length,calories:foods.reduce((s,x)=>s+Number(x.kcal||0),0),protein:foods.reduce((s,x)=>s+Number(x.protein||0),0),
    activeKcal:energy?Number(energy.activeKcal):null,exerciseMinutes:energy&&energy.exerciseMinutes!=null?Number(energy.exerciseMinutes):null};
 });
 const logged=days.filter(d=>d.foods>0);
 const active=days.filter(d=>d.activeKcal!==null);
 const exercise=days.filter(d=>d.exerciseMinutes!==null);
 const eligibleWeights=weights.filter(w=>w.date<=dates[6]).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const latest=eligibleWeights.at(-1)||null,prior=eligibleWeights.length>1?eligibleWeights.at(-2):null;
 const currentWeekWeights=eligibleWeights.filter(w=>w.date>=dates[0]);
 const totalCalories=logged.reduce((n,d)=>n+d.calories,0);
 return {dates,days,loggedDays:logged.length,calories:totalCalories,calorieAvg:logged.length?totalCalories/logged.length:null,
  proteinAvg:logged.length?logged.reduce((s,d)=>s+d.protein,0)/logged.length:null,
  activityDays:active.length,activeCalories:active.reduce((s,d)=>s+d.activeKcal,0),
  exerciseMinutes:exercise.length?exercise.reduce((s,d)=>s+d.exerciseMinutes,0):null,exerciseDays:exercise.length,
  latestWeight:latest,previousWeight:prior,weightChange:latest&&prior?latest.kg-prior.kg:null,
  weekWeights:currentWeekWeights,trend:eligibleWeights.slice(-12),target:Number(prefs.kcal)||2470};
}
function weightChart(weights){
 if(weights.length===0)return '<div class="progress-empty">No weigh-ins yet. Tell ChatGPT “Log my weight as 102 kg in Fuel Lab” after you weigh yourself. Your previous approximate weights have not been given invented dates.</div>';
 if(weights.length===1)return '<div class="progress-single"><strong>'+fmt(weights[0].kg)+' kg</strong><span>'+shortDate(weights[0].date)+' · first recorded weigh-in</span></div>';
 const w=310,h=165,p={l:33,r:12,t:19,b:26};
 let lo=Math.min(...weights.map(w=>w.kg)),hi=Math.max(...weights.map(w=>w.kg));
 const spread=Math.max(0.6,hi-lo),padding=spread*.22;lo-=padding;hi+=padding;
 const time=weights.map(w=>localDate(w.date).getTime()),earliest=Math.min(...time),latest=Math.max(...time);
 const x=i=>p.l+(latest===earliest?(i/(weights.length-1)):(time[i]-earliest)/(latest-earliest))*(w-p.l-p.r);
 const y=v=>p.t+(hi-v)/(hi-lo)*(h-p.t-p.b);
 const points=weights.map((q,i)=>[x(i),y(q.kg)]);
 const line=points.map((q,i)=>(i===0?'M':'L')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
 const dotted=[0,.5,1].map(i=>{const yy=p.t+i*(h-p.t-p.b);return '<line x1="'+p.l+'" y1="'+yy+'" x2="'+(w-p.r)+'" y2="'+yy+'" stroke="var(--line)" stroke-dasharray="3 5"/><text x="'+(p.l-5)+'" y="'+(yy+4)+'" fill="var(--muted)" font-size="10" text-anchor="end">'+(hi-(hi-lo)*i).toFixed(1)+'</text>'}).join('');
 const circles=points.map((pt,i)=>'<circle cx="'+pt[0].toFixed(1)+'" cy="'+pt[1].toFixed(1)+'" r="'+(i===points.length-1?4.5:3)+'" fill="var(--mint)"><title>'+esc(weights[i].date)+' · '+fmt(weights[i].kg)+' kg</title></circle>').join('');
 return '<svg class="progress-weight-graph" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Weight history over '+weights.length+' measurements" xmlns="http://www.w3.org/2000/svg">'+dotted+'<path d="'+line+'" fill="none" stroke="var(--mint)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'+circles+
 '<text x="'+p.l+'" y="'+(h-3)+'" fill="var(--muted)" font-size="10">'+shortDate(weights[0].date)+'</text><text x="'+(w-p.r)+'" y="'+(h-3)+'" fill="var(--muted)" font-size="10" text-anchor="end">'+shortDate(weights.at(-1).date)+'</text></svg>';
}
function trainingPanel(model,week){
 const data=model.training||{};
 const swims=Array.isArray(data.swims)?data.swims:[];
 const gyms=Array.isArray(data.gyms)?data.gyms:[];
 const strength=Array.isArray(data.strength)?data.strength:[];
 const begin=week.dates[0],end=week.dates[6];
 const during=record=>record.date>=begin&&record.date<=end;
 const wkSwims=swims.filter(during),wkGyms=gyms.filter(during),wkStrength=strength.filter(during);
 const distance=wkSwims.reduce((n,x)=>n+(Number(x.distanceM)||0),0);
 const sessionRecords=[
  ...wkSwims.map(x=>({date:x.date,label:'Swim',detail:(x.type||x.setting||'Pool session')+' · '+fmt(x.distanceM)+' m'})),
  ...wkGyms.map(x=>({date:x.date,label:'Gym',detail:(x.session||'Workout')+(x.workingSets!=null?' · '+fmt(x.workingSets)+' sets':'') }))
 ].sort((a,b)=>b.date.localeCompare(a.date)||a.label.localeCompare(b.label)).slice(0,5);
 const liftRecords=wkStrength.filter(x=>x.loadKg!=null).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
 const hasData=swims.length+gyms.length+strength.length>0;
 if(!hasData)return '<section class="card training-card"><div class="eyebrow">SWIM & STRENGTH</div><h2>Your training, alongside your fuel.</h2><p class="progress-hint">Connect your existing Swim & Strength Progress Tracker under Settings to see recorded workouts here. No second workout diary or new manual entry process.</p></section>';
 const stats=[
  ['Swim distance',fmt(distance/1000)+' km',wkSwims.length+' recorded swims'],
  ['Gym sessions',String(wkGyms.length),'Recorded this week'],
  ['Strength records',String(wkStrength.length),'Exercise entries this week']
 ].map(([label,value,sub])=>'<div class="training-stat"><small>'+label+'</small><strong>'+value+'</strong><span>'+sub+'</span></div>').join('');
 const sessions=sessionRecords.length?sessionRecords.map(x=>'<div class="training-item"><span class="training-date">'+shortDate(x.date)+'</span><div><strong>'+esc(x.label)+'</strong><span>'+esc(x.detail)+'</span></div></div>').join(''):'<p class="progress-hint">No swim or gym sessions recorded for this week.</p>';
 const lifts=liftRecords.length?'<div class="training-lifts"><h3>Recent recorded lifts</h3>'+liftRecords.map(x=>'<div class="training-lift"><span>'+esc(x.exercise)+'</span><strong>'+fmt(x.loadKg)+' kg</strong></div>').join('')+'</div>':'';
 return '<section class="card training-card"><div class="eyebrow">SWIM & STRENGTH</div><h2>Training overview</h2><p class="progress-hint">Read-only from your separate training spreadsheet, for '+shortDate(begin)+' – '+shortDate(end)+'. Apple Health daily active energy already includes workouts, so calories are never added twice.</p>'+
 '<div class="training-stats">'+stats+'</div><h3>Recorded sessions</h3><div class="training-list">'+sessions+'</div>'+lifts+'</section>';
}

/* Performance Lab: visualise read-only training records; never estimate a 1RM. */
function performanceExerciseGroups(rows){
 const groups=new Map();
 for(const r of (Array.isArray(rows)?rows:[])){
  const name=String(r.exercise||'').trim().replace(/\s+/g,' ');
  const basis=String(r.loadBasis||'Not specified').trim().replace(/\s+/g,' ')||'Not specified';
  const load=Number(r.loadKg);
  if(!name||!r.date||!Number.isFinite(load)||load<=0)continue;
  const key=name.toLowerCase()+'|'+basis.toLowerCase();
  if(!groups.has(key))groups.set(key,{key,name,basis,records:[]});
  groups.get(key).records.push({...r,loadKg:load});
 }
 return Array.from(groups.values()).map(g=>{
  const dates=new Map();
  for(const r of g.records)if(!dates.has(r.date)||dates.get(r.date).loadKg<r.loadKg)dates.set(r.date,r);
  g.days=Array.from(dates.values()).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));return g;
 }).sort((a,b)=>b.days.length-a.days.length||a.name.localeCompare(b.name));
}
const perfDate=s=>localDate(s).toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'2-digit'});
const perfPace=min=>{const sec=Math.round(min*60);return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');};
function perfChart(records,kind,unit,title){
 if(!records.length)return '<div class="perf-empty">No measurements recorded for this chart.</div>';
 const w=350,h=176,L=47,R=15,T=19,B=31;
 const vals=records.map(x=>Number(x.value)),small=Math.min(...vals),big=Math.max(...vals);
 const pad=Math.max((big-small)*.24,big*.10,unit==='pace'?.1:1);
 const min=kind==='bar'?0:Math.max(0,small-pad),max=Math.max(min+.1,big+pad);
 const x=i=>L+(records.length===1?.5:i/(records.length-1))*(w-L-R);
 const y=value=>T+(max-value)/(max-min)*(h-T-B);
 const fmtY=v=>unit==='m'?fmt(Math.round(v)):unit==='pace'?v.toFixed(1):fmt(Number(v.toFixed(1)));
 const fmtVal=v=>unit==='pace'?perfPace(v)+' /100m':fmt(v)+' '+unit;
 const grid=[0,.5,1].map(q=>{const yy=T+q*(h-T-B);return '<line x1="'+L+'" y1="'+yy.toFixed(1)+'" x2="'+(w-R)+'" y2="'+yy.toFixed(1)+'" stroke="var(--line)" stroke-dasharray="3 5"/><text x="'+(L-6)+'" y="'+(yy+4).toFixed(1)+'" fill="var(--muted)" font-size="10" text-anchor="end">'+fmtY(max-q*(max-min))+'</text>';}).join('');
 let plot='';
 if(kind==='bar'){
  const width=Math.min(27,(w-L-R)/records.length*.58);
  plot=records.map((r,i)=>{const xx=x(i)-width/2,yy=y(r.value);return '<rect x="'+xx.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+width.toFixed(1)+'" height="'+Math.max(1,h-B-yy).toFixed(1)+'" rx="4" fill="var(--mint)"><title>'+esc(r.date)+' · '+fmtVal(r.value)+'</title></rect>';}).join('');
 }else{
  const points=records.map((r,i)=>[x(i),y(r.value)]);
  const d=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  plot='<path d="'+d+'" fill="none" stroke="var(--mint)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+
    points.map((p,i)=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4.3" stroke="var(--surface)" stroke-width="2" fill="var(--mint)"><title>'+esc(records[i].date)+' · '+fmtVal(records[i].value)+'</title></circle>').join('');
 }
 const labels='<text x="'+L+'" y="'+(h-5)+'" fill="var(--muted)" font-size="10">'+perfDate(records[0].date)+'</text>'+
 (records.length>1?'<text x="'+(w-R)+'" y="'+(h-5)+'" text-anchor="end" fill="var(--muted)" font-size="10">'+perfDate(records.at(-1).date)+'</text>':'');
 return '<svg class="perf-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(title)+' with '+records.length+' recorded measurements" xmlns="http://www.w3.org/2000/svg">'+grid+plot+labels+'</svg>';
}
function perfStats(items){
 return '<div class="perf-stats">'+items.map(x=>'<div class="perf-stat"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong><span>'+esc(x[2])+'</span></div>').join('')+'</div>';
}
function perfGym(training,selectedKey){
 const groups=performanceExerciseGroups(training.strength);
 if(!groups.length)return '<div class="perf-empty">No weighted exercises have been recorded yet. Log a gym session in chat and refresh your connected tracker.</div>';
 const g=groups.find(x=>x.key===selectedKey)||groups[0],all=g.days,first=all[0],last=all.at(-1);
 const options=groups.map(x=>'<option value="'+esc(x.key)+'"'+(x.key===g.key?' selected':'')+'>'+esc(x.name+' · '+x.basis)+'</option>').join('');
 const difference=last.loadKg-first.loadKg;
 const stats=perfStats([
  ['Latest load',fmt(last.loadKg)+' kg',perfDate(last.date)],
  ['Highest logged',fmt(Math.max(...all.map(x=>x.loadKg)))+' kg','Same exercise and load basis'],
  ['Since first record',all.length>1?(difference>0?'+':'')+fmt(difference)+' kg':'—',all.length+' dated records']
 ]);
 const history=all.slice(-4).reverse().map(r=>'<div class="perf-row"><span>'+perfDate(r.date)+'</span><strong>'+fmt(r.loadKg)+' kg</strong><span>'+((r.reps!=null&&Number.isFinite(Number(r.reps)))?fmt(r.reps)+' reps':'Reps not recorded')+'</span></div>').join('');
 const recent=all.slice(-12).map(x=>({date:x.date,value:x.loadKg}));
 return '<div class="perf-select"><label for="performanceExercise">Exercise and load basis</label><select id="performanceExercise" class="control">'+options+'</select></div>'+stats+
 '<div class="perf-graph-head"><h3>Recorded working loads</h3><span>Last '+recent.length+' dates</span></div>'+
 perfChart(recent,'line','kg',g.name+' working loads')+
 '<div class="perf-history"><h3>Recent entries</h3>'+history+'</div>'+
 '<p class="perf-note">This compares recorded weights, not estimated one-rep maxes. '+esc(g.basis)+' loads are shown exactly as logged. Dumbbells are per dumbbell where stated; machine stacks can differ between gyms. If several loads exist on a date, the highest is plotted.</p>';
}
function perfSwim(training){
 const rows=(Array.isArray(training.swims)?training.swims:[])
  .filter(x=>x.date&&Number.isFinite(Number(x.distanceM))&&Number(x.distanceM)>0)
  .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 if(!rows.length)return '<div class="perf-empty">No swimming sessions recorded yet. Log a swim through chat and refresh your tracker.</div>';
 const total=rows.reduce((n,x)=>n+Number(x.distanceM),0),recent=rows.slice(-12);
 const pace=recent.filter(x=>Number.isFinite(Number(x.durationMin))&&Number(x.durationMin)>0)
  .map(x=>({date:x.date,value:Number(x.durationMin)*100/Number(x.distanceM)}));
 const history=rows.slice(-4).reverse().map(x=>'<div class="perf-row"><span>'+perfDate(x.date)+'</span><strong>'+fmt(x.distanceM)+' m</strong><span>'+esc(x.type||x.setting||'Swim')+'</span></div>').join('');
 return perfStats([['Swims logged',String(rows.length),'Recorded sessions'],['Distance logged',fmt(total/1000)+' km','All recorded swims'],['Longest session',fmt(Math.max(...rows.map(x=>Number(x.distanceM))))+' m','Not necessarily continuous']])+
 '<div class="perf-graph-head"><h3>Distance per swim</h3><span>Last '+recent.length+' sessions</span></div>'+
 perfChart(recent.map(x=>({date:x.date,value:Number(x.distanceM)})),'bar','m','Swim distance per session')+
 '<div class="perf-graph-head perf-subhead"><h3>Elapsed pace</h3><span>Minutes / 100 m</span></div>'+
 perfChart(pace,'line','pace','Elapsed minutes per 100 metres')+
 '<p class="perf-note">Elapsed pace includes any rests and drills. It is not race pace and cannot reliably compare speed across different session types.</p>'+
 '<div class="perf-history"><h3>Recent swims</h3>'+history+'</div>';
}
function performanceLab(model){
 const training=model.training||{};
 const has=['swims','gyms','strength'].some(k=>Array.isArray(training[k])&&training[k].length);
 const tab=model.performanceTab==='swim'?'swim':'gym';
 const head='<section class="card performance-lab" aria-labelledby="performanceTitle"><div class="perf-head"><div><div class="eyebrow">PERFORMANCE LAB</div><h2 id="performanceTitle">Your training progress</h2></div><span class="perf-tag">READ-ONLY</span></div><p class="progress-hint">From your existing training spreadsheet. Log workouts through chat, then view the trends here.</p>';
 if(!has)return head+'<div class="perf-empty">Connect your Swim & Strength tracker in Settings and tap Refresh now to unlock these charts.</div></section>';
 const tabs='<div class="perf-tabs" role="tablist" aria-label="Training progress view">'+
 '<button type="button" role="tab" data-performance-tab="gym" aria-selected="'+(tab==='gym')+'" class="'+(tab==='gym'?'selected':'')+'">Gym</button>'+
 '<button type="button" role="tab" data-performance-tab="swim" aria-selected="'+(tab==='swim')+'" class="'+(tab==='swim'?'selected':'')+'">Swimming</button></div>';
 return head+tabs+'<div role="tabpanel" aria-label="'+(tab==='gym'?'Gym progress':'Swimming progress')+'">'+(tab==='gym'?perfGym(training,model.performanceExercise):perfSwim(training))+'</div></section>';
}

function display(model){
 const m=summarize(model);
 const title=shortDate(m.dates[0])+' – '+shortDate(m.dates[6]);
 const weight=m.latestWeight;
 const delta=m.weightChange;
 const total=m.days.length;
 const base=m.target;
 const bars=m.days.map(d=>{
 const pct=d.foods?Math.min(115,d.calories/base*100):0;
 return '<div class="progress-day"><div class="progress-day-label">'+dayLabel(d.date)+'</div><div class="progress-day-track">'+(d.foods?'<div class="progress-day-fill" style="width:'+Math.min(100,pct).toFixed(1)+'%"></div>':'<span class="progress-day-missing">Not logged</span>')+'<span class="progress-target-mark"></span></div><div class="progress-day-num">'+(d.foods?fmt(d.calories):'—')+'</div></div>';
 }).join('');
 const summaryCards=[
 ['Total logged intake',m.loggedDays?fmt(m.calories)+' kcal':'—','From '+m.loggedDays+' days with entries'],
 ['Avg daily intake',m.calorieAvg===null?'—':fmt(m.calorieAvg)+' kcal','Over '+m.loggedDays+' logged day'+(m.loggedDays===1?'':'s')],
 ['Avg daily protein',m.proteinAvg===null?'—':fmt(m.proteinAvg)+' g','On days with food entries'],
 ['Active energy',m.activityDays?fmt(m.activeCalories)+' kcal':'—',m.activityDays+' of 7 days recorded'],
 ['Exercise time',m.exerciseMinutes===null?'—':fmt(m.exerciseMinutes)+' min',m.exerciseDays+' of 7 days recorded'],
 ['Weigh-ins this week',String(m.weekWeights.length),'Measurements saved']
 ].map(c=>'<div class="progress-stat"><small>'+c[0]+'</small><strong>'+c[1]+'</strong><span>'+c[2]+'</span></div>').join('');
 return '<div class="eyebrow">LONG-TERM FUEL</div><h1>Progress & trends.</h1><p class="helper">Weight, weekly nutrition and Apple Health activity together. Based only on what you actually recorded.</p>'+
 '<section class="card progress-weight"><div class="progress-card-head"><div><div class="eyebrow">WEIGHT TRACKING</div><h2>Weight trend</h2></div><span class="progress-meta">'+(weight?'Latest · '+shortDate(weight.date):'No entries yet')+'</span></div>'+
 '<div class="progress-weight-value"><strong>'+(weight?fmt(weight.kg)+' <small>kg</small>':'—')+'</strong><span>'+(delta===null?'Waiting for two weigh-ins':(delta>0?'+':'')+fmt(delta)+' kg since previous weigh-in')+'</span></div>'+
 weightChart(m.trend)+'<p class="progress-hint">Weigh-ins are stored privately in the Weight Log Google Sheet. We show individual measurements, not assumed daily weights.</p></section>'+
 '<div class="progress-week-title"><h2>Weekly summary</h2><div class="progress-week-controls"><button id="weekPrev" type="button" aria-label="Previous week">‹</button><span>'+title+'</span><button id="weekNext" type="button" aria-label="Next week" '+(model.offset>=0?'disabled':'')+'>›</button></div></div>'+
 '<div class="progress-stats">'+summaryCards+'</div>'+
 '<section class="card progress-week-card"><div class="progress-card-head"><div><h2>Daily calorie intake</h2><p class="progress-subtitle">Compared with your '+fmt(base)+' kcal base target</p></div><span class="progress-meta">'+m.loggedDays+'/7 days</span></div>'+
 '<div class="progress-day-chart">'+bars+'</div><p class="progress-hint">Missing days are not counted as zero. Averages use only logged days; incomplete days may still underestimate intake. Calorie targets are not measures of energy expenditure or body-fat change.</p></section>'+
 performanceLab(model)+
  trainingPanel(model,m)+
 '<section class="card progress-footer"><div class="eyebrow">KEEP IT SIMPLE</div><h2>Log your weight in chat</h2><p>Whenever you weigh yourself, tell ChatGPT the number and date. It will be saved to your private Weight Log and appear here after Fuel Lab syncs.</p><a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">Open ChatGPT to log a weigh-in ↗</a></section>';
}
window.FuelProgress={summarize,display,weekDates,performanceExerciseGroups,performanceLab};
})();