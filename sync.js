/* Fuel Lab v0.2 — private, read-only Google Sheets.
   Public OAuth Client ID only; no access token or personal spreadsheet ID is hardcoded. */
(function(){
'use strict';
const CLIENT='568556229750-ap39oagpjs6gu432tfghgupujfukdooq.apps.googleusercontent.com';
const SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEET_KEY='fuel-lab-google-sheet-id-v1',STAMP_KEY='fuel-lab-google-last-sync-v1',TRAINING_KEY='fuel-lab-training-sheet-id-v1';
const $=s=>document.querySelector(s);
let token=null,expires=0,busy=false,lastFetch=0,oauth=null,booted=false;
const saved=()=>{try{return localStorage.getItem(SHEET_KEY)||''}catch(e){return ''}};
const prior=()=>{try{return JSON.parse(localStorage.getItem(STAMP_KEY)||'null')}catch(e){return null}};
const savedTraining=()=>{try{return localStorage.getItem(TRAINING_KEY)||'';}catch(e){return '';}};
function trainingStatus(msg,error=false){const el=$('#trainingStatus');if(el){el.textContent=msg;el.classList.toggle('problem',error);}}
const num=v=>{if(v===null||v===undefined||v==='')return null;let n=Number(String(v).replace(/,/g,'').trim());return Number.isFinite(n)&&n>=0&&n<=1000000?n:null};
const idFrom=v=>{let s=String(v||'').trim(),m=s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{15,120})/);if(m)s=m[1];return /^[A-Za-z0-9_-]{15,120}$/.test(s)?s:null};
const validToken=()=>!!token&&Date.now()<expires-45000;
function status(msg,error=false){
 const el=$('#syncStatus');if(el){el.textContent=msg;el.classList.toggle('problem',error)}
 const summary=$('#syncSummary');if(summary){let last=prior();summary.textContent=msg+(last?.when?' · Last successful sync: '+new Date(last.when).toLocaleString('en-IE',{dateStyle:'short',timeStyle:'short'}):'')}
 const pill=$('#syncPill');if(pill)pill.innerHTML='<span class="status-dot"></span> '+(error?'NEEDS ATTENTION':validToken()?'DRIVE CONNECTED':'LOCAL + CLOUD CACHE');
}
function table(rows,required,convert){
 const [head,...data]=rows;
 if(!Array.isArray(head)||required.some(h=>!head.includes(h)))throw Error('Unexpected spreadsheet columns; your local diary was not changed.');
 let items=[],skipped=0;
 for(const row of data){
   if(!row||!String(row[head.indexOf(required[0])]||'').trim())continue;
   const cell=k=>row[head.indexOf(k)];
   if(String(cell('Status')||'Active').toLowerCase().trim()==='deleted')continue;
   const result=convert(cell);
   if(result)items.push(result);else skipped++;
 }
 return {items,skipped};
}
function diary(cell){
 const id=String(cell('Entry ID')||'').trim(),date=String(cell('Date')||'').trim(),meal=String(cell('Meal')||'').trim(),name=String(cell('Food')||'').trim();
 if(!id||id.length>120||!name||name.length>180||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['Breakfast','Lunch','Dinner','Snacks'].includes(meal))return null;
 const qty=num(cell('Servings')),kcal=num(cell('Calories')),protein=num(cell('Protein (g)')),carbs=num(cell('Carbs (g)')),fat=num(cell('Fat (g)'));
 if(qty===null||qty===0||[kcal,protein,carbs,fat].some(n=>n===null))return null;
 return {id,date,meal,name,qty,portion:String(cell('Serving unit')||'serving').slice(0,50),kcal,protein,carbs,fat,
   accuracy:String(cell('Accuracy')||'Estimated').slice(0,30),source:String(cell('Source')||'ChatGPT').slice(0,120),
   notes:String(cell('Notes')||'').slice(0,2000),createdAt:String(cell('Recorded at')||''),origin:'google-sheets'};
}
function food(cell){
 const id=String(cell('Food ID')||'').trim(),name=String(cell('Name')||'').trim(),portion=String(cell('Serving unit')||'').trim();
 if(!id||id.length>120||!name||name.length>180||!portion||portion.length>60)return null;
 const kcal=num(cell('Calories')),protein=num(cell('Protein (g)')),carbs=num(cell('Carbs (g)')),fat=num(cell('Fat (g)'));
 if([kcal,protein,carbs,fat].some(x=>x===null))return null;
 return {id,name,portion,kcal,protein,carbs,fat,aliases:String(cell('Aliases')||'').split('|').map(x=>x.trim()).filter(Boolean).slice(0,20),accuracy:String(cell('Accuracy')||'Estimated').slice(0,30),source:String(cell('Source')||'ChatGPT'),origin:'google-sheets'};
}
function activity(cell){
 const id=String(cell('Record ID')||'').trim(),date=String(cell('Date')||'').trim(),kind=String(cell('Kind')||'').trim();
 if(!id||id.length>150||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['Daily Active','Workout'].includes(kind))return null;
 const kcal=num(cell('Active kcal')),minutes=num(cell('Exercise minutes'));
 if(kcal===null)return null;
 return {id,date,kind,name:String(cell('Activity')||'Activity').slice(0,100),activeKcal:kcal,exerciseMinutes:minutes,
 durationMinutes:num(cell('Duration minutes')),updatedAt:String(cell('Updated at')||''),source:String(cell('Source')||'Apple Health').slice(0,100),origin:'google-sheets'};
}
function weighIn(cell){
 const id=String(cell('Entry ID')||'').trim(),date=String(cell('Date')||'').trim(),kg=num(cell('Weight (kg)'));
 if(!id||id.length>150||!/^\d{4}-\d{2}-\d{2}$/.test(date)||kg===null||kg<20||kg>500)return null;
 return {id,date,kg,context:String(cell('Time / context')||'').slice(0,100),
  source:String(cell('Source')||'ChatGPT').slice(0,100),notes:String(cell('Notes')||'').slice(0,350),origin:'google-sheets'};
}
/* Optional read-only training tracker import. Missing or invalid tabs never block food sync. */
function trainingTable(rows,required,convert){
 const [head,...data]=rows;
 if(!Array.isArray(head)||required.some(h=>!head.includes(h)))throw Error('Training tracker columns do not match the expected layout');
 let items=[],skipped=0;
 for(let i=0;i<data.length;i++){
  const row=data[i];if(!row||!String(row[head.indexOf(required[0])]||'').trim())continue;
  const cell=k=>row[head.indexOf(k)];
  const item=convert(cell,i+2);
  if(item)items.push(item);else skipped++;
 }
 return {items,skipped};
}
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d);
const safeText=(value,max=200)=>String(value||'').slice(0,max);
function swimRecord(cell,row){
 const date=safeText(cell('Date')).trim(),distanceM=num(cell('Distance (m)'));
 if(!validDate(date)||distanceM===null||distanceM<=0||distanceM>100000)return null;
 return {id:'swim-row-'+row,date,setting:safeText(cell('Setting'),100),type:safeText(cell('Session type'),120),
   distanceM,durationMin:num(cell('Duration (min)')),avgHr:num(cell('Avg HR (bpm)')),
   activeKcal:num(cell('Watch active kcal')),notes:safeText(cell('Session notes'),500)};
}
function gymRecord(cell,row){
 const date=safeText(cell('Date')).trim(),session=safeText(cell('Session'),120).trim();
 if(!validDate(date)||!session)return null;
 return {id:'gym-row-'+row,date,session,warmupKm:num(cell('Warm-up (km)')),workingSets:num(cell('Working sets')),
   durationMin:num(cell('Approx. gym time (min)')),effort:safeText(cell('Session effort'),100)};
}
function strengthRecord(cell,row){
 const date=safeText(cell('Date')).trim(),exercise=safeText(cell('Exercise'),120).trim();
 if(!validDate(date)||!exercise)return null;
 return {id:'strength-row-'+row,date,exercise,loadKg:num(cell('Load (kg)')),
   loadBasis:safeText(cell('Load basis'),60),reps:num(cell('Total reps'))};
}
async function getTab(sheet,tab){
 const bounds={'Activity':'L','Weight Log':'G','Swim Log':'L','Gym Sessions':'H','Strength Log':'M'};
 const range="'"+tab.replace(/'/g,"''")+"'!A1:"+(bounds[tab]||'O');
 const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sheet)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE';
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
 if(!response.ok){
   if(response.status===401){expires=0;throw Error('Google sign-in expired. Tap Connect again.')}
   if(response.status===403)throw Error('Google access denied. Check Google account and Sheets API permissions.');
   throw Error('Google Sheets returned '+response.status+'.');
 }
 const result=await response.json();return result.values||[];
}
async function refresh(force=false){
 const sheet=idFrom($('#syncSheetId')?.value||saved());
 if(!sheet)return status('Paste your private Google Sheet link in Settings.',true);
 if(!validToken())return status('Tap Connect Google again. Your previously cached diary remains available.',true);
 if(busy||(!force&&Date.now()-lastFetch<60000))return;
 busy=true;status('Reading the latest ChatGPT entries…');
 try{
   const [log,library,activityRows,weightRows]=await Promise.all([getTab(sheet,'Diary'),getTab(sheet,'Saved Foods'),getTab(sheet,'Activity'),getTab(sheet,'Weight Log')]);
   const meals=table(log,['Entry ID','Date','Meal','Food','Servings','Calories','Protein (g)','Carbs (g)','Fat (g)','Status'],diary);
   const foods=table(library,['Food ID','Name','Serving unit','Calories','Protein (g)','Carbs (g)','Fat (g)','Status'],food);
   const activityData=table(activityRows,['Record ID','Date','Kind','Active kcal','Status'],activity);
   const weightData=table(weightRows,['Entry ID','Date','Weight (kg)','Status'],weighIn);
   const result=await window.FuelLabBridge.applyRemoteSnapshot({entries:meals.items,foods:foods.items});
   const activityResult=await window.FuelLabBridge.applyActivitySnapshot(activityData.items);
   const weightResult=await window.FuelLabBridge.applyWeightsSnapshot(weightData.items);
   const tracker=idFrom($('#trainingSheetId')?.value||savedTraining());
   if(tracker){
    trainingStatus('Reading your swim and gym tracker…');
    try{
      const [swimRows,gymRows,strengthRows]=await Promise.all([
        getTab(tracker,'Swim Log'),getTab(tracker,'Gym Sessions'),getTab(tracker,'Strength Log')
      ]);
      const swims=trainingTable(swimRows,['Date','Distance (m)'],swimRecord);
      const gyms=trainingTable(gymRows,['Date','Session'],gymRecord);
      const strength=trainingTable(strengthRows,['Date','Exercise'],strengthRecord);
      const training=await window.FuelLabBridge.applyTrainingSnapshot({swims:swims.items,gyms:gyms.items,strength:strength.items});
      trainingStatus('Up to date · '+training.swims+' swims · '+training.gyms+' gym sessions · '+training.strength+' strength records');
    }catch(trainingError){
      console.warn('Fuel Lab training sync:',trainingError);
      trainingStatus('Training sync failed: '+(trainingError?.message||'Unknown error')+'. Your cached sessions remain available.',true);
    }
   }else trainingStatus('Not connected. Paste your tracker link to add training charts.');
   localStorage.setItem(STAMP_KEY,JSON.stringify({when:new Date().toISOString(),entries:result.entries,foods:result.foods}));
   lastFetch=Date.now();
   status('Up to date · '+result.entries+' chat entries · '+result.foods+' saved foods · '+activityResult.count+' activity records · '+weightResult.count+' weigh-ins'+(meals.skipped+foods.skipped+activityData.skipped+weightData.skipped?' · '+(meals.skipped+foods.skipped+activityData.skipped+weightData.skipped)+' incomplete rows skipped':'')+(result.conflicts?' · '+result.conflicts+' local IDs protected':''));
 }catch(e){console.warn('Fuel Lab sync:',e);status('Sync failed: '+(e?.message||'Unknown error')+' Your local diary remains intact.',true)}
 finally{busy=false}
}
function connect(){
 const sheet=idFrom($('#syncSheetId')?.value);
 if(!sheet)return status('Enter a valid Google Sheets link or ID.',true);
 if(location.protocol!=='https:'&&location.hostname!=='localhost')return status('Google sign-in requires HTTPS.',true);
 if(!navigator.onLine)return status('Reconnect to the internet to sign in.',true);
 if(!window.google?.accounts?.oauth2)return status('Google sign-in has not loaded. Check your connection.',true);
 localStorage.setItem(SHEET_KEY,sheet);
 if(validToken()){refresh(true);return}
 try{
   oauth=window.google.accounts.oauth2.initTokenClient({client_id:CLIENT,scope:SCOPE,callback:r=>{
     if(r.error||!r.access_token)return status('Sign-in failed: '+(r.error||'No access token'),true);
     token=r.access_token;expires=Date.now()+Math.max(60,Number(r.expires_in)||3600)*1000;refresh(true);
   }});
   oauth.requestAccessToken({prompt:'consent'});
 }catch(e){status('Google sign-in failed: '+e.message,true)}
}
function disconnect(){
 if(token&&window.google?.accounts?.oauth2)try{window.google.accounts.oauth2.revoke(token,()=>{})}catch(e){}
 token=null;expires=0;oauth=null;
 status('Disconnected. Previously cached entries remain available offline.');
}
function autoCheck(){
 if(document.visibilityState!=='visible'||!navigator.onLine||busy)return;
 if(saved()&&validToken())refresh();
 else if(saved()&&!validToken())status('Google login needed for live updates. Tap Connect in Settings; cached diary remains.');
}
function bootstrap(){
 if(booted||!window.FuelLabBridge?.ready)return;
 booted=true;$('#syncSheetId').value=saved();
 $('#trainingSheetId').value=savedTraining();
 $('#trainingSheetId').addEventListener('change',()=>{
   const value=$('#trainingSheetId').value.trim();
   if(!value){try{localStorage.removeItem(TRAINING_KEY);}catch(_){}trainingStatus('Tracker disconnected. Cached sessions remain available.');return;}
   const id=idFrom(value);
   if(!id)return trainingStatus('That does not look like a Google Sheets link.',true);
   try{localStorage.setItem(TRAINING_KEY,id);}catch(_){}
   lastFetch=0;trainingStatus('Tracker link saved. Tap Refresh now to import sessions.');
 });
 $('#syncConnect').addEventListener('click',connect);
 $('#syncNow').addEventListener('click',()=>refresh(true));
 $('#syncDisconnect').addEventListener('click',disconnect);
 $('#syncSheetId').addEventListener('change',()=>{let id=idFrom($('#syncSheetId').value);if(id){localStorage.setItem(SHEET_KEY,id);lastFetch=0;status('Sheet link saved. Tap Connect Google once to authorise access.')}});
 status(saved()?'Ready. Tap Connect to enable automatic refresh.':'Not connected. Paste your Fuel Lab spreadsheet link to begin.');
 document.addEventListener('visibilitychange',autoCheck);
 window.addEventListener('focus',autoCheck);
 window.addEventListener('online',autoCheck);
 setInterval(autoCheck,120000);
}
window.addEventListener('fuel-lab-ready',bootstrap);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap);else bootstrap();
})();
