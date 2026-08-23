(() => {
  const input = document.getElementById("digest-search");
  const clearButton = document.getElementById("clear-search");
  const resetButton = document.getElementById("reset-filters");
  const historyBack = document.getElementById("history-back");
  const results = document.getElementById("search-results");
  const status = document.getElementById("search-status");
  const manifestElement = document.getElementById("search-manifest");
  const providerFilter = document.getElementById("provider-filter");
  const topicFilter = document.getElementById("topic-filter");
  const typeFilter = document.getElementById("type-filter");
  const dateFilter = document.getElementById("date-filter");
  const manifest = JSON.parse(manifestElement.textContent || "{}");
  const monthCache = new Map();
  let renderVersion = 0;

  const addOptions = (select, values) => {
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
  };

  addOptions(providerFilter, manifest.providers || []);
  addOptions(topicFilter, manifest.topics || []);
  addOptions(typeFilter, manifest.types || []);

  const monthOptions = document.createElement("optgroup");
  monthOptions.label = "By month";
  for (const month of manifest.months || []) {
    const option = document.createElement("option");
    option.value = "month:" + month.key;
    option.textContent = month.label + " (" + month.count + ")";
    monthOptions.append(option);
  }
  if (monthOptions.children.length) dateFilter.append(monthOptions);

  const params = new URLSearchParams(window.location.search);
  const setKnownValue = (select, value) => {
    if (value && Array.from(select.options).some((option) => option.value === value)) {
      select.value = value;
    }
  };
  input.value = params.get("q") || "";
  setKnownValue(providerFilter, params.get("provider"));
  setKnownValue(topicFilter, params.get("topic"));
  setKnownValue(typeFilter, params.get("type"));
  setKnownValue(dateFilter, params.get("date"));
  if (window.location.search) {
    document.querySelector(".search-disclosure").open = true;
  }

  const loadMonth = async (month) => {
    if (!monthCache.has(month.key)) {
      monthCache.set(month.key, fetch(month.file, { cache: "no-cache" }).then((response) => {
        if (!response.ok) throw new Error("Unable to load " + month.label);
        return response.json();
      }));
    }
    return monthCache.get(month.key);
  };

  const getStories = async () => {
    const selectedMonth = dateFilter.value.startsWith("month:")
      ? dateFilter.value.slice(6)
      : "";
    const months = selectedMonth
      ? (manifest.months || []).filter((month) => month.key === selectedMonth)
      : (manifest.months || []);
    const monthlyStories = await Promise.all(months.map(loadMonth));
    return monthlyStories.flat();
  };

  const localDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  };

  const render = async () => {
    const version = ++renderVersion;
    const query = input.value.trim().toLowerCase();
    results.replaceChildren();
    clearButton.hidden = !query;
    const isFiltered = providerFilter.value !== "all" || topicFilter.value !== "all" ||
      typeFilter.value !== "all" || dateFilter.value !== "all";
    resetButton.hidden = !query && !isFiltered;

    if (!query && !isFiltered) {
      results.hidden = true;
      status.textContent = "";
      status.hidden = true;
      return;
    }

    status.textContent = "Loading stories...";
    status.hidden = false;
    results.hidden = true;

    let stories;
    try {
      stories = await getStories();
    } catch (error) {
      if (version !== renderVersion) return;
      status.textContent = "Search data could not be loaded. Please refresh and try again.";
      return;
    }
    if (version !== renderVersion) return;

    const today = new Date();
    const todayText = localDate(today);
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const weekStartText = localDate(weekStart);
    const matches = stories.filter((story) => {
      const text = [story.title, story.provider, story.topic, story.source, story.published, story.digest]
        .join(" ")
        .toLowerCase();
      const matchesText = !query || text.includes(query);
      const matchesProvider = providerFilter.value === "all" || story.provider === providerFilter.value;
      const matchesTopic = topicFilter.value === "all" || story.topic === topicFilter.value;
      const matchesType = typeFilter.value === "all" || story.type === typeFilter.value;
      const selectedMonth = dateFilter.value.startsWith("month:") ? dateFilter.value.slice(6) : "";
      const matchesDate = dateFilter.value === "all" ||
        (dateFilter.value === "today" && story.digest === todayText) ||
        (dateFilter.value === "7" && story.digest >= weekStartText && story.digest <= todayText) ||
        (selectedMonth && story.digest.startsWith(selectedMonth));
      return matchesText && matchesProvider && matchesTopic && matchesType && matchesDate;
    });
    const visibleMatches = matches.slice(0, 50);

    status.textContent = matches.length === 1
      ? "1 matching story"
      : matches.length + " matching stories";
    if (matches.length > visibleMatches.length) {
      status.textContent += "; showing the first " + visibleMatches.length;
    }
    status.hidden = false;
    results.hidden = false;

    for (const story of visibleMatches) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const meta = document.createElement("span");
      const provider = document.createElement("span");
      const topic = document.createElement("span");
      const source = document.createElement("span");
      const published = document.createElement("time");

      link.href = story.url;
      link.textContent = story.title;
      link.rel = "noopener noreferrer";
      meta.className = "search-result-meta";
      provider.className = "provider-badge";
      provider.dataset.provider = story.provider.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      provider.textContent = story.provider;
      topic.textContent = story.topic;
      source.textContent = story.source;
      published.dateTime = story.published;
      published.textContent = story.published;

      meta.append(provider, topic, source, published);
      item.append(link, meta);
      results.append(item);
    }
  };

  input.addEventListener("input", render);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      event.preventDefault();
      input.value = "";
      render();
    }
  });
  clearButton.addEventListener("click", () => {
    input.value = "";
    render();
    input.focus();
  });
  for (const filter of [providerFilter, topicFilter, typeFilter, dateFilter]) {
    filter.addEventListener("change", render);
  }
  resetButton.addEventListener("click", () => {
    input.value = "";
    providerFilter.value = "all";
    topicFilter.value = "all";
    typeFilter.value = "all";
    dateFilter.value = "all";
    render();
    input.focus();
  });
  historyBack.addEventListener("click", (event) => {
    if (document.referrer) {
      event.preventDefault();
      history.back();
    }
  });
  render();
})();
