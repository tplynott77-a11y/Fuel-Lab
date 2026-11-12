(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FuelCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const starterFoods=[
    {id:'egg',name:'Large egg',aliases:['egg','eggs','boiled egg','scrambled egg','scrambled eggs'],portion:'egg',kcal:72,protein:6.3,carbs:0.4,fat:4.8},
    {id:'bagel',name:'Plain bagel',aliases:['bagel','bagels','plain bagel'],portion:'bagel',kcal:250,protein:9,carbs:49,fat:1.5},
    {id:'weetabix',name:'Wheat biscuit',aliases:['weetabix','weetabix biscuit','wheat biscuit','wheat biscuits'],portion:'biscuit',kcal:68,protein:2.3,carbs:13,fat:0.4},
    {id:'milk',name:'Low-fat milk (100 ml)',aliases:['low fat milk','low-fat milk','milk'],portion:'100 ml',kcal:47,protein:3.5,carbs:5,fat:1.6},
    {id:'chicken',name:'Cooked chicken breast (100 g)',aliases:['chicken breast','cooked chicken','cooked chicken breast'],portion:'100 g',kcal:165,protein:31,carbs:0,fat:3.6},
    {id:'banana',name:'Medium banana',aliases:['banana','bananas'],portion:'banana',kcal:105,protein:1.3,carbs:27,fat:0.4},
    {id:'sugar',name:'Sugar (1 teaspoon)',aliases:['sugar','teaspoon sugar','tsp sugar'],portion:'teaspoon',kcal:16,protein:0,carbs:4,fat:0},
    {id:'coffee',name:'Americano coffee',aliases:['americano','black coffee','coffee'],portion:'cup',kcal:5,protein:0.3,carbs:0.5,fat:0},
    {id:'rice',name:'Cooked rice (100 g)',aliases:['cooked rice','rice'],portion:'100 g',kcal:130,protein:2.7,carbs:28,fat:0.3},
    {id:'toast',name:'Bread slice',aliases:['bread slice','slice of bread','slice bread','bread','toast'],portion:'slice',kcal:90,protein:3,carbs:17,fat:1.1},
  ].map(x=>({...x,source:'illustrative'}));
  const words={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,half:.5};
  const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
  function matchFood(segment,foods){
    let s=clean(segment),qty=1,usedQuantity=false,unit=null;
    const prefix=s.match(/^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)\s*(?:x\s*)?(?:(g|grams?|ml|millilitres?|tsp|teaspoons?)\s+)?(.*)$/);
    if(prefix&&prefix[3]){qty=words[prefix[1]]??Number(prefix[1]);unit=prefix[2]||null;s=prefix[3].trim();usedQuantity=true;}
    // 150g chicken rather than 150 g chicken
    if(!usedQuantity){const m=s.match(/^(\d+(?:\.\d+)?)(g|ml)\s+(.+)$/);if(m){qty=Number(m[1]);unit=m[2];s=m[3];}}
    s=s.replace(/^(?:slices?|pieces?|servings?)\s+of\s+/,'').replace(/^(of|some|plain|the)\s+/,'').replace(/\s+(?:for breakfast|for lunch|for dinner)$/,'').trim();
    const matched=foods.map(f=>{
      const aliases=[f.name,...(f.aliases||[])].map(clean);
      const best=aliases.reduce((n,a)=>{
        if(a===s)return Math.max(n,100+a.length);
        if(s===a+'s')return Math.max(n,95+a.length);
        return n;
      },0);
      return {f,best};
    }).sort((a,b)=>b.best-a.best)[0];
    if(!matched||!matched.best)return {matched:false,raw:segment.trim()};
    const food=matched.f;
    if(unit){const is100=/100\s*(g|ml)/i.test(food.portion);
      if(is100&&/^(g|gram|grams|ml|millilitre|millilitres)$/.test(unit))qty=qty/100;
      else if(unit==='tsp'||unit.startsWith('teaspoon')){if(!/teaspoon/i.test(food.portion))return {matched:false,raw:segment.trim(),why:'Serving unit does not match'};}
      else return {matched:false,raw:segment.trim(),why:'Serving unit does not match'};
    }
    if(!Number.isFinite(qty)||qty<=0||qty>1000)return {matched:false,raw:segment.trim(),why:'Invalid quantity'};
    return {matched:true,foodId:food.id,foodName:food.name,qty:Math.round(qty*1000)/1000,raw:segment.trim()};
  }
  function parseText(input,foods=starterFoods){
    const parts=String(input||'').replace(/[.;\n]+/g,',').split(/\s*,\s*|\s+and\s+|\s+\+\s+/i).map(s=>s.trim()).filter(Boolean);
    return parts.map(p=>matchFood(p,foods));
  }
  function nutrition(food,qty){return Object.fromEntries(['kcal','protein','carbs','fat'].map(k=>[k,Math.round((Number(food[k])||0)*qty*10)/10]));}
  function totals(entries){return ['kcal','protein','carbs','fat'].reduce((o,k)=>(o[k]=Math.round(entries.reduce((s,e)=>s+(Number(e[k])||0),0)*10)/10,o),{});}
  return {starterFoods,parseText,nutrition,totals,clean};
});