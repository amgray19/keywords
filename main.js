let chartInstance = null;
let lastParsedData = [];

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
  const output = document.getElementById("output");
  output.innerHTML = "";
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
        renderChart(document.getElementById("chartType").value, false); // normal render
        renderOutput();
      });
    };
    reader.readAsArrayBuffer(file);
  });
});

document.getElementById("download-pdf").addEventListener("click", () => {
  renderChart(document.getElementById("chartType").value, true); // light-mode chart for export

  setTimeout(() => {
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      alert("Popup blocker prevented opening the print window.");
      return;
    }

    const doc = printWindow.document;
    const chartImgData = document.getElementById("chart").toDataURL("image/png");

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
    doc.write(`<img src="${chartImgData}" alt="Chart">`);
    doc.write(document.getElementById("output").innerHTML);
    doc.write("</body></html>");
    doc.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }, 300); // delay to allow chart re-render
});

document.getElementById("chartType").addEventListener("change", e => {
  renderChart(e.target.value, false);
});
document.getElementById("filterKeyword").addEventListener("change", renderOutput);
document.getElementById("viewMode").addEventListener("change", renderOutput);

document.getElementById("toggle-theme").addEventListener("click", () => {
  const current = localStorage.getItem("theme") || "light";
  const newMode = current === "dark" ? "light" : "dark";
  localStorage.setItem("theme", newMode);
  document.body.classList.remove("dark-mode", "light-mode");
  document.body.classList.add(`${newMode}-mode`);
  renderChart(document.getElementById("chartType").value, false);
});

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

function renderChart(type, forceLightMode = false) {
  if (!lastParsedData.length) return;

  const ctx = document.getElementById("chart").getContext("2d");
  const chartCanvas = document.getElementById("chart");
  chartCanvas.style.display = "block";
  chartCanvas.style.border = "1px solid #ccc";

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

  const actualType = type === "bar" && keywords.length > 6 ? "bar" : type;
  const indexAxis = actualType === "bar" && keywords.length > 6 ? 'y' : 'x';

  const pastelColor = (i, total) => {
    const hue = (360 * i / total);
    return `hsl(${hue}, 80%, 75%)`;
  };
  const backgroundColor = keywords.map((_, i) => pastelColor(i, keywords.length));

  Chart.register(ChartDataLabels);

  chartInstance = new Chart(ctx, {
    type: actualType,
    data: {
      labels: keywords,
      datasets: [{
        label: "Keyword Matches",
        data: counts,
        backgroundColor
      }]
    },
    options: {
      indexAxis,
      responsive: true,
      layout: {
        padding: { top: 20 }
      },
      plugins: {
        legend: {
          display: actualType === "pie",
          position: "bottom"
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
          color: () => {
            const mode = forceLightMode ? "light" : (document.body.classList.contains("dark-mode") ? "dark" : "light");
            return mode === "dark" ? "#fff" : "#000";
          },
          anchor: actualType === "pie" ? "end" : "end",
          align: actualType === "pie" ? "start" : "right",
          offset: actualType === "pie" ? -10 : 0,
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

      const summaryData = Object.entries(file.summary).filter(([k, _]) => !filter || k === filter);
      const resultData = file.results.filter(entry => !filter || entry.keyword === filter);

      let summaryHTML = "<div class='summary'><h3>Summary</h3>";
      if (summaryData.length === 0) {
        summaryHTML += "<p>No results found.</p>";
      } else {
        summaryHTML += "<ul>";
        summaryData.forEach(([keyword, pages]) => {
          const pageStr = [...new Set(pages)].join(", ");
          summaryHTML += `<li><strong>${keyword}</strong> — ${pages.length} match(es) (Sentences ${pageStr})</li>`;
        });
        summaryHTML += "</ul>";
      }
      summaryHTML += "</div>";

      let resultsHTML = "<div class='results'><h3>Matched Sentences</h3><ul>";
      resultData.forEach(entry => {
        resultsHTML += `<li class="result-sentence"><strong>Sentence ${entry.page}:</strong> “${entry.html}”</li>`;
      });
      resultsHTML += "</ul></div>";

      section.innerHTML += summaryHTML + (resultData.length ? resultsHTML : "");
      output.appendChild(section);
    });
  } else {
    const keywordMap = {};
    lastParsedData.forEach(file => {
      file.results.forEach(entry => {
        if (!filter || entry.keyword === filter) {
          keywordMap[entry.keyword] = keywordMap[entry.keyword] || [];
          keywordMap[entry.keyword].push({ ...entry, file: file.filename });
        }
      });
    });

    if (Object.keys(keywordMap).length === 0) {
      const section = document.createElement("div");
      section.classList.add("file-section");
      section.innerHTML = `<h2>Results by Keyword</h2><div class='summary'><p>No results found.</p></div>`;
      output.appendChild(section);
      return;
    }

    Object.entries(keywordMap).forEach(([keyword, entries]) => {
      const section = document.createElement("div");
      section.classList.add("file-section");
      section.innerHTML = `<h2>Results for: ${keyword}</h2>`;

      const summaryHTML = `<div class='summary'><h3>Summary</h3><ul><li><strong>${keyword}</strong> — ${entries.length} match(es) across ${new Set(entries.map(e => e.file)).size} file(s)</li></ul></div>`;

      let resultsHTML = "<div class='results'><h3>Matched Sentences</h3><ul>";
      entries.forEach(entry => {
        resultsHTML += `<li class="result-sentence"><strong>Sentence ${entry.page}:</strong> [${entry.file}] “${entry.html}”</li>`;
      });
      resultsHTML += "</ul></div>";

      section.innerHTML += summaryHTML + resultsHTML;
      output.appendChild(section);
    });
  }
}
