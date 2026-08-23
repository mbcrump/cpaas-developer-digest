(() => {
  const manifest = JSON.parse(document.getElementById("trends-manifest").textContent || "{}");
  const status = document.getElementById("trend-status");
  const dashboard = document.getElementById("trend-dashboard");
  const periodButtons = Array.from(document.querySelectorAll("[data-period]"));
  const topics = [
    "AI & Agents",
    "Authentication & Trust",
    "Messaging & RCS",
    "Contact Center",
    "Voice",
    "Video",
    "SDKs & Tooling",
    "Platform & Operations"
  ];
  const topicColors = {
    "AI & Agents": "#08768d",
    "Authentication & Trust": "#d65f4a",
    "Messaging & RCS": "#c79224",
    "Contact Center": "#5678a6",
    "Voice": "#7658a6",
    "Video": "#31906f",
    "SDKs & Tooling": "#a94f74",
    "Platform & Operations": "#718087"
  };
  let allStories = [];
  let selectedPeriod = "all";

  const countBy = (stories, field) => {
    const counts = new Map();
    for (const story of stories) counts.set(story[field], (counts.get(story[field]) || 0) + 1);
    return counts;
  };

  const sortedCounts = (counts, preferredFirst) => Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (preferredFirst && a.name === preferredFirst) return -1;
      if (preferredFirst && b.name === preferredFirst) return 1;
      return b.count - a.count || a.name.localeCompare(b.name);
    });

  const searchUrl = (values) => {
    const params = new URLSearchParams(values);
    return "index.html?" + params.toString();
  };

  const filteredStories = () => {
    if (selectedPeriod === "all" || !allStories.length) return allStories;
    const latest = new Date(manifest.latestDate + "T00:00:00");
    latest.setDate(latest.getDate() - Number(selectedPeriod) + 1);
    const cutoff = latest.getFullYear() + "-" + String(latest.getMonth() + 1).padStart(2, "0") + "-" + String(latest.getDate()).padStart(2, "0");
    return allStories.filter((story) => story.digest >= cutoff);
  };

  const addMetric = (value, label) => {
    const metric = document.createElement("div");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    metric.className = "metric";
    strong.textContent = value;
    span.textContent = label;
    metric.append(strong, span);
    return metric;
  };

  const renderSummary = (stories) => {
    const summary = document.getElementById("trend-summary");
    const topicCounts = sortedCounts(countBy(stories, "topic"));
    const dates = stories.map((story) => story.digest).sort();
    const archiveDays = dates.length
      ? Math.round((new Date(dates[dates.length - 1] + "T00:00:00") - new Date(dates[0] + "T00:00:00")) / 86400000) + 1
      : 0;
    summary.replaceChildren(
      addMetric(String(stories.length), "Published stories"),
      addMetric(String(countBy(stories, "provider").size), "Active providers"),
      addMetric(topicCounts.length ? topicCounts[0].name : "None", "Leading topic"),
      addMetric(archiveDays ? archiveDays + (archiveDays === 1 ? " day" : " days") : "None", "Archive span")
    );
  };

  const renderHeatmap = (stories) => {
    const wrap = document.getElementById("topic-heatmap");
    const providerCounts = countBy(stories, "provider");
    const providers = sortedCounts(providerCounts, "Vonage").map((item) => item.name);
    const matrix = new Map();
    let maximum = 0;
    for (const story of stories) {
      const key = story.provider + "\u0000" + story.topic;
      const count = (matrix.get(key) || 0) + 1;
      matrix.set(key, count);
      maximum = Math.max(maximum, count);
    }
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    const corner = document.createElement("th");
    corner.scope = "col";
    corner.textContent = "Provider";
    header.append(corner);
    for (const topic of topics) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = topic;
      header.append(th);
    }
    thead.append(header);
    table.append(thead);
    const tbody = document.createElement("tbody");
    for (const provider of providers) {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = provider;
      row.append(label);
      for (const topic of topics) {
        const cell = document.createElement("td");
        const count = matrix.get(provider + "\u0000" + topic) || 0;
        if (count) {
          const link = document.createElement("a");
          link.href = searchUrl({ provider, topic });
          link.textContent = String(count);
          link.title = provider + ": " + count + " " + topic + (count === 1 ? " story" : " stories");
          link.style.setProperty("--heat", String(0.18 + (count / maximum) * 0.82));
          cell.append(link);
        } else {
          const empty = document.createElement("span");
          empty.className = "heatmap-empty";
          empty.textContent = "0";
          cell.append(empty);
        }
        row.append(cell);
      }
      tbody.append(row);
    }
    table.className = "heatmap-table";
    table.append(tbody);
    wrap.replaceChildren(table);
  };

  const renderBars = (containerId, entries, linkValues) => {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "trend-status";
      empty.textContent = "No matching content in this period.";
      container.append(empty);
      return;
    }
    const maximum = Math.max(...entries.map((entry) => entry.count));
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    for (const entry of entries) {
      const row = document.createElement("div");
      const heading = document.createElement("div");
      const link = document.createElement("a");
      const count = document.createElement("span");
      const track = document.createElement("div");
      const fill = document.createElement("div");
      heading.className = "bar-row-heading";
      link.href = searchUrl(linkValues(entry.name));
      link.textContent = entry.name;
      count.textContent = entry.count + " (" + Math.round(entry.count / total * 100) + "%)";
      track.className = "bar-track";
      fill.className = "bar-fill";
      fill.style.width = (entry.count / maximum * 100) + "%";
      if (topicColors[entry.name]) fill.style.background = topicColors[entry.name];
      heading.append(link, count);
      track.append(fill);
      row.append(heading, track);
      container.append(row);
    }
  };

  const renderMonthlyTrend = (stories) => {
    const legend = document.getElementById("topic-legend");
    const chart = document.getElementById("monthly-trend");
    legend.replaceChildren();
    chart.replaceChildren();
    for (const topic of topics) {
      const item = document.createElement("span");
      const swatch = document.createElement("span");
      item.className = "legend-item";
      swatch.className = "legend-swatch";
      swatch.style.setProperty("--topic-color", topicColors[topic]);
      item.append(swatch, document.createTextNode(topic));
      legend.append(item);
    }
    const monthGroups = new Map();
    for (const story of stories) {
      const key = story.digest.slice(0, 7);
      if (!monthGroups.has(key)) monthGroups.set(key, []);
      monthGroups.get(key).push(story);
    }
    for (const [month, monthStories] of Array.from(monthGroups).sort((a, b) => a[0].localeCompare(b[0]))) {
      const row = document.createElement("div");
      const label = document.createElement("span");
      const band = document.createElement("div");
      const total = document.createElement("span");
      const counts = countBy(monthStories, "topic");
      row.className = "month-row";
      label.className = "month-label";
      label.textContent = new Date(month + "-01T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" });
      band.className = "month-band";
      band.setAttribute("aria-label", label.textContent + ", " + monthStories.length + " stories");
      for (const topic of topics) {
        const count = counts.get(topic) || 0;
        if (!count) continue;
        const segment = document.createElement("span");
        segment.className = "month-segment";
        segment.style.setProperty("--topic-color", topicColors[topic]);
        segment.style.width = (count / monthStories.length * 100) + "%";
        segment.title = topic + ": " + count;
        band.append(segment);
      }
      total.className = "month-total";
      total.textContent = monthStories.length + (monthStories.length === 1 ? " story" : " stories");
      row.append(label, band, total);
      chart.append(row);
    }
  };

  const render = () => {
    const stories = filteredStories();
    renderSummary(stories);
    renderHeatmap(stories);
    const vonageStories = stories.filter((story) => story.provider === "Vonage");
    renderBars("vonage-focus", sortedCounts(countBy(vonageStories, "topic")), (topic) => ({ provider: "Vonage", topic }));
    renderBars("topic-activity", sortedCounts(countBy(stories, "topic")), (topic) => ({ topic }));
    renderMonthlyTrend(stories);
    renderBars("provider-activity", sortedCounts(countBy(stories, "provider")), (provider) => ({ provider }));
    renderBars("content-mix", sortedCounts(countBy(stories, "type")), (type) => ({ type }));
    status.hidden = true;
    dashboard.hidden = false;
  };

  for (const button of periodButtons) {
    button.addEventListener("click", () => {
      selectedPeriod = button.dataset.period;
      for (const candidate of periodButtons) {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      }
      render();
    });
  }

  Promise.all((manifest.months || []).map((month) => fetch(month.file, { cache: "no-cache" }).then((response) => {
    if (!response.ok) throw new Error("Unable to load " + month.label);
    return response.json();
  }))).then((months) => {
    allStories = months.flat();
    render();
  }).catch(() => {
    status.textContent = "Trend data could not be loaded. Please refresh and try again.";
  });
})();
