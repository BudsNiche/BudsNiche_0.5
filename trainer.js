const TRAINER_ENDPOINT = "https://xrwtuneumaoviwdintej.supabase.co/functions/v1/judge-trainer";

const trainerKeyInput = document.getElementById("trainerKey");
const loadBtn = document.getElementById("loadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const filterPanel = document.getElementById("filterPanel");
const filterText = document.getElementById("filterText");
const trainerList = document.getElementById("trainerList");
const statusText = document.getElementById("statusText");

let rows = [];

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
}

async function trainerRequest(action, extra = {}) {
  const trainerKey = trainerKeyInput.value.trim();

  if (!trainerKey) {
    throw new Error("Enter your private trainer key first.");
  }

  const response = await fetch(TRAINER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": trainerKey,
    },
    body: JSON.stringify({ action, ...extra }),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Trainer returned HTTP ${response.status}.`);
  }

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `Trainer returned HTTP ${response.status}.`);
  }

  return data;
}

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function formatConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function renderRows() {
  const query = (filterText?.value || "").trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (!query) return true;
    return [
      row.topic,
      row.category,
      row.player_answer,
      row.normalized_answer,
      row.canonical_concept,
      row.reason,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  trainerList.replaceChildren();

  if (!filtered.length) {
    trainerList.appendChild(
      makeEl(
        "div",
        "trainer-empty",
        rows.length ? "No judgments match that filter." : "No cached AI judgments yet."
      )
    );
    return;
  }

  for (const row of filtered) {
    const card = makeEl("article", "trainer-card");

    const head = makeEl("div", "trainer-card-head");
    head.appendChild(makeEl("strong", "", row.topic || "Untitled topic"));
    head.appendChild(makeEl("span", "", row.category || "Uncategorized"));
    card.appendChild(head);

    const body = makeEl("div", "trainer-card-body");
    body.appendChild(makeEl("p", "trainer-answer", row.player_answer || "(blank answer)"));

    const meta = makeEl("div", "trainer-meta");

    const scoreBox = makeEl("div");
    scoreBox.appendChild(makeEl("small", "", "AI score"));
    scoreBox.appendChild(makeEl("strong", "", String(row.score ?? "—")));
    meta.appendChild(scoreBox);

    const confidenceBox = makeEl("div");
    confidenceBox.appendChild(makeEl("small", "", "Confidence"));
    confidenceBox.appendChild(makeEl("strong", "", formatConfidence(row.confidence)));
    meta.appendChild(confidenceBox);

    const versionBox = makeEl("div");
    versionBox.appendChild(makeEl("small", "", "Judge"));
    versionBox.appendChild(makeEl("strong", "", row.judge_version || "—"));
    meta.appendChild(versionBox);

    body.appendChild(meta);

    if (row.reason) {
      body.appendChild(makeEl("p", "trainer-reason", row.reason));
    }

    const edit = makeEl("div", "trainer-edit");

    const scoreLabel = makeEl("label", "trainer-label", "Your score");
    const scoreInput = document.createElement("input");
    scoreInput.type = "number";
    scoreInput.min = "0";
    scoreInput.max = "100";
    scoreInput.step = "1";
    scoreInput.value = String(row.score ?? "");
    scoreLabel.appendChild(scoreInput);
    edit.appendChild(scoreLabel);

    const canonicalLabel = makeEl("label", "trainer-label", "Canonical concept");
    const canonicalInput = document.createElement("input");
    canonicalInput.type = "text";
    canonicalInput.value = row.canonical_concept || row.player_answer || "";
    canonicalLabel.appendChild(canonicalInput);
    edit.appendChild(canonicalLabel);

    body.appendChild(edit);

    const notesLabel = makeEl("label", "trainer-label", "Notes (optional)");
    const notesInput = document.createElement("textarea");
    notesInput.placeholder = "Why you changed the score, special context, etc.";
    notesLabel.appendChild(notesInput);
    body.appendChild(notesLabel);

    const saveRow = makeEl("div", "trainer-save-row");
    const saveBtn = makeEl("button", "trainer-button", "Save as Training");
    saveBtn.type = "button";

    if (row.approved_by_admin) {
      saveRow.appendChild(makeEl("span", "trained-badge", "OWNER APPROVED"));
    } else if (row.needs_review) {
      saveRow.appendChild(makeEl("span", "review-badge", "NEEDS REVIEW"));
    }

    saveBtn.addEventListener("click", async () => {
      const score = Number(scoreInput.value);
      if (!Number.isInteger(score) || score < 0 || score > 100) {
        setStatus("Score must be a whole number from 0 to 100.", true);
        scoreInput.focus();
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      setStatus(`Saving “${row.player_answer}”...`);

      try {
        const result = await trainerRequest("save", {
          cache_id: row.id,
          score,
          canonical_concept: canonicalInput.value.trim(),
          notes: notesInput.value.trim(),
        });

        row.score = result.row.score;
        row.canonical_concept = result.row.canonical_concept;
        row.approved_by_admin = true;
        row.needs_review = false;

        setStatus(
          `Saved “${row.player_answer}” at ${result.row.score}. Future exact matches will use your owner-approved training.`
        );
        renderRows();
      } catch (error) {
        setStatus(error.message || "Could not save training example.", true);
        saveBtn.disabled = false;
        saveBtn.textContent = "Save as Training";
      }
    });

    saveRow.appendChild(saveBtn);
    body.appendChild(saveRow);
    card.appendChild(body);
    trainerList.appendChild(card);
  }
}

async function loadJudgments() {
  loadBtn.disabled = true;
  if (refreshBtn) refreshBtn.disabled = true;
  setStatus("Loading cached AI judgments...");

  try {
    const data = await trainerRequest("list");
    rows = Array.isArray(data.rows) ? data.rows : [];
    filterPanel.classList.remove("hidden");
    renderRows();
    setStatus(`Loaded ${rows.length} cached judgment${rows.length === 1 ? "" : "s"}.`);
  } catch (error) {
    rows = [];
    trainerList.replaceChildren();
    setStatus(error.message || "Could not load judgments.", true);
  } finally {
    loadBtn.disabled = false;
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

loadBtn.addEventListener("click", loadJudgments);
refreshBtn?.addEventListener("click", loadJudgments);
filterText?.addEventListener("input", renderRows);
trainerKeyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadJudgments();
});
