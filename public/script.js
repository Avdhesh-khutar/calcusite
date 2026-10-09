/* Calcusite Professional Calculator Engine */
const calculators=[
{name:'EMI Calculator',desc:'Loan EMI, interest & amortization',icon:'🏠',cat:'loan',type:'emi'},
{name:'SIP Calculator',desc:'Plan your monthly investments',icon:'🪙',cat:'financial',type:'sip'},
{name:'Loan Calculator',desc:'Home, car & personal loan',icon:'💰',cat:'loan',type:'loan'},
{name:'BMI Calculator',desc:'Check your Body Mass Index',icon:'❤️',cat:'health',type:'bmi'},
{name:'Age Calculator',desc:'Find your exact age',icon:'📅',cat:'date',type:'age'},
{name:'GST Calculator',desc:'Calculate GST and final price',icon:'🧾',cat:'tax',type:'gst'},
{name:'FD Calculator',desc:'Fixed deposit maturity & returns',icon:'🏦',cat:'financial',type:'fd'},
{name:'RD Calculator',desc:'Recurring deposit maturity & returns',icon:'💵',cat:'financial',type:'rd'},
{name:'Percentage Calculator',desc:'Easy percentage calculations',icon:'%',cat:'other',type:'percentage'}
];
const categories=[['🏦','Financial','25+ calculators','financial'],['❤️','Health','10+ calculators','health'],['🎓','Education','10+ calculators','education'],['🔄','Unit & Conversion','15+ calculators','unit'],['📅','Date & Time','10+ calculators','date'],['%','Tax & GST','8+ calculators','tax'],['🔢','Math Tools','15+ calculators','other'],['⚙️','Other Tools','10+ calculators','other']];
const $=id=>document.getElementById(id);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const money=(v,d=0)=>`₹${Number(v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})}`;
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function renderPopular(list=calculators.slice(0,9)){
 const grid=$('popularGrid');if(!grid)return;
 grid.innerHTML=list.map((c,i)=>`<div class="calc-card" data-type="${c.type}" data-name="${esc(c.name)}"><div class="calc-icon ${['blue','green','orange','purple','pink'][i%5]}">${c.icon}</div><div class="calc-info"><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p></div><button class="calc-arrow" type="button">→</button></div>`).join('');
 grid.querySelectorAll('.calc-card').forEach(x=>x.onclick=()=>openCalculator(x.dataset.type,x.dataset.name));
}
function renderCategories(){
 const grid=$('categoryGrid');if(!grid)return;
 grid.innerHTML=categories.map(c=>`<button class="category" data-section="${c[3]}" type="button"><div class="category-icon">${c[0]}</div><div><h3>${esc(c[1])}</h3><p>${esc(c[2])}</p></div><span>→</span></button>`).join('');
 grid.querySelectorAll('.category').forEach(x=>x.onclick=()=>filterCategory(x.dataset.section));
}
function filterCategory(cat){renderPopular(calculators.filter(c=>c.cat===cat));const h=document.querySelector('.section-head h2');if(h)h.textContent='Calculators';window.scrollTo({top:350,behavior:'smooth'});}
function field(label,id,value,type='number',step=''){return `<label>${label}<input id="${id}" type="${type}" value="${value}" ${step?`step="${step}"`:''}></label>`}
function form(type,name){
 const f={
 emi:`<h2>${esc(name)}</h2><p>Calculate monthly EMI, total interest and total payment.</p><div class="form-grid">${field('Loan Amount (₹)','emiAmount',1000000)}${field('Annual Interest Rate (%)','emiRate',8.5,'number','.01')}${field('Tenure (Years)','emiYears',20,'number','.1')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate EMI</button><div id="calculatorResult" class="result"></div>`,
 sip:`<h2>${esc(name)}</h2><p>Estimate your SIP investment value and returns.</p><div class="form-grid">${field('Monthly SIP (₹)','sipAmount',5000)}${field('Expected Annual Return (%)','sipRate',12,'number','.01')}${field('Investment Period (Years)','sipYears',15,'number','.1')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate SIP</button><div id="calculatorResult" class="result"></div>`,
 loan:`<h2>${esc(name)}</h2><p>Calculate loan EMI, total interest and total payment.</p><div class="form-grid">${field('Loan Amount (₹)','loanAmount',500000)}${field('Annual Interest Rate (%)','loanRate',10,'number','.01')}${field('Tenure (Years)','loanYears',5,'number','.1')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate Loan</button><div id="calculatorResult" class="result"></div>`,
 bmi:`<h2>${esc(name)}</h2><p>Calculate BMI and weight category.</p><div class="form-grid">${field('Weight (kg)','bmiWeight',70,'number','.1')}${field('Height (cm)','bmiHeight',170,'number','.1')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate BMI</button><div id="calculatorResult" class="result"></div>`,
 age:`<h2>${esc(name)}</h2><p>Find your exact age from your date of birth.</p><div class="form-grid">${field('Date of Birth','birthDate','','date')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate Age</button><div id="calculatorResult" class="result"></div>`,
 gst:`<h2>${esc(name)}</h2><p>Calculate GST amount and final price.</p><div class="form-grid">${field('Base Amount (₹)','gstAmount',25000)}${field('GST Rate (%)','gstRate',18,'number','.01')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate GST</button><div id="calculatorResult" class="result"></div>`,
 fd:`<h2>${esc(name)}</h2><p>Calculate fixed deposit maturity and interest.</p><div class="form-grid">${field('Principal Amount (₹)','fdAmount',100000)}${field('Annual Interest Rate (%)','fdRate',7,'number','.01')}${field('Tenure (Years)','fdYears',5,'number','.1')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate FD</button><div id="calculatorResult" class="result"></div>`,
 rd:`<h2>${esc(name)}</h2><p>Calculate recurring deposit maturity and interest.</p><div class="form-grid">${field('Monthly Deposit (₹)','rdAmount',5000)}${field('Annual Interest Rate (%)','rdRate',7,'number','.01')}${field('Tenure (Years)','rdYears',5,'number','.1')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate RD</button><div id="calculatorResult" class="result"></div>`,
 percentage:`<h2>${esc(name)}</h2><p>Calculate a percentage of any value.</p><div class="form-grid">${field('Value','percentValue',500)}${field('Percentage (%)','percentRate',18,'number','.01')}</div><button class="primary-btn" id="calculateBtn" type="button">Calculate</button><div id="calculatorResult" class="result"></div>`
 };return f[type]||`<h2>${esc(name)}</h2><p>This calculator will be added soon.</p>`;
}
function openCalculator(type,name){const modal=$('calculatorModal'),body=$('modalBody');if(!modal||!body)return;body.innerHTML=form(type,name);modal.classList.add('show');$('calculateBtn')?.addEventListener('click',()=>calculate(type,name));}
function loanCalc(p,r,y){if(p<=0||r<0||y<=0)return null;const n=Math.round(y*12),m=r/12/100;const emi=m===0?p/n:p*m*Math.pow(1+m,n)/(Math.pow(1+m,n)-1);return{emi,total:emi*n,interest:emi*n-p,n};}
function error(t){return `<div class="calc-error">⚠️ ${esc(t)}</div>`}
function calculate(type,name){let result='';
 if(type==='emi'||type==='loan'){const q=type==='emi'?'emi':'loan',d=loanCalc(num($(q+'Amount')?.value),num($(q+'Rate')?.value),num($(q+'Years')?.value));result=d?`<div class="emi-result"><strong>Monthly EMI</strong><h2>${money(d.emi)}</h2><hr><p><strong>Principal:</strong> ${money(num($(q+'Amount').value))}</p><p><strong>Total Interest:</strong> ${money(d.interest)}</p><p><strong>Total Payment:</strong> ${money(d.total)}</p><p><strong>Tenure:</strong> ${d.n} months</p></div>`:error('Please enter valid loan values.');}
 else if(type==='sip'){const m=num($('sipAmount')?.value),r=num($('sipRate')?.value),y=num($('sipYears')?.value);if(m<=0||r<0||y<=0)result=error('Please enter valid SIP values.');else{const n=Math.round(y*12),mr=r/12/100,invested=m*n,fv=mr===0?invested:m*((Math.pow(1+mr,n)-1)/mr)*(1+mr);result=`<div class="sip-result"><strong>Total Future Value</strong><h2>${money(fv)}</h2><hr><p><strong>Monthly Investment:</strong> ${money(m)}</p><p><strong>Invested Amount:</strong> ${money(invested)}</p><p><strong>Estimated Returns:</strong> ${money(fv-invested)}</p><p><strong>Investment Period:</strong> ${y} years</p></div>`;}}
 else if(type==='bmi'){const w=num($('bmiWeight')?.value),h=num($('bmiHeight')?.value)/100;if(w<=0||h<=0)result=error('Please enter valid height and weight.');else{const bmi=w/(h*h);let s=bmi<18.5?'Underweight':bmi<25?'Normal':bmi<30?'Overweight':'Obesity';result=`<div class="bmi-result"><strong>Your BMI</strong><h2>${bmi.toFixed(1)}</h2><p><strong>Status:</strong> ${s}</p></div>`;}}
 else if(type==='age'){const raw=$('birthDate')?.value,d=raw?new Date(raw+'T00:00:00'):null,t=new Date();if(!d||isNaN(d)||d>t)result=error('Please select a valid date of birth.');else{let y=t.getFullYear()-d.getFullYear(),m=t.getMonth()-d.getMonth(),day=t.getDate()-d.getDate();if(day<0){m--;day+=new Date(t.getFullYear(),t.getMonth(),0).getDate();}if(m<0){y--;m+=12;}result=`<div class="age-result"><strong>Your Exact Age</strong><h2>${y} Years</h2><p>${m} Months and ${day} Days</p></div>`;}}
 else if(type==='gst'){const a=num($('gstAmount')?.value),r=num($('gstRate')?.value),g=a*r/100;result=a<0||r<0?error('Please enter valid GST values.'): `<div class="gst-result"><strong>Final Amount</strong><h2>${money(a+g,2)}</h2><hr><p><strong>Base Amount:</strong> ${money(a,2)}</p><p><strong>GST (${r}%):</strong> ${money(g,2)}</p><p><strong>Final Amount:</strong> ${money(a+g,2)}</p></div>`;}
 else if(type==='fd'){const p=num($('fdAmount')?.value),r=num($('fdRate')?.value),y=num($('fdYears')?.value),mat=p*Math.pow(1+r/100,y);result=p<=0||r<0||y<=0?error('Please enter valid FD values.'): `<div class="fd-result"><strong>Maturity Amount</strong><h2>${money(mat)}</h2><hr><p><strong>Principal:</strong> ${money(p)}</p><p><strong>Interest Earned:</strong> ${money(mat-p)}</p></div>`;}
 else if(type==='rd'){const p=num($('rdAmount')?.value),r=num($('rdRate')?.value),y=num($('rdYears')?.value),n=Math.round(y*12),q=r/400,mat=q===0?p*n:p*((Math.pow(1+q,n/3)-1)/q)*(1+q);result=p<=0||r<0||y<=0?error('Please enter valid RD values.'): `<div class="rd-result"><strong>Maturity Amount</strong><h2>${money(mat)}</h2><hr><p><strong>Total Deposits:</strong> ${money(p*n)}</p><p><strong>Estimated Interest:</strong> ${money(mat-p*n)}</p></div>`;}
 else if(type==='percentage'){const v=num($('percentValue')?.value),r=num($('percentRate')?.value),a=v*r/100;result=`<div class="percentage-result"><strong>Percentage Result</strong><h2>${a.toLocaleString('en-IN',{maximumFractionDigits:2})}</h2><p>${r}% of ${v.toLocaleString('en-IN')} = ${a.toLocaleString('en-IN')}</p></div>`;}
 const out=$('calculatorResult');if(out)out.innerHTML=result;if(result&&!result.includes('calc-error'))saveRecent(name,result);
}
function saveRecent(name,value){const rows=JSON.parse(localStorage.getItem('calcRecent')||'[]');rows.unshift({name,value:String(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),time:new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})});localStorage.setItem('calcRecent',JSON.stringify(rows.slice(0,6)));renderRecent();}
function renderRecent(){const list=$('recentList');if(!list)return;const rows=JSON.parse(localStorage.getItem('calcRecent')||'[]');list.innerHTML=rows.length?rows.map(r=>`<div class="recent-row"><div class="r-icon">✓</div><div><strong>${esc(r.name)}</strong><p>${esc(r.value)}</p><small>${esc(r.time)}</small></div></div>`).join(''):`<div class="recent-row"><div class="r-icon">◷</div><div><strong>No recent calculations</strong><p>Your recent calculations will appear here.</p></div></div>`;}
function navigate(s){if(s==='ai'){$('aiInput')?.focus();window.scrollTo({top:700,behavior:'smooth'});return}if(s==='calculators'){renderPopular(calculators);window.scrollTo({top:350,behavior:'smooth'});return}if(s)filterCategory(s);}

document.addEventListener('DOMContentLoaded',()=>{
 renderPopular();renderCategories();renderRecent();
 document.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.section)));
 const search=$('searchInput');if(search)search.addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();renderPopular(q?calculators.filter(c=>`${c.name} ${c.desc} ${c.cat}`.toLowerCase().includes(q)):calculators.slice(0,9));});
 const modal=$('calculatorModal');const close=$('modalClose');if(close&&modal)close.addEventListener('click',()=>modal.classList.remove('show'));if(modal)modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show');});
const menu=$('mobileMenu'),sidebar=$('sidebar');
if(menu&&sidebar)menu.addEventListener('click',e=>{
  e.stopPropagation();
  sidebar.classList.toggle('open');
});
document.addEventListener('click',e=>{
  if(window.innerWidth<=800&&sidebar?.classList.contains('open')
    &&!sidebar.contains(e.target)&&!menu?.contains(e.target)){
    sidebar.classList.remove('open');
  }
});
document.querySelectorAll('.side-nav [data-section],.side-ai [data-section]')
.forEach(b=>b.addEventListener('click',()=>{
  if(window.innerWidth<=800)sidebar?.classList.remove('open');
}));
 const theme=$('themeBtn');if(theme)theme.addEventListener('click',()=>document.documentElement.classList.toggle('dark'));
 document.querySelectorAll('.chips button').forEach(b=>b.addEventListener('click',()=>{const i=$('aiInput');if(i){i.value=b.textContent.trim();i.focus();}}));
 const aiButton=$('aiSend'),aiInput=$('aiInput');if(aiButton&&aiInput)aiButton.addEventListener('click',()=>{if(!aiInput.value.trim()){aiInput.focus();return}alert('AI Assistant backend next stage mein securely connect kiya jayega.');});
});
