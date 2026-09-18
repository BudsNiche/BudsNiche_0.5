const SUPABASE_URL = "https://xrwtuneumaoviwdintej.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WshnYFpEH1zJRpjH9kzugA_1fV6iiGn";

const today = new Date();
const todayKey = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0")
].join("-");

document.getElementById("todayLabel").textContent = today.toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});

async function loadDailyContent() {
  const status = document.getElementById("dataStatus");
  try {
    const endpoint =
      `${SUPABASE_URL}/rest/v1/daily_content?select=*&date=eq.${encodeURIComponent(todayKey)}&limit=1`;

    const response = await fetch(endpoint, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
    });

    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);

    const rows = await response.json();

    if (!rows.length) {
      status.textContent = "No content for today";
      return;
    }

    const item = rows[0];
    if (item.bible_verse) document.getElementById("bibleVerse").textContent = `“${item.bible_verse}”`;
    if (item.bible_reference) document.getElementById("bibleReference").textContent = item.bible_reference;
    if (item.motivation) document.getElementById("motivationText").textContent = item.motivation;
    if (item.hot_take) document.getElementById("hotTakeText").textContent = item.hot_take;
    if (item.fact_of_the_day) document.getElementById("factText").textContent = item.fact_of_the_day;
    if (item.question_of_the_day) document.getElementById("questionText").textContent = item.question_of_the_day;

    status.textContent = "Live from Supabase";
  } catch (error) {
    console.error(error);
    status.textContent = "Connection error";
  }
}

// Daily check-in streak
const streakKey = "budsniche-checkin-streak";
const lastCheckinKey = "budsniche-last-checkin";
let streak = Number(localStorage.getItem(streakKey) || 0);
const lastCheckin = localStorage.getItem(lastCheckinKey);

if (lastCheckin !== todayKey) {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = [
    yesterday.getFullYear(),
    String(yesterday.getMonth() + 1).padStart(2, "0"),
    String(yesterday.getDate()).padStart(2, "0")
  ].join("-");

  streak = lastCheckin === yesterdayKey ? streak + 1 : 1;
  localStorage.setItem(streakKey, String(streak));
  localStorage.setItem(lastCheckinKey, todayKey);
}
document.getElementById("checkinStreak").textContent = streak || 1;

// Real shared Hot Take poll
const pollActions = document.getElementById("pollActions");
const pollResults = document.getElementById("pollResults");
const pollMeta = document.getElementById("pollMeta");

const voterStorageKey = "budsniche-voter-id";
let voterId = localStorage.getItem(voterStorageKey);

if (!voterId) {
  voterId = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
  localStorage.setItem(voterStorageKey, voterId);
}

async function getOwnVote() {
  const endpoint =
    `${SUPABASE_URL}/rest/v1/poll_votes?select=vote&date=eq.${encodeURIComponent(todayKey)}&voter_id=eq.${encodeURIComponent(voterId)}&limit=1`;

  const response = await fetch(endpoint, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
  });

  if (!response.ok) throw new Error(`Could not check vote (${response.status})`);
  const rows = await response.json();
  return rows.length ? rows[0].vote : null;
}

async function fetchPollVotes() {
  const endpoint =
    `${SUPABASE_URL}/rest/v1/poll_votes?select=vote&date=eq.${encodeURIComponent(todayKey)}`;

  const response = await fetch(endpoint, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
  });

  if (!response.ok) throw new Error(`Could not load votes (${response.status})`);
  return await response.json();
}

function renderPollResults(votes, ownVote = null) {
  const agree = votes.filter(v => v.vote === "agree").length;
  const disagree = votes.filter(v => v.vote === "disagree").length;
  const total = agree + disagree;

  const agreePct = total ? Math.round((agree / total) * 100) : 0;
  const disagreePct = total ? 100 - agreePct : 0;

  document.getElementById("agreePercent").textContent = `${agreePct}%`;
  document.getElementById("disagreePercent").textContent = `${disagreePct}%`;
  document.getElementById("agreeBar").style.width = `${agreePct}%`;
  document.getElementById("disagreeBar").style.width = `${disagreePct}%`;

  pollMeta.textContent = ownVote
    ? `You voted ${ownVote === "agree" ? "Agree" : "Disagree"} • ${total} total vote${total === 1 ? "" : "s"}`
    : `${total} total vote${total === 1 ? "" : "s"}`;

  pollActions.classList.add("hidden");
  pollResults.classList.remove("hidden");
}

async function loadPoll() {
  try {
    const ownVote = await getOwnVote();

    if (ownVote) {
      const votes = await fetchPollVotes();
      renderPollResults(votes, ownVote);
    } else {
      pollActions.classList.remove("hidden");
      pollResults.classList.add("hidden");
    }
  } catch (error) {
    console.error(error);
  }
}

async function submitPollVote(vote) {
  document.querySelectorAll(".vote-btn").forEach(btn => btn.disabled = true);

  try {
    const existingVote = await getOwnVote();

    if (existingVote) {
      const votes = await fetchPollVotes();
      renderPollResults(votes, existingVote);
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/poll_votes`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        date: todayKey,
        vote,
        voter_id: voterId
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Vote failed (${response.status}): ${message}`);
    }

    const votes = await fetchPollVotes();
    renderPollResults(votes, vote);
  } catch (error) {
    console.error(error);
    pollMeta.textContent = "Could not save your vote. Try again.";
    pollResults.classList.remove("hidden");
  } finally {
    document.querySelectorAll(".vote-btn").forEach(btn => btn.disabled = false);
  }
}

document.querySelectorAll(".vote-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    submitPollVote(btn.dataset.vote);
  });
});


// Today's Discussion
const discussionForm = document.getElementById("discussionForm");
const discussionName = document.getElementById("discussionName");
const discussionResponse = document.getElementById("discussionResponse");
const discussionSubmit = document.getElementById("discussionSubmit");
const discussionStatus = document.getElementById("discussionStatus");
const discussionFeed = document.getElementById("discussionFeed");
const discussionCount = document.getElementById("discussionCount");

const savedDiscussionName = localStorage.getItem("budsniche-discussion-name");
if (savedDiscussionName) discussionName.value = savedDiscussionName;

function discussionTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

async function fetchDiscussionPosts() {
  const endpoint =
    `${SUPABASE_URL}/rest/v1/question_responses?select=id,created_at,display_name,response,parent_response_id,likes&date=eq.${encodeURIComponent(todayKey)}&order=created_at.asc`;

  const response = await fetch(endpoint, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Could not load discussion (${response.status}): ${message}`);
  }

  return await response.json();
}

async function insertDiscussionPost({ name, responseText, parentId = null }) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/question_responses`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      date: todayKey,
      display_name: name,
      response: responseText,
      parent_response_id: parentId
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Could not post response (${response.status}): ${message}`);
  }
}

function createReplyForm(parentId) {
  const form = document.createElement("form");
  form.className = "reply-form";

  const grid = document.createElement("div");
  grid.className = "reply-grid";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Your name";
  const nameInput = document.createElement("input");
  nameInput.maxLength = 30;
  nameInput.required = true;
  nameInput.placeholder = "Your name";
  nameInput.value = localStorage.getItem("budsniche-discussion-name") || "";
  nameLabel.appendChild(nameInput);

  const responseLabel = document.createElement("label");
  responseLabel.textContent = "Your reply";
  const replyInput = document.createElement("textarea");
  replyInput.maxLength = 500;
  replyInput.required = true;
  replyInput.placeholder = "Write a reply...";
  responseLabel.appendChild(replyInput);

  grid.appendChild(nameLabel);
  grid.appendChild(responseLabel);

  const actions = document.createElement("div");
  actions.className = "reply-form-actions";

  const postButton = document.createElement("button");
  postButton.type = "submit";
  postButton.className = "button primary";
  postButton.textContent = "Post Reply";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "text-button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => form.remove());

  const status = makeTextElement("span", "muted small", "");

  actions.appendChild(postButton);
  actions.appendChild(cancelButton);
  actions.appendChild(status);

  form.appendChild(grid);
  form.appendChild(actions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const responseText = replyInput.value.trim();

    if (!name || !responseText) return;

    postButton.disabled = true;
    status.textContent = "Posting...";

    try {
      localStorage.setItem("budsniche-discussion-name", name);
      discussionName.value = name;

      await insertDiscussionPost({
        name,
        responseText,
        parentId
      });

      form.remove();
      await loadDiscussion();
    } catch (error) {
      console.error(error);
      status.textContent = "Could not post reply.";
      postButton.disabled = false;
    }
  });

  return form;
}

function createDiscussionPost(post, replies = []) {
  const wrapper = document.createElement("div");

  const card = document.createElement("article");
  card.className = "discussion-post";

  const head = document.createElement("div");
  head.className = "discussion-post-head";
  head.appendChild(makeTextElement("span", "discussion-name", post.display_name || "Anonymous"));
  head.appendChild(makeTextElement("span", "discussion-time", discussionTime(post.created_at)));

  card.appendChild(head);
  card.appendChild(makeTextElement("p", "discussion-text", post.response || ""));

  const actions = document.createElement("div");
  actions.className = "discussion-actions";

  const replyButton = document.createElement("button");
  replyButton.type = "button";
  replyButton.className = "text-button";
  replyButton.textContent = replies.length ? `Reply • ${replies.length}` : "Reply";

  replyButton.addEventListener("click", () => {
    const existing = wrapper.querySelector(".reply-form");
    if (existing) {
      existing.remove();
      return;
    }
    wrapper.appendChild(createReplyForm(post.id));
  });

  actions.appendChild(replyButton);
  card.appendChild(actions);
  wrapper.appendChild(card);

  if (replies.length) {
    const repliesContainer = document.createElement("div");
    repliesContainer.className = "replies";

    replies.forEach((reply) => {
      const replyCard = document.createElement("article");
      replyCard.className = "discussion-post reply-post";

      const replyHead = document.createElement("div");
      replyHead.className = "discussion-post-head";
      replyHead.appendChild(makeTextElement("span", "discussion-name", reply.display_name || "Anonymous"));
      replyHead.appendChild(makeTextElement("span", "discussion-time", discussionTime(reply.created_at)));

      replyCard.appendChild(replyHead);
      replyCard.appendChild(makeTextElement("p", "discussion-text", reply.response || ""));
      repliesContainer.appendChild(replyCard);
    });

    wrapper.appendChild(repliesContainer);
  }

  return wrapper;
}

async function loadDiscussion() {
  discussionFeed.innerHTML = "";

  try {
    const posts = await fetchDiscussionPosts();
    discussionCount.textContent = `${posts.length} post${posts.length === 1 ? "" : "s"}`;

    const repliesByParent = new Map();
    const topLevel = [];

    posts.forEach((post) => {
      if (post.parent_response_id == null) {
        topLevel.push(post);
      } else {
        const key = String(post.parent_response_id);
        if (!repliesByParent.has(key)) repliesByParent.set(key, []);
        repliesByParent.get(key).push(post);
      }
    });

    if (!topLevel.length) {
      const empty = document.createElement("div");
      empty.className = "empty-discussion";
      empty.textContent = "No answers yet. Be the first Bud to start the discussion.";
      discussionFeed.appendChild(empty);
      return;
    }

    topLevel
      .slice()
      .reverse()
      .forEach((post) => {
        const replies = repliesByParent.get(String(post.id)) || [];
        discussionFeed.appendChild(createDiscussionPost(post, replies));
      });
  } catch (error) {
    console.error(error);
    discussionFeed.innerHTML = "";
    discussionFeed.appendChild(
      makeTextElement("p", "muted", "Could not load today’s discussion.")
    );
  }
}

discussionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = discussionName.value.trim();
  const responseText = discussionResponse.value.trim();

  if (!name || !responseText) return;

  discussionSubmit.disabled = true;
  discussionStatus.textContent = "Posting...";

  try {
    localStorage.setItem("budsniche-discussion-name", name);

    await insertDiscussionPost({
      name,
      responseText,
      parentId: null
    });

    discussionResponse.value = "";
    discussionStatus.textContent = "Posted!";
    await loadDiscussion();

    setTimeout(() => {
      discussionStatus.textContent = "Your answer will be visible to everyone.";
    }, 1800);
  } catch (error) {
    console.error(error);
    discussionStatus.textContent = "Could not post. Try again.";
  } finally {
    discussionSubmit.disabled = false;
  }
});


// Daily game loaded from Supabase
const scoringProfiles = {
  "chick-fil-a": {
    missed: "Dwarf Grill — 100",
    concepts: [
      { names: ["dwarf grill", "the dwarf grill"], score: 100 },
      { names: ["hapeville georgia", "hapeville", "hapeville ga"], score: 98 },
      { names: ["1946", "founded 1946"], score: 97 },
      { names: ["truett cathy", "s truett cathy"], score: 94 },
      { names: ["closed sundays", "closed sunday", "sunday closing"], score: 67 },
      { names: ["cow mascot", "cows", "eat mor chikin", "eat more chicken"], score: 52 },
      { names: ["polynesian sauce"], score: 43 },
      { names: ["waffle fries", "waffle fry"], score: 35 },
      { names: ["chicken sandwich", "chicken sandwiches"], score: 30 },
      { names: ["fast food"], score: 12 },
      { names: ["restaurant", "resturant", "restaraunt"], score: 4 }
    ]
  },
  "orca whale": {
    missed: "Orcinus orca — 100",
    concepts: [
      { names: ["orcinus orca"], score: 100 },
      { names: ["delphinidae"], score: 94 },
      { names: ["spyhopping", "spy hopping"], score: 90 },
      { names: ["echolocation", "echo location"], score: 76 },
      { names: ["pod", "pods"], score: 72 },
      { names: ["apex predator"], score: 68 },
      { names: ["dolphin", "dolphin family"], score: 58 },
      { names: ["salmon"], score: 52 },
      { names: ["marine mammal"], score: 44 },
      { names: ["black and white", "black white"], score: 30 },
      { names: ["killer whale"], score: 24 },
      { names: ["ocean"], score: 15 },
      { names: ["water"], score: 8 },
      { names: ["animal"], score: 3 }
    ]
  },
  "battle of gettysburg": {
    missed: "Pickett's Charge — 100",
    concepts: [
      { names: ["picketts charge", "pickett's charge"], score: 100 },
      { names: ["george meade", "meade"], score: 96 },
      { names: ["robert e lee", "robert lee", "general lee"], score: 94 },
      { names: ["july 1863", "1863"], score: 90 },
      { names: ["gettysburg pennsylvania", "pennsylvania"], score: 74 },
      { names: ["union"], score: 62 },
      { names: ["confederacy", "confederate"], score: 62 },
      { names: ["civil war", "american civil war"], score: 46 },
      { names: ["abraham lincoln", "lincoln"], score: 42 },
      { names: ["slavery"], score: 32 },
      { names: ["battlefield"], score: 18 },
      { names: ["war"], score: 8 }
    ]
  }
};

let rounds = [];
let roundIndex = 0;
let timerId = null;
let secondsLeft = 45;
let totalScore = 0;
let roundLocked = false;

const categoryLabel = document.getElementById("categoryLabel");
const topicLabel = document.getElementById("topicLabel");
const timer = document.getElementById("timer");
const answerForm = document.getElementById("answerForm");
const roundResults = document.getElementById("roundResults");
const nextRound = document.getElementById("nextRound");
const startRound = document.getElementById("startRound");
const totalScoreEl = document.getElementById("totalScore");

startRound.disabled = true;
categoryLabel.textContent = "Loading";
topicLabel.textContent = "Loading today's game...";

function normalize(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

async function loadDailyGame() {
  try {
    const endpoint =
      `${SUPABASE_URL}/rest/v1/daily_game?select=round_number,category,topic&date=eq.${encodeURIComponent(todayKey)}&published=eq.true&order=round_number.asc`;

    const response = await fetch(endpoint, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Could not load daily game (${response.status}): ${message}`);
    }

    const rows = await response.json();

    if (!rows.length) {
      rounds = [];
      categoryLabel.textContent = "No game yet";
      topicLabel.textContent = "Today's game has not been published.";
      startRound.disabled = true;
      return;
    }

    rounds = rows.map((row) => {
      const profile = scoringProfiles[String(row.topic || "").toLowerCase()] || {
        missed: "AI scoring for this topic is coming next.",
        concepts: []
      };

      return {
        round_number: row.round_number,
        category: row.category,
        topic: row.topic,
        missed: profile.missed,
        concepts: profile.concepts
      };
    });

    roundIndex = 0;
    totalScore = 0;
    totalScoreEl.textContent = "0";
    startRound.disabled = false;
    renderRound();
  } catch (error) {
    console.error(error);
    rounds = [];
    categoryLabel.textContent = "Game error";
    topicLabel.textContent = "Could not load today's game.";
    startRound.disabled = true;
  }
}

function currentInputs() {
  return [...answerForm.querySelectorAll("input")];
}

function renderRound() {
  if (!rounds.length) return;

  const round = rounds[roundIndex];
  categoryLabel.textContent = round.category;
  topicLabel.textContent = round.topic;
  secondsLeft = 45;
  timer.textContent = secondsLeft;
  roundLocked = false;
  roundResults.classList.add("hidden");
  roundResults.innerHTML = "";
  nextRound.classList.add("hidden");

  currentInputs().forEach((input) => {
    input.value = "";
    input.disabled = false;
  });

  document.getElementById("submitAnswers").disabled = false;
}

function startTimer() {
  if (!rounds.length) return;

  clearInterval(timerId);
  if (roundLocked) renderRound();

  secondsLeft = 45;
  timer.textContent = secondsLeft;

  timerId = setInterval(() => {
    secondsLeft -= 1;
    timer.textContent = secondsLeft;

    if (secondsLeft <= 0) {
      clearInterval(timerId);
      scoreRound();
    }
  }, 1000);
}

function scoreOne(answer, round) {
  const clean = normalize(answer);
  if (!clean) return { label: "(blank)", score: 0, concept: null };

  for (const concept of round.concepts) {
    for (const alias of concept.names) {
      if (normalize(alias) === clean) {
        return {
          label: answer.trim(),
          score: concept.score,
          concept: concept.names[0]
        };
      }
    }
  }

  return { label: answer.trim(), score: 0, concept: null };
}

function scoreRound() {
  if (roundLocked || !rounds.length) return;

  roundLocked = true;
  clearInterval(timerId);

  const round = rounds[roundIndex];
  const usedConcepts = new Set();
  const results = currentInputs().map((input) => scoreOne(input.value, round));

  let roundScore = 0;

  results.forEach((result) => {
    if (result.concept && usedConcepts.has(result.concept)) {
      result.duplicate = true;
      result.score = 0;
    }

    if (result.concept) usedConcepts.add(result.concept);
    roundScore += result.score;
  });

  totalScore += roundScore;
  totalScoreEl.textContent = totalScore;

  currentInputs().forEach((input) => input.disabled = true);
  document.getElementById("submitAnswers").disabled = true;

  roundResults.innerHTML = `
    <div class="result-list">
      ${results.map((r) => `
        <div class="result-item">
          <span>${escapeHtml(r.label)}${r.duplicate ? " <em>(duplicate)</em>" : ""}</span>
          <span class="result-score">${r.score}</span>
        </div>
      `).join("")}
    </div>
    <div class="missed">
      <strong>Round score: ${roundScore} / 400</strong><br/>
      <span class="muted">You missed: ${round.missed}</span>
    </div>
  `;

  roundResults.classList.remove("hidden");
  nextRound.textContent =
    roundIndex < rounds.length - 1 ? "Next Category" : "Finish / Play Again";
  nextRound.classList.remove("hidden");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  scoreRound();
});

startRound.addEventListener("click", startTimer);

nextRound.addEventListener("click", () => {
  if (!rounds.length) return;

  if (roundIndex < rounds.length - 1) {
    roundIndex += 1;
  } else {
    roundIndex = 0;
    totalScore = 0;
    totalScoreEl.textContent = "0";
  }

  renderRound();
  startTimer();
});

loadDailyContent();
loadPoll();
loadDiscussion();
loadDailyGame();
