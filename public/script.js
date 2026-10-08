const calculators = [
  {
    name: "EMI Calculator",
    desc: "Loan EMI, interest & amortization",
    icon: "🏠",
    cat: "loan",
    type: "emi"
  },
  {
    name: "SIP Calculator",
    desc: "Plan your monthly investments",
    icon: "🪙",
    cat: "financial",
    type: "sip"
  },
  {
    name: "Loan Calculator",
    desc: "Home, car & personal loan",
    icon: "💰",
    cat: "loan",
    type: "loan"
  },
  {
    name: "BMI Calculator",
    desc: "Check your Body Mass Index",
    icon: "❤️",
    cat: "health",
    type: "bmi"
  },
  {
    name: "Age Calculator",
    desc: "Find your exact age",
    icon: "📅",
    cat: "date",
    type: "age"
  },
  {
    name: "GST Calculator",
    desc: "Calculate GST and final price",
    icon: "🧾",
    cat: "tax",
    type: "gst"
  },
  {
    name: "FD Calculator",
    desc: "Fixed deposit maturity & returns",
    icon: "🏦",
    cat: "financial",
    type: "fd"
  },
  {
    name: "RD Calculator",
    desc: "Recurring deposit calculator",
    icon: "💵",
    cat: "financial",
    type: "rd"
  },
  {
    name: "Percentage Calculator",
    desc: "Easy percentage calculations",
    icon: "%",
    cat: "other",
    type: "percentage"
  }
];

const categories = [
  ["🏦", "Financial", "25+ calculators", "financial"],
  ["❤️", "Health", "10+ calculators", "health"],
  ["🎓", "Education", "10+ calculators", "education"],
  ["🔄", "Unit & Conversion", "15+ calculators", "unit"],
  ["📅", "Date & Time", "10+ calculators", "date"],
  ["%", "Tax & GST", "8+ calculators", "tax"],
  ["🔢", "Math Tools", "15+ calculators", "other"],
  ["⚙️", "Other Tools", "10+ calculators", "other"]
];

function $(id) {
  return document.getElementById(id);
}

/* =========================
   POPULAR CALCULATORS
========================= */

function renderPopular(list) {
  const grid = $("popularGrid");

  if (!grid) return;

  const items = list || calculators.slice(0, 9);

  grid.innerHTML = items.map((c, index) => `
    <div class="calc-card" data-type="${c.type}" data-name="${c.name}">
      <div class="calc-icon ${["blue","green","orange","purple","pink"][index % 5]}">
        ${c.icon}
      </div>

      <div class="calc-info">
        <h3>${c.name}</h3>
        <p>${c.desc}</p>
      </div>

      <button class="calc-arrow" aria-label="Open ${c.name}">
        →
      </button>
    </div>
  `).join("");

  grid.querySelectorAll(".calc-card").forEach(card => {
    card.addEventListener("click", () => {
      openCalculator(card.dataset.type, card.dataset.name);
    });
  });
}

/* =========================
   CATEGORIES
========================= */

function renderCategories() {
  const grid = $("categoryGrid");

  if (!grid) return;

  grid.innerHTML = categories.map(category => `
    <button
      class="category"
      data-section="${category[3]}"
      type="button"
    >
      <div class="category-icon">
        ${category[0]}
      </div>

      <div>
        <h3>${category[1]}</h3>
        <p>${category[2]}</p>
      </div>

      <span>→</span>
    </button>
  `).join("");

  grid.querySelectorAll(".category").forEach(card => {
    card.addEventListener("click", () => {
      filterCategory(card.dataset.section);
    });
  });
}

/* =========================
   CATEGORY FILTER
========================= */

function filterCategory(category) {
  const result = calculators.filter(c => c.cat === category);

  renderPopular(result);

  const heading = document.querySelector(".section-head h2");

  if (heading) {
    heading.textContent = "Calculators";
  }

  window.scrollTo({
    top: 350,
    behavior: "smooth"
  });
}

/* =========================
   CALCULATOR MODAL
========================= */

function openCalculator(type, name) {
  const modal = $("calculatorModal");
  const modalBody = $("modalBody");

  if (!modal || !modalBody) return;

  const forms = {

    emi: `
      <h2>${name}</h2>
      <p>Calculate your monthly loan EMI.</p>

      <div class="form-grid">
        <label>
          Loan Amount (₹)
          <input id="emiAmount" type="number" value="1000000">
        </label>

        <label>
          Annual Interest Rate (%)
          <input id="emiRate" type="number" value="8.5" step="0.1">
        </label>

        <label>
          Tenure (Years)
          <input id="emiYears" type="number" value="20">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate EMI
      </button>

      <div id="calculatorResult" class="result"></div>
    `,

    bmi: `
      <h2>${name}</h2>
      <p>Calculate your Body Mass Index.</p>

      <div class="form-grid">
        <label>
          Weight (kg)
          <input id="bmiWeight" type="number" value="70">
        </label>

        <label>
          Height (cm)
          <input id="bmiHeight" type="number" value="170">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate BMI
      </button>

      <div id="calculatorResult" class="result"></div>
    `,

    gst: `
      <h2>${name}</h2>
      <p>Calculate GST amount and final price.</p>

      <div class="form-grid">
        <label>
          Amount (₹)
          <input id="gstAmount" type="number" value="25000">
        </label>

        <label>
          GST Rate (%)
          <input id="gstRate" type="number" value="18">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate GST
      </button>

      <div id="calculatorResult" class="result"></div>
    `,

    percentage: `
      <h2>${name}</h2>
      <p>Calculate percentage easily.</p>

      <div class="form-grid">
        <label>
          Value
          <input id="percentValue" type="number" value="500">
        </label>

        <label>
          Percentage (%)
          <input id="percentRate" type="number" value="18">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate
      </button>

      <div id="calculatorResult" class="result"></div>
    `,

    sip: `
      <h2>${name}</h2>
      <p>Estimate your SIP investment value.</p>

      <div class="form-grid">
        <label>
          Monthly SIP (₹)
          <input id="sipAmount" type="number" value="5000">
        </label>

        <label>
          Annual Return (%)
          <input id="sipRate" type="number" value="12">
        </label>

        <label>
          Years
          <input id="sipYears" type="number" value="15">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate SIP
      </button>

      <div id="calculatorResult" class="result"></div>
    `,

    loan: `
      <h2>${name}</h2>
      <p>Calculate your loan EMI.</p>

      <div class="form-grid">
        <label>
          Loan Amount (₹)
          <input id="loanAmount" type="number" value="500000">
        </label>

        <label>
          Interest Rate (%)
          <input id="loanRate" type="number" value="10">
        </label>

        <label>
          Years
          <input id="loanYears" type="number" value="5">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate Loan
      </button>

      <div id="calculatorResult" class="result"></div>
    `,

    fd: `
      <h2>${name}</h2>
      <p>Calculate fixed deposit maturity.</p>

      <div class="form-grid">
        <label>
          Principal (₹)
          <input id="fdAmount" type="number" value="100000">
        </label>

        <label>
          Annual Rate (%)
          <input id="fdRate" type="number" value="7">
        </label>

        <label>
          Years
          <input id="fdYears" type="number" value="5">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate FD
      </button>

      <div id="calculatorResult" class="result"></div>
    `,

    age: `
      <h2>${name}</h2>
      <p>Enter your date of birth.</p>

      <div class="form-grid">
        <label>
          Date of Birth
          <input id="birthDate" type="date">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate Age
      </button>

      <div id="calculatorResult" class="result"></div>
    `,

    rd: `
      <h2>${name}</h2>
      <p>Recurring deposit calculator.</p>

      <div class="form-grid">
        <label>
          Monthly Deposit (₹)
          <input id="rdAmount" type="number" value="5000">
        </label>

        <label>
          Annual Rate (%)
          <input id="rdRate" type="number" value="7">
        </label>

        <label>
          Years
          <input id="rdYears" type="number" value="5">
        </label>
      </div>

      <button class="primary-btn" id="calculateBtn">
        Calculate RD
      </button>

      <div id="calculatorResult" class="result"></div>
    `
  };

  modalBody.innerHTML =
    forms[type] ||
    `<h2>${name}</h2><p>This calculator will be added soon.</p>`;

  modal.classList.add("show");

  const btn = $("calculateBtn");

  if (btn) {
    btn.addEventListener("click", () => calculate(type, name));
  }
}

/* =========================
   CALCULATIONS
========================= */

function calculate(type, name) {
  let result = "";

  if (type === "emi") {
    const p = Number($("emiAmount").value);
    const rate = Number($("emiRate").value) / 12 / 100;
    const months = Number($("emiYears").value) * 12;

    const emi =
      rate === 0
        ? p / months
        : p * rate * Math.pow(1 + rate, months) /
          (Math.pow(1 + rate, months) - 1);

    result = `Monthly EMI: ₹${emi.toLocaleString("en-IN", {
      maximumFractionDigits: 0
    })}`;
  }

  else if (type === "bmi") {
    const weight = Number($("bmiWeight").value);
    const height = Number($("bmiHeight").value) / 100;

    const bmi = weight / (height * height);

    let status = "Normal";

    if (bmi < 18.5) status = "Underweight";
    else if (bmi >= 25 && bmi < 30) status = "Overweight";
    else if (bmi >= 30) status = "Obesity";

    result = `BMI: ${bmi.toFixed(1)} — ${status}`;
  }

  else if (type === "gst") {
    const amount = Number($("gstAmount").value);
    const rate = Number($("gstRate").value);

    const gst = amount * rate / 100;
    const total = amount + gst;

    result =
      `GST: ₹${gst.toLocaleString("en-IN", {
        maximumFractionDigits: 2
      })}<br>` +
      `Total: ₹${total.toLocaleString("en-IN", {
        maximumFractionDigits: 2
      })}`;
  }

  else if (type === "percentage") {
    const value = Number($("percentValue").value);
    const rate = Number($("percentRate").value);

    const answer = value * rate / 100;

    result = `${rate}% of ${value} = ${answer}`;
  }

  else if (type === "sip") {
    const monthly = Number($("sipAmount").value);
    const annualRate = Number($("sipRate").value);
    const years = Number($("sipYears").value);

    const months = years * 12;
    const monthlyRate = annualRate / 12 / 100;

    const futureValue =
      monthly *
      (((Math.pow(1 + monthlyRate, months) - 1) /
        monthlyRate) *
        (1 + monthlyRate));

    result = `Estimated Value: ₹${futureValue.toLocaleString("en-IN", {
      maximumFractionDigits: 0
    })}`;
  }

  else if (type === "loan") {
    const p = Number($("loanAmount").value);
    const rate = Number($("loanRate").value) / 12 / 100;
    const months = Number($("loanYears").value) * 12;

    const emi =
      rate === 0
        ? p / months
        : p * rate * Math.pow(1 + rate, months) /
          (Math.pow(1 + rate, months) - 1);

    result = `Monthly EMI: ₹${emi.toLocaleString("en-IN", {
      maximumFractionDigits: 0
    })}`;
  }

  else if (type === "fd") {
    const p = Number($("fdAmount").value);
    const rate = Number($("fdRate").value) / 100;
    const years = Number($("fdYears").value);

    const maturity = p * Math.pow(1 + rate, years);

    result = `Maturity Amount: ₹${maturity.toLocaleString("en-IN", {
      maximumFractionDigits: 0
    })}`;
  }

  else if (type === "rd") {
    const monthly = Number($("rdAmount").value);
    const rate = Number($("rdRate").value) / 100;
    const years = Number($("rdYears").value);

    const months = years * 12;
    const monthlyRate = rate / 12;

    const maturity =
      monthly *
      months +
      monthly *
      (months * (months + 1) / 2) *
      monthlyRate;

    result = `Approx. Maturity: ₹${maturity.toLocaleString("en-IN", {
      maximumFractionDigits: 0
    })}`;
  }

  else if (type === "age") {
    const dob = new Date($("birthDate").value);
    const today = new Date();

    if (!isNaN(dob.getTime())) {
      let age = today.getFullYear() - dob.getFullYear();

      const monthDiff = today.getMonth() - dob.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < dob.getDate())
      ) {
        age--;
      }

      result = `Your age is approximately ${age} years.`;
    } else {
      result = "Please select your date of birth.";
    }
  }

  const output = $("calculatorResult");

  if (output) {
    output.innerHTML = result;
  }

  saveRecent(name, result);
}

/* =========================
   RECENT CALCULATIONS
========================= */

function saveRecent(name, value) {
  const rows = JSON.parse(
    localStorage.getItem("calcRecent") || "[]"
  );

  rows.unshift({
    name,
    value: String(value).replace(/<[^>]*>/g, ""),
    time: new Date().toLocaleString("en-IN")
  });

  localStorage.setItem(
    "calcRecent",
    JSON.stringify(rows.slice(0, 6))
  );

  renderRecent();
}

function renderRecent() {
  const list = $("recentList");

  if (!list) return;

  const rows = JSON.parse(
    localStorage.getItem("calcRecent") || "[]"
  );

  if (!rows.length) {
    list.innerHTML = `
      <div class="recent-row">
        <div class="r-icon">◷</div>
        <div>
          <strong>No recent calculations</strong>
          <p>Your recent calculations will appear here.</p>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map(row => `
    <div class="recent-row">
      <div class="r-icon">✓</div>
      <div>
        <strong>${row.name}</strong>
        <p>${row.value}</p>
        <small>${row.time}</small>
      </div>
    </div>
  `).join("");
}

/* =========================
   NAVIGATION
========================= */

function navigate(section) {
  if (section === "ai") {
    const input = $("aiInput");

    if (input) input.focus();

    window.scrollTo({
      top: 700,
      behavior: "smooth"
    });

    return;
  }

  if (section === "calculators") {
    renderPopular(calculators);

    window.scrollTo({
      top: 350,
      behavior: "smooth"
    });

    return;
  }

  if (section) {
    filterCategory(section);
  }
}

/* =========================
   START WEBSITE
========================= */

document.addEventListener("DOMContentLoaded", () => {

  /* Render cards immediately */
  renderPopular();
  renderCategories();
  renderRecent();

  /* Navigation buttons */
  document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => {
      navigate(button.dataset.section);
    });
  });

  /* Search */
  const search = $("searchInput");

  if (search) {
    search.addEventListener("input", event => {
      const query = event.target.value
        .toLowerCase()
        .trim();

      const result = calculators.filter(c =>
        `${c.name} ${c.desc} ${c.cat}`
          .toLowerCase()
          .includes(query)
      );

      renderPopular(
        query ? result : calculators.slice(0, 9)
      );
    });
  }

  /* Close modal */
  const modal = $("calculatorModal");
  const close = $("modalClose");

  if (close && modal) {
    close.addEventListener("click", () => {
      modal.classList.remove("show");
    });
  }

  /* Mobile menu */
  const mobileMenu = $("mobileMenu");
  const sidebar = $("sidebar");

  if (mobileMenu && sidebar) {
    mobileMenu.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  /* Dark mode */
  const themeBtn = $("themeBtn");

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
    });
  }

  /* AI suggestions */
  document.querySelectorAll(".chips button").forEach(button => {
    button.addEventListener("click", () => {
      const input = $("aiInput");

      if (input) {
        input.value = button.textContent.trim();
        input.focus();
      }
    });
  });

  /* AI button */
  const aiButton = $("aiSend");
  const aiInput = $("aiInput");

  if (aiButton && aiInput) {
    aiButton.addEventListener("click", () => {

      const question = aiInput.value.trim();

      if (!question) {
        aiInput.focus();
        return;
      }

      alert(
        "AI Assistant backend next stage mein securely connect kiya jayega."
      );
    });
  }

});
