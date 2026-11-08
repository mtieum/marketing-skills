#!/usr/bin/env node
// The review board: every queue item on one page in the browser, with its video or image,
// the exact text (one click to copy), the link, the fact check, and buttons for the owner's
// decision, which are written straight back into the item's front matter.
//
//   node board.mjs [workspace]      # workspace defaults to ./marketing; opens http://localhost:4747
//   PORT=5000 node board.mjs marketing
//
// No dependencies. It listens on 127.0.0.1 only, and serves only the files the queue items
// name as assets. Nothing is posted anywhere: "Posted" only records that the owner did it.
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';

const WS = resolve(process.argv[2] ?? 'marketing');
const QUEUE = join(WS, 'queue');
const PORT = Number(process.env.PORT ?? 4747);
if (!existsSync(QUEUE)) {
  console.error(`no queue at ${QUEUE}: pass the workspace folder (the one with brand.md and queue/)`);
  process.exit(1);
}

// --- Items -----------------------------------------------------------------
const FM = /^---\n([\s\S]*?)\n---\n?/;
function parse(file) {
  const raw = readFileSync(join(QUEUE, file), 'utf8');
  const m = raw.match(FM);
  const meta = {};
  if (m) for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    else v = v.replace(/^"(.*)"$/, '$1');
    meta[kv[1]] = v;
  }
  const body = m ? raw.slice(m[0].length) : raw;
  const [text, sources = ''] = body.split('<!-- sources -->');
  return { file, meta, text: text.trim(), sources: sources.trim() };
}
const items = () => readdirSync(QUEUE).filter((f) => f.endsWith('.md') && f !== 'README.md').map(parse)
  .sort((a, b) => `${a.meta.due ?? '9'} ${a.meta.time ?? ''} ${a.file}`.localeCompare(`${b.meta.due ?? '9'} ${b.meta.time ?? ''} ${b.file}`));

/** Set (or add) front-matter keys in an item file, leaving everything else as written. */
function setMeta(file, changes) {
  const path = join(QUEUE, file);
  let raw = readFileSync(path, 'utf8');
  const m = raw.match(FM);
  if (!m) throw new Error('no front matter');
  let fm = m[1];
  for (const [k, v] of Object.entries(changes)) {
    const line = `${k}: ${/[:#"\[\]]|^\s|\s$/.test(v) ? JSON.stringify(v) : v}`;
    const re = new RegExp(`^${k}:.*$`, 'm');
    fm = re.test(fm) ? fm.replace(re, line) : `${fm}\n${line}`;
  }
  writeFileSync(path, raw.replace(FM, `---\n${fm}\n---\n`));
}

const verification = (item) => {
  // An item whose text is another's (the same caption on a second channel) can point at its check.
  const id = item.meta.checked_as ?? item.meta.id ?? item.file.replace(/\.md$/, '');
  const f = join(WS, 'campaigns', item.meta.campaign ?? '', 'verification', `${id}.md`);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
};

// --- Page ------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const VIDEO = new Set(['.mp4', '.mov', '.webm']);
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const assetUrl = (p) => `/asset?p=${encodeURIComponent(p)}`;

/** A markdown table as an HTML table; other lines as paragraphs. Enough for verification files. */
function mdLite(md) {
  const out = [];
  let rows = [];
  const flush = () => {
    if (!rows.length) return;
    const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const [head, , ...rest] = rows;
    out.push(`<table><tr>${cells(head).map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${rest.map((r) => `<tr>${cells(r).map((c) => `<td class="v-${esc(c.toLowerCase())}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`);
    rows = [];
  };
  for (const line of md.split('\n')) {
    if (line.startsWith('|')) { rows.push(line); continue; }
    flush();
    if (/^#+\s/.test(line)) out.push(`<h4>${esc(line.replace(/^#+\s/, ''))}</h4>`);
    else if (line.trim()) out.push(`<p>${esc(line)}</p>`);
  }
  flush();
  return out.join('');
}

function verdicts(md, status) {
  if (!md) return '<span class="tag warn">not checked</span>';
  const n = (v) => (md.match(new RegExp(`\\|\\s*${v}\\s*\\|`, 'g')) ?? []).length;
  const bad = n('WRONG') + n('UNSUPPORTED');
  // Past draft, the fact gate has applied its fixes: the rows are history, not work left.
  const fixed = bad && status && status !== 'draft';
  return `<span class="tag ${bad && !fixed ? 'bad' : 'good'}">${n('SUPPORTED')} supported${bad ? `, ${bad} ${fixed ? 'fixed' : 'to fix'}` : ''}</span>`;
}

/** The text to paste: fenced blocks if the item has them (several fields), else the whole text. */
function copyBlocks(text) {
  const fences = [...text.matchAll(/(?:^|\n)([^\n]*)\n```[^\n]*\n([\s\S]*?)\n```/g)];
  if (fences.length) return fences.map(([, label, body]) => ({ label: label.replace(/[:#*]/g, '').trim(), body }));
  return [{ label: '', body: text }];
}

function card(item, n) {
  const { meta } = item;
  const assets = [].concat(meta.assets ?? []);
  const media = assets.map((p) => {
    const e = extname(p).toLowerCase();
    if (VIDEO.has(e)) return `<video controls preload="metadata" src="${assetUrl(p)}"></video>`;
    if (IMAGE.has(e)) return `<img src="${assetUrl(p)}" alt="">`;
    return '';
  }).join('');
  const files = assets.map((p) => `<li><code>${esc(p)}</code> <button class="ghost" data-copy="${esc(p)}">Copy path</button></li>`).join('');
  const v = verification(item);
  const blocks = copyBlocks(item.text).map((b, i) => `
    <div class="block">
      <div class="block-head"><span>${esc(b.label || 'Text to paste')}</span><button data-copyblock>Copy</button></div>
      <pre>${esc(b.body)}</pre>
    </div>`).join('');
  return `
  <article class="card" id="${esc(meta.id ?? item.file.replace(/\.md$/, ''))}" data-status="${esc(meta.status ?? 'draft')}" data-channel="${esc(meta.channel)}" data-file="${esc(item.file)}" data-due="${esc(meta.due ?? '')}" data-time="${esc(meta.time ?? '')}" data-title="${esc(title(item))}">
    <header>
      <span class="n">${n}</span>
      <span class="todo"></span>
      <span class="chan">${esc(meta.channel ?? '?')}</span>
      <span class="when">${esc(meta.due ?? '')} ${esc(meta.time ?? '')}</span>
      <span class="status s-${esc(meta.status)}">${esc(meta.status ?? 'draft')}</span>
      ${verdicts(v, meta.status)}
      <span class="id">${esc(meta.id ?? item.file)}</span>
    </header>
    <div class="body">
      ${media ? `<div class="media">${media}</div>` : ''}
      <div class="words">
        ${blocks}
        ${meta.link ? `<p class="row"><b>Link</b> <a href="${esc(meta.link)}" target="_blank" rel="noopener">${esc(meta.link)}</a> <button class="ghost" data-copy="${esc(meta.link)}">Copy</button></p>` : ''}
        ${meta.notes ? `<p class="row notes"><b>Notes</b> ${esc(meta.notes)}</p>` : ''}
        ${meta.owner_note ? `<p class="row notes"><b>Your note</b> ${esc(meta.owner_note)}</p>` : ''}
        ${meta.out_url ? `<p class="row"><b>Posted</b> <a href="${esc(meta.out_url)}" target="_blank" rel="noopener">${esc(meta.out_url)}</a></p>` : ''}
        ${files ? `<details><summary>Files</summary><ul class="files">${files}</ul></details>` : ''}
        ${v ? `<details><summary>Fact check</summary><div class="check">${mdLite(v)}</div></details>` : ''}
        <div class="actions">
          <button data-act="approved" class="yes">Approve</button>
          <button data-act="changes">Change…</button>
          <button data-act="rejected" class="no">Reject</button>
          <button data-act="out">Posted…</button>
        </div>
      </div>
    </div>
  </article>`;
}

/** A short name for an item: its channel and the last word of its id ("instagram · prague"). */
const title = (it) => `${it.meta.channel ?? '?'} · ${String(it.meta.id ?? it.file).replace(/\.md$/, '').split('-').slice(-1)[0]}`;
/** Still to do: not posted, not rejected, not measured. */
const DONE = new Set(['out', 'rejected', 'measured']);

function page() {
  const all = items();
  const cards = all.map((it, i) => card(it, i + 1)).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review board</title>
<style>
:root{--bg:#f6f6f4;--card:#fff;--ink:#1c1c1a;--muted:#6b6b66;--line:#e2e2dc;--accent:#2f5bd3;--good:#1f7a3f;--bad:#b3261e;--warn:#9a6700;--code:#f0f0ec;--tab:#ebebe6}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--ink:#ecece8;--muted:#a3a39c;--line:#33332f;--accent:#8aa8ff;--good:#6fcf8f;--bad:#ff8a80;--warn:#e6b450;--code:#262623;--tab:#262623}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
.top{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px 0}
.bar{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;max-width:1100px;margin:0 auto}
.bar h1{font-size:17px;margin:0 6px 0 0}.spacer{flex:1}
.next{max-width:1100px;margin:8px auto 0;font-size:14px;padding:7px 12px;border-radius:8px;background:var(--tab);cursor:pointer}
.next b{font-weight:650}.next .in{color:var(--muted)}.next.late{color:var(--bad)}
.tabs{display:flex;gap:4px;overflow-x:auto;max-width:1100px;margin:10px auto 0;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tab{border:0;border-bottom:3px solid transparent;border-radius:6px 6px 0 0;background:none;padding:6px 10px 7px;white-space:nowrap;color:var(--muted)}
.tab[aria-selected=true]{color:var(--ink);border-bottom-color:var(--accent);background:var(--tab)}
.tab .c{display:inline-block;min-width:20px;margin-left:6px;padding:0 6px;border-radius:99px;background:var(--line);color:var(--ink);font-size:12px}
.tab.overdue .c{background:var(--bad);color:var(--bg)}.tab .c.zero{opacity:.45}
main{max-width:1100px;margin:0 auto;padding:8px 16px 80px}
.empty{color:var(--muted);padding:40px 0;text-align:center}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:12px 0;overflow:hidden}
.card.isdone{opacity:.6}
.card header{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);font-size:13px}
.n{font-weight:700}.chan{font-weight:600;text-transform:capitalize}.when{color:var(--muted)}.id{color:var(--muted);margin-left:auto;font-family:ui-monospace,monospace;font-size:12px}
.todo:empty{display:none}.todo{font-weight:650;border-radius:6px;padding:1px 8px;background:var(--tab)}.todo.late{color:var(--bad)}
.status,.tag{border-radius:99px;padding:1px 9px;border:1px solid currentColor;font-size:12px}
.s-approved,.s-ready,.s-out,.s-measured,.good{color:var(--good)}.s-rejected,.bad{color:var(--bad)}.s-changes,.s-draft,.warn{color:var(--warn)}.s-checked{color:var(--accent)}
.body{display:flex;gap:16px;padding:14px;flex-wrap:wrap}.media{flex:0 0 240px;display:flex;flex-direction:column;gap:8px}
.media video,.media img{width:240px;max-height:430px;border-radius:8px;background:#000}
.words{flex:1 1 380px;min-width:0}
.block{border:1px solid var(--line);border-radius:8px;margin-bottom:10px}.block-head{display:flex;justify-content:space-between;align-items:center;padding:4px 6px 4px 10px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--line)}
pre{margin:0;padding:10px;white-space:pre-wrap;word-break:break-word;font:14px/1.5 system-ui,sans-serif}
.row{margin:6px 0;font-size:14px;word-break:break-word}.row b{color:var(--muted);font-weight:600;margin-right:6px}
a{color:var(--accent)}code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:12px;word-break:break-all}
details{margin:8px 0;font-size:14px}summary{cursor:pointer;color:var(--muted)}.files{padding-left:18px}
.check{overflow-x:auto}table{border-collapse:collapse;font-size:12.5px;margin-top:6px}th,td{border:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.v-supported{color:var(--good)}.v-wrong,.v-unsupported{color:var(--bad);font-weight:600}.v-soft{color:var(--warn)}
button,.btn{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:7px;padding:4px 10px;cursor:pointer;text-decoration:none}
button:hover,.btn:hover{border-color:var(--accent)}button.ghost{padding:1px 7px;font-size:12px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.yes{color:var(--good);border-color:currentColor}.no{color:var(--bad)}
.hide{display:none}.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:6px 14px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
@media (max-width:600px){.media{flex-basis:100%}.media video,.media img{width:100%}.id{margin-left:0}}
</style></head><body>
<div class="top">
  <div class="bar"><h1>Review board</h1><span class="spacer"></span>
    <button id="notify" title="Browser notifications 15 minutes before each post, while this page is open">Notify me</button>
    <a class="btn" href="/reminders.ics" title="Every post still to do, with a 15-minute alarm: open it to add to your calendar">Add to calendar</a>
    <button id="reload" class="ghost">Reload</button></div>
  <div class="next hide" id="next"></div>
  <nav class="tabs" id="tabs" role="tablist"></nav>
</div>
<main id="main">${cards}<p class="empty hide" id="empty">Nothing here.</p></main>
<div class="toast" id="toast"></div>
<script>
const DONE=new Set(${JSON.stringify([...DONE])});
const LEAD=15; // minutes before a post that reminders fire
const cards=[...document.querySelectorAll('.card')];
const pad=(n)=>String(n).padStart(2,'0');
const ymd=(d)=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const when=(c)=>c.dataset.due?new Date(c.dataset.due+'T'+(c.dataset.time||'09:00')):null;
const isDone=(c)=>DONE.has(c.dataset.status);
const needsYes=(c)=>['draft','checked','changes'].includes(c.dataset.status);
const toast=(t)=>{const e=document.getElementById('toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),1600)};
const copy=async(t)=>{try{await navigator.clipboard.writeText(t);toast('Copied')}catch{toast('Copy failed: select and copy by hand')}};
const store={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
function ago(ms){const m=Math.round(Math.abs(ms)/60000);if(m<60)return m+' min';const h=Math.floor(m/60);if(h<48)return h+' h'+(m%60?' '+(m%60)+' min':'');return Math.round(h/24)+' days'}
function dayName(d){const t=ymd(new Date()),tm=ymd(new Date(Date.now()+864e5));if(d===t)return 'Today';if(d===tm)return 'Tomorrow';
  return new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}

let current=null;
function tabsFor(){
  const today=ymd(new Date());const todo=cards.filter(c=>!isDone(c));
  const tabs=[];
  const late=todo.filter(c=>c.dataset.due&&c.dataset.due<today);
  if(late.length)tabs.push({key:'overdue',label:'Overdue',n:late.length,cls:'overdue',show:c=>!isDone(c)&&c.dataset.due&&c.dataset.due<today});
  const days=[...new Set(cards.map(c=>c.dataset.due).filter(d=>d&&d>=today))].sort();
  if(!days.includes(today))days.unshift(today);
  for(const d of days)tabs.push({key:d,label:dayName(d),n:todo.filter(c=>c.dataset.due===d).length,show:c=>c.dataset.due===d});
  if(cards.some(c=>!c.dataset.due))tabs.push({key:'nodate',label:'No date',n:todo.filter(c=>!c.dataset.due).length,show:c=>!c.dataset.due});
  tabs.push({key:'all',label:'All',n:todo.length,show:()=>true});
  tabs.push({key:'done',label:'Done',n:cards.length-todo.length,count:'plain',show:isDone});
  return tabs;
}
function render(){
  const tabs=tabsFor();
  if(!current||!tabs.some(t=>t.key===current)){
    // Open on what needs doing first: anything overdue, else today if it has work, else the next day that does.
    current=(tabs.find(t=>t.key==='overdue')||tabs.find(t=>/^[0-9]/.test(t.key)&&t.n)||tabs.find(t=>t.key==='all')).key;
  }
  const nav=document.getElementById('tabs');
  nav.innerHTML=tabs.map(t=>'<button class="tab '+(t.cls||'')+'" role="tab" aria-selected="'+(t.key===current)+'" data-tab="'+t.key+'">'+t.label+'<span class="c'+(t.n?'':' zero')+'">'+t.n+'</span></button>').join('');
  const tab=tabs.find(t=>t.key===current);
  // Within a tab: what's still to do first, in time order; done items after.
  const shown=cards.filter(tab.show).sort((a,b)=>(isDone(a)-isDone(b))||((when(a)??0)-(when(b)??0)));
  const main=document.getElementById('main');
  cards.forEach(c=>c.classList.add('hide'));
  for(const c of shown){c.classList.remove('hide');c.classList.toggle('isdone',isDone(c));main.insertBefore(c,document.getElementById('empty'))}
  document.getElementById('empty').classList.toggle('hide',shown.length>0);
  label();
}
/** Each card's to-do line, and the "next up" bar. */
function label(){
  const now=Date.now();
  for(const c of cards){const t=c.querySelector('.todo');const w=when(c);
    if(isDone(c)||!w){t.textContent='';continue}
    const d=w-now;const verb=needsYes(c)?'Approve, then post':'Post';
    t.textContent=d<0?verb+' (due '+ago(d)+' ago)':verb+' in '+ago(d);t.classList.toggle('late',d<0)}
  const next=cards.filter(c=>!isDone(c)&&when(c)).sort((a,b)=>when(a)-when(b))[0];
  const bar=document.getElementById('next');
  if(!next){bar.classList.add('hide');return}
  const d=when(next)-now;
  bar.classList.remove('hide');bar.classList.toggle('late',d<0);bar.dataset.go=next.id;
  bar.innerHTML='<b>Next up:</b> '+next.dataset.title+' · '+dayName(next.dataset.due)+' '+(next.dataset.time||'')+' <span class="in">('+(d<0?'due '+ago(d)+' ago':'in '+ago(d))+(needsYes(next)?', needs your approval first':'')+')</span>';
}
document.getElementById('next').addEventListener('click',(e)=>{const id=e.currentTarget.dataset.go;const c=document.getElementById(id);if(!c)return;
  if(c.classList.contains('hide')){current=c.dataset.due||'all';render()}c.scrollIntoView({behavior:'smooth',block:'start'})});

// Reminders while the page is open (the calendar file covers the rest).
function remind(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const sent=store.get('board-reminded',{});const now=Date.now();
  for(const c of cards){const w=when(c);if(isDone(c)||!w)continue;
    if(now>=w-LEAD*60000&&now<w+60*60000&&!sent[c.id]){sent[c.id]=1;
      const n=new Notification('Post at '+(c.dataset.time||'')+': '+c.dataset.title,{body:needsYes(c)?'Still needs your approval.':'Open the board to copy the text.',tag:c.id});
      n.onclick=()=>{window.focus();current=c.dataset.due;render();c.scrollIntoView()}}}
  store.set('board-reminded',sent);
}
document.getElementById('notify').addEventListener('click',async()=>{
  if(!('Notification' in window))return toast('This browser has no notifications');
  const p=await Notification.requestPermission();toast(p==='granted'?'Reminders on, '+LEAD+' min before each post (keep this tab open)':'Notifications blocked in the browser');remind()});
if('Notification' in window&&Notification.permission==='granted')document.getElementById('notify').textContent='Reminders on';
setInterval(()=>{label();remind()},30000);remind();

document.addEventListener('click',async(e)=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.tab){current=b.dataset.tab;render();window.scrollTo(0,0);return}
  if(b.id==='reload')return location.reload();
  if(b.dataset.copy!==undefined)return copy(b.dataset.copy);
  if(b.hasAttribute('data-copyblock'))return copy(b.closest('.block').querySelector('pre').textContent);
  const act=b.dataset.act;if(!act)return;
  const card=b.closest('.card');const body={file:card.dataset.file,status:act};
  if(act==='changes'){const n=prompt('What should change?');if(!n)return;body.note=n}
  if(act==='rejected'){const n=prompt('Why? (optional, helps next time)');if(n===null)return;if(n)body.note=n}
  if(act==='out'){const n=prompt('Link to the live post (optional)');if(n===null)return;if(n)body.out_url=n}
  const r=await fetch('/decide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)return toast('Not saved: '+(await r.text()));
  const s=card.querySelector('.status');s.textContent=act;s.className='status s-'+act;card.dataset.status=act;toast('Saved: '+act);render();
});
if(location.hash){const c=document.getElementById(location.hash.slice(1));if(c){current=c.dataset.due||'all'}}
render();
if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView();
</script></body></html>`;
}

/** Every post still to do as a calendar, each with an alarm before it: import it, or open it, in any calendar app. */
function calendar() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const fold = (line) => line.match(/.{1,73}/g).join('\r\n ');
  const txt = (s) => String(s).replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const events = items().filter((it) => it.meta.due && !DONE.has(it.meta.status ?? 'draft')).map((it) => {
    const [h, m] = (it.meta.time || '09:00').split(':');
    const start = `${it.meta.due.replace(/-/g, '')}T${h.padStart(2, '0')}${(m ?? '00').padStart(2, '0')}00`;
    const id = it.meta.id ?? it.file.replace(/\.md$/, '');
    const ask = ['draft', 'checked', 'changes'].includes(it.meta.status ?? 'draft') ? ' (approve first)' : '';
    return [
      'BEGIN:VEVENT', `UID:${id}@review-board`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, 'DURATION:PT15M',
      fold(`SUMMARY:${txt(`Post: ${title(it)}${ask}`)}`),
      fold(`DESCRIPTION:${txt(`Copy the text and file from the review board: http://localhost:${PORT}/#${id}${it.meta.notes ? `\n\n${it.meta.notes}` : ''}`)}`),
      'BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${txt(`Post soon: ${title(it)}`)}`), 'TRIGGER:-PT15M', 'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//marketing-skills//review board//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Posts to do', ...events, 'END:VCALENDAR', ''].join('\r\n');
}

// --- Server ----------------------------------------------------------------
const TYPES = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.srt': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8' };
const ALLOWED_STATUS = new Set(['approved', 'rejected', 'changes', 'out']);

function sendAsset(req, res, p) {
  // Only files a queue item names: the board is not a general file server.
  const known = items().some((i) => [].concat(i.meta.assets ?? []).includes(p));
  if (!known || !existsSync(p)) { res.writeHead(404).end('not an asset of any queue item'); return; }
  const size = statSync(p).size;
  const type = TYPES[extname(p).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    createReadStream(p, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
    createReadStream(p).pipe(res);
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(page());
    } else if (req.method === 'GET' && url.pathname === '/reminders.ics') {
      res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="posts-to-do.ics"', 'cache-control': 'no-store' }).end(calendar());
    } else if (req.method === 'GET' && url.pathname === '/asset') {
      sendAsset(req, res, url.searchParams.get('p') ?? '');
    } else if (req.method === 'POST' && url.pathname === '/decide') {
      // Same-origin only: a page elsewhere can't change the queue through this.
      const origin = req.headers.origin;
      if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { res.writeHead(403).end('wrong origin'); return; }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { file, status, note, out_url } = JSON.parse(body);
          if (!ALLOWED_STATUS.has(status)) throw new Error('unknown status');
          if (!items().some((i) => i.file === file)) throw new Error('unknown item');
          const today = new Date().toISOString().slice(0, 10);
          const changes = { status, decided: today };
          if (note) changes.owner_note = String(note).replace(/\n/g, ' ');
          if (out_url) changes.out_url = String(out_url);
          if (status === 'out') changes.out = today;
          setMeta(file, changes);
          res.writeHead(200).end('ok');
        } catch (e) {
          res.writeHead(400).end(e.message);
        }
      });
    } else res.writeHead(404).end('not found');
  } catch (e) {
    res.writeHead(500).end(String(e?.message ?? e));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const link = `http://localhost:${PORT}/`;
  console.log(`review board for ${WS}\n  ${link}\n  (Ctrl+C to stop)`);
  if (!process.env.NO_OPEN) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    execFile(opener, [link], () => {});
  }
});
