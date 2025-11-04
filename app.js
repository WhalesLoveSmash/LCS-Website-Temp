console.log('app.js loaded');

const SHEET_ID = '1VwjWfTvvKHXdVARc9a1QSwi1PoZOU8GIAHiuN0fLBmA';
const TAB_CANDIDATES = ['Group Bets', 'LCS Bets – November 2025'];

const COLS = {
  event: 'Event',
  tag: 'Author Tag',
  market: 'Market',
  odds: 'Odds',
  stake: 'Stake',
  returns: 'Returns',
  cashout: 'Cashout'
};

const grid   = document.getElementById('grid');
const tsEl   = document.getElementById('ts');
const winEl  = document.getElementById('winCount');
const loseEl = document.getElementById('loseCount');
const totalEl= document.getElementById('totalCount');

function showSkeletons(n=5){
  grid.innerHTML='';
  for(let i=0;i<n;i++){
    const d=document.createElement('div');
    d.className='skel';
    grid.appendChild(d);
  }
}

function gvizUrl(sheetName){
  const base=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
  const params=new URLSearchParams({tqx:'out:json'});
  if(sheetName) params.set('sheet',sheetName);
  return `${base}?${params.toString()}`;
}
async function fetchFirstAvailable(){
  for(const name of TAB_CANDIDATES){
    try{
      const res=await fetch(gvizUrl(name),{cache:'no-store'});
      const text=await res.text();
      if(!text.startsWith('/*')) throw new Error('Not gviz');
      return parseGviz(text);
    }catch(_){}
  }
  const res=await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=0&tqx=out:json`,{cache:'no-store'});
  const text=await res.text();
  return parseGviz(text);
}
function parseGviz(text){
  const json=JSON.parse(text.substring(text.indexOf('{'),text.lastIndexOf('}')+1));
  const cols=json.table.cols.map(c=>c.label);
  const rows=json.table.rows||[];
  return rows.map(r=>{
    const get=(label)=>{
      const idx=cols.indexOf(label);
      if(idx===-1) return '';
      const cell=r.c[idx];
      return (cell && (cell.f ?? cell.v)) ?? '';
    };
    return {
      event:String(get(COLS.event)||'').toUpperCase(),
      tag:get(COLS.tag),
      market:get(COLS.market),
      odds:get(COLS.odds),
      stake:get(COLS.stake),
      returns:get(COLS.returns),
      cashout:get(COLS.cashout)
    };
  });
}

function statusEmoji(event){
  if(!event) return null;
  if(event.includes('SUCCESS')||event.includes('WIN')) return '✅';
  if(event.includes('FAIL')||event.includes('LOSS')||event.includes('LOSE')) return '❌';
  return null;
}
function formatMoney(x){
  if(x===''||x==null) return '';
  const num=Number(String(x).replace(/[^\d.-]/g,''));
  if(Number.isNaN(num)) return `$${x}`;
  return `$${num}`;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function isReadableRow(r){
  if(!String(r.odds).trim() || !String(r.stake).trim()) return false;
  if(!String(r.returns).trim() && !String(r.cashout).trim()) return false;
  if(!statusEmoji(r.event)) return false;
  return true;
}

function updateRibbon(list){
  let wins=0,losses=0;
  for(const r of list){
    const z=statusEmoji(r.event);
    if(z==='✅') wins++; else if(z==='❌') losses++;
  }
  winEl.textContent=wins;
  loseEl.textContent=losses;
  totalEl.textContent=wins+losses;
  tsEl.textContent=`Last updated ${new Date().toLocaleTimeString()}`;
}
function render(list){
  grid.innerHTML='';
  const frag=document.createDocumentFragment();
  const clean=list.filter(isReadableRow).reverse();
  updateRibbon(clean);

  for(const r of clean){
    const z=statusEmoji(r.event);
    const statusClass=z==='✅' ? 'status ok' : 'status';
    const ret=(r.cashout && String(r.cashout).trim()!=='') ? r.cashout : r.returns;

    const card=document.createElement('article');
    card.className='card';
    card.innerHTML=`
      <div class="row1">
        <div class="${statusClass}">${z}</div>
        <div>
          <div class="title">${escapeHtml(r.tag||'')}<span class="sp">·</span>${escapeHtml(r.market||'')}</div>
          <div class="meta">Odds ${escapeHtml(String(r.odds||''))} <span class="sp">•</span> ${formatMoney(r.stake)} <span class="sp">•</span> Returns ${formatMoney(ret)}</div>
        </div>
      </div>
    `;
    frag.appendChild(card);
  }

  if(clean.length===0){
    const empty=document.createElement('div');
    empty.className='card';
    empty.innerHTML=`<div class="title">No readable bets yet.</div><div class="meta">Resolved rows with Odds, Stake, and Returns/Cashout will appear here.</div>`;
    frag.appendChild(empty);
  }

  grid.appendChild(frag);
}

async function load(){
  try{
    showSkeletons();
    const rows=await fetchFirstAvailable();
    render(rows);
  }catch(e){
    console.error(e);
    grid.innerHTML=`<div class="card"><div class="title">Unable to load sheet.</div><div class="meta">Check sharing and tab name.</div></div>`;
  }
}
load();
setInterval(load,60_000);
