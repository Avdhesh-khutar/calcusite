$("#modalClose").addEventListener("click", closeCalculator);

  $("#calculatorModal").addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) {
      closeCalculator();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCalculator();
      closeMenu();
    }
  });

  $("#heroEmi").addEventListener("click", () => {
    openCalculator("emi");
  });

  $("#searchInput").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();

    const matching = calculators.filter((calculator) =>
      `${calculator.name} ${calculator.desc} ${calculator.cat}`
        .toLowerCase()
        .includes(query)
    );

    $("#welcome").hidden = query.length > 0;

    const heading = $("#popularSection .section-heading h2");
    if (heading) {
      heading.textContent = query
        ? "Search Results"
        : "🔥 Popular Calculators";
    }

    renderPopular(query ? matching : calculators.filter(c => c.popular));
  });

  $("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });

  $("#menuToggle").addEventListener("click", openMenu);
  $("#closeMenu").addEventListener("click", closeMenu);
  $("#overlay").addEventListener("click", closeMenu);

  $("#aiInfo").addEventListener("click", () => {
    showToast("AI Assistant ko activate karne ke liye secure backend connect karna hoga.");
  });
});
