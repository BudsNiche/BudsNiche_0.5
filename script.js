console.log("[BudsNiche] v17 AI Judge script loaded");
const SUPABASE_URL = "https://xrwtuneumaoviwdintej.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WshnYFpEH1zJRpjH9kzugA_1fV6iiGn";
const NICHE_JUDGE_URL = `${SUPABASE_URL}/functions/v1/bright-action`;
const NICHE_JUDGE_TIMEOUT_MS = 15000;

const today = new Date();
const todayKey = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0")
].join("-");

const longDate = today.toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});
const todayLabelEl = document.getElementById("todayLabel");
const issueDateEl = document.getElementById("issueDate");
if (todayLabelEl) todayLabelEl.textContent = longDate;
if (issueDateEl) issueDateEl.textContent = todayKey;

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
    if (item.goal_of_the_day) document.getElementById("goalText").textContent = item.goal_of_the_day;
    if (item.hot_take) document.getElementById("hotTakeText").textContent = item.hot_take;
    if (item.question_of_the_day) document.getElementById("questionText").textContent = item.question_of_the_day;

    if (item.this_or_that_a) {
      document.getElementById("thisOrThatAText").textContent = item.this_or_that_a;
      document.getElementById("thisOrThatAResultLabel").textContent = item.this_or_that_a;
    }

    if (item.this_or_that_b) {
      document.getElementById("thisOrThatBText").textContent = item.this_or_that_b;
      document.getElementById("thisOrThatBResultLabel").textContent = item.this_or_that_b;
    }

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
const checkinStreakEl = document.getElementById("checkinStreak");
if (checkinStreakEl) checkinStreakEl.textContent = streak || 1;

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


// Real shared This or That
const thisOrThatActions = document.getElementById("thisOrThatActions");
const thisOrThatResults = document.getElementById("thisOrThatResults");
const thisOrThatMeta = document.getElementById("thisOrThatMeta");

async function getOwnThisOrThatVote() {
  const endpoint =
    `${SUPABASE_URL}/rest/v1/this_or_that_votes?select=choice&date=eq.${encodeURIComponent(todayKey)}&voter_id=eq.${encodeURIComponent(voterId)}&limit=1`;

  const response = await fetch(endpoint, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
  });

  if (!response.ok) throw new Error(`Could not check This or That vote (${response.status})`);

  const rows = await response.json();
  return rows.length ? rows[0].choice : null;
}

async function fetchThisOrThatVotes() {
  const endpoint =
    `${SUPABASE_URL}/rest/v1/this_or_that_votes?select=choice&date=eq.${encodeURIComponent(todayKey)}`;

  const response = await fetch(endpoint, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
  });

  if (!response.ok) throw new Error(`Could not load This or That votes (${response.status})`);

  return await response.json();
}

function renderThisOrThatResults(votes, ownChoice = null) {
  const a = votes.filter(v => v.choice === "a").length;
  const b = votes.filter(v => v.choice === "b").length;
  const total = a + b;

  const aPct = total ? Math.round((a / total) * 100) : 0;
  const bPct = total ? 100 - aPct : 0;

  document.getElementById("thisOrThatAPercent").textContent = `${aPct}%`;
  document.getElementById("thisOrThatBPercent").textContent = `${bPct}%`;
  document.getElementById("thisOrThatABar").style.width = `${aPct}%`;
  document.getElementById("thisOrThatBBar").style.width = `${bPct}%`;

  const picked =
    ownChoice === "a"
      ? document.getElementById("thisOrThatAText").textContent
      : document.getElementById("thisOrThatBText").textContent;

  thisOrThatMeta.textContent = ownChoice
    ? `You picked ${picked} • ${total} total vote${total === 1 ? "" : "s"}`
    : `${total} total vote${total === 1 ? "" : "s"}`;

  thisOrThatActions.classList.add("hidden");
  thisOrThatResults.classList.remove("hidden");
}

async function loadThisOrThat() {
  try {
    const ownChoice = await getOwnThisOrThatVote();

    if (ownChoice) {
      const votes = await fetchThisOrThatVotes();
      renderThisOrThatResults(votes, ownChoice);
    } else {
      thisOrThatActions.classList.remove("hidden");
      thisOrThatResults.classList.add("hidden");
    }
  } catch (error) {
    console.error(error);
  }
}

async function submitThisOrThatVote(choice) {
  document.querySelectorAll(".this-or-that-btn").forEach(btn => btn.disabled = true);

  try {
    const existingChoice = await getOwnThisOrThatVote();

    if (existingChoice) {
      const votes = await fetchThisOrThatVotes();
      renderThisOrThatResults(votes, existingChoice);
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/this_or_that_votes`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        date: todayKey,
        choice,
        voter_id: voterId
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`This or That vote failed (${response.status}): ${message}`);
    }

    const votes = await fetchThisOrThatVotes();
    renderThisOrThatResults(votes, choice);
  } catch (error) {
    console.error(error);
    thisOrThatMeta.textContent = "Could not save your choice. Try again.";
    thisOrThatResults.classList.remove("hidden");
  } finally {
    document.querySelectorAll(".this-or-that-btn").forEach(btn => btn.disabled = false);
  }
}

document.querySelectorAll(".this-or-that-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    submitThisOrThatVote(btn.dataset.choice);
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
const discussionPanel = document.getElementById("discussionPanel");
const enterDiscussionBtn = document.getElementById("enterDiscussionBtn");

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

  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.className = "vote-mini";
  likeButton.disabled = true;
  likeButton.title = "Shared likes connect next";
  likeButton.textContent = `👍 ${Number(post.likes || 0)}`;

  const dislikeButton = document.createElement("button");
  dislikeButton.type = "button";
  dislikeButton.className = "vote-mini";
  dislikeButton.disabled = true;
  dislikeButton.title = "Shared dislikes connect next";
  dislikeButton.textContent = "👎 0";

  actions.appendChild(replyButton);
  actions.appendChild(likeButton);
  actions.appendChild(dislikeButton);
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
    discussionStatus.textContent = "Posted! Enter the thread when you're ready.";
    localStorage.setItem(`budsniche-discussion-posted-${todayKey}`, "true");
    enterDiscussionBtn.classList.remove("hidden");
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



const hasPostedToday = localStorage.getItem(`budsniche-discussion-posted-${todayKey}`) === "true";
if (hasPostedToday) enterDiscussionBtn.classList.remove("hidden");

const closeDiscussionBtn = document.getElementById("closeDiscussionBtn");

function openDiscussionOverlay() {
  discussionPanel.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  loadDiscussion();
}

function closeDiscussionOverlay() {
  discussionPanel.classList.add("hidden");
  document.body.style.overflow = "";
}

enterDiscussionBtn.addEventListener("click", openDiscussionOverlay);
closeDiscussionBtn.addEventListener("click", closeDiscussionOverlay);

// Daily game loaded from Supabase
const scoringProfiles = {
  "chick-fil-a": {
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
  },

  // September 18, 2026 — Round 1
  // McDonald's Menu: more specific / less obvious menu knowledge scores higher.
  "mcdonald's menu": {
    concepts: [
      { names: ["sausage burrito", "breakfast burrito"], score: 100 },
      { names: ["fruit and maple oatmeal", "fruit & maple oatmeal", "oatmeal"], score: 96 },
      { names: ["bacon egg and cheese biscuit", "bacon egg cheese biscuit"], score: 92 },
      { names: ["sausage biscuit with egg", "sausage egg biscuit"], score: 90 },
      { names: ["hotcakes and sausage", "hotcakes with sausage"], score: 88 },
      { names: ["filet o fish", "filet-o-fish", "fish fillet"], score: 82 },
      { names: ["sausage mcgriddles", "sausage mcgriddle", "mcgriddle", "mcgriddles"], score: 78 },
      { names: ["egg mcmuffin", "egg mc muffin"], score: 74 },
      { names: ["double quarter pounder with cheese", "double quarter pounder"], score: 69 },
      { names: ["quarter pounder with cheese", "quarter pounder", "qp with cheese"], score: 58 },
      { names: ["mcchicken", "mc chicken"], score: 48 },
      { names: ["mccrispy", "mc crispy", "crispy chicken sandwich"], score: 46 },
      { names: ["big mac", "bigmac"], score: 36 },
      { names: ["chicken mcnuggets", "mcnuggets", "mc nuggets", "nuggets", "chicken nuggets"], score: 28 },
      { names: ["french fries", "fries", "world famous fries"], score: 20 },
      { names: ["cheeseburger", "cheese burger"], score: 17 },
      { names: ["hamburger", "burger"], score: 12 },
      { names: ["coke", "coca cola", "coca-cola", "soda", "pop"], score: 6 }
    ]
  },
  "mcdonalds menu": {
    concepts: [
      { names: ["sausage burrito", "breakfast burrito"], score: 100 },
      { names: ["fruit and maple oatmeal", "fruit & maple oatmeal", "oatmeal"], score: 96 },
      { names: ["bacon egg and cheese biscuit", "bacon egg cheese biscuit"], score: 92 },
      { names: ["sausage biscuit with egg", "sausage egg biscuit"], score: 90 },
      { names: ["hotcakes and sausage", "hotcakes with sausage"], score: 88 },
      { names: ["filet o fish", "filet-o-fish", "fish fillet"], score: 82 },
      { names: ["sausage mcgriddles", "sausage mcgriddle", "mcgriddle", "mcgriddles"], score: 78 },
      { names: ["egg mcmuffin", "egg mc muffin"], score: 74 },
      { names: ["double quarter pounder with cheese", "double quarter pounder"], score: 69 },
      { names: ["quarter pounder with cheese", "quarter pounder", "qp with cheese"], score: 58 },
      { names: ["mcchicken", "mc chicken"], score: 48 },
      { names: ["mccrispy", "mc crispy", "crispy chicken sandwich"], score: 46 },
      { names: ["big mac", "bigmac"], score: 36 },
      { names: ["chicken mcnuggets", "mcnuggets", "mc nuggets", "nuggets", "chicken nuggets"], score: 28 },
      { names: ["french fries", "fries", "world famous fries"], score: 20 },
      { names: ["cheeseburger", "cheese burger"], score: 17 },
      { names: ["hamburger", "burger"], score: 12 },
      { names: ["coke", "coca cola", "coca-cola", "soda", "pop"], score: 6 }
    ]
  },

  // September 18, 2026 — Round 2
  // Physics: advanced named concepts score highest; broad everyday terms score lower.
  "physics": {
    concepts: [
      { names: ["noethers theorem", "noether theorem", "noether's theorem"], score: 100 },
      { names: ["lagrangian mechanics", "lagrangian"], score: 98 },
      { names: ["schrodinger equation", "schrödinger equation", "schrodingers equation"], score: 96 },
      { names: ["lorentz transformation", "lorentz transformations"], score: 92 },
      { names: ["wave particle duality", "wave-particle duality"], score: 88 },
      { names: ["heisenberg uncertainty principle", "uncertainty principle"], score: 86 },
      { names: ["quantum entanglement", "entanglement"], score: 82 },
      { names: ["thermodynamics", "laws of thermodynamics"], score: 76 },
      { names: ["entropy"], score: 72 },
      { names: ["electromagnetism", "electromagnetic force"], score: 68 },
      { names: ["quantum mechanics", "quantum physics"], score: 62 },
      { names: ["relativity", "general relativity", "special relativity"], score: 60 },
      { names: ["newtons laws", "newton's laws", "newton laws"], score: 48 },
      { names: ["f equals ma", "f=ma", "force equals mass times acceleration"], score: 44 },
      { names: ["momentum"], score: 38 },
      { names: ["acceleration"], score: 31 },
      { names: ["force"], score: 25 },
      { names: ["energy"], score: 22 },
      { names: ["gravity", "gravitational force"], score: 20 },
      { names: ["motion"], score: 14 },
      { names: ["science"], score: 4 }
    ]
  },

  // September 18, 2026 — Round 3
  // Iowa State University: calibrated to Makai's mini-training ratings on Sept. 18, 2026.
  "iowa state university": {
    concepts: [
      // Makai-trained examples from the mini judge session.
      { names: ["george washington carver", "george carver", "carver"], score: 99 },
      { names: ["iowa agricultural college and model farm", "iowa agricultural college"], score: 98 },
      { names: ["1858", "founded 1858", "established 1858"], score: 96 },
      { names: ["first state to accept the morrill act", "morrill act", "land grant"], score: 94 },
      { names: ["veishea"], score: 92 },
      { names: ["campanile", "stanton memorial carillon", "carillon"], score: 89 },
      { names: ["hilton magic"], score: 76 },
      { names: ["cy the cardinal", "cy", "cardinal mascot"], score: 70 },
      { names: ["hilton coliseum", "hilton"], score: 64 },
      { names: ["jack trice", "jack trice stadium"], score: 63 },
      { names: ["ames iowa", "ames"], score: 47 },
      { names: ["cardinal and gold", "cardinal gold", "cardinal", "gold"], score: 44 },
      { names: ["big 12", "big twelve", "big 12 conference"], score: 38 },
      { names: ["cyclones", "cyclone"], score: 33 },
      { names: ["college", "university", "school"], score: 18 },
      { names: ["iowa"], score: 8 }
    ]
  }
};

let rounds = [];
let roundIndex = 0;
let timerId = null;
let secondsLeft = 45;
let totalScore = 0;
let roundActive = false;
let roundComplete = false;
let currentAnswers = [];
let gameInView = false;
let gameFinished = false;

const categoryLabel = document.getElementById("categoryLabel");
const topicLabel = document.getElementById("topicLabel");
const timer = document.getElementById("timer");
const answerForm = document.getElementById("answerForm");
const singleAnswerInput = document.getElementById("singleAnswerInput");
const answerProgress = document.getElementById("answerProgress");
const submittedAnswers = document.getElementById("submittedAnswers");
const roundResults = document.getElementById("roundResults");
const nextRound = document.getElementById("nextRound");
const totalScoreEl = document.getElementById("totalScore");
const totalPossibleEl = document.getElementById("totalPossible");
const roundCounter = document.getElementById("roundCounter");
const gameStage = document.getElementById("gameStage");
const finalScorePanel = document.getElementById("finalScorePanel");
const finalScore = document.getElementById("finalScore");

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
      `${SUPABASE_URL}/rest/v1/daily_game?select=round_number,category,topic,round_type&date=eq.${encodeURIComponent(todayKey)}&published=eq.true&order=round_number.asc`;

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
      categoryLabel.textContent = "NO GAME YET";
      topicLabel.textContent = "Today's game has not been published.";
      answerProgress.textContent = "Check back later.";
      singleAnswerInput.disabled = true;
      return;
    }

    rounds = rows.map((row) => {
      const profile = scoringProfiles[String(row.topic || "").toLowerCase()] || {
        concepts: []
      };

      return {
        round_number: row.round_number,
        category: row.category,
        topic: row.topic,
        round_type: row.round_type || "niche",
        // These local concepts are now backup scoring + today's Top 4 display only.
        // Normal Niche scoring is handled by the live Supabase AI Judge.
        concepts: profile.concepts
      };
    });

    totalPossibleEl.textContent = String(rounds.length * 400);
    prepareRound();

    if (gameInView) startRound();
  } catch (error) {
    console.error(error);
    rounds = [];
    categoryLabel.textContent = "GAME ERROR";
    topicLabel.textContent = "Could not load today's game.";
    singleAnswerInput.disabled = true;
  }
}

function prepareRound() {
  if (!rounds.length || gameFinished) return;

  clearInterval(timerId);
  roundActive = false;
  roundComplete = false;
  currentAnswers = [];
  secondsLeft = 45;

  const round = rounds[roundIndex];
  categoryLabel.textContent = round.category;
  topicLabel.textContent = round.topic;
  timer.textContent = "45";
  roundCounter.textContent = `${roundIndex + 1} / ${rounds.length}`;
  answerProgress.textContent = "Answer 1 of 4";
  submittedAnswers.innerHTML = "";
  roundResults.innerHTML = "";
  roundResults.classList.add("hidden");
  nextRound.classList.add("hidden");
  singleAnswerInput.value = "";
  singleAnswerInput.disabled = false;
}

function startRound() {
  if (!rounds.length || roundActive || roundComplete || gameFinished) return;

  roundActive = true;
  secondsLeft = 45;
  timer.textContent = String(secondsLeft);
  singleAnswerInput.disabled = false;
  singleAnswerInput.focus({ preventScroll: true });

  clearInterval(timerId);
  timerId = setInterval(() => {
    secondsLeft -= 1;
    timer.textContent = String(Math.max(secondsLeft, 0));

    if (secondsLeft <= 0) {
      finishRound();
    }
  }, 1000);
}

function scoreOneBackup(answer, round) {
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

async function judgeNicheAnswers(round, answers) {
  if (!answers.length) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NICHE_JUDGE_TIMEOUT_MS);

  try {
    const response = await fetch(NICHE_JUDGE_URL, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        category: round.category,
        topic: round.topic,
        answers
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`AI Judge returned ${response.status}: ${message}`);
    }

    const data = await response.json();
    if (!data?.ok || !Array.isArray(data.judgments)) {
      throw new Error("AI Judge returned an unexpected response.");
    }

    // Match by player_answer first instead of trusting network response order.
    const pool = data.judgments.map((judgment) => ({ judgment, used: false }));

    return answers.map((answer) => {
      const clean = normalize(answer);
      let match = pool.find(
        (entry) => !entry.used && normalize(entry.judgment?.player_answer || "") === clean
      );

      // Safe fallback if a future Judge version omits player_answer or changes ordering.
      if (!match) match = pool.find((entry) => !entry.used);
      if (match) match.used = true;

      const judgment = match?.judgment || {};
      const rawScore = Number(judgment.score);
      const score = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : 0;

      return {
        label: answer.trim() || "(blank)",
        score,
        concept: judgment.canonical_concept || clean || null,
        reason: judgment.reason || "",
        confidence: Number(judgment.confidence ?? 0),
        needs_review: Boolean(judgment.needs_review),
        source: judgment.source || "ai"
      };
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function submitSingleAnswer() {
  if (!roundActive || roundComplete) return;

  const value = singleAnswerInput.value.trim();
  if (!value) return;

  currentAnswers.push(value);

  const chip = document.createElement("span");
  chip.className = "submitted-chip";
  chip.textContent = `${String(currentAnswers.length).padStart(2, "0")} // ${value}`;
  submittedAnswers.appendChild(chip);

  singleAnswerInput.value = "";

  if (currentAnswers.length >= 4) {
    finishRound();
    return;
  }

  answerProgress.textContent = `Answer ${currentAnswers.length + 1} of 4`;
  singleAnswerInput.focus({ preventScroll: true });
}

function topFourAnswers(round) {
  return round.concepts
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => ({
      label: item.names[0],
      score: item.score
    }));
}

async function finishRound() {
  if (roundComplete || !rounds.length) return;

  roundComplete = true;
  roundActive = false;
  clearInterval(timerId);
  singleAnswerInput.disabled = true;

  const round = rounds[roundIndex];
  const submitted = currentAnswers.slice(0, 4);
  const paddedAnswers = submitted.slice();
  while (paddedAnswers.length < 4) paddedAnswers.push("");

  answerProgress.textContent = submitted.length
    ? "AI Judge is scoring your answers..."
    : "No answers submitted.";

  roundResults.innerHTML = submitted.length
    ? `<h4 class="round-summary-title">AI JUDGE // SCORING...</h4><p class="poll-result">Checking training, cache, then Luna only if needed.</p>`
    : "";
  if (submitted.length) roundResults.classList.remove("hidden");

  let results = [];
  let usedBackupScoring = false;

  if (submitted.length) {
    try {
      if (round.round_type !== "niche") {
        throw new Error(`Round type '${round.round_type}' is not wired yet.`);
      }
      results = await judgeNicheAnswers(round, submitted);
    } catch (error) {
      console.error("AI Judge failed; using backup scoring.", error);
      usedBackupScoring = true;
      results = submitted.map((answer) => scoreOneBackup(answer, round));
    }
  }

  while (results.length < 4) {
    results.push({
      label: "(blank)",
      score: 0,
      concept: null,
      source: "blank"
    });
  }

  // A canonical concept may only score once per round, even if the player
  // types a synonym/alias as another answer.
  const usedConcepts = new Set();
  let roundScore = 0;

  results.forEach((result) => {
    const conceptKey = normalize(result.concept || "");

    if (conceptKey && usedConcepts.has(conceptKey)) {
      result.duplicate = true;
      result.score = 0;
    }

    if (conceptKey) usedConcepts.add(conceptKey);
    roundScore += Number(result.score || 0);
  });

  totalScore += roundScore;
  totalScoreEl.textContent = String(totalScore);

  const top = topFourAnswers(round);
  const judgeNote = usedBackupScoring
    ? `<p class="poll-result">AI Judge was unavailable, so backup scoring was used for this round.</p>`
    : `<p class="poll-result">Scored by the BudsNiche AI Judge. Trained/cached answers do not need a new AI judgment.</p>`;

  roundResults.innerHTML = `
    <h4 class="round-summary-title">ROUND COMPLETE</h4>
    ${judgeNote}
    <div class="result-columns">
      <div class="result-panel">
        <h4>YOUR ANSWERS</h4>
        <div class="result-list">
          ${results.map((r) => `
            <div class="result-item">
              <span>${escapeHtml(r.label)}${r.duplicate ? " (duplicate)" : ""}</span>
              <span class="result-score">${r.score}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="result-panel">
        <h4>TOP 4 ANSWERS</h4>
        ${
          top.length
            ? `<ol class="top-answer-list">
                ${top.map((item) => `<li>${escapeHtml(item.label)} — <strong>${item.score}</strong></li>`).join("")}
               </ol>`
            : `<p>Top answers for this topic haven't been published yet.</p>`
        }
      </div>
    </div>

    <p class="round-score-line">ROUND SCORE // ${roundScore} / 400</p>
  `;

  answerProgress.textContent = "Round complete.";
  roundResults.classList.remove("hidden");
  nextRound.textContent =
    roundIndex < rounds.length - 1 ? "NEXT CATEGORY →" : "SEE TODAY'S RESULT →";
  nextRound.classList.remove("hidden");
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSingleAnswer();
});

nextRound.addEventListener("click", () => {
  if (roundIndex < rounds.length - 1) {
    roundIndex += 1;
    prepareRound();
    gameStage.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(startRound, 450);
    return;
  }

  gameFinished = true;
  finalScore.textContent = String(totalScore);
  finalScorePanel.classList.remove("hidden");
  nextRound.classList.add("hidden");
  finalScorePanel.scrollIntoView({ behavior: "smooth", block: "center" });
});

const gameObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      gameInView = entry.isIntersecting;

      if (
        entry.isIntersecting &&
        rounds.length &&
        !roundActive &&
        !roundComplete &&
        !gameFinished
      ) {
        startRound();
      }
    });
  },
  { threshold: 0.62 }
);

gameObserver.observe(gameStage);




// Retro top tabs / pop-up windows
const modalBackdrop = document.getElementById("modalBackdrop");

function closeAllModals() {
  modalBackdrop.classList.add("hidden");
  document.querySelectorAll(".retro-modal").forEach((modal) => modal.classList.add("hidden"));
}

document.querySelectorAll("[data-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    closeAllModals();
    modalBackdrop.classList.remove("hidden");
    document.getElementById(button.dataset.modal).classList.remove("hidden");
  });
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeAllModals);
});

modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeAllModals();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModals();
    if (!discussionPanel.classList.contains("hidden")) closeDiscussionOverlay();
  }
});

const feedbackForm = document.getElementById("feedbackForm");
const feedbackText = document.getElementById("feedbackText");
const feedbackStatus = document.getElementById("feedbackStatus");

feedbackForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = feedbackText.value.trim();
  if (!value) return;

  const existing = JSON.parse(localStorage.getItem("budsniche-feedback-drafts") || "[]");
  existing.push({ date: todayKey, feedback: value });
  localStorage.setItem("budsniche-feedback-drafts", JSON.stringify(existing));

  feedbackText.value = "";
  feedbackStatus.textContent = "Saved on this browser. Shared feedback inbox connection comes next.";
});



// Dashboard path progress
const dailyPathSteps = [...document.querySelectorAll("[data-step]")];
const pathFill = document.getElementById("pathFill");
const pathArea = document.querySelector(".path-area");
const dailyProgressNumber = document.getElementById("dailyProgressNumber");
const dailyProgressBar = document.getElementById("dailyProgressBar");
const dailyProgressLabel = document.getElementById("dailyProgressLabel");

function updateDailyPath() {
  if (!pathArea || !pathFill) return;

  const areaRect = pathArea.getBoundingClientRect();
  const trigger = Math.min(window.innerHeight * 0.55, window.innerHeight - 70);
  const filled = Math.max(
    0,
    Math.min(pathArea.offsetHeight - 130, trigger - areaRect.top)
  );

  pathFill.style.height = `${filled}px`;

  let passedCount = 0;
  let activeLabel = "CHECK IN";

  dailyPathSteps.forEach((step) => {
    const rect = step.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const active = center > window.innerHeight * 0.27 && center < window.innerHeight * 0.72;
    const passed = center < window.innerHeight * 0.27;

    step.classList.toggle("active", active);
    step.classList.toggle("passed", passed);

    if (passed) passedCount += 1;
    if (active && step.dataset.label) activeLabel = step.dataset.label;
  });

  const current = Math.min(dailyPathSteps.length, passedCount + 1);

  if (dailyProgressNumber) {
    dailyProgressNumber.textContent = `${current} / ${dailyPathSteps.length}`;
  }

  if (dailyProgressBar) {
    dailyProgressBar.style.width =
      `${(current / Math.max(dailyPathSteps.length, 1)) * 100}%`;
  }

  if (dailyProgressLabel) {
    dailyProgressLabel.textContent = `currently: ${activeLabel}`;
  }
}

window.addEventListener("scroll", updateDailyPath, { passive: true });
window.addEventListener("resize", updateDailyPath);
updateDailyPath();

// Goal completion is local to this browser for now.
const completeGoalButton = document.getElementById("completeGoal");
if (completeGoalButton) {
  const goalDoneKey = `budsniche-goal-done-${todayKey}`;

  if (localStorage.getItem(goalDoneKey) === "true") {
    completeGoalButton.classList.add("done");
    completeGoalButton.textContent = "Completed ✓";
  }

  completeGoalButton.addEventListener("click", () => {
    localStorage.setItem(goalDoneKey, "true");
    completeGoalButton.classList.add("done");
    completeGoalButton.textContent = "Completed ✓";
  });
}

// Separate game launch
const gameZone = document.getElementById("gameZone");
const launchGame = document.getElementById("launchGame");
const topGameButton = document.getElementById("topGameButton");
const closeGame = document.getElementById("closeGame");
const gameLaunchCard = document.getElementById("game-launch");

function openGameZone() {
  if (!gameZone) return;
  gameZone.classList.remove("hidden");
  requestAnimationFrame(() => {
    gameZone.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (launchGame && gameZone) {
  launchGame.addEventListener("click", openGameZone);
}

if (topGameButton && gameLaunchCard) {
  topGameButton.addEventListener("click", () => {
    gameLaunchCard.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

if (closeGame && gameZone && gameLaunchCard) {
  closeGame.addEventListener("click", () => {
    gameZone.classList.add("hidden");
    gameLaunchCard.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

// Small dashboard dates
const sidebarDate = document.getElementById("sidebarDate");
if (sidebarDate) {
  sidebarDate.textContent = today.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

console.log("[BudsNiche] starting data loaders", todayKey);

Promise.resolve().then(loadDailyContent).catch((error) => console.error("daily content loader failed", error));
Promise.resolve().then(loadPoll).catch((error) => console.error("hot take loader failed", error));
Promise.resolve().then(loadThisOrThat).catch((error) => console.error("this-or-that loader failed", error));
Promise.resolve().then(loadDiscussion).catch((error) => console.error("discussion loader failed", error));
Promise.resolve().then(loadDailyGame).catch((error) => console.error("game loader failed", error));
