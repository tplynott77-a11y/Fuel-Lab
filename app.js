(function(){
'use strict';
const {starterFoods,parseText,nutrition,totals}=window.FuelCore;
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-IE',{maximumFractionDigits:1});
const dayString=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>dayString(new Date());
const dateObject=d=>new Date(d+'T12:00:00');
const uid=()=>window.crypto?.randomUUID?.()||'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
let db;
let state={foods:[],entries:[],prefs:{id:'settings',kcal:2470,protein:160,carbs:270,fat:80},date:today(),screen:'today',parsed:[],activity:[],weights:[],progressWeekOffset:0,training:{swims:[],gyms:[],strength:[]}};
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast._timer);toast._timer=setTimeout(()=>el.classList.remove('show'),3600);}
function applyTheme(value){
 const mode=value==='dark'?'dark':'light';
 document.documentElement.dataset.theme=mode;
 document.documentElement.style.colorScheme=mode;
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute('content',mode==='light'?'#edf4fc':'#0b121d');
 const iosBar=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
 if(iosBar)iosBar.setAttribute('content',mode==='light'?'default':'black-translucent');
 try{localStorage.setItem('fuel-lab-theme',mode);}catch(_){}
 const selector=$('#themeSelect');
 if(selector)selector.value=mode;
}
// iOS Safari can close IndexedDB connections while a PWA is backgrounded.
// Reopen a stale connection before reading/writing; do not delete or reset the database.
let openPromise=null;
function openDb(){return new Promise((resolve,reject)=>{
 const req=indexedDB.open('fuel-lab-private-v1',1);
 req.onupgradeneeded=()=>{const d=req.result;for(const store of ['foods','entries','prefs'])if(!d.objectStoreNames.contains(store))d.createObjectStore(store,{keyPath:'id'});};
 req.onsuccess=()=>{
   const connection=req.result;
   connection.onclose=()=>{if(db===connection)db=null;};
   connection.onversionchange=()=>{connection.close();if(db===connection)db=null;};
   resolve(connection);
 };
 req.onerror=()=>reject(req.error||Error('Cannot open local food diary'));
 req.onblocked=()=>reject(Error('Please close any other Fuel Lab tabs and try again.'));
});}
async function ensureDb(){
 if(db)return db;
 if(!openPromise)openPromise=openDb().then(connection=>{db=connection;return connection;}).finally(()=>{openPromise=null;});
 return openPromise;
}
function isClosedConnection(err){
 return err?.name==='InvalidStateError'||/database connection is clos(?:ed|ing)|connection.*clos(?:ed|ing)|database is clos(?:ed|ing)/i.test(String(err?.message||''));
}
async function transact(stores,mode,enqueue){
 for(let attempt=0;attempt<3;attempt++){
  const connection=await ensureDb();
  try{
   return await new Promise((resolve,reject)=>{
    let tx;
    try{tx=connection.transaction(stores,mode);}catch(e){reject(e);return;}
    let value;
    const setResult=result=>{value=result;};
    tx.oncomplete=()=>resolve(value);
    tx.onabort=()=>reject(tx.error||Error('Local database transaction aborted'));
    tx.onerror=()=>reject(tx.error||Error('Local database transaction failed'));
    try{enqueue(tx,setResult);}
    catch(e){try{tx.abort();}catch(_){}reject(e);}
   });
  }catch(e){
   if(attempt===2||!isClosedConnection(e))throw e;
   // The old connection has become unusable. Keep all existing stores and records.
   if(db===connection)db=null;
   await new Promise(resolve=>setTimeout(resolve,60*(attempt+1)));
  }
 }
}
function op(store,type,arg){
 return transact(store,type==='getAll'||type==='get'?'readonly':'readwrite',(tx,setResult)=>{
  const obj=tx.objectStore(store);
  let req;
  if(type==='getAll')req=obj.getAll();
  else if(type==='put')req=obj.put(arg);
  else if(type==='delete')req=obj.delete(arg);
  else if(type==='get')req=obj.get(arg);
  else if(type==='clear')req=obj.clear();
  else throw Error('Unsupported local database operation');
  req.onsuccess=()=>setResult(req.result);
 });
}
async function reload(){const [foods,entries,prefs,activityCache,weightCache,trainingCache]=await Promise.all([op('foods','getAll'),op('entries','getAll'),op('prefs','get','settings'),op('prefs','get','health-activity-cache'),op('prefs','get','weight-cache'),op('prefs','get','training-cache')]);state.foods=foods.sort((a,b)=>a.name.localeCompare(b.name));state.entries=entries;state.prefs=prefs||state.prefs;state.activity=Array.isArray(activityCache?.items)?activityCache.items:[];state.weights=Array.isArray(weightCache?.items)?weightCache.items:[];state.training=trainingCache?.items||{swims:[],gyms:[],strength:[]};}
async function firstRun(){const seeded=await op('prefs','get','starter-seeded');if(!seeded){for(const food of starterFoods)await op('foods','put',food);await op('prefs','put',state.prefs);await op('prefs','put',{id:'starter-seeded',done:true});}await reload();}
const meals=['Breakfast','Lunch','Dinner','Snacks'];
function nav(screen){state.screen=screen;$$('.screen').forEach(x=>x.classList.toggle('hidden',x.id!=='screen-'+screen));$$('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.screen===screen));window.scrollTo({top:0,behavior:'instant'});render();}
function render(){renderDiary();renderActivity();renderProgress();renderPicker();renderFoods();renderSettings();renderParsed();}
function renderProgress(){if(!window.FuelProgress)return;$('#progressContent').innerHTML=window.FuelProgress.display({entries:state.entries,activity:state.activity,weights:state.weights,prefs:state.prefs,today:today(),offset:state.progressWeekOffset,training:state.training});}

function activeForDay(date){return state.activity.find(x=>x.date===date&&x.kind==='Daily Active')||null;}
function adjustmentForDay(date){
 const a=activeForDay(date),baseline=state.prefs.activityBaselineKcal;
 if(!a||baseline===null||baseline===undefined||baseline==='')return 0;
 const value=Number(baseline),credit=Number(state.prefs.exerciseCreditPct??70);
 if(!Number.isFinite(value)||value<0||!Number.isFinite(credit)||credit<0||credit>100)return 0;
 return Math.round(Math.max(0,Number(a.activeKcal)-value)*credit/100);
}
function renderActivity(){
 const daily=activeForDay(state.date),credit=adjustmentForDay(state.date),baseline=state.prefs.activityBaselineKcal;
 $('#activityKcal').textContent=daily?fmt(daily.activeKcal)+' kcal':'—';
 $('#activityMinutes').textContent=daily&&daily.exerciseMinutes!==null&&daily.exerciseMinutes!==undefined?fmt(daily.exerciseMinutes)+' min':'—';
 $('#activityCredit').textContent=(baseline===null||baseline===undefined||baseline==='')?'Not configured':(credit>0?'+':'')+fmt(credit)+' kcal';
 $('#activityNote').textContent=!daily?'No Apple Health data for this date yet. Set up the Shortcut to sync your daily activity.':
 (baseline===null||baseline===undefined||baseline==='')?
 'Includes everyday movement and workouts. No calories are added to your target until you set an activity baseline in Settings.':
 'Adjusted target credits '+(state.prefs.exerciseCreditPct??70)+'% of active energy above your chosen baseline ('+fmt(baseline)+' kcal). Do not separately add workout calories to this total.';
 $('#activitySource').textContent=daily?'Apple Health · '+(daily.updatedAt?new Date(daily.updatedAt).toLocaleString('en-IE',{dateStyle:'short',timeStyle:'short'}):'Saved activity'):'Awaiting Shortcut';
}
function renderDiary(){const all=state.entries.filter(x=>x.date===state.date);const sum=totals(all);const adjusted=state.prefs.kcal+adjustmentForDay(state.date);const remain=Math.round(adjusted-sum.kcal);
$('#dateLabel').textContent=state.date===today()?'Today · '+dateObject(state.date).toLocaleDateString('en-IE',{day:'numeric',month:'short'}):dateObject(state.date).toLocaleDateString('en-IE',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
$('#calConsumed').textContent=fmt(sum.kcal);$('#calTarget').textContent=fmt(adjusted);$('#calRemaining').textContent=fmt(Math.abs(remain));$('#balanceLabel').textContent=remain>=0?'kcal remaining':'kcal above target';$('#calRing').style.setProperty('--progress',Math.min(100,100*sum.kcal/adjusted)+'%');$('#entryCount').textContent=all.length+' '+(all.length===1?'entry':'entries');
$('#macroGrid').innerHTML=[['protein','Protein'],['carbs','Carbs'],['fat','Fat']].map(([key,title])=>`<div class="macro"><div class="row">${title}<span>g</span></div><div class="value">${fmt(sum[key])}<small> / ${fmt(state.prefs[key])}</small></div><div class="bar"><span style="width:${Math.max(0,Math.min(100,sum[key]/state.prefs[key]*100))}%"></span></div></div>`).join('');
$('#mealGroups').innerHTML=meals.map(meal=>{const list=all.filter(e=>e.meal===meal),val=totals(list);return `<section class="meal"><div class="meal-head"><div><strong>${meal}</strong><div class="sub">${fmt(val.kcal)} kcal · ${fmt(val.protein)}g protein</div></div><button data-add-meal="${meal}">+ Add</button></div>${list.length?list.map(e=>`<div class="entry"><div><div class="food-name">${esc(e.name)}</div><div class="sub">${fmt(e.qty)} × ${esc(e.portion)} · ${fmt(e.protein)}g protein ${e.origin==='google-sheets'?'· ☁ ChatGPT':''}</div></div><div class="numbers"><strong>${fmt(e.kcal)} kcal</strong><span class="sub">${fmt(e.carbs)}g carbs</span></div><button class="delete" aria-label="Delete ${esc(e.name)}" data-delete-entry="${esc(e.id)}" ${e.origin==='google-sheets'?'disabled title="Edit this entry via ChatGPT"':''}>×</button></div>`).join(''):'<div class="empty-meal">Nothing logged yet</div>'}</section>`;}).join('');
}
function renderPicker(){const options=state.foods.map(f=>`<option value="${esc(f.id)}">${esc(f.name)} · ${esc(f.portion)}</option>`).join('');const el=$('#foodPicker'),old=el.value;el.innerHTML=options;if(state.foods.some(f=>f.id===old))el.value=old;const food=state.foods.find(f=>f.id===el.value);const qty=Number($('#foodQty').value)||1;$('#pickerNutrition').textContent=food?`${fmt(nutrition(food,qty).kcal)} kcal · ${fmt(nutrition(food,qty).protein)} g protein per ${fmt(qty)} serving(s)`:'Add your first saved food to continue.';}
function renderFoods(){$('#foodCount').textContent=state.foods.length+' saved';$('#foodList').innerHTML=state.foods.map(f=>`<div class="food-card"><div><b>${esc(f.name)}</b><small>${fmt(f.kcal)} kcal · ${fmt(f.protein)}g protein · ${esc(f.portion)} ${f.source==='illustrative'?'· starter estimate':''}</small></div><button data-delete-food="${esc(f.id)}" ${f.origin==='google-sheets'?'disabled title="Edit this food via ChatGPT"':''} aria-label="Delete food">Delete</button></div>`).join('')||'<p class="helper">No foods yet. Add one above.</p>';}
function renderSettings(){for(const key of ['kcal','protein','carbs','fat']){$('#target'+key[0].toUpperCase()+key.slice(1)).value=state.prefs[key];}$('#activityBaseline').value=state.prefs.activityBaselineKcal??'';$('#activityCreditPct').value=state.prefs.exerciseCreditPct??70;}
function renderParsed(){const root=$('#parseResults');if(state.parsed.length===0){root.innerHTML='';return;}const unknown=state.parsed.filter(x=>!x.matched);const known=state.parsed.filter(x=>x.matched);
root.innerHTML='<div class="section-title"><h2>Review before logging</h2></div>'+(unknown.length?`<div class="alert">Couldn't identify ${unknown.map(x=>'“'+esc(x.raw)+'”').join(', ')}. Add those as saved foods first. Extras such as cooking oil, butter, sauces or milk should be logged separately.</div>`:'')+known.map((x,i)=>{const f=state.foods.find(f=>f.id===x.foodId),nutritionVals=f?nutrition(f,x.qty):null;return `<div class="result"><b>${esc(x.foodName)}</b><div class="result-row"><span>${f?esc(f.portion):''} · ${nutritionVals?fmt(nutritionVals.kcal):0} kcal</span><label>Servings <input class="control" type="number" min="0.1" max="1000" step="0.1" data-quantity="${i}" value="${x.qty}"></label></div></div>`;}).join('')+(known.length?'<button class="primary" id="saveParsed">Save matched foods to diary</button>':'');}
async function addFoodEntry(food,qty,meal){const info=nutrition(food,qty);const entry={id:uid(),date:state.date,meal,name:food.name,portion:food.portion,qty,...info,createdAt:new Date().toISOString(),origin:'local'};await op('entries','put',entry);return entry;}
async function addFromPicker(){const f=state.foods.find(x=>x.id===$('#foodPicker').value),qty=Number($('#foodQty').value);if(!f||!Number.isFinite(qty)||qty<=0||qty>1000)return toast('Choose a food and a valid serving amount.');await addFoodEntry(f,qty,$('#pickerMeal').value);await reload();render();toast('Food added to '+state.date+'.');}
async function addParsed(){let added=0;const meal=$('#quickMeal').value;for(const candidate of state.parsed){if(!candidate.matched)continue;const food=state.foods.find(f=>f.id===candidate.foodId);if(food){await addFoodEntry(food,candidate.qty,meal);added++;}}if(!added)return toast('No recognised foods to add.');state.parsed=[];$('#quickText').value='';await reload();nav('today');toast(`${added} food${added===1?'':'s'} added. Check your totals.`);}
function validateNumber(n){return Number.isFinite(n)&&n>=0&&n<=1000000;}
async function createFood(e){e.preventDefault();const get=s=>$(s).value.trim();const f={id:uid(),name:get('#newName'),portion:get('#newPortion'),kcal:Number(get('#newKcal')),protein:Number(get('#newProtein')),carbs:Number(get('#newCarbs')),fat:Number(get('#newFat')),aliases:[],source:'custom'};if(!f.name||!f.portion||!['kcal','protein','carbs','fat'].every(k=>validateNumber(f[k])))return toast('Check the name and nutrition numbers.');await op('foods','put',f);await reload();$('#foodForm').reset();render();toast('Food saved locally.');}
async function exportBackup(){const payload={kind:'fuel-lab-backup',version:1,exportedAt:new Date().toISOString(),foods:state.foods,entries:state.entries,prefs:state.prefs,activity:state.activity,weights:state.weights};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`fuel-lab-backup-${today()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup downloaded. Save it to iCloud Drive.');}
async function restoreBackup(file){if(!file||file.size>15*1024*1024)return toast('Choose a valid backup smaller than 15 MB.');let data;try{data=JSON.parse(await file.text());}catch(e){return toast('That is not a valid JSON backup.');}
if(data.kind!=='fuel-lab-backup'||data.version!==1||!Array.isArray(data.entries)||!Array.isArray(data.foods)||!data.prefs)return toast('This is not a Fuel Lab backup.');
if(data.entries.some(x=>!x.id||!x.date||!meals.includes(x.meal)||!['kcal','protein','carbs','fat'].every(k=>validateNumber(Number(x[k]))))||data.foods.some(x=>!x.id||!x.name||!x.portion||!['kcal','protein','carbs','fat'].every(k=>validateNumber(Number(x[k])))))return toast('Backup contains invalid diary or food values.');
if(!confirm(`Replace the current local diary with ${data.entries.length} imported entries and ${data.foods.length} foods? Export a backup first if you want to keep the current data.`))return;
// Single transaction: either all three stores restore, or none of them do.
await transact(['foods','entries','prefs'],'readwrite',txn=>{for(const name of ['foods','entries'])txn.objectStore(name).clear();txn.objectStore('prefs').clear();for(const food of data.foods)txn.objectStore('foods').put(food);for(const item of data.entries)txn.objectStore('entries').put(item);txn.objectStore('prefs').put({...data.prefs,id:'settings'});txn.objectStore('prefs').put({id:'starter-seeded',done:true});if(Array.isArray(data.activity))txn.objectStore('prefs').put({id:'health-activity-cache',items:data.activity});if(Array.isArray(data.weights))txn.objectStore('prefs').put({id:'weight-cache',items:data.weights});});
await reload();render();toast('Local backup restored.');}
function attach(){ $$('.bottom-nav button').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.screen)));
$('#prevDate').addEventListener('click',()=>{const d=dateObject(state.date);d.setDate(d.getDate()-1);state.date=dayString(d);render();});
$('#nextDate').addEventListener('click',()=>{const d=dateObject(state.date);d.setDate(d.getDate()+1);state.date=dayString(d);render();});
$('#progressContent').addEventListener('click',e=>{if(e.target.closest('#weekPrev')){state.progressWeekOffset--;renderProgress();}if(e.target.closest('#weekNext')){state.progressWeekOffset=Math.min(0,state.progressWeekOffset+1);renderProgress();}});
$('#mealGroups').addEventListener('click',async e=>{const add=e.target.closest('[data-add-meal]');if(add){$('#quickMeal').value=add.dataset.addMeal;$('#pickerMeal').value=add.dataset.addMeal;nav('add');return;}const del=e.target.closest('[data-delete-entry]');if(del&&state.entries.some(x=>x.id===del.dataset.deleteEntry&&x.origin==='google-sheets'))return toast('Ask ChatGPT to delete this saved Google Sheets entry.');if(del&&confirm('Remove this food entry?')){await op('entries','delete',del.dataset.deleteEntry);await reload();render();toast('Entry removed.');}});
$('#parseBtn').addEventListener('click',()=>{state.parsed=parseText($('#quickText').value,state.foods);renderParsed();if(!state.parsed.length)toast('Describe the food you ate first.');});
$('#parseResults').addEventListener('change',e=>{const el=e.target.closest('[data-quantity]');if(!el)return;const matches=state.parsed.filter(x=>x.matched);const target=matches[Number(el.dataset.quantity)];const qty=Number(el.value);if(target&&qty>0&&qty<=1000){target.qty=qty;const results=$('#parseResults');const focus=el.dataset.quantity;const caret=document.activeElement===el;renderParsed();if(caret){const next=results.querySelector(`[data-quantity="${focus}"]`);next?.focus();}}});
$('#parseResults').addEventListener('click',e=>{if(e.target.id==='saveParsed')addParsed().catch(showError);});
$('#foodPicker').addEventListener('change',renderPicker);$('#foodQty').addEventListener('input',renderPicker);$('#addSelected').addEventListener('click',()=>addFromPicker().catch(showError));
$('#foodForm').addEventListener('submit',e=>createFood(e).catch(showError));
$('#foodList').addEventListener('click',async e=>{const del=e.target.closest('[data-delete-food]');if(!del)return;const food=state.foods.find(f=>f.id===del.dataset.deleteFood);if(food?.origin==='google-sheets')return toast('Ask ChatGPT to delete this cloud food.');if(food&&confirm(`Delete “${food.name}” from the saved food library? Existing diary records will remain.`)){await op('foods','delete',food.id);await reload();render();toast('Saved food removed.');}});
$('#themeSelect').value=document.documentElement.dataset.theme==='dark'?'dark':'light';
$('#themeSelect').addEventListener('change',e=>applyTheme(e.target.value));
$('#settingsForm').addEventListener('submit',async e=>{e.preventDefault();const next={id:'settings'};for(const k of ['kcal','protein','carbs','fat']){const v=Number($('#target'+k[0].toUpperCase()+k.slice(1)).value);if(!Number.isFinite(v)||v<=0||v>50000)return toast('Enter valid positive targets.');next[k]=v;}const raw=$('#activityBaseline').value.trim();const baseline=raw===''?null:Number(raw),pct=Number($('#activityCreditPct').value);if((baseline!==null&&(!Number.isFinite(baseline)||baseline<0||baseline>20000))||!Number.isFinite(pct)||pct<0||pct>100)return toast('Check the activity baseline and percentage.');next.activityBaselineKcal=baseline;next.exerciseCreditPct=pct;await op('prefs','put',next);await reload();render();toast('Targets updated.');});
$('#checkForUpdates').addEventListener('click',checkForAppUpdates);
$('#exportBtn').addEventListener('click',exportBackup);$('#importInput').addEventListener('change',async e=>{try{await restoreBackup(e.target.files[0]);}catch(err){showError(err)}finally{e.target.value='';}});
}

// Read-only Google Sheets importer: remote rows are cached, never uploaded to Sheets.
async function applyRemoteSnapshot({entries,foods}){
 if(!Array.isArray(entries)||!Array.isArray(foods)||entries.length>10000||foods.length>5000)throw Error('Invalid remote data');
 const entryIds=new Set(),foodIds=new Set();
 for(const e of entries){
   if(!e.id||entryIds.has(e.id)||!e.date||!meals.includes(e.meal)||!['kcal','protein','carbs','fat'].every(k=>validateNumber(Number(e[k]))))throw Error('Invalid or duplicated cloud entry');
   entryIds.add(e.id);
 }
 for(const f of foods){
   if(!f.id||foodIds.has(f.id)||!f.name||!f.portion||!['kcal','protein','carbs','fat'].every(k=>validateNumber(Number(f[k]))))throw Error('Invalid or duplicated cloud food');
   foodIds.add(f.id);
 }
 let entriesSaved=0,foodsSaved=0,conflicts=0;
 await transact(['entries','foods'],'readwrite',tx=>{
   entriesSaved=0;foodsSaved=0;conflicts=0;
   const es=tx.objectStore('entries'),fs=tx.objectStore('foods');
   const er=es.getAll(),fr=fs.getAll();
   let previousEntries=null,previousFoods=null,merged=false;
   function merge(){
     if(merged||!previousEntries||!previousFoods)return;
     merged=true;
     const oldE=new Map(previousEntries.map(x=>[x.id,x])),oldF=new Map(previousFoods.map(x=>[x.id,x]));
     // Only remove previously synced cloud entries that the master Sheet no longer contains.
     for(const e of previousEntries)if(e.origin==='google-sheets'&&!entryIds.has(e.id))es.delete(e.id);
     for(const f of previousFoods)if(f.origin==='google-sheets'&&!foodIds.has(f.id))fs.delete(f.id);
     for(const e of entries){
       if(oldE.has(e.id)&&oldE.get(e.id).origin!=='google-sheets'){conflicts++;continue}
       es.put({...e,origin:'google-sheets'});entriesSaved++;
     }
     for(const f of foods){
       if(oldF.has(f.id)&&oldF.get(f.id).origin!=='google-sheets'){conflicts++;continue}
       fs.put({...f,origin:'google-sheets'});foodsSaved++;
     }
   }
   er.onsuccess=()=>{previousEntries=er.result;merge();};
   fr.onsuccess=()=>{previousFoods=fr.result;merge();};
 });
 await reload();render();
 return {entries:entriesSaved,foods:foodsSaved,conflicts};
}

async function applyActivitySnapshot(activity){
 if(!Array.isArray(activity)||activity.length>10000)throw Error('Invalid Apple Health activity data');
 const ids=new Set();
 for(const a of activity){
  if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id)||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!['Daily Active','Workout'].includes(a.kind)||!Number.isFinite(a.activeKcal)||a.activeKcal<0||a.activeKcal>20000||a.exerciseMinutes!==null&&a.exerciseMinutes!==undefined&&(!Number.isFinite(a.exerciseMinutes)||a.exerciseMinutes<0||a.exerciseMinutes>1440))throw Error('Invalid activity record');
  ids.add(a.id);
 }
 await op('prefs','put',{id:'health-activity-cache',items:activity,updatedAt:new Date().toISOString()});
 await reload();render();return {count:activity.length};
}

async function applyWeightsSnapshot(weights){
 if(!Array.isArray(weights)||weights.length>10000)throw Error('Invalid weight data');
 const ids=new Set();
 for(const w of weights){
  if(!w||typeof w.id!=='string'||!w.id||ids.has(w.id)||!/^\d{4}-\d{2}-\d{2}$/.test(w.date)||!Number.isFinite(w.kg)||w.kg<20||w.kg>500)throw Error('Invalid weigh-in row');
  ids.add(w.id);
 }
 await op('prefs','put',{id:'weight-cache',items:weights,updatedAt:new Date().toISOString()});
 await reload();render();
 return {count:weights.length};
}
async function applyTrainingSnapshot(training){
 if(!training||typeof training!=='object')throw Error('Invalid training snapshot');
 const data={};
 for(const [name,maximum] of [['swims',10000],['gyms',10000],['strength',15000]]){
  const rows=training[name];
  if(!Array.isArray(rows)||rows.length>maximum)throw Error('Invalid training '+name);
  const seen=new Set();
  for(const row of rows){
   if(!row||typeof row.id!=='string'||row.id.length>180||!row.id||
      typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||seen.has(row.id))throw Error('Invalid training record');
   seen.add(row.id);
  }
  data[name]=rows;
 }
 await op('prefs','put',{id:'training-cache',items:data,updatedAt:new Date().toISOString()});
 await reload();render();
 return {swims:data.swims.length,gyms:data.gyms.length,strength:data.strength.length};
}
window.FuelLabBridge={ready:false,applyRemoteSnapshot,applyActivitySnapshot,applyWeightsSnapshot,applyTrainingSnapshot};

async function checkForAppUpdates(){
 const button=$('#checkForUpdates'),status=$('#updateStatus');
 if(!button||button.disabled)return;
 if(!navigator.onLine){status.textContent='You are offline. Connect to the internet and try again.';return;}
 button.disabled=true;
 status.textContent='Checking for the latest version…';
 try{
  if('serviceWorker' in navigator&&location.protocol==='https:'){
   const registration=await navigator.serviceWorker.getRegistration('./');
   if(registration){
    await registration.update();
    const worker=registration.installing||registration.waiting;
    if(worker&&worker.state!=='activated'){
     await new Promise(resolve=>{
      let finished=false;
      const done=()=>{if(!finished){finished=true;resolve();}};
      navigator.serviceWorker.addEventListener('controllerchange',done,{once:true});
      setTimeout(done,4000);
     });
    }
   }else await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  }
  status.textContent='Refreshing Fuel Lab…';
  const url=new URL(location.href);
  url.searchParams.set('app-refresh',String(Date.now()));
  location.replace(url.href);
 }catch(error){
  console.warn('Fuel Lab update:',error);
  status.textContent='Could not check for updates. Please try again while connected.';
  button.disabled=false;
 }
}
function showError(err){console.error('Fuel Lab:',err);toast('Could not save that change. Check device storage and try again.');}
async function init(){try{await ensureDb();await firstRun();attach();render();window.FuelLabBridge.ready=true;window.dispatchEvent(new Event('fuel-lab-ready'));if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(console.warn);}catch(e){console.error(e);$('#app').innerHTML='<main style="padding:45px 20px"><h1>Local storage unavailable</h1><p>Fuel Lab could not open its local diary. Try opening it from its HTTPS web address in Safari rather than a local file or private browsing window.</p><p>No information was uploaded.</p></main>';}}
init();
})();
