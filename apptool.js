const fileInput = document.getElementById("fileInput");
const dataInput = document.getElementById("dataInput");
const exampleBtn = document.getElementById("exampleBtn");
const dataStatus = document.getElementById("dataStatus");

const distributionSelect = document.getElementById("distributionSelect");
const piecewiseOptions = document.getElementById("piecewiseOptions");
const pieceCountInput = document.getElementById("pieceCount");
const histogramBinsInput = document.getElementById("histogramBins");
const fitBtn = document.getElementById("fitBtn");

const parametersOutput = document.getElementById("parametersOutput");
const interpretationOutput = document.getElementById("interpretationOutput");

const pdfCanvas = document.getElementById("pdfCanvas");
const histogramCanvas = document.getElementById("histogramCanvas");
const combinedCanvas = document.getElementById("combinedCanvas");

let data = [];

const exampleData = [
  4.6, 4.9, 5.1, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9, 6.0,
  6.1, 6.2, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 6.9, 7.0,
  7.1, 7.2, 7.4, 7.5, 7.6, 7.8, 7.9, 8.1, 8.2, 8.4,
  8.6, 8.8, 9.0, 9.2, 9.4
].join(", ");

function parseNumbers(text) {
  return text
    .split(/[\s,;]+/)
    .map(item => Number(item.trim()))
    .filter(Number.isFinite);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values) {
  return sum(values) / values.length;
}

function variance(values) {
  const m = mean(values);
  return sum(values.map(value => Math.pow(value - m, 2))) / values.length;
}

function standardDeviation(values) {
  return Math.sqrt(variance(values));
}

function min(values) {
  return Math.min(...values);
}

function max(values) {
  return Math.max(...values);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function format(value, digits = 5) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1e-12) return "0";
  return Number(value.toFixed(digits)).toString();
}

function clamp(value, lower, upper) {
  return Math.min(Math.max(value, lower), upper);
}

function loadDataFromTextArea() {
  data = parseNumbers(dataInput.value);
  updateDataStatus();
}

function updateDataStatus() {
  if (data.length === 0) {
    dataStatus.textContent = "No valid numerical data loaded.";
    return;
  }

  dataStatus.textContent =
    `${data.length} values loaded. ` +
    `Min = ${format(min(data))}, Max = ${format(max(data))}, ` +
    `Mean = ${format(mean(data))}, Standard deviation = ${format(standardDeviation(data))}.`;
}

fileInput.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    dataInput.value = reader.result;
    loadDataFromTextArea();
    fitSelectedDistribution();
  };

  reader.readAsText(file);
});

dataInput.addEventListener("input", loadDataFromTextArea);

exampleBtn.addEventListener("click", () => {
  dataInput.value = exampleData;
  loadDataFromTextArea();
  fitSelectedDistribution();
});

distributionSelect.addEventListener("change", () => {
  piecewiseOptions.classList.toggle(
    "hidden",
    distributionSelect.value !== "piecewiseUniform"
  );

  fitSelectedDistribution();
});

pieceCountInput.addEventListener("input", fitSelectedDistribution);
histogramBinsInput.addEventListener("input", fitSelectedDistribution);
fitBtn.addEventListener("click", fitSelectedDistribution);

function createHistogram(values, requestedBins) {
  const binCount = clamp(Math.round(Number(requestedBins)), 4, 40);

  let lower = min(values);
  let upper = max(values);

  if (lower === upper) {
    lower -= 0.5;
    upper += 0.5;
  }

  const width = (upper - lower) / binCount;
  const counts = Array(binCount).fill(0);

  values.forEach(value => {
    let index = Math.floor((value - lower) / width);
    index = clamp(index, 0, binCount - 1);
    counts[index]++;
  });

  const bins = counts.map((count, index) => {
    const start = lower + index * width;
    const end = start + width;

    return {
      start,
      end,
      center: (start + end) / 2,
      width,
      count,
      density: count / (values.length * width)
    };
  });

  return {
    lower,
    upper,
    width,
    bins
  };
}

function normalPDF(x, mu, sigma) {
  return (
    (1 / (sigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2))
  );
}

function fitUniform(values) {
  const a = min(values);
  const b = max(values);

  if (a === b) {
    throw new Error("Uniform fitting requires at least two different values.");
  }

  return {
    name: "Uniform distribution",
    type: "uniform",
    domain: [a, b],
    parameters: [
      ["Lower endpoint a", a],
      ["Upper endpoint b", b],
      ["Constant density", 1 / (b - a)]
    ],
    pdf(x) {
      return x >= a && x <= b ? 1 / (b - a) : 0;
    }
  };
}

function fitTriangular(values) {
  const a = min(values);
  const b = max(values);

  if (a === b) {
    throw new Error("Triangular fitting requires at least two different values.");
  }

  const binCount = Math.max(6, Math.round(Math.sqrt(values.length)));
  const histogram = createHistogram(values, binCount);

  const modalBin = histogram.bins.reduce((best, current) =>
    current.count > best.count ? current : best
  );

  const c = clamp(modalBin.center, a, b);

  return {
    name: "Triangular distribution",
    type: "triangular",
    domain: [a, b],
    parameters: [
      ["Lower endpoint a", a],
      ["Upper endpoint b", b],
      ["Estimated mode c", c]
    ],
    pdf(x) {
      if (x < a || x > b) return 0;

      if (c === a) {
        return (2 * (b - x)) / Math.pow(b - a, 2);
      }

      if (c === b) {
        return (2 * (x - a)) / Math.pow(b - a, 2);
      }

      if (x <= c) {
        return (2 * (x - a)) / ((b - a) * (c - a));
      }

      return (2 * (b - x)) / ((b - a) * (b - c));
    }
  };
}

function fitLinear(values) {
  const a = min(values);
  const b = max(values);

  if (a === b) {
    throw new Error("Linear fitting requires at least two different values.");
  }

  const width = b - a;
  const observedMean = mean(values);

  const increasingMean = a + (2 / 3) * width;
  const decreasingMean = a + (1 / 3) * width;

  const direction =
    Math.abs(observedMean - increasingMean) <=
    Math.abs(observedMean - decreasingMean)
      ? "increasing"
      : "decreasing";

  const normalizingConstant = 2 / Math.pow(width, 2);

  return {
    name: `${direction === "increasing" ? "Increasing" : "Decreasing"} linear distribution`,
    type: "linear",
    direction,
    domain: [a, b],
    parameters: [
      ["Lower endpoint a", a],
      ["Upper endpoint b", b],
      ["Direction", direction],
      ["Normalizing constant", normalizingConstant]
    ],
    pdf(x) {
      if (x < a || x > b) return 0;

      if (direction === "increasing") {
        return normalizingConstant * (x - a);
      }

      return normalizingConstant * (b - x);
    }
  };
}

function fitPiecewiseUniform(values) {
  const a = min(values);
  const b = max(values);

  if (a === b) {
    throw new Error("Piecewise uniform fitting requires at least two different values.");
  }

  const pieces = clamp(Math.round(Number(pieceCountInput.value)), 2, 12);
  const histogram = createHistogram(values, pieces);

  const intervals = histogram.bins.map(bin => ({
    start: bin.start,
    end: bin.end,
    density: bin.density,
    count: bin.count
  }));

  return {
    name: "Piecewise uniform distribution",
    type: "piecewiseUniform",
    domain: [histogram.lower, histogram.upper],
    intervals,
    parameters: intervals.map((interval, index) => [
      `Piece ${index + 1}: [${format(interval.start)}, ${format(interval.end)}]`,
      `density = ${format(interval.density)}, count = ${interval.count}`
    ]),
    pdf(x) {
      if (x < histogram.lower || x > histogram.upper) return 0;

      const index = clamp(
        Math.floor((x - histogram.lower) / histogram.width),
        0,
        intervals.length - 1
      );

      return intervals[index].density;
    }
  };
}

function fitNormal(values) {
  const mu = mean(values);
  const sigma = standardDeviation(values);

  if (sigma === 0) {
    throw new Error("Normal fitting requires positive standard deviation.");
  }

  return {
    name: "Normal distribution",
    type: "normal",
    domain: [mu - 4 * sigma, mu + 4 * sigma],
    parameters: [
      ["Mean μ", mu],
      ["Standard deviation σ", sigma]
    ],
    pdf(x) {
      return normalPDF(x, mu, sigma);
    }
  };
}

function fitModel(values, type) {
  if (type === "uniform") return fitUniform(values);
  if (type === "triangular") return fitTriangular(values);
  if (type === "linear") return fitLinear(values);
  if (type === "piecewiseUniform") return fitPiecewiseUniform(values);
  if (type === "normal") return fitNormal(values);

  throw new Error("Unknown distribution selected.");
}

function fitSelectedDistribution() {
  loadDataFromTextArea();

  try {
    if (data.length < 2) {
      throw new Error("Please enter or upload at least two numerical values.");
    }

    const model = fitModel(data, distributionSelect.value);

    renderParameters(model);
    renderInterpretation(model, data);

    drawPDFGraph(pdfCanvas, model);
    drawHistogramGraph(histogramCanvas, data);
    drawCombinedGraph(combinedCanvas, data, model);
  } catch (error) {
    parametersOutput.textContent = error.message;
    interpretationOutput.textContent =
      "No interpretation available until valid data and a valid model are provided.";

    clearCanvas(pdfCanvas, error.message);
    clearCanvas(histogramCanvas, error.message);
    clearCanvas(combinedCanvas, error.message);
  }
}

function renderParameters(model) {
  let html = `<strong>${model.name}</strong>`;

  html += `
    <table>
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Estimate</th>
        </tr>
      </thead>
      <tbody>
  `;

  model.parameters.forEach(([name, estimate]) => {
    html += `
      <tr>
        <td>${name}</td>
        <td>${typeof estimate === "number" ? format(estimate) : estimate}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  parametersOutput.innerHTML = html;
}

function renderInterpretation(model, values) {
  const binCount = clamp(Math.round(Number(histogramBinsInput.value)), 4, 40);
  const histogram = createHistogram(values, binCount);

  const squaredErrors = histogram.bins.map(bin => {
    const expected = model.pdf(bin.center);
    return Math.pow(bin.density - expected, 2);
  });

  const rmse = Math.sqrt(sum(squaredErrors) / squaredErrors.length);
  const averageHistogramDensity =
    sum(histogram.bins.map(bin => bin.density)) / histogram.bins.length;

  const relativeError = rmse / Math.max(averageHistogramDensity, 1e-12);

  let qualityClass = "good";
  let qualityText = "reasonable";

  if (relativeError > 0.75) {
    qualityClass = "bad";
    qualityText = "not very reasonable";
  } else if (relativeError > 0.35) {
    qualityClass = "warning";
    qualityText = "moderately reasonable";
  }

  const comments = {
    uniform:
      "This model is reasonable when the histogram bars have similar heights across the whole interval.",
    triangular:
      "This model is reasonable when the histogram has one main peak and the density decreases toward both endpoints.",
    linear:
      `The fitted PDF is ${model.direction}. This is reasonable when the data become more concentrated toward the ${model.direction === "increasing" ? "upper" : "lower"} endpoint.`,
    piecewiseUniform:
      "This model is flexible because each interval has its own constant density. It can match irregular histograms better than a single simple formula.",
    normal:
      "This model is reasonable when the histogram is approximately symmetric and bell-shaped around the mean."
  };

  interpretationOutput.innerHTML = `
    The fitted <strong>${model.name.toLowerCase()}</strong> appears
    <span class="${qualityClass}">${qualityText}</span>
    based on the difference between the histogram density and the fitted PDF.
    <br><br>
    Relative fitting error: <strong>${format(relativeError)}</strong>.
    <br>
    Sample median: <strong>${format(median(values))}</strong>.
    <br><br>
    ${comments[model.type]}
  `;
}

function clearCanvas(canvas, message) {
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#64748b";
  ctx.font = "17px Arial";
  ctx.textAlign = "center";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function getScale(canvas, xMin, xMax, yMax) {
  const width = canvas.width;
  const height = canvas.height;

  const padding = {
    left: 68,
    right: 28,
    top: 26,
    bottom: 58
  };

  const toX = x =>
    padding.left +
    ((x - xMin) / (xMax - xMin)) *
      (width - padding.left - padding.right);

  const toY = y =>
    height -
    padding.bottom -
    (y / yMax) *
      (height - padding.top - padding.bottom);

  return {
    width,
    height,
    padding,
    toX,
    toY
  };
}

function drawGrid(ctx, scale, xMin, xMax, yMax) {
  ctx.save();

  ctx.strokeStyle = "#e5e7eb";
  ctx.fillStyle = "#64748b";
  ctx.lineWidth = 1;
  ctx.font = "12px Arial";

  const verticalLines = 8;
  const horizontalLines = 5;

  for (let i = 0; i <= verticalLines; i++) {
    const value = xMin + (i / verticalLines) * (xMax - xMin);
    const x = scale.toX(value);

    ctx.beginPath();
    ctx.moveTo(x, scale.padding.top);
    ctx.lineTo(x, scale.height - scale.padding.bottom);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillText(format(value, 2), x, scale.height - scale.padding.bottom + 22);
  }

  for (let i = 0; i <= horizontalLines; i++) {
    const value = (i / horizontalLines) * yMax;
    const y = scale.toY(value);

    ctx.beginPath();
    ctx.moveTo(scale.padding.left, y);
    ctx.lineTo(scale.width - scale.padding.right, y);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillText(format(value, 3), scale.padding.left - 8, y + 4);
  }

  ctx.restore();
}

function drawAxes(ctx, scale) {
  ctx.save();

  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1.4;

  ctx.beginPath();
  ctx.moveTo(scale.padding.left, scale.padding.top);
  ctx.lineTo(scale.padding.left, scale.height - scale.padding.bottom);
  ctx.lineTo(scale.width - scale.padding.right, scale.height - scale.padding.bottom);
  ctx.stroke();

  ctx.fillStyle = "#1f2937";
  ctx.font = "13px Arial";
  ctx.textAlign = "center";
  ctx.fillText("x", scale.width - scale.padding.right - 4, scale.height - scale.padding.bottom + 40);

  ctx.save();
  ctx.translate(24, scale.padding.top + 24);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Density", 0, 0);
  ctx.restore();

  ctx.restore();
}

function estimatePDFMax(model, xMin, xMax) {
  let maximum = 0;
  const samples = 800;

  for (let i = 0; i <= samples; i++) {
    const x = xMin + (i / samples) * (xMax - xMin);
    maximum = Math.max(maximum, model.pdf(x));
  }

  return maximum;
}

function drawPDFGraph(canvas, model) {
  const ctx = canvas.getContext("2d");

  let [xMin, xMax] = model.domain;
  const margin = Math.max((xMax - xMin) * 0.08, 0.5);

  xMin -= margin;
  xMax += margin;

  const yMax = Math.max(estimatePDFMax(model, xMin, xMax) * 1.25, 1e-6);
  const scale = getScale(canvas, xMin, xMax, yMax);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid(ctx, scale, xMin, xMax, yMax);
  drawPDFLine(ctx, model, xMin, xMax, scale);
  drawAxes(ctx, scale);
}

function drawHistogramGraph(canvas, values) {
  const ctx = canvas.getContext("2d");
  const bins = clamp(Math.round(Number(histogramBinsInput.value)), 4, 40);
  const histogram = createHistogram(values, bins);

  const xMin = histogram.lower;
  const xMax = histogram.upper;
  const yMax = Math.max(...histogram.bins.map(bin => bin.density)) * 1.25 || 1;

  const scale = getScale(canvas, xMin, xMax, yMax);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid(ctx, scale, xMin, xMax, yMax);
  drawHistogramBars(ctx, histogram, scale);
  drawAxes(ctx, scale);
}

function drawCombinedGraph(canvas, values, model) {
  const ctx = canvas.getContext("2d");
  const bins = clamp(Math.round(Number(histogramBinsInput.value)), 4, 40);
  const histogram = createHistogram(values, bins);

  let [xMin, xMax] = model.domain;

  xMin = Math.min(xMin, histogram.lower);
  xMax = Math.max(xMax, histogram.upper);

  const margin = Math.max((xMax - xMin) * 0.08, 0.5);

  xMin -= margin;
  xMax += margin;

  const histogramMax = Math.max(...histogram.bins.map(bin => bin.density));
  const pdfMax = estimatePDFMax(model, xMin, xMax);
  const yMax = Math.max(histogramMax, pdfMax) * 1.25 || 1;

  const scale = getScale(canvas, xMin, xMax, yMax);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid(ctx, scale, xMin, xMax, yMax);
  drawHistogramBars(ctx, histogram, scale);
  drawPDFLine(ctx, model, xMin, xMax, scale);
  drawLegend(ctx);
  drawAxes(ctx, scale);
}

function drawHistogramBars(ctx, histogram, scale) {
  ctx.save();

  ctx.fillStyle = "rgba(37, 99, 235, 0.24)";
  ctx.strokeStyle = "rgba(37, 99, 235, 0.58)";
  ctx.lineWidth = 1;

  histogram.bins.forEach(bin => {
    const x = scale.toX(bin.start);
    const width = scale.toX(bin.end) - scale.toX(bin.start);
    const y = scale.toY(bin.density);
    const base = scale.toY(0);
    const height = base - y;

    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
  });

  ctx.restore();
}

function drawPDFLine(ctx, model, xMin, xMax, scale) {
  if (model.type === "piecewiseUniform") {
    drawPiecewisePDF(ctx, model, scale);
    return;
  }

  ctx.save();

  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const samples = 900;

  ctx.beginPath();

  for (let i = 0; i <= samples; i++) {
    const x = xMin + (i / samples) * (xMax - xMin);
    const y = model.pdf(x);

    const px = scale.toX(x);
    const py = scale.toY(y);

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.stroke();
  ctx.restore();
}

function drawPiecewisePDF(ctx, model, scale) {
  ctx.save();

  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 3;

  model.intervals.forEach(interval => {
    const x1 = scale.toX(interval.start);
    const x2 = scale.toX(interval.end);
    const y = scale.toY(interval.density);
    const base = scale.toY(0);

    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, base);
    ctx.lineTo(x1, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, base);
    ctx.lineTo(x2, y);
    ctx.stroke();
  });

  ctx.restore();
}

function drawLegend(ctx) {
  ctx.save();

  ctx.font = "13px Arial";

  ctx.fillStyle = "rgba(37, 99, 235, 0.24)";
  ctx.fillRect(78, 20, 22, 13);
  ctx.strokeStyle = "rgba(37, 99, 235, 0.58)";
  ctx.strokeRect(78, 20, 22, 13);

  ctx.fillStyle = "#1f2937";
  ctx.fillText("Histogram density", 108, 31);

  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(245, 27);
  ctx.lineTo(278, 27);
  ctx.stroke();

  ctx.fillStyle = "#1f2937";
  ctx.fillText("Fitted PDF", 288, 31);

  ctx.restore();
}

dataInput.value = exampleData;
loadDataFromTextArea();
fitSelectedDistribution();
