let chartInstance = null;
let lastParsedData = [];

// Fix: Apply saved theme correctly on load
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.classList.remove("dark-mode", "light-mode");
  document.body.classList.add(`${savedTheme}-mode`);
  const logo = document.getElementById("logo");
  if (logo) logo.src = savedTheme === "dark" ? "logo-dark.png" : "logo-light.png";
});

document.getElementById("toggle-theme").addEventListener("click", () => {
  const current = localStorage.getItem("theme") || "light";
  const newMode = current === "dark" ? "light" : "dark";
  localStorage.setItem("theme", newMode);
  document.body.classList.remove("dark-mode", "light-mode");
  document.body.classList.add(`${newMode}-mode`);
  document.getElementById("logo").src = newMode === "dark" ? "logo-dark.png" : "logo-light.png";
  renderChart(document.getElementById("chartType").value);
});

document.getElementById("reset").addEventListener("click", () => {
  document.getElementById("upload").value = "";
  document.getElementById("output").innerHTML = "";
  const chart = document.getElementById("chart");
  chart.style.display = "none";
  chart.style.border = "none";
  if (chartInstance) chartInstance.destroy();
  chartInstance = null;
  lastParsedData = [];
  document.getElementById("filterKeyword").value = "";
  document.getElementById("viewMode").value = "file";
});

document.getElementById("generate").addEventListener("click", () => {
  document.getElementById("output").innerHTML = "";
  lastParsedData = [];

  const keywordList = document.getElementById("keywords").value.split(/\r?\n/).map(k => k.trim()).filter(k => k);
  const files = document.getElementById("upload").files;

  if (!files.length) {
    alert("Please upload at least one .docx file.");
    return;
  }

  const allKeywordsSet = new Set();

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = async function(event) {
      const arrayBuffer = event.target.result;

      mammoth.extractRawText({ arrayBuffer }).then(result => {
        const text = result.value;
        const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

        const summary = {};
        const results = [];

        sentences.forEach((sentence, idx) => {
          keywordList.forEach(keyword => {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = keyword.includes(" ")
              ? new RegExp("(" + escaped + ")", "gi")
              : new RegExp("\\b(" + escaped + ")\\b", "gi");

            if (regex.test(sentence)) {
              summary[keyword] = summary[keyword] || [];
              summary[keyword].push(idx + 1);
              const highlighted = sentence.replace(regex, "<span class='highlight'>$1</span>");
              results.push({ page: idx + 1, raw: sentence, html: highlighted, keyword });
              allKeywordsSet.add(keyword);
            }
          });
        });

        lastParsedData.push({ filename: file.name, summary, results });
        updateFilterOptions(Array.from(allKeywordsSet).sort());
        renderChart(document.getElementById("chartType").value);
        renderOutput();
      });
    };
    reader.readAsArrayBuffer(file);
  });
});

document.getElementById("download-pdf").addEventListener("click", () => {
  renderChart(document.getElementById("chartType").value, true, () => {
    const chartCanvas = document.getElementById("chart");
    const chartImg = chartCanvas.toDataURL("image/png");

    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      alert("Popup blocker prevented opening the print window.");
      return;
    }

    const doc = printWindow.document;
    doc.write("<html><head><title>Keyword Summary</title><style>");
    doc.write(`
      body { font-family: Arial, sans-serif; padding: 2em; color: #000; background: #fff; }
      h1 { margin-top: 0; }
      ul { padding-left: 1.2em; }
      li { margin-bottom: 0.5em; }
      .highlight { background: yellow; font-weight: bold; color: red; }
      .section { margin-bottom: 2em; }
      img { width: 80%; max-width: 600px; display: block; margin: 2em auto 1em auto; }
    `);
    doc.write("</style></head><body>");
    doc.write("<h1>Keyword Summary Report</h1>");
    doc.write(`<img src="${chartImg}" alt="Chart">`);
    doc.write(document.getElementById("output").innerHTML);
    doc.write("</body></html>");
    doc.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  });
});

document.getElementById("chartType").addEventListener("change", (e) => {
  renderChart(e.target.value);
});

document.getElementById("filterKeyword").addEventListener("change", renderOutput);
document.getElementById("viewMode").addEventListener("change", renderOutput);

function updateFilterOptions(keywordList) {
  const select = document.getElementById("filterKeyword");
  select.innerHTML = `<option value="">(Show All Keywords)</option>`;
  keywordList.forEach(k => {
    const option = document.createElement("option");
    option.value = k;
    option.textContent = k;
    select.appendChild(option);
  });
}

function renderChart(type, forceLightMode = false, onComplete = null) {
  if (!lastParsedData.length) return;

  const ctx = document.getElementById("chart").getContext("2d");
  const chartCanvas = document.getElementById("chart");
  chartCanvas.style.display = "block";
  chartCanvas.style.border = "1px solid #ccc";
  chartCanvas.style.marginBottom = "3em";

  if (chartInstance) chartInstance.destroy();

  const keywordCounts = {};
  lastParsedData.forEach(file => {
    Object.entries(file.summary).forEach(([keyword, pages]) => {
      keywordCounts[keyword] = (keywordCounts[keyword] || 0) + pages.length;
    });
  });

  const sortedEntries = Object.entries(keywordCounts).sort(([a], [b]) => a.localeCompare(b));
  const keywords = sortedEntries.map(([k]) => k);
  const counts = sortedEntries.map(([, v]) => v);
  const total = counts.reduce((a, b) => a + b, 0);
  const isDark = document.body.classList.contains("dark-mode");
  const actualType = type === "bar" && keywords.length > 6 ? "bar" : type;
  const indexAxis = actualType === "bar" && keywords.length > 6 ? 'y' : 'x';

  const pastelColor = (i, total) => {
    const hue = (360 * i / total);
    return `hsl(${hue}, 80%, 75%)`;
  };

  const backgroundColor = keywords.map((_, i) => pastelColor(i, keywords.length));
  const borderColor = (actualType === "pie" || actualType === "bar") ? (isDark ? "#fff" : "#000") : null;

  Chart.register(ChartDataLabels);

  chartInstance = new Chart(ctx, {
    type: actualType,
    data: {
      labels: keywords,
      datasets: [{
        label: "Keyword Matches",
        data: counts,
        backgroundColor,
        borderColor,
        borderWidth: 1
      }]
    },
    options: {
      indexAxis,
      responsive: true,
      animation: {
        onComplete: () => {
          if (typeof onComplete === "function") onComplete();
        }
      },
      layout: {
        padding: {
          top: 20,
          bottom: actualType === "pie" ? 40 : 10
        }
      },
      scales: actualType === "pie" ? {} : {
        x: {
          ticks: {
            color: isDark ? "#fff" : "#000"
          },
          grid: {
            color: isDark ? "#444" : "#ccc"
          }
        },
        y: {
          ticks: {
            color: isDark ? "#fff" : "#000"
          },
          grid: {
            color: isDark ? "#444" : "#ccc"
          }
        }
      },
      plugins: {
        legend: {
          display: actualType === "pie",
          position: "bottom",
          labels: {
            color: isDark ? "#fff" : "#000"
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const count = ctx.raw;
              const percent = ((count / total) * 100).toFixed(1);
              return `${ctx.label}: ${count} match(es) (${percent}%)`;
            }
          }
        },
        datalabels: {
          color: isDark ? "#fff" : "#000",
          anchor: actualType === "pie" ? "end" : "end",
          align: actualType === "pie" ? "end" : "right",
          offset: actualType === "pie" ? 8 : 0,
          font: { weight: "bold" },
          formatter: (value, ctx) => {
            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percent = (value / sum) * 100;
            return percent < 5 ? '' : `${value} (${percent.toFixed(1)}%)`;
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

function renderOutput() {
  const output = document.getElementById("output");
  output.innerHTML = "";
  const filter = document.getElementById("filterKeyword").value;
  const viewMode = document.getElementById("viewMode").value;

  if (viewMode === "file") {
    lastParsedData.forEach(file => {
      const section = document.createElement("div");
      section.classList.add("file-section");
      section.innerHTML = `<h2>Results for: ${file.filename}</h2>`;

      const summaryData = Object.entries(file.summary).filter(([k]) => !filter || k === filter);
      const resultData = file.results.filter(entry => !filter || entry.keyword === filter);

      let summaryHTML = "<div class='summary'><h3>Summary</h3>";
      summaryHTML += summaryData.length
        ? "<ul>" + summaryData.map(([keyword, pages]) =>
            `<li><strong>${keyword}</strong> — ${pages.length} match(es) (Sentences ${[...new Set(pages)].join(", ")})</li>`).join("") + "</ul>"
        : "<p>No results found.</p>";
      summaryHTML += "</div>";

      let resultsHTML = "<div class='results'><h3>Matched Sentences</h3><ul>";
      resultsHTML += resultData.map(entry =>
        `<li class="result-sentence"><strong>Sentence ${entry.page}:</strong> “${entry.html}”</li>`).join("");
      resultsHTML += "</ul></div>";

      section.innerHTML += summaryHTML + (resultData.length ? resultsHTML : "");
      output.appendChild(section);
    });
  }
}
