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
  const existingExport = document.getElementById("pdf-temp-export");
  if (existingExport) existingExport.remove();

  const exportContainer = document.createElement("div");
  exportContainer.id = "pdf-temp-export";
  exportContainer.style.position = "absolute";
  exportContainer.style.left = "-9999px";
  exportContainer.style.width = "800px";
  exportContainer.style.padding = "1em";
  exportContainer.style.background = "#fff";
  exportContainer.innerHTML = "<h2 style='margin-top: 0;'>Keyword Summary Report</h2>";

  const chartCanvas = document.getElementById("chart");
  const chartImg = document.createElement("img");
  chartImg.src = chartCanvas.toDataURL("image/png");
  chartImg.style.maxWidth = "100%";
  chartImg.style.marginBottom = "1em";
  exportContainer.appendChild(chartImg);

  const outputClone = document.getElementById("output").cloneNode(true);
  exportContainer.appendChild(outputClone);
  document.body.appendChild(exportContainer);

  html2pdf().set({
    margin: 0.5,
    filename: "Keyword_Summary.pdf",
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
  }).from(exportContainer).save().then(() => {
    exportContainer.remove();
  });
});

document.getElementById("chartType").addEventListener("change", e => {
  renderChart(e.target.value);
});
document.getElementById("filterKeyword").addEventListener("change", renderOutput);
document.getElementById("viewMode").addEventListener("change", renderOutput);

function updateFilterOptions(keywordList) {
  const select = document.getElementById("filterKeyword");
  select.innerHTML = `<option value="">(Show All)</option>`;
  keywordList.forEach(k => {
    const option = document.createElement("option");
    option.value = k;
    option.textContent = k;
    select.appendChild(option);
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

      let summaryHTML = "<div class='summary'><h3>Summary</h3><ul>";
      Object.entries(file.summary).forEach(([keyword, pages]) => {
        if (!filter || keyword === filter) {
          const pageStr = [...new Set(pages)].join(", ");
          summaryHTML += `<li><strong>${keyword}</strong> — ${pages.length} match(es) (Sentences ${pageStr})</li>`;
        }
      });
      summaryHTML += "</ul></div>";

      let resultsHTML = "<div class='results'><h3>Matched Sentences</h3><ul>";
      file.results.forEach(entry => {
        if (!filter || entry.keyword === filter) {
          resultsHTML += `<li class="result-sentence"><strong>Sentence ${entry.page}:</strong> “${entry.html}”</li>`;
        }
      });
      resultsHTML += "</ul></div>";

      section.innerHTML += summaryHTML + resultsHTML;
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
        }
      }
    }
  });
}
