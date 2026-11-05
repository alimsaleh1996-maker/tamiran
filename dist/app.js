(function(){
  'use strict';
  const stages=[
    ['reception','پذیرش'],['assigned','تخصیص'],['diagnosing','عیب‌یابی'],['estimate','برآورد'],['approval','تأیید مشتری'],
    ['parts','تأمین قطعه'],['repairing','تعمیر'],['qc','کنترل کیفیت'],['ready','آماده تحویل'],['delivered','تحویل']
  ];
  const roles={manager:'مدیر تعمیرگاه',reception:'پذیرش',technician:'تکنسین',qc:'کنترل کیفیت',finance:'مالی / صندوق',delivery:'تحویل'};
  const navGroups=[
    {title:'عملیات تعمیرگاه',items:[['home','نبض تعمیرگاه','ن'],['reception','پذیرش تعمیرات','پ'],['workflow','مرکز عملیات','م'],['tasks','کارهای من','ک']]},
    {title:'کنترل و تکمیل',items:[['quality','کنترل کیفیت','ق'],['finance','مالی پرونده','ف'],['delivery','تحویل تعمیرات','ت'],['receipts','رسیدها','ر']]},
    {title:'آزمایش و بازخورد',items:[['bugs','فهرست باگ‌ها','!']]}
  ];
  const seedCases=[
    {id:9,receipt:'868793-000009',customer:'آزمون بازیابی پیش‌نویس',mobile:'09350000008',brand:'سامسونگ',model:'A56 QA',issue:'تست ثبت نحوه برخورد با اطلاعات دستگاه',stage:'assigned',owner:'تکنسین تست'},
    {id:8,receipt:'868793-000008',customer:'سناریو ضمانت و اصلاح',mobile:'09351086026',brand:'سامسونگ',model:'A56 QA',issue:'Regression پیام اعتبارسنجی گزارش فنی',stage:'qc',owner:'تکنسین تست'},
    {id:7,receipt:'868793-000007',customer:'سناریو رد برآورد',mobile:'09120000005',brand:'سامسونگ',model:'A56 QA',issue:'تست رد برآورد هزینه',stage:'approval',owner:'تکنسین تست'},
    {id:6,receipt:'868793-000006',customer:'سناریو تحویل',mobile:'09120000004',brand:'سامسونگ',model:'A56 QA',issue:'تست کامل مالی و تحویل',stage:'ready',owner:'تکنسین تست'}
  ];
  const validPages=new Set(navGroups.flatMap(g=>g.items.map(i=>i[0])));
  const state={page:'home',role:'manager',selectedCase:9,cases:load('tamiran-lab-cases',seedCases),bugs:load('tamiran-lab-bugs',[])};
  const $=s=>document.querySelector(s); const content=$('#content');
  function load(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value:structuredClone(fallback)}catch{return structuredClone(fallback)}}
  function save(){localStorage.setItem('tamiran-lab-cases',JSON.stringify(state.cases));localStorage.setItem('tamiran-lab-bugs',JSON.stringify(state.bugs))}
  function fa(n){return new Intl.NumberFormat('fa-IR').format(n)}
  function stageName(code){return stages.find(s=>s[0]===code)?.[1]||code}
  function stageIndex(code){return Math.max(0,stages.findIndex(s=>s[0]===code))}
  function escapeHtml(value){const d=document.createElement('div');d.textContent=String(value??'');return d.innerHTML}
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2400)}
  function setup(){
    $('#roleSelect').innerHTML=Object.entries(roles).map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    $('#roleSelect').value=state.role; $('#roleSelect').addEventListener('change',e=>{state.role=e.target.value;render();toast(`نمای نقش: ${roles[state.role]}`)});
    $('#openMenu').onclick=()=>toggleMenu(true); $('#closeMenu').onclick=$('#backdrop').onclick=()=>toggleMenu(false);
    document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const a=btn.dataset.action;if(a==='new-case')$('#caseDialog').showModal();if(a==='advance')advanceCase();if(a==='report-bug')$('#bugDialog').showModal()});
    $('#bugFab').onclick=()=>$('#bugDialog').showModal();
    document.querySelectorAll('[data-close-dialog]').forEach(btn=>btn.onclick=()=>btn.closest('dialog').close());
    $('#bugForm').addEventListener('submit',submitBug); $('#caseForm').addEventListener('submit',submitCase);
    window.addEventListener('popstate',()=>{const page=new URLSearchParams(location.search).get('view')||'home';state.page=validPages.has(page)?page:'home';render()});
    const initialPage=new URLSearchParams(location.search).get('view')||'home';state.page=validPages.has(initialPage)?initialPage:'home';render();
  }
  function toggleMenu(open){$('#sidebar').classList.toggle('open',open);$('#backdrop').classList.toggle('show',open)}
  function setPage(page){state.page=page;history.pushState({},'',page==='home'?'./':`?view=${page}`);toggleMenu(false);render()}
  function renderNav(){
    $('#nav').innerHTML=navGroups.map(g=>`<div class="nav-group"><div class="nav-group-title">${g.title}</div>${g.items.map(([id,label,icon])=>`<button class="nav-item ${state.page===id?'active':''}" data-page="${id}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}</div>`).join('');
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
  }
  function render(){
    renderNav(); const titles={home:'نبض تعمیرگاه',reception:'پذیرش تعمیرات',workflow:'مرکز عملیات',tasks:'کارهای من',quality:'کنترل کیفیت',finance:'مالی پرونده',delivery:'تحویل تعمیرات',receipts:'رسیدها',bugs:'فهرست باگ‌ها'};
    $('#pageTitle').textContent=titles[state.page]||'تعمیران'; $('#breadcrumb').textContent=`${roles[state.role]} · شعبه مرکزی`;
    const views={home:homeView,reception:receptionView,workflow:workflowView,tasks:tasksView,quality:qualityView,finance:financeView,delivery:deliveryView,receipts:receiptsView,bugs:bugsView};
    content.innerHTML=(views[state.page]||homeView)(); bindView();
  }
  function stats(){const active=state.cases.filter(c=>c.stage!=='delivered');return `<div class="stats">
    ${stat('teal','پرونده‌های فعال',active.length,'همه پرونده‌های باز','پ')}
    ${stat('gold','منتظر تخصیص',active.filter(c=>c.stage==='reception').length,'نیازمند تعیین مسئول','ت')}
    ${stat('sky','آماده تحویل',active.filter(c=>c.stage==='ready').length,'منتظر تسویه یا تحویل','آ')}
    ${stat('coral','باگ‌های P0/P1',state.bugs.filter(b=>['P0','P1'].includes(b.severity)).length,'نیازمند تصمیم','!')}
  </div>`}
  function stat(tone,label,value,note,icon){return `<article class="stat ${tone}"><div class="stat-icon">${icon}</div><div><span>${label}</span><strong>${fa(value)}</strong><small>${note}</small></div></article>`}
  function homeView(){return `<section class="welcome"><div><span class="eyebrow">◉ وضعیت زنده آزمایش</span><h2>تعمیرگاه آزمایشی صدراتل</h2><p>گردش کامل پرونده را بدون اتصال به مشتری، پیامک یا دیتابیس واقعی بررسی کنید.</p></div></section>${stats()}<div class="grid-2"><section class="panel"><div class="panel-head"><div><h3>جریان P0 تعمیرات</h3><p>ده مرحله اصلی؛ از پذیرش تا تحویل</p></div><button class="soft-btn" data-page-link="workflow">مشاهده پرونده‌ها</button></div>${pipeline(null)}</section><section class="panel"><div class="panel-head"><div><h3>نقاط نیازمند توجه</h3><p>براساس وضعیت آزمایشی فعلی</p></div></div>${issues()}</section></div>${recentTable()}`}
  function pipeline(active){return `<div class="pipeline">${stages.map((s,i)=>`<div class="stage ${active===s[0]?'active':''}"><b>${fa(i+1)}</b><span>${s[1]}</span></div>`).join('')}</div>`}
  function issues(){const rows=[['انتقال بک‌اند واقعی','تراکنش‌های دیتابیس هنوز منتقل و آزمون نشده‌اند','P0'],['تست کامل نقش‌ها','پذیرش، تکنسین و مشتری هنوز در بک‌اند جدید آزمون نشده‌اند','P0'],['چاپ و موبایل','تست مرورگر و خروجی چاپ هنوز انجام نشده است','P1']];return `<div class="bugs">${rows.map(r=>`<div class="bug-row"><span class="severity ${r[2]}">${r[2]}</span><div><strong>${r[0]}</strong><p>${r[1]}</p></div></div>`).join('')}</div>`}
  function caseTable(list){return `<div class="table-wrap"><table class="queue"><thead><tr><th>رسید</th><th>مشتری و دستگاه</th><th>ایراد</th><th>وضعیت</th></tr></thead><tbody>${list.map(c=>`<tr><td><button class="receipt" data-case="${Number(c.id)}">${escapeHtml(c.receipt)}</button></td><td class="device"><strong>${escapeHtml(c.customer)}</strong><span>${escapeHtml(c.brand)} ${escapeHtml(c.model)}</span></td><td>${escapeHtml(c.issue)}</td><td><span class="pill ${c.stage==='approval'?'warning':''}">${escapeHtml(stageName(c.stage))}</span></td></tr>`).join('')}</tbody></table></div>`}
  function recentTable(list=state.cases){return `<section class="panel"><div class="panel-head"><div><h3>آخرین پرونده‌ها</h3><p>داده آزمایشی و قابل بازنشانی</p></div></div>${caseTable(list)}</section>`}
  function receptionView(){return `<section class="panel"><div class="panel-head"><div><h3>پذیرش سه‌مرحله‌ای</h3><p>مشتری ← دستگاه ← وضعیت و شرح پذیرش</p></div><button class="primary-btn" data-action="new-case">پذیرش آزمایشی جدید</button></div>${pipeline('reception')}</section>${recentTable()}`}
  function workflowView(){const c=state.cases.find(c=>c.id===state.selectedCase)||state.cases[0];if(!c)return '<div class="empty">پرونده‌ای وجود ندارد.</div>';return `<div class="case-board"><section class="panel"><div class="panel-head"><div><h3>پرونده‌ها</h3><p>${fa(state.cases.length)} سناریوی آزمایشی</p></div></div><div class="case-list">${state.cases.map(x=>`<button class="case-card ${x.id===c.id?'active':''}" data-case="${Number(x.id)}"><b>${escapeHtml(x.receipt)}</b><span>${escapeHtml(x.customer)} · ${escapeHtml(stageName(x.stage))}</span></button>`).join('')}</div></section><section class="panel case-detail"><span class="eyebrow">${escapeHtml(stageName(c.stage))}</span><h2>${escapeHtml(c.brand)} ${escapeHtml(c.model)}</h2><p>${escapeHtml(c.issue)}</p><div class="case-meta"><div class="metric"><small>مشتری</small><strong>${escapeHtml(c.customer)}</strong></div><div class="metric"><small>مسئول</small><strong>${escapeHtml(c.owner||'تعیین نشده')}</strong></div><div class="metric"><small>رسید</small><strong>${escapeHtml(c.receipt)}</strong></div></div>${pipeline(c.stage)}<div class="action-row"><button class="primary-btn" data-action="advance" ${c.stage==='delivered'?'disabled':''}>ثبت اقدام بعدی</button><button class="ghost-btn" data-action="report-bug">گزارش مشکل این مرحله</button></div></section></div>`}
  function tasksView(){const allowed=state.role==='technician'?state.cases.filter(c=>['assigned','diagnosing','repairing','parts'].includes(c.stage)):state.cases.filter(c=>c.stage!=='delivered');return `<section class="panel"><div class="panel-head"><div><h3>کارهای من</h3><p>فقط اقدام بعدی؛ بدون انتخاب دستی وضعیت</p></div><span class="pill">${roles[state.role]}</span></div>${allowed.length?caseTable(allowed):'<div class="empty">کاری برای این نقش باقی نمانده است.</div>'}</section>`}
  function queueView(title,desc,codes){const rows=state.cases.filter(c=>codes.includes(c.stage));return `<section class="panel"><div class="panel-head"><div><h3>${title}</h3><p>${desc}</p></div><span class="pill">${fa(rows.length)} پرونده</span></div>${rows.length?caseTable(rows):'<div class="empty">در این صف پرونده‌ای وجود ندارد.</div>'}</section>`}
  function qualityView(){return queueView('صف کنترل کیفیت','پرونده فقط پس از تکمیل تعمیر وارد این صف می‌شود.',['qc'])}
  function financeView(){return queueView('صف مالی پرونده','فاکتور، پرداخت و مانده؛ بدون Dropdown انتخاب پرونده.',['qc','ready'])}
  function deliveryView(){return queueView('صف تحویل امن','فقط پرونده آماده تحویل و دارای تعیین تکلیف مالی.',['ready'])}
  function receiptsView(){return recentTable()}
  function bugsView(){return `<section class="panel"><div class="panel-head"><div><h3>باگ‌های ثبت‌شده</h3><p>این فهرست فقط در همین مرورگر ذخیره می‌شود.</p></div><button class="primary-btn" data-action="report-bug">ثبت باگ</button></div>${state.bugs.length?`<div class="bugs">${state.bugs.map(b=>`<div class="bug-row"><span class="severity ${b.severity}">${b.severity}</span><div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.module)} · ${escapeHtml(b.description||'بدون توضیح')}</p></div><time>${b.date}</time></div>`).join('')}</div>`:'<div class="empty">هنوز گزارشی ثبت نشده است.</div>'}</section>`}
  function bindView(){document.querySelectorAll('[data-page-link]').forEach(b=>b.onclick=()=>setPage(b.dataset.pageLink));document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>{state.selectedCase=Number(b.dataset.case);setPage('workflow')})}
  function advanceCase(){const c=state.cases.find(c=>c.id===state.selectedCase);if(!c)return;const i=stageIndex(c.stage);if(i<stages.length-1){c.stage=stages[i+1][0];save();render();toast(`پرونده به «${stageName(c.stage)}» منتقل شد`)}}
  function submitBug(e){e.preventDefault();const f=new FormData(e.target);state.bugs.unshift({title:f.get('title'),module:f.get('module'),severity:f.get('severity'),description:f.get('description'),date:new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date())});save();e.target.reset();$('#bugDialog').close();if(state.page==='bugs')render();toast('گزارش باگ ذخیره شد')}
  function submitCase(e){e.preventDefault();const f=new FormData(e.target),next=Math.max(0,...state.cases.map(c=>c.id))+1;state.cases.unshift({id:next,receipt:`LAB-${String(next).padStart(5,'0')}`,customer:f.get('customer'),mobile:f.get('mobile'),brand:f.get('brand'),model:f.get('model'),issue:f.get('issue'),stage:'reception',owner:''});state.selectedCase=next;save();e.target.reset();$('#caseDialog').close();setPage('workflow');toast('پرونده آزمایشی ثبت شد')}
  setup();
}());
