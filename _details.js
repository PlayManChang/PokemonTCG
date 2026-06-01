const puppeteer=require('puppeteer'),fs=require('fs');
const IDS=[47253,47254,47255,47256,47257,47258,47259,47260,47262,47267,47268,47269,47271];
const EN={'icon-grass':'풀','icon-fire':'불꽃','icon-water':'물','icon-electric':'번개','icon-lightning':'번개','icon-psychic':'초','icon-fighting':'격투','icon-darkness':'악','icon-dark':'악','icon-metal':'강철','icon-steel':'강철','icon-dragon':'드래곤','icon-fairy':'페어리','icon-colorless':'무색','icon-none':'무색','icon-void':'무색'};
(async()=>{
const b=await puppeteer.launch({headless:true,args:['--no-sandbox']});
const p=await b.newPage();
await p.setRequestInterception(true);
p.on('request',r=>{const t=r.resourceType();(t==='image'||t==='font'||t==='media')?r.abort():r.continue();});
const out=[];
for(const id of IDS){
  await p.goto('https://www.pokemon-card.com/card-search/details.php/card/'+id,{waitUntil:'domcontentloaded',timeout:30000});
  const d=await p.evaluate((EN)=>{
    const rb=document.querySelector('.RightBox-inner'); if(!rb) return null;
    const name=(document.querySelector('h1.Heading1')||{}).innerText||'';
    const stage=(rb.querySelector('.type')||{}).innerText||'';
    const hp=(rb.querySelector('.hp-num')||{}).innerText||'';
    const tIcon=rb.querySelector('.TopInfo .icon');
    let type=''; if(tIcon){const c=[...tIcon.classList].find(x=>EN[x]); type=EN[c]||'';}
    const abilities=[],attacks=[]; let sec='',special='';
    for(const el of rb.children){
      if(el.tagName==='H2'){sec=el.innerText.trim();continue;}
      if(el.tagName==='H4'){
        const ic=[...el.querySelectorAll('[class*="icon-"]')].map(i=>{const c=[...i.classList].find(x=>EN[x]);return EN[c]||'';}).filter(Boolean);
        const dmg=(el.querySelector('.f_right')||{}).innerText||'';
        const nm=el.innerText.replace(dmg,'').replace(/\s+/g,' ').trim();
        if(sec.includes('特性')){abilities.push({name_ja:nm});}
        else if(sec.includes('ワザ')){attacks.push({name_ja:nm,cost:ic.join(''),damage:(dmg||'').trim()});}
      }
      if(el.tagName==='P'){
        const tx=el.innerText.trim(); if(!tx)continue;
        if(sec.includes('特性')&&abilities.length)abilities[abilities.length-1].text_ja=tx;
        else if(sec.includes('ワザ')&&attacks.length)attacks[attacks.length-1].text_ja=tx;
        else if(sec.includes('特別'))special+=(special?' ':'')+tx;
      }
    }
    return {name_ja:name,stage,hp,type,abilities,attacks,special};
  },EN);
  d.id=String(id); out.push(d); process.stdout.write('.');
}
await b.close();
fs.writeFileSync('_details.json',JSON.stringify(out,null,2));
console.log('\nsaved',out.length);
})();
