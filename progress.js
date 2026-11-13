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
 const dotted=[0,.5,1].map(i=>{const yy=p.t+i*(h-p.t-p.b);return '<line x1="'+p.l+'" y1="'+yy+'" x2="'+(w-p.r)+'" y2="'+yy+'" stroke="#3b5554" stroke-dasharray="3 5"/><text x="'+(p.l-5)+'" y="'+(yy+4)+'" fill="#a5c4b7" font-size="10" text-anchor="end">'+(hi-(hi-lo)*i).toFixed(1)+'</text>'}).join('');
 const circles=points.map((pt,i)=>'<circle cx="'+pt[0].toFixed(1)+'" cy="'+pt[1].toFixed(1)+'" r="'+(i===points.length-1?4.5:3)+'" fill="#b6f0c6"><title>'+esc(weights[i].date)+' · '+fmt(weights[i].kg)+' kg</title></circle>').join('');
 return '<svg class="progress-weight-graph" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Weight history over '+weights.length+' measurements" xmlns="http://www.w3.org/2000/svg">'+dotted+'<path d="'+line+'" fill="none" stroke="#9be6b7" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'+circles+
 '<text x="'+p.l+'" y="'+(h-3)+'" fill="#a5c4b7" font-size="10">'+shortDate(weights[0].date)+'</text><text x="'+(w-p.r)+'" y="'+(h-3)+'" fill="#a5c4b7" font-size="10" text-anchor="end">'+shortDate(weights.at(-1).date)+'</text></svg>';
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
 ['Avg daily intake',m.calorieAvg===null?'—':fmt(m.calorieAvg)+' kcal',m.loggedDays+' of 7 days logged'],
 ['Avg daily protein',m.proteinAvg===null?'—':fmt(m.proteinAvg)+' g','On days with food entries'],
 ['Active energy',m.activityDays?fmt(m.activeCalories)+' kcal':'—',m.activityDays+' of 7 days recorded'],
 ['Exercise time',m.exerciseMinutes===null?'—':fmt(m.exerciseMinutes)+' min',m.exerciseDays+' of 7 days recorded']
 ].map(c=>'<div class="progress-stat"><small>'+c[0]+'</small><strong>'+c[1]+'</strong><span>'+c[2]+'</span></div>').join('');
 return '<div class="eyebrow">LONG-TERM FUEL</div><h1>Progress & trends.</h1><p class="helper">Weight, weekly nutrition and Apple Health activity together. Based only on what you actually recorded.</p>'+
 '<section class="card progress-weight"><div class="progress-card-head"><div><div class="eyebrow">WEIGHT TRACKING</div><h2>Weight trend</h2></div><span class="progress-meta">'+(weight?'Latest · '+shortDate(weight.date):'No entries yet')+'</span></div>'+
 '<div class="progress-weight-value"><strong>'+(weight?fmt(weight.kg)+' <small>kg</small>':'—')+'</strong><span>'+(delta===null?'Waiting for two weigh-ins':(delta>0?'+':'')+fmt(delta)+' kg since previous weigh-in')+'</span></div>'+
 weightChart(m.trend)+'<p class="progress-hint">Weigh-ins are stored privately in the Weight Log Google Sheet. We show individual measurements, not assumed daily weights.</p></section>'+
 '<div class="progress-week-title"><h2>Weekly summary</h2><div class="progress-week-controls"><button id="weekPrev" type="button" aria-label="Previous week">‹</button><span>'+title+'</span><button id="weekNext" type="button" aria-label="Next week" '+(model.offset>=0?'disabled':'')+'>›</button></div></div>'+
 '<div class="progress-stats">'+summaryCards+'</div>'+
 '<section class="card progress-week-card"><div class="progress-card-head"><div><h2>Daily calorie intake</h2><p class="progress-subtitle">Compared with your '+fmt(base)+' kcal base target</p></div><span class="progress-meta">'+m.loggedDays+'/7 days</span></div>'+
 '<div class="progress-day-chart">'+bars+'</div><p class="progress-hint">Missing days are not counted as zero. Averages use only logged days; incomplete days may still underestimate intake. Calorie targets are not measures of energy expenditure or body-fat change.</p></section>'+
 '<section class="card progress-footer"><div class="eyebrow">KEEP IT SIMPLE</div><h2>Log your weight in chat</h2><p>Whenever you weigh yourself, tell ChatGPT the number and date. It will be saved to your private Weight Log and appear here after Fuel Lab syncs.</p><a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">Open ChatGPT to log a weigh-in ↗</a></section>';
}
window.FuelProgress={summarize,display,weekDates};
})();