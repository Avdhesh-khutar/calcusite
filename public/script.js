const calculators = [
  {name:"EMI Calculator",desc:"Loan EMI, interest & amortization",icon:"🏠",cat:"loan",type:"emi"},
  {name:"SIP Calculator",desc:"Plan your monthly investments",icon:"🪙",cat:"financial",type:"sip"},
  {name:"Loan Calculator",desc:"Home, car & personal loan",icon:"%",cat:"loan",type:"loan"},
  {name:"BMI Calculator",desc:"Check your Body Mass Index",icon:"❤",cat:"health",type:"bmi"},
  {name:"Age Calculator",desc:"Find exact age in years & months",icon:"▣",cat:"date",type:"age"},
  {name:"GST Calculator",desc:"Calculate GST and price with tax",icon:"▤",cat:"tax",type:"gst"},
  {name:"FD Calculator",desc:"Fixed deposit maturity & returns",icon:"🏦",cat:"financial",type:"fd"},
  {name:"RD Calculator",desc:"Recurring deposit calculator",icon:"💰",cat:"financial",type:"rd"},
  {name:"Percentage Calculator",desc:"Easy percentage calculations",icon:"◔",cat:"other",type:"percentage"}
];

const categories = [
  ["🏦","Financial","25+ calculators","financial"],
  ["❤","Health","10+ calculators","health"],
  ["🎓","Education","10+ calculators","education"],
  ["⇄","Unit & Conversion","15+ calculators","unit"],
  ["▣","Date & Time","10+ calculators","date"],
  ["%","Tax & GST","8+ calculators","tax"],
  ["▦","Math Tools","15+ calculators","other"],
  ["⚙","Other Tools","10+ calculators","other"]
];

const popularGrid=document.getElementById("popularGrid");
const categoryGrid=document.getElementById("categoryGrid");
const modal=document.getElementById("calculatorModal");
const modalBody=document.getElementById("modalBody");
const recentList=document.getElementById("recentList");

function renderPopular(list=calculators.slice(0,9)){
  popularGrid.innerHTML=list.map((c,i)=>`
    <div class="calc-card" data-type="${c.type}" data-name="${c.name}">
      <div class="calc-icon ${["blue","green","orange","purple","pink","orange"][i%6]}">${c.icon}</div>
      <div><h3>${c.name}</h3><p>${c.desc}</p></div>
      <button class="go">→</button>
    </div>`).join("");
  popularGrid.querySelectorAll(".calc-card").forEach(el=>el.onclick=()=>openCalculator(el.dataset.type,el.dataset.name));
}

function renderCategories(){
  categoryGrid.innerHTML=categories.map(c=>`
    <button class="category" data-section="${c[3]}" style="text-align:left">
      <div class="category-icon">${c[0]}</div><h3>${c[1]}</h3><p>${c[2]}</p>
    </button>`).join("");
  categoryGrid.querySelectorAll(".category").forEach(el=>el.onclick=()=>filterCategory(el.dataset.section));
}

function filterCategory(cat){
  const list=calculators.filter(c=>c.cat===cat);
  renderPopular(list.length?list:calculators);
  document.querySelector(".section-head h2").textContent="Calculators";
  window.scrollTo({top:350,behavior:"smooth"});
}

function openCalculator(type,name){
  const forms={
    emi:`<h2>🏠 ${name}</h2><p>Calculate monthly loan EMI.</p>
      <div class="form-grid"><label>Loan Amount (₹)<input id="a" type="number" value="1000000"></label>
      <label>Annual Interest Rate (%)<input id="r" type="number" value="8.5" step="0.1"></label>
      <label>Tenure (Years)<input id="n" type="number" value="20"></label>
      <button class="primary-btn" id="calcBtn">Calculate EMI</button></div><div id="result"></div>`,
    bmi:`<h2>❤ ${name}</h2><div class="form-grid"><label>Weight (kg)<input id="w" type="number" value="70"></label><label>Height (cm)<input id="h" type="number" value="170"></label><button class="primary-btn" id="calcBtn">Calculate BMI</button></div><div id="result"></div>`,
    gst:`<h2>▤ ${name}</h2><div class="form-grid"><label>Amount (₹)<input id="a" type="number" value="25000"></label><label>GST Rate (%)<input id="r" type="number" value="18"></label><button class="primary-btn" id="calcBtn">Calculate GST</button></div><div id="result"></div>`,
    percentage:`<h2>◔ ${name}</h2><div class="form-grid"><label>Value<input id="a" type="number" value="500"></label><label>Percentage (%)<input id="r" type="number" value="18"></label><button class="primary-btn" id="calcBtn">Calculate</button></div><div id="result"></div>`,
    sip:`<h2>🪙 ${name}</h2><div class="form-grid"><label>Monthly SIP (₹)<input id="a" type="number" value="5000"></label><label>Annual Return (%)<input id="r" type="number" value="12"></label><label>Years<input id="n" type="number" value="15"></label><button class="primary-btn" id="calcBtn">Calculate</button></div><div id="result"></div>`,
    fd:`<h2>🏦 ${name}</h2><div class="form-grid"><label>Principal (₹)<input id="a" type="number" value="100000"></label><label>Annual Rate (%)<input id="r" type="number" value="7"></label><label>Years<input id="n" type="number" value="5"></label><button class="primary-btn" id="calcBtn">Calculate</button></div><div id="result"></div>`
  };
  modalBody.innerHTML=forms[type] || `<h2>${name}</h2><p>This calculator is being added. The dashboard is ready for more calculator modules.</p>`;
  modal.classList.add("show");
  const btn=document.getElementById("calcBtn");
  if(btn) btn.onclick=()=>calculate(type,name);
}

function calculate(type,name){
  let out="";
  if(type==="emi"){
    const P=+a.value,r=+document.getElementById("r").value/1200,n=+document.getElementById("n").value*12;
    const emi=P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
    out=`<div class="result"><b>Monthly EMI: ₹${emi.toLocaleString("en-IN",{maximumFractionDigits:0})}</b><br>Total Payment: ₹${(emi*n).toLocaleString("en-IN",{maximumFractionDigits:0})}</div>`;
  }else if(type==="bmi"){
    const bmi=+w.value/Math.pow(+h.value/100,2);
    out=`<div class="result"><b>Your BMI: ${bmi.toFixed(1)}</b><br>${bmi<18.5?"Underweight":bmi<25?"Normal range":bmi<30?"Overweight":"Obesity range"}</div>`;
  }else if(type==="gst"){
    const amount=+a.value,rate=+document.getElementById("r").value,gst=amount*rate/100;
    out=`<div class="result"><b>GST: ₹${gst.toLocaleString("en-IN",{maximumFractionDigits:2})}</b><br>Total: ₹${(amount+gst).toLocaleString("en-IN",{maximumFractionDigits:2})}</div>`;
  }else if(type==="percentage"){
    out=`<div class="result"><b>Result: ${((+a.value*+document.getElementById("r").value)/100).toLocaleString("en-IN")}</b></div>`;
  }else if(type==="sip"){
    const p=+a.value, monthly=+document.getElementById("r").value/1200, months=+document.getElementById("n").value*12;
    const fv=p*((Math.pow(1+monthly,months)-1)/monthly)*(1+monthly);
    out=`<div class="result"><b>Estimated Value: ₹${fv.toLocaleString("en-IN",{maximumFractionDigits:0})}</b><br>Invested: ₹${(p*months).toLocaleString("en-IN")}</div>`;
  }else if(type==="fd"){
    const P=+a.value,rate=+document.getElementById("r").value/100,years=+document.getElementById("n").value;
    const maturity=P*Math.pow(1+rate/4,4*years);
    out=`<div class="result"><b>Maturity: ₹${maturity.toLocaleString("en-IN",{maximumFractionDigits:0})</b><br>Interest: ₹${(maturity-P).toLocaleString("en-IN",{maximumFractionDigits:0})}</div>`;
  }
  document.getElementById("result").innerHTML=out;
  saveRecent(name,out.replace(/<[^>]*>/g,"").split("<")[0]);
}

function saveRecent(name,value){
  const rows=JSON.parse(localStorage.getItem("calcRecent")||"[]");
  rows.unshift({name,value,time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})});
  localStorage.setItem("calcRecent",JSON.stringify(rows.slice(0,6)));
  renderRecent();
}
function renderRecent(){
  const rows=JSON.parse(localStorage.getItem("calcRecent")||"[]");
  recentList.innerHTML=rows.length?rows.map(r=>`<div class="recent-row"><div class="r-icon">▦</div><div><strong>${r.name}</strong><small>${r.time}</small></div><div class="value">${r.value}</div></div>`).join(""):`<div class="recent-empty">Your recent calculations will appear here.</div>`;
}

function navigate(section){
  if(section==="ai"){document.getElementById("aiInput").focus();window.scrollTo({top:700,behavior:"smooth"});return}
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.section===section));
  if(section==="calculators"){renderPopular(calculators);window.scrollTo({top:350,behavior:"smooth"});}
  else filterCategory(section);
  document.getElementById("sidebar").classList.remove("open");
}
document.querySelectorAll("[data-section]").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.section)));
document.getElementById("searchInput").addEventListener("input",e=>{
  const q=e.target.value.toLowerCase().trim();
  renderPopular(q?calculators.filter(c=>(c.name+" "+c.desc+" "+c.cat).toLowerCase().includes(q)):calculators);
});
document.getElementById("modalClose").onclick=()=>modal.classList.remove("show");
modal.onclick=e=>{if(e.target===modal)modal.classList.remove("show")};
document.getElementById("mobileMenu").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
document.getElementById("themeBtn").onclick=()=>{
  document.documentElement.classList.toggle("dark");
  document.getElementById("themeBtn").textContent=document.documentElement.classList.contains("dark")?"☾":"☀";
};
document.querySelectorAll(".chips button").forEach(b=>b.onclick=()=>{document.getElementById("aiInput").value=b.textContent;});
document.getElementById("aiSend").onclick=()=>{
  const q=document.getElementById("aiInput").value.trim();
  document.getElementById("aiReply").textContent=q?`Received: "${q}". Secure AI calculation will be connected to the backend in the next stage.`:"Please type a calculation question.";
};

renderPopular();renderCategories();renderRecent();
