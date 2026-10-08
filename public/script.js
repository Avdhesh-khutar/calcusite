const display = document.getElementById("display");
const expression = document.getElementById("expression");
const themeBtn = document.getElementById("themeBtn");

let current = "0";
let previous = "";
let operator = null;
let resetNext = false;

function render() {
  display.value = current;
  expression.textContent = previous && operator
    ? `${previous} ${symbol(operator)}`
    : "";
}

function symbol(op) {
  return op === "*" ? "×" : op === "/" ? "÷" : op;
}

function inputNumber(value) {
  if (resetNext || current === "Error") {
    current = "0";
    resetNext = false;
  }

  if (value === "." && current.includes(".")) return;

  if (current === "0" && value !== ".") {
    current = value;
  } else {
    current += value;
  }

  render();
}

function chooseOperator(op) {
  if (current === "Error") return;

  if (operator && !resetNext) {
    calculate();
  }

  previous = current;
  operator = op;
  resetNext = true;
  render();
}

function calculate() {
  if (!operator || previous === "") return;

  const a = Number(previous);
  const b = Number(current);
  let result;

  if (operator === "+") result = a + b;
  if (operator === "-") result = a - b;
  if (operator === "*") result = a * b;
  if (operator === "/") result = b === 0 ? NaN : a / b;

  if (!Number.isFinite(result)) {
    current = "Error";
  } else {
    current = String(Number(result.toFixed(10)));
  }

  previous = "";
  operator = null;
  resetNext = true;
  render();
}

function percent() {
  if (current === "Error") return;
  current = String(Number(current) / 100);
  render();
}

function clearAll() {
  current = "0";
  previous = "";
  operator = null;
  resetNext = false;
  render();
}

function deleteLast() {
  if (resetNext || current === "Error") {
    clearAll();
    return;
  }

  current = current.length > 1 ? current.slice(0, -1) : "0";
  render();
}

document.querySelector(".keys").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const value = button.dataset.value;
  const action = button.dataset.action;

  if (value !== undefined) {
    if (/^\d$/.test(value) || value === ".") inputNumber(value);
    else if (["+", "-", "*", "/"].includes(value)) chooseOperator(value);
    else if (value === "%") percent();
  }

  if (action === "clear") clearAll();
  if (action === "delete") deleteLast();
  if (action === "calculate") calculate();
});

document.addEventListener("keydown", (event) => {
  const key = event.key;

  if (/^\d$/.test(key) || key === ".") inputNumber(key);
  else if (["+", "-", "*", "/"].includes(key)) chooseOperator(key);
  else if (key === "%") percent();
  else if (key === "Enter" || key === "=") calculate();
  else if (key === "Backspace") deleteLast();
  else if (key === "Escape") clearAll();
});

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeBtn.textContent = document.body.classList.contains("dark") ? "☀" : "☾";
});

render();
