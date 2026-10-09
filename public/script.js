"use strict";

/* ==========================================
   CALCUSITE AI — PROFESSIONAL CALCULATOR ENGINE
   ========================================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const calculators = [
  {id:"emi",name:"EMI Calculator",desc:"Monthly loan instalment and interest",icon:"🏠",cat:"loan",popular:true},
  {id:"sip",name:"SIP Calculator",desc:"Estimate investment growth and returns",icon:"📈",cat:"financial",popular:true},
  {id:"loan",name:"Loan Calculator",desc:"Calculate loan repayment costs",icon:"💳",cat:"loan",popular:true},
  {id:"bmi",name:"BMI Calculator",desc:"Check your body mass index",icon:"❤️",cat:"health",popular:true},
  {id:"age",name:"Age Calculator",desc:"Calculate your exact age",icon:"🎂",cat:"date",popular:true},
  {id:"gst",name:"GST Calculator",desc:"Calculate GST and final price",icon:"🧾",cat:"tax",popular:true},
  {id:"fd",name:"FD Calculator",desc:"Fixed deposit maturity and interest",icon:"🏦",cat:"financial",popular:true},
  {id:"rd",name:"RD Calculator",desc:"Recurring deposit maturity estimate",icon:"💰",cat:"financial",popular:true},
  {id:"percentage",name:"Percentage Calculator",desc:"Find percentages and changes",icon:"％",cat:"other",popular:true},
  {id:"compound",name:"Compound Interest",desc:"Estimate compound growth over time",icon:"📊",cat:"financial",popular:false}
];

const categories = [
  {id:"financial",icon:"🏦",name:"Financial",desc:"SIP, FD, RD & interest"},
  {id:"loan",icon:"🏠",name:"Loan & EMI",desc:"Loan payments and costs"},
  {id:"health",icon:"❤️",name:"Health",desc:"BMI and body metrics"},
  {id:"date",icon:"🎂",name:"Age & Date",desc:"Age and date calculations"},
  {id:"tax",icon:"🧾",name:"Tax & GST",desc:"Tax and price calculations"},
  {id:"education",icon:"🎓",name:"Education & Math",desc:"Useful maths tools"},
  {id:"unit",icon:"⇄",name:"Unit & Conversion",desc:"Conversions coming soon"},
  {id:"other",icon:"⚙️",name:"Other Tools",desc:"Percentage and more"}
];

const money = (value) => "₹" + Math.round(Number(value) || 0).toLocaleString("en-IN");
const number = (value) => Number(value);
const safe = (value) => String(value).replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function renderPopular(list = calculators.filter(c => c.popular)) {
  const grid = $("#popularGrid");
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = '<div class="empty-state">No calculators found. Try another search.</div>';
    return;
  }

  grid.innerHTML = list.map(c => `
    <button class="calc-card" type="button" data-open="${c.id}">
      <span class="calc-icon ${c.cat === "financial" ? "green" : c.cat === "tax" ? "orange" : c.cat === "health" ? "pink" : c.cat === "date" ? "purple" : ""}">${c.icon}</span>
      <span class="calc-info"><strong>${safe(c.name)}</strong><p>${safe(c.desc)}</p></span>
      <span class="calc-arrow">↗</span>
    </button>
  `).join("");
}

function renderCategories() {
  const grid = $("#categoryGrid");
  if (!grid) return;

  grid.innerHTML = categories.map(c => `
    <button class="category-card" type="button" data-category="${c.id}">
      <span class="category-icon">${c.icon}</span>
      <strong>${safe(c.name)}</strong>
      <small>${safe(c.desc)}</small>
    </button>
  `).join("");
}

function readHistory() {
  try {
    const data = JSON.parse(localStorage.getItem("calcusiteHistory") || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHistory(item) {
  const history = readHistory();
  history.unshift({...item, time:new Date().toISOString()});
  try {
    localStorage.setItem("calcusiteHistory", JSON.stringify(history.slice(0,30)));
  } catch {}
  renderHistory();
}

function renderHistory() {
  const list = $("#recentList");
  if (!list) return;

  const history = readHistory();
  if (!history.length) {
    list.innerHTML = '<div class="empty-state">Your calculations will appear here after you use a calculator.</div>';
    return;
  }

  list.innerHTML = history.slice(0,8).map(item => {
    const date = new Date(item.time);
    const dateText = Number.isNaN(date.getTime()) ? "" :
      date.toLocaleString("en-IN", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
    return `
      <article class="history-row">
        <span class="history-symbol">✓</span>
        <div class="history-content">
          <strong>${safe(item.name)}</strong>
          <p>${safe(item.result)}</p>
        </div>
        <time>${safe(dateText)}</time>
      </article>`;
  }).join("");
}

function fieldsFor(id) {
  const field = (name,label,value,type="number",step="any",min="0") => ({
    name,label,value,type,step,min
  });

  const definitions = {
    emi:[
      field("amount","Loan Amount (₹)",1000000),
      field("rate","Annual Interest Rate (%)",8.5,"number","0.01"),
      field("years","Loan Tenure (Years)",20,"number","1","1")
    ],
    loan:[
      field("amount","Loan Amount (₹)",500000),
      field("rate","Annual Interest Rate (%)",10,"number","0.01"),
      field("years","Loan Tenure (Years)",5,"number","1","1")
    ],
    sip:[
      field("monthly","Monthly Investment (₹)",5000),
      field("rate","Expected Annual Return (%)",12,"number","0.1"),
      field("years","Investment Period (Years)",15,"number","1","1")
    ],
    bmi:[
      field("weight","Weight (kg)",70,"number","0.1","0.1"),
      field("height","Height (cm)",170,"number","0.1","0.1")
    ],
    age:[
      field("birth","Date of Birth","","date")
    ],
    gst:[
      field("amount","Base Amount (₹)",25000),
      field("rate","GST Rate (%)",18,"number","0.1")
    ],
    fd:[
      field("amount","Deposit Amount (₹)",100000),
      field("rate","Annual Interest Rate (%)",7,"number","0.1"),
      field("years","Deposit Period (Years)",5,"number","1","1"),
      {name:"frequency",label:"Compounding Frequency",type:"select",value:"4",options:[["1","Yearly"],["2","Half-yearly"],["4","Quarterly"],["12","Monthly"]]}
    ],
    rd:[
      field("monthly","Monthly Deposit (₹)",5000),
      field("rate","Annual Interest Rate (%)",6.5,"number","0.1"),
      field("years","Deposit Period (Years)",5,"number","1","1")
    ],
    percentage:[
      field("amount","Value",500),
      field("rate","Percentage (%)",18,"number","0.1")
    ],
    compound:[
      field("amount","Initial Investment (₹)",100000),
      field("rate","Annual Interest Rate (%)",8,"number","0.1"),
      field("years","Investment Period (Years)",10,"number","1","1")
    ]
  };

  return definitions[id] || [];
}

function fieldHTML(f) {
  if (f.type === "select") {
    return `<div class="field"><label for="field-${f.name}">${safe(f.label)}</label>
      <select id="field-${f.name}" name="${f.name}">
      ${f.options.map(o => `<option value="${o[0]}" ${o[0] === f.value ? "selected" : ""}>${safe(o[1])}</option>`).join("")}
      </select></div>`;
  }

  return `<div class="field"><label for="field-${f.name}">${safe(f.label)}</label>
    <input id="field-${f.name}" name="${f.name}" type="${f.type}" ${f.type === "number" ? `min="${f.min}" step="${f.step}"` : ""} value="${safe(f.value)}" ${f.type === "date" ? `max="${new Date().toISOString().slice(0,10)}"` : ""} required>
    ${f.name === "rate" ? '<small>Enter the rate applicable to your calculation.</small>' : ""}
    </div>`;
}

function openCalculator(id) {
  const calc = calculators.find(c => c.id === id);
  if (!calc) return;

  $("#modalTitle").textContent = calc.name;
  $("#modalDescription").textContent = calc.desc + ". Enter your details to calculate an estimate.";
  $("#formFields").innerHTML = fieldsFor(id).map(fieldHTML).join("");
  $("#calculatorResult").innerHTML = "";
  $("#calculatorForm").dataset.type = id;

  $("#calculatorModal").classList.add("show");
  $("#calculatorModal").setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
  $("#modalClose").focus();
}

function closeCalculator() {
  $("#calculatorModal").classList.remove("show");
  $("#calculatorModal").setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}

function readField(name) {
  const input = $(`#field-${name}`);
  return input ? input.value : "";
}

function numericField(name) {
  const input = $(`#field-${name}`);
  const value = input ? Number(input.value) : NaN;
  if (!input || input.value.trim() === "" || !Number.isFinite(value) || value < 0) {
    throw new Error("Please enter valid non-negative values in all fields.");
  }
  return value;
}

function resultHTML(title, value, details = [], ratio = null, note = "") {
  const detailHTML = details.map(d => `
    <div class="result-detail"><span>${safe(d[0])}</span><strong>${safe(d[1])}</strong></div>
  `).join("");

  const bar = ratio ? `
    <div class="result-bar"><span class="principal" style="width:${ratio}%"></span><span class="interest" style="width:${100-ratio}%"></span></div>
    <div class="result-note">Blue: principal / invested amount · Green: interest / estimated returns</div>
  ` : "";

  return `<div class="result-label">${safe(title)}</div>
    <div class="result-value">${safe(value)}</div>
    ${detailHTML ? `<div class="result-details">${detailHTML}</div>` : ""}
    ${bar}
    ${note ? `<p class="result-note">${safe(note)}</p>` : ""}`;
}

function calculate(id) {
  let result = "";
  let summary = "";

  if (id === "emi" || id === "loan") {
    const p = numericField("amount");
    const rate = numericField("rate");
    const years = numericField("years");
    if (p <= 0 || years <= 0) throw new Error("Loan amount and tenure must be greater than zero.");

    const months = Math.round(years * 12);
    const r = rate / 1200;
    const emi = r === 0 ? p / months : p * r * Math.pow(1+r,months) / (Math.pow(1+r,months)-1);
    const total = emi * months;
    const interest = total - p;
    const ratio = total ? Math.min(100,Math.max(0,p/total*100)) : 100;

    result = resultHTML("Estimated Monthly EMI",money(emi),[
      ["Loan principal",money(p)],
      ["Total interest",money(interest)],
      ["Total repayment",money(total)],
      ["Number of instalments",String(months)]
    ],ratio,"EMI is estimated using a standard reducing-balance monthly interest calculation.");
    summary = `Monthly EMI: ${money(emi)} · Total interest: ${money(interest)}`;
  }

  else if (id === "sip") {
    const monthly = numericField("monthly");
    const rate = numericField("rate");
    const years = numericField("years");
    if (monthly <= 0 || years <= 0) throw new Error("Investment and period must be greater than zero.");

    const n = Math.round(years*12);
    const r = Math.pow(1+rate/100,1/12)-1;
    const invested = monthly*n;
    const future = r === 0 ? invested : monthly*(Math.pow(1+r,n)-1)/r;
    const returns = future-invested;
    result = resultHTML("Estimated Future Value",money(future),[
      ["Monthly investment",money(monthly)],
      ["Total invested",money(invested)],
      ["Estimated returns",money(returns)],
      ["Investment period",`${years} years`]
    ],future ? Math.min(100,invested/future*100) : 100,
    "Market-linked returns are not guaranteed. Actual results may vary.");
    summary = `Future value: ${money(future)} · Invested: ${money(invested)}`;
  }

  else if (id === "bmi") {
    const weight = numericField("weight");
    const height = numericField("height")/100;
    if (weight <= 0 || height <= 0) throw new Error("Enter a valid weight and height.");

    const bmi = weight/(height*height);
    let status = "Normal range";
    if (bmi < 18.5) status = "Underweight range";
    else if (bmi >= 25 && bmi < 30) status = "Overweight range";
    else if (bmi >= 30) status = "Obesity range";

    result = resultHTML("Your BMI",bmi.toFixed(1),[
      ["Classification",status],
      ["Weight",`${weight} kg`],
      ["Height",`${(height*100).toFixed(1)} cm`]
    ],null,"BMI is a screening measure, not a medical diagnosis.");
    summary = `BMI: ${bmi.toFixed(1)} · ${status}`;
  }

  else if (id === "age") {
    const raw = readField("birth");
    if (!raw) throw new Error("Please select your date of birth.");
    const birth = new Date(`${raw}T00:00:00`);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (Number.isNaN(birth.getTime()) || birth > today) throw new Error("Please enter a valid date of birth.");

    let years = today.getFullYear()-birth.getFullYear();
    let months = today.getMonth()-birth.getMonth();
    let days = today.getDate()-birth.getDate();
    if (days < 0) {
      months--;
      days += new Date(today.getFullYear(),today.getMonth(),0).getDate();
    }
    if (months < 0) { years--; months += 12; }

    const totalDays = Math.floor((today-birth)/86400000);
    result = resultHTML("Your Exact Age",`${years} years`,[
      ["Additional months",String(months)],
      ["Additional days",String(days)],
      ["Total days lived",totalDays.toLocaleString("en-IN")]
    ]);
    summary = `Age: ${years} years, ${months} months, ${days} days`;
  }

  else if (id === "gst") {
    const amount = numericField("amount");
    const rate = numericField("rate");
    const tax = amount*rate/100;
    const total = amount+tax;
    result = resultHTML("Final Amount",money(total),[
      ["Base amount",money(amount)],
      [`GST (${rate}%)`,money(tax)],
      ["Final price",money(total)]
    ]);
    summary = `Final amount: ${money(total)} · GST: ${money(tax)}`;
  }

  else if (id === "fd") {
    const p = numericField("amount");
    const rate = numericField("rate");
    const years = numericField("years");
    const n = numericField("frequency");
    if (p <= 0 || years <= 0) throw new Error("Deposit and period must be greater than zero.");

    const maturity = p*Math.pow(1+rate/(100*n),n*years);
    const interest = maturity-p;
    result = resultHTML("Estimated Maturity Amount",money(maturity),[
      ["Principal deposit",money(p)],
      ["Interest earned",money(interest)],
      ["Annual rate",`${rate}%`],
      ["Deposit period",`${years} years`]
    ],maturity ? Math.min(100,p/maturity*100) : 100,
    "Actual bank maturity depends on compounding rules, tax and product terms.");
    summary = `Maturity: ${money(maturity)} · Interest: ${money(interest)}`;
  }

  else if (id === "rd") {
    const monthly = numericField("monthly");
    const rate = numericField("rate");
    const years = numericField("years");
    if (monthly <= 0 || years <= 0) throw new Error("Monthly deposit and period must be greater than zero.");

    const n = Math.round(years*12);
    const r = Math.pow(1+rate/400,1/3)-1;
    const maturity = r === 0 ? monthly*n : monthly*(Math.pow(1+r,n)-1)/r;
    const invested = monthly*n;
    const interest = maturity-invested;
    result = resultHTML("Estimated Maturity Amount",money(maturity),[
      ["Monthly deposit",money(monthly)],
      ["Total deposits",money(invested)],
      ["Estimated interest",money(interest)],
      ["Period",`${years} years`]
    ],maturity ? Math.min(100,invested/maturity*100) : 100,
    "This is an estimate using a periodic deposit-growth model. Bank calculations may differ.");
    summary = `Maturity: ${money(maturity)} · Deposits: ${money(invested)}`;
  }

  else if (id === "percentage") {
    const amount = numericField("amount");
    const rate = numericField("rate");
    const value = amount*rate/100;
    result = resultHTML("Percentage Result",money(value),[
      ["Original value",money(amount)],
      ["Percentage",`${rate}%`],
      ["Value after addition",money(amount+value)]
    ]);
    summary = `${rate}% of ${money(amount)} = ${money(value)}`;
  }

  else if (id === "compound") {
    const p = numericField("amount");
    const rate = numericField("rate");
    const years = numericField("years");
    if (p <= 0 || years <= 0) throw new Error("Principal and period must be greater than zero.");

    const total = p*Math.pow(1+rate/100,years);
    const interest = total-p;
    result = resultHTML("Future Value",money(total),[
      ["Initial investment",money(p)],
      ["Compound interest",money(interest)],
      ["Annual rate",`${rate}%`],
      ["Period",`${years} years`]
    ],total ? Math.min(100,p/total*100) : 100);
    summary = `Future value: ${money(total)} · Interest: ${money(interest)}`;
  }

  $("#calculatorResult").innerHTML = result;
  saveHistory({id,name:calculators.find(c => c.id === id)?.name || id,result:summary});
}

function showCategory(category) {
  const matching = category === "all"
    ? calculators
    : calculators.filter(c => c.cat === category ||
      (category === "education" && ["percentage","compound"].includes(c.id)) ||
      (category === "unit" && c.id === "percentage"));

  $("#welcome").hidden = category !== "all";
  $("#popularSection").hidden = false;

  const heading = $("#popularSection .section-heading h2");
  const kicker = $("#popularSection .section-kicker");
  const desc = $("#popularSection .section-heading p");
  if (heading) heading.textContent = category === "all" ? "🔥 Popular Calculators" :
    `${categories.find(c=>c.id===category)?.name || "All"} Calculators`;
  if (kicker) kicker.textContent = category === "all" ? "GET STARTED" : "BROWSE TOOLS";
  if (desc) desc.textContent = category === "all" ? "Tools people use most often." : "Choose a calculator to get started.";

  renderPopular(matching);
  $("#popularSection").scrollIntoView({behavior:"smooth",block:"start"});
}

function showPage(page) {
  $$(".nav-item").forEach(btn => btn.classList.toggle("active",btn.dataset.page===page));

  if (page === "dashboard") {
    $("#welcome").hidden = false;
    $("#popularSection .section-heading h2").textContent = "🔥 Popular Calculators";
    $("#popularSection .section-kicker").textContent = "GET STARTED";
    $("#popularSection .section-heading p").textContent = "Tools people use most often.";
    renderPopular(calculators.filter(c=>c.popular));
    $("#welcome").scrollIntoView({behavior:"smooth",block:"start"});
  } else if (page === "history") {
    $("#welcome").hidden = true;
    $("#popularSection .section-heading h2").textContent = "◷ Calculation History";
    $("#popularSection .section-heading p").textContent = "Your latest calculations on this device.";
    renderHistory();
    $("#recentList").scrollIntoView({behavior:"smooth",block:"start"});
  } else {
    showCategory(page === "all" ? "all" : page);
  }

  closeMenu();
}

function openMenu() {
  $("#sidebar").classList.add("open");
  $("#overlay").classList.add("show");
}
function closeMenu() {
  $("#sidebar").classList.remove("open");
  $("#overlay").classList.remove("show");
}

document.addEventListener("DOMContentLoaded", () => {
  renderPopular();
  renderCategories();
  renderHistory();

  document.addEventListener("click", event => {
    const calcButton = event.target.closest("[data-open]");
    if (calcButton) {
      openCalculator(calcButton.dataset.open);
      return;
    }

    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      showCategory(categoryButton.dataset.category);
      return;
    }

    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      showPage(pageButton.dataset.page);
    }
  });

  $("#calculatorForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = event.currentTarget.dataset.type;
    try {
      calculate(id);
    } catch (error) {
      $("#calculatorResult").innerHTML =
        `<div class="result-note" role="alert">${safe(error.message || "Please check your inputs and try again.")}</div>`;
    }
  });

  $("#modalClose").addEventListener("click"
