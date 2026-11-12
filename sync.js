/* Fuel Lab v0.2 — private, read-only Google Sheets.
   Public OAuth Client ID only; no access token or personal spreadsheet ID is hardcoded. */
(function(){
'use strict';
const CLIENT='568556229750-ap39oagpjs6gu432tfghgupujfukdooq.apps.googleusercontent.com';
const SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEET_KEY='fuel-lab-google-sheet-id-v1',STAMP_KEY='fuel-lab-google-last-sync-v1';
const $=s=>document.querySelector(s);
let token=null,expires=0,busy=false,lastFetch=0,oauth=null,booted=false;
const saved=()=>{try{return localStorage.getItem(SHEET_KEY)||''}catch(e){return ''}};
const prior=()=>{try{return JSON.parse(localStorage.getItem(STAMP_KEY)||'null')}catch(e){return null}};
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
async function getTab(sheet,tab){
 const range="'"+tab.replace(/'/g,"''")+"'!A1:O";
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
   const [log,library]=await Promise.all([getTab(sheet,'Diary'),getTab(sheet,'Saved Foods')]);
   const meals=table(log,['Entry ID','Date','Meal','Food','Servings','Calories','Protein (g)','Carbs (g)','Fat (g)','Status'],diary);
   const foods=table(library,['Food ID','Name','Serving unit','Calories','Protein (g)','Carbs (g)','Fat (g)','Status'],food);
   const result=await window.FuelLabBridge.applyRemoteSnapshot({entries:meals.items,foods:foods.items});
   localStorage.setItem(STAMP_KEY,JSON.stringify({when:new Date().toISOString(),entries:result.entries,foods:result.foods}));
   lastFetch=Date.now();
   status('Up to date · '+result.entries+' chat entries · '+result.foods+' saved foods'+(meals.skipped+foods.skipped?' · '+(meals.skipped+foods.skipped)+' incomplete rows skipped':'')+(result.conflicts?' · '+result.conflicts+' local IDs protected':''));
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
