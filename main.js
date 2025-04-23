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
        renderChart(document.getElementById("chartType").value);
        renderOutput();
      });
    };
    reader.readAsArrayBuffer(file);
  });
});

document.getElementById("download-pdf").addEventListener("click", () => {
  const printWindow = window.open("", "_blank", "width=900,height=1000");

  if (!printWindow) {
    alert("Popup blocker prevented opening the print window.");
    return;
  }

  const doc = printWindow.document;
  doc.write("<html><head><title>Keyword Summary</title>");
  doc.write(`
    <style>
      body { font-family: Arial, sans-serif; padding: 2em; color: #333; }
      h1 { margin-top: 0; }
      ul { padding-left: 1.2em; }
      li { margin-bottom: 0.5em; }
      .highlight { background: yellow; font-weight: bold; color: red; }
      .section { margin-bottom: 2em; }
      img { max-width: 600px; width: 80%; display: block; margin: 0 auto 1em auto; }
    </style>
  `);
  doc.write("</head><body>");
  doc.write("<h1>Keyword Summary Report</h1>");

  const chartCanvas = document.getElementById("chart");
  const chartImgData = chartCanvas.toDataURL("image/png");
  doc.write(`<img src="${chartImgData}" alt="Chart" style="width: 80%; max-width: 600px; display: block; margin: 0 auto 1em auto;">`);

  lastParsedData.forEach(file => {
    doc.write(`<div class="section"><h2>Results for: ${file.filename}</h2>`);

    const summaryData = Object.entries(file.summary);
    const resultData = file.results;

    doc.write("<h3>Summary</h3>");
    if (summaryData.length === 0) {
      doc.write("<p>No results found.</p>");
    } else {
      doc.write("<ul>");
      summaryData.forEach(([keyword, pages]) => {
        doc.write(`<li><strong>${keyword}</strong> — ${pages.length} match(es) (Sentences ${[...new Set(pages)].join(", ")})</li>`);
      });
      doc.write("</ul>");
    }

    if (resultData.length) {
      doc.write("<h3>Matched Sentences</h3><ul>");
      resultData.forEach(entry => {
        doc.write(`<li><strong>Sentence ${entry.page}:</strong> “${entry.raw}”</li>`);
      });
      doc.write("</ul>");
    }

    doc.write("</div>");
  });

  doc.write("</body></html>");
  doc.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
});

document.getElementById("chartType").addEventListener("change", e => {
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

function renderOutput() {
  // (Unchanged — previous version with "No results found" support)
  // See earlier message: https://chat.openai.com/share/70858ae2-3a94-40e4-987d-9588ab1e571a
}

function renderChart(type) {
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

  const keywords = Object.keys(keywordCounts);
  const counts = Object.values(keywordCounts);
  const total = counts.reduce((a, b) => a + b, 0);
  const actualType = type === "bar" && keywords.length > 6 ? "bar" : type;
  const indexAxis = actualType === "bar" && keywords.length > 6 ? 'y' : 'x';

  Chart.register(ChartDataLabels);

  chartInstance = new Chart(ctx, {
    type: actualType,
    data: {
      labels: keywords,
      datasets: [{
        label: "Keyword Matches",
        data: counts,
        backgroundColor: keywords.map(() => `hsl(${Math.random()*360}, 70%, 70%)`)
      }]
    },
    options: {
      indexAxis,
      responsive: true,
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
          color: "#000",
          anchor: "end",
          align: "top",
          font: { weight: "bold" },
          formatter: (value) => {
            const percent = ((value / total) * 100).toFixed(1);
            return `${value} (${percent}%)`;
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}
