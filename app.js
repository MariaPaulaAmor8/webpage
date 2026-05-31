const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");

const distributionSelect = document.getElementById("distribution");
const parameterForm = document.getElementById("parameterForm");
const probabilityType = document.getElementById("probabilityType");
const boundA = document.getElementById("boundA");
const boundB = document.getElementById("boundB");
const boundBContainer = document.getElementById("boundBContainer");
const boundALabel = document.getElementById("boundALabel");
const probabilityValue = document.getElementById("probabilityValue");
const formulaBox = document.getElementById("formulaBox");
const errorMessage = document.getElementById("errorMessage");
const graphTitle = document.getElementById("graphTitle");
const graphSubtitle = document.getElementById("graphSubtitle");
const tooltip = document.getElementById("tooltip");

let currentDistribution = null;
let nextClickTarget = "a";

const defaultParameters = {
  uniform: { a: 0, b: 10 },
  triangular: { a: 0, b: 10, c: 5 },
  linear: { a: 0, b: 10, direction: "increasing" },
  piecewise: { a: 0, b: 3, c: 7, d: 10 },
  normal: { mu: 0, sigma: 1 }
};

const parameterDefinitions = {
  uniform: [
    { id: "a", label: "Lower endpoint a", type: "number" },
    { id: "b", label: "Upper endpoint b", type: "number" }
  ],

  triangular: [
    { id: "a", label: "Lower endpoint a", type: "number" },
    { id: "b", label: "Upper endpoint b", type: "number" },
    { id: "c", label: "Mode c", type: "number" }
  ],

  linear: [
    { id: "a", label: "Lower endpoint a", type: "number" },
    { id: "b", label: "Upper endpoint b", type: "number" },
    { id: "direction", label: "Direction", type: "select" }
  ],

  piecewise: [
    { id: "a", label: "Start a", type: "number" },
    { id: "b", label: "End of first interval b", type: "number" },
    { id: "c", label: "End of second interval c", type: "number" },
    { id: "d", label: "End d", type: "number" }
  ],

  normal: [
    { id: "mu", label: "Mean μ", type: "number" },
    { id: "sigma", label: "Standard deviation σ", type: "number" }
  ]
};

const distributionTitles = {
  uniform: "Uniform Distribution",
  triangular: "Triangular Distribution",
  linear: "Linear Distribution",
  piecewise: "Piecewise Distribution",
  normal: "Normal Distribution"
};

function formatNumber(value, digits = 6) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1e-12) return "0";
  return Number(value.toFixed(digits)).toString();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function expandedDomain(a, b) {
  const width = b - a;
  const margin = width * 0.12;
  return [a - margin, b + margin];
}

function getParameterValue(id) {
  const element = document.getElementById(`param-${id}`);

  if (element.type === "number") {
    return Number(element.value);
  }

  return element.value;
}

function getCurrentParameters() {
  const type = distributionSelect.value;
  const parameters = {};

  parameterDefinitions[type].forEach(def => {
    parameters[def.id] = getParameterValue(def.id);
  });

  return parameters;
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * absX);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX));

  return sign * y;
}

function normalCDF(x, mu, sigma) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.sqrt(2))));
}

function makeUniform(params) {
  const { a, b } = params;

  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) {
    throw new Error("Uniform distribution requires a < b.");
  }

  const height = 1 / (b - a);

  return {
    title: "Uniform Distribution",
    domain: expandedDomain(a, b),

    pdf(x) {
      return x >= a && x <= b ? height : 0;
    },

    cdf(x) {
      if (x <= a) return 0;
      if (x >= b) return 1;
      return (x - a) / (b - a);
    },

    formula:
      `f(x) = 1 / (${b} - ${a}) = ${formatNumber(height)} for ${a} ≤ x ≤ ${b}\n` +
      `f(x) = 0 otherwise`
  };
}

function makeTriangular(params) {
  const { a, b, c } = params;

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    a >= b ||
    c < a ||
    c > b
  ) {
    throw new Error("Triangular distribution requires a < b and a ≤ c ≤ b.");
  }

  return {
    title: "Triangular Distribution",
    domain: expandedDomain(a, b),

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
    },

    cdf(x) {
      if (x <= a) return 0;
      if (x >= b) return 1;

      if (c === a) {
        return 1 - Math.pow((b - x) / (b - a), 2);
      }

      if (c === b) {
        return Math.pow((x - a) / (b - a), 2);
      }

      if (x <= c) {
        return Math.pow(x - a, 2) / ((b - a) * (c - a));
      }

      return 1 - Math.pow(b - x, 2) / ((b - a) * (b - c));
    },

    formula:
      `f(x) = 2(x - ${a}) / [(${b} - ${a})(${c} - ${a})] for ${a} ≤ x ≤ ${c}\n` +
      `f(x) = 2(${b} - x) / [(${b} - ${a})(${b} - ${c})] for ${c} ≤ x ≤ ${b}\n` +
      `f(x) = 0 otherwise`
  };
}

function makeLinear(params) {
  const { a, b, direction } = params;

  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) {
    throw new Error("Linear distribution requires a < b.");
  }

  const width = b - a;
  const constant = 2 / Math.pow(width, 2);

  return {
    title:
      direction === "increasing"
        ? "Increasing Linear Distribution"
        : "Decreasing Linear Distribution",

    domain: expandedDomain(a, b),

    pdf(x) {
      if (x < a || x > b) return 0;

      if (direction === "increasing") {
        return constant * (x - a);
      }

      return constant * (b - x);
    },

    cdf(x) {
      if (x <= a) return 0;
      if (x >= b) return 1;

      if (direction === "increasing") {
        return Math.pow((x - a) / width, 2);
      }

      return 1 - Math.pow((b - x) / width, 2);
    },

    formula:
      direction === "increasing"
        ? `f(x) = 2(x - ${a}) / (${b} - ${a})² for ${a} ≤ x ≤ ${b}\nf(x) = 0 otherwise`
        : `f(x) = 2(${b} - x) / (${b} - ${a})² for ${a} ≤ x ≤ ${b}\nf(x) = 0 otherwise`
  };
}

function makePiecewise(params) {
  const { a, b, c, d } = params;

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    !Number.isFinite(d) ||
    !(a < b && b <= c && c < d)
  ) {
    throw new Error("Piecewise distribution requires a < b ≤ c < d.");
  }

  /*
    This is a trapezoidal piecewise PDF:

    Interval 1: rising line
    Interval 2: constant plateau
    Interval 3: decreasing line

    The height h is calculated so the total area is exactly 1.
  */

  const h = 2 / (d + c - b - a);

  return {
    title: "Piecewise Distribution",
    domain: expandedDomain(a, d),

    pdf(x) {
      if (x < a || x > d) return 0;

      if (x <= b) {
        return h * (x - a) / (b - a);
      }

      if (x <= c) {
        return h;
      }

      return h * (d - x) / (d - c);
    },

    cdf(x) {
      if (x <= a) return 0;
      if (x >= d) return 1;

      const leftArea = 0.5 * (b - a) * h;
      const middleArea = (c - b) * h;

      if (x <= b) {
        return (h * Math.pow(x - a, 2)) / (2 * (b - a));
      }

      if (x <= c) {
        return leftArea + h * (x - b);
      }

      const t = x - c;
      const rightPartial = h * t - (h * t * t) / (2 * (d - c));

      return leftArea + middleArea + rightPartial;
    },

    formula:
      `h = 2 / (${d} + ${c} - ${b} - ${a}) = ${formatNumber(h)}\n` +
      `f(x) = h(x - ${a}) / (${b} - ${a}) for ${a} ≤ x ≤ ${b}\n` +
      `f(x) = h for ${b} ≤ x ≤ ${c}\n` +
      `f(x) = h(${d} - x) / (${d} - ${c}) for ${c} ≤ x ≤ ${d}\n` +
      `f(x) = 0 otherwise`
  };
}

function makeNormal(params) {
  const { mu, sigma } = params;

  if (!Number.isFinite(mu) || !Number.isFinite(sigma) || sigma <= 0) {
    throw new Error("Normal distribution requires σ > 0.");
  }

  return {
    title: "Normal Distribution",
    domain: [mu - 4 * sigma, mu + 4 * sigma],

    pdf(x) {
      return (
        (1 / (sigma * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2))
      );
    },

    cdf(x) {
      return normalCDF(x, mu, sigma);
    },

    formula:
      `f(x) = [1 / (${sigma}√(2π))] e^[-(x - ${mu})² / (2${sigma}²)]\n` +
      `Support: -∞ < x < ∞`
  };
}

function createDistribution() {
  const type = distributionSelect.value;
  const params = getCurrentParameters();

  if (type === "uniform") return makeUniform(params);
  if (type === "triangular") return makeTriangular(params);
  if (type === "linear") return makeLinear(params);
  if (type === "piecewise") return makePiecewise(params);
  if (type === "normal") return makeNormal(params);

  throw new Error("Unknown distribution.");
}

function calculateProbability(distribution) {
  const type = probabilityType.value;
  const x1 = Number(boundA.value);
  const x2 = Number(boundB.value);

  const cdf = x => clamp(distribution.cdf(x), 0, 1);

  if (type === "below") {
    return cdf(x1);
  }

  if (type === "above") {
    return 1 - cdf(x1);
  }

  const lower = Math.min(x1, x2);
  const upper = Math.max(x1, x2);

  return cdf(upper) - cdf(lower);
}

function getShadingBounds(distribution) {
  const type = probabilityType.value;
  const x1 = Number(boundA.value);
  const x2 = Number(boundB.value);
  const [xMin, xMax] = distribution.domain;

  if (type === "below") {
    return [xMin, clamp(x1, xMin, xMax)];
  }

  if (type === "above") {
    return [clamp(x1, xMin, xMax), xMax];
  }

  return [
    clamp(Math.min(x1, x2), xMin, xMax),
    clamp(Math.max(x1, x2), xMin, xMax)
  ];
}

function drawGraph(distribution) {
  const width = canvas.width;
  const height = canvas.height;

  const padding = {
    left: 70,
    right: 30,
    top: 30,
    bottom: 60
  };

  const [xMin, xMax] = distribution.domain;
  const yMin = 0;
  const yMax = estimateYMax(distribution, xMin, xMax);

  const toCanvasX = x =>
    padding.left +
    ((x - xMin) / (xMax - xMin)) *
      (width - padding.left - padding.right);

  const toCanvasY = y =>
    height -
    padding.bottom -
    ((y - yMin) / (yMax - yMin)) *
      (height - padding.top - padding.bottom);

  ctx.clearRect(0, 0, width, height);

  drawGrid(width, height, padding, xMin, xMax, yMax, toCanvasX, toCanvasY);
  drawShadedRegion(distribution, toCanvasX, toCanvasY);
  drawPDF(distribution, xMin, xMax, toCanvasX, toCanvasY);
  drawAxes(width, height, padding);

  canvas.dataset.xMin = xMin;
  canvas.dataset.xMax = xMax;
  canvas.dataset.padding = JSON.stringify(padding);
}

function estimateYMax(distribution, xMin, xMax) {
  let max = 0;
  const samples = 800;

  for (let i = 0; i <= samples; i++) {
    const x = xMin + (i / samples) * (xMax - xMin);
    max = Math.max(max, distribution.pdf(x));
  }

  return max > 0 ? max * 1.2 : 1;
}

function drawGrid(width, height, padding, xMin, xMax, yMax, toCanvasX, toCanvasY) {
  ctx.save();

  ctx.strokeStyle = "#e5e7eb";
  ctx.fillStyle = "#64748b";
  ctx.lineWidth = 1;
  ctx.font = "12px Arial";

  const verticalLines = 8;
  const horizontalLines = 6;

  for (let i = 0; i <= verticalLines; i++) {
    const xValue = xMin + (i / verticalLines) * (xMax - xMin);
    const x = toCanvasX(xValue);

    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillText(formatNumber(xValue, 3), x, height - padding.bottom + 25);
  }

  for (let i = 0; i <= horizontalLines; i++) {
    const yValue = (i / horizontalLines) * yMax;
    const y = toCanvasY(yValue);

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillText(formatNumber(yValue, 3), padding.left - 10, y + 4);
  }

  ctx.restore();
}

function drawAxes(width, height, padding) {
  ctx.save();

  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = "#1f2937";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("x", width - padding.right - 5, height - padding.bottom + 42);

  ctx.save();
  ctx.translate(25, padding.top + 20);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("f(x)", 0, 0);
  ctx.restore();

  ctx.restore();
}

function drawPDF(distribution, xMin, xMax, toCanvasX, toCanvasY) {
  const samples = 900;

  ctx.save();

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();

  for (let i = 0; i <= samples; i++) {
    const x = xMin + (i / samples) * (xMax - xMin);
    const y = distribution.pdf(x);

    const px = toCanvasX(x);
    const py = toCanvasY(y);

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.stroke();

  ctx.restore();
}

function drawShadedRegion(distribution, toCanvasX, toCanvasY) {
  let [start, end] = getShadingBounds(distribution);

  if (end < start) {
    [start, end] = [end, start];
  }

  if (Math.abs(end - start) < 1e-12) return;

  const samples = 500;

  ctx.save();

  ctx.fillStyle = "rgba(37, 99, 235, 0.18)";
  ctx.strokeStyle = "rgba(37, 99, 235, 0.35)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(toCanvasX(start), toCanvasY(0));

  for (let i = 0; i <= samples; i++) {
    const x = start + (i / samples) * (end - start);
    const y = distribution.pdf(x);
    ctx.lineTo(toCanvasX(x), toCanvasY(y));
  }

  ctx.lineTo(toCanvasX(end), toCanvasY(0));
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function clearCanvasWithMessage(message) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#64748b";
  ctx.font = "18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function renderParameterForm() {
  const type = distributionSelect.value;
  const parameters = parameterDefinitions[type];
  const defaults = defaultParameters[type];

  parameterForm.innerHTML = "";

  parameters.forEach(parameter => {
    const wrapper = document.createElement("div");

    if (parameters.length % 2 === 1 && parameter === parameters[parameters.length - 1]) {
      wrapper.classList.add("wide");
    }

    const label = document.createElement("label");
    label.textContent = parameter.label;
    label.setAttribute("for", `param-${parameter.id}`);

    wrapper.appendChild(label);

    if (parameter.type === "select") {
      const select = document.createElement("select");
      select.id = `param-${parameter.id}`;

      const optionIncreasing = document.createElement("option");
      optionIncreasing.value = "increasing";
      optionIncreasing.textContent = "Increasing";

      const optionDecreasing = document.createElement("option");
      optionDecreasing.value = "decreasing";
      optionDecreasing.textContent = "Decreasing";

      select.appendChild(optionIncreasing);
      select.appendChild(optionDecreasing);

      select.value = defaults[parameter.id];
      select.addEventListener("input", updateEverything);

      wrapper.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.id = `param-${parameter.id}`;
      input.type = "number";
      input.step = "any";
      input.value = defaults[parameter.id];

      input.addEventListener("input", updateEverything);

      wrapper.appendChild(input);
    }

    parameterForm.appendChild(wrapper);
  });

  setDefaultBounds();
}

function setDefaultBounds() {
  const type = distributionSelect.value;
  const params = defaultParameters[type];

  if (type === "uniform") {
    boundA.value = params.a;
    boundB.value = params.b;
  }

  if (type === "triangular") {
    boundA.value = params.a;
    boundB.value = params.c;
  }

  if (type === "linear") {
    boundA.value = params.a;
    boundB.value = params.b;
  }

  if (type === "piecewise") {
    boundA.value = params.b;
    boundB.value = params.c;
  }

  if (type === "normal") {
    boundA.value = params.mu;
    boundB.value = params.mu + params.sigma;
  }
}

function updateBoundVisibility() {
  if (probabilityType.value === "between") {
    boundBContainer.style.display = "block";
    boundALabel.textContent = "x₁";
  } else {
    boundBContainer.style.display = "none";
    boundALabel.textContent = "x";
  }
}

function updateSubtitle() {
  const type = probabilityType.value;
  const x1 = Number(boundA.value);
  const x2 = Number(boundB.value);

  if (type === "below") {
    graphSubtitle.textContent = `Shaded area: P(X ≤ ${formatNumber(x1, 4)})`;
  } else if (type === "above") {
    graphSubtitle.textContent = `Shaded area: P(X ≥ ${formatNumber(x1, 4)})`;
  } else {
    graphSubtitle.textContent =
      `Shaded area: P(${formatNumber(Math.min(x1, x2), 4)} ≤ X ≤ ${formatNumber(Math.max(x1, x2), 4)})`;
  }
}

function updateEverything() {
  updateBoundVisibility();

  try {
    currentDistribution = createDistribution();

    const probability = calculateProbability(currentDistribution);

    probabilityValue.textContent = formatNumber(probability, 8);
    formulaBox.textContent = currentDistribution.formula;
    graphTitle.textContent = currentDistribution.title;
    errorMessage.textContent = "";

    updateSubtitle();
    drawGraph(currentDistribution);
  } catch (error) {
    currentDistribution = null;

    probabilityValue.textContent = "—";
    formulaBox.textContent = "Enter valid parameters to generate the PDF.";
    graphTitle.textContent = distributionTitles[distributionSelect.value];
    graphSubtitle.textContent = "PDF graph and shaded probability region";
    errorMessage.textContent = error.message;

    clearCanvasWithMessage(error.message);
  }
}

function canvasToX(event) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);

  const xMin = Number(canvas.dataset.xMin);
  const xMax = Number(canvas.dataset.xMax);
  const padding = JSON.parse(canvas.dataset.padding);

  const plotWidth = canvas.width - padding.left - padding.right;
  const ratio = clamp((mouseX - padding.left) / plotWidth, 0, 1);

  return xMin + ratio * (xMax - xMin);
}

function showTooltip(event) {
  if (!currentDistribution) return;

  const rect = canvas.getBoundingClientRect();
  const x = canvasToX(event);
  const y = currentDistribution.pdf(x);

  tooltip.hidden = false;
  tooltip.style.left = `${event.clientX - rect.left}px`;
  tooltip.style.top = `${event.clientY - rect.top}px`;
  tooltip.innerHTML = `x = ${formatNumber(x, 5)}<br>f(x) = ${formatNumber(y, 7)}`;
}

function handleCanvasClick(event) {
  if (!currentDistribution) return;

  const x = canvasToX(event);

  if (probabilityType.value === "between") {
    if (nextClickTarget === "a") {
      boundA.value = formatNumber(x, 6);
      nextClickTarget = "b";
    } else {
      boundB.value = formatNumber(x, 6);
      nextClickTarget = "a";
    }
  } else {
    boundA.value = formatNumber(x, 6);
  }

  updateEverything();
}

distributionSelect.addEventListener("change", () => {
  renderParameterForm();
  updateEverything();
});

probabilityType.addEventListener("change", () => {
  nextClickTarget = "a";
  updateEverything();
});

boundA.addEventListener("input", updateEverything);
boundB.addEventListener("input", updateEverything);

canvas.addEventListener("mousemove", showTooltip);

canvas.addEventListener("mouseleave", () => {
  tooltip.hidden = true;
});

canvas.addEventListener("click", handleCanvasClick);

renderParameterForm();
updateEverything();