const $ = (id) => document.getElementById(id);

// Supabase browser configuration: publishable key is intended for frontend use.
// Never put a Supabase service_role/secret key in this file.
const SUPABASE_URL = "https://vkqtvjdsaihiufsubnmu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lSAe_3EpAZA5DplXfTD8Nw_pSjhM9Eg";

if (!window.supabase?.createClient) {
  throw new Error("Supabase library did not load. Check your internet connection.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let mode = "message";
let historyItems = [];
let historyStorageKey = null;
let latestResult = null;
let currentUser = null;
let authInitialized = false;

function showAuthMessage(message, isError = false) {
  const box = $("authMessage");
  box.textContent = message;
  box.classList.remove("hidden");
  box.classList.toggle("error", isError);
}

function switchAuthTab(tab) {
  const login = tab === "login";
  $("loginForm").classList.toggle("hidden", !login);
  $("signupForm").classList.toggle("hidden", login);
  $("loginTab").classList.toggle("active", login);
  $("signupTab").classList.toggle("active", !login);
  $("authMessage").classList.add("hidden");
}

function navigate(viewId) {
  document.querySelectorAll(".view:not(#authView)").forEach(view => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.target === viewId);
  });
  $("crumb").textContent =
    viewId === "overview" ? "Overview" :
    viewId === "scanner" ? "Scam scanner" : "Scan history";
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.target));
});

$("quickScan").addEventListener("click", () => {
  navigate("overview");
  $("messageInput").focus();
});

$("goScan").addEventListener("click", () => {
  navigate("overview");
  $("messageInput").focus();
});

document.querySelectorAll(".scan-tab").forEach(button => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll(".scan-tab").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });
    $("messageForm").classList.toggle("hidden", mode !== "message");
    $("urlForm").classList.toggle("hidden", mode !== "url");
    $("errorBox").classList.add("hidden");
  });
});

$("messageInput").addEventListener("input", () => {
  $("charCount").textContent = `${$("messageInput").value.length} / 5000`;
});

$("scanButton").addEventListener("click", runScan);

$("clearHistory").addEventListener("click", () => {
  historyItems = [];
  if (historyStorageKey) {
    localStorage.setItem(historyStorageKey, "[]");
  }
  renderHistory();
  renderStats();
});

function showDashboard(user) {
  currentUser = user;
  document.body.classList.remove("auth-mode");
  $("authView").classList.remove("active");
  $("signOutButton").classList.remove("hidden");

  historyStorageKey = `scamShieldHistory_${user.id}`;
  try {
    const stored = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
    historyItems = Array.isArray(stored) ? stored : [];
  } catch {
    historyItems = [];
  }

  navigate("overview");
  renderHistory();
  renderStats();
  checkHealth();
}

function showLogin() {
  currentUser = null;
  historyItems = [];
  historyStorageKey = null;
  document.body.classList.add("auth-mode");

  document.querySelectorAll(".view:not(#authView)").forEach(view => {
    view.classList.remove("active");
  });
  $("authView").classList.add("active");
  $("signOutButton").classList.add("hidden");
  renderHistory();
  renderStats();
}

$("loginTab").addEventListener("click", () => switchAuthTab("login"));
$("signupTab").addEventListener("click", () => switchAuthTab("signup"));

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("loginSubmit");
  submit.disabled = true;
  submit.textContent = "Signing in…";

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: $("loginEmail").value.trim(),
      password: $("loginPassword").value
    });
    if (error) throw error;
    // onAuthStateChange opens the dashboard after Supabase establishes the session.
  } catch (error) {
    showAuthMessage(error.message || "Unable to sign in.", true);
  } finally {
    submit.disabled = false;
    submit.textContent = "Sign In →";
  }
});

$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const confirmation = $("confirmPassword").value;

  if (password !== confirmation) {
    showAuthMessage("Passwords do not match.", true);
    return;
  }

  const submit = $("signupSubmit");
  submit.disabled = true;
  submit.textContent = "Creating account…";

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password
    });
    if (error) throw error;

    if (data.session?.user) {
      showAuthMessage("Account created successfully.");
      // The auth state listener will open the dashboard.
    } else {
      switchAuthTab("login");
      showAuthMessage(
        "Account created. Check your email and confirm your address before signing in."
      );
    }
  } catch (error) {
    showAuthMessage(error.message || "Unable to create account.", true);
  } finally {
    submit.disabled = false;
    submit.textContent = "Create Account →";
  }
});

$("forgotPassword").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  if (!email) {
    showAuthMessage("Enter your email address first.", true);
    return;
  }

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if (error) throw error;
    showAuthMessage("If an account exists for that email, password reset instructions have been sent.");
  } catch (error) {
    showAuthMessage(error.message || "Unable to send password reset email.", true);
  }
});

$("signOutButton").addEventListener("click", async () => {
  $("signOutButton").disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    showLogin();
    switchAuthTab("login");
  } catch (error) {
    alert(error.message || "Unable to sign out.");
  } finally {
    $("signOutButton").disabled = false;
  }
});

async function initializeAuthentication() {
  // Register the listener first so a sign-in event cannot be missed during startup.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      if (currentUser?.id !== session.user.id || document.body.classList.contains("auth-mode")) {
        showDashboard(session.user);
      }
    } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
      showLogin();
    }
  });

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showLogin();
    showAuthMessage("Could not restore your session. Please sign in again.", true);
    return;
  }

  if (data.session?.user) {
    showDashboard(data.session.user);
  } else {
    showLogin();
  }
  authInitialized = true;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("Health check failed");
    const data = await response.json();

    $("connection").classList.toggle("offline", !data.ollama);
    $("connection").innerHTML = `<i></i><span>${data.ollama ? "Local AI connected" : "Ollama offline"}</span>`;
    $("aiStat").textContent = data.ollama ? "Online" : "Offline";
    $("aiStat").style.color = data.ollama ? "var(--green)" : "var(--red)";
    $("modelStat").textContent = data.model || "AI model status";
  } catch {
    $("connection").classList.add("offline");
    $("connection").innerHTML = "<i></i><span>Backend unavailable</span>";
    $("aiStat").textContent = "Offline";
    $("modelStat").textContent = "Backend unavailable";
  }
}

async function runScan() {
  if (!currentUser) {
    showLogin();
    return;
  }

  const text = mode === "message"
    ? $("messageInput").value.trim()
    : $("urlInput").value.trim();

  const error = $("errorBox");
  error.classList.add("hidden");

  if (!text) {
    error.textContent = mode === "message"
      ? "Please paste a message to analyze."
      : "Please enter a website address.";
    error.classList.remove("hidden");
    return;
  }

  if (mode === "message" && text.length > 5000) {
    error.textContent = "Please keep the message under 5,000 characters.";
    error.classList.remove("hidden");
    return;
  }

  const button = $("scanButton");
  button.disabled = true;
  button.textContent = "Analyzing…";
  $("emptyResult").classList.add("hidden");
  $("resultContent").classList.add("hidden");
  $("resultBadge").textContent = "ANALYZING";
  $("resultBadge").className = "result-badge neutral";

  try {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const endpoint = mode === "message"
      ? "/api/scan/message"
      : "/api/scan/url";

    const payload = mode === "message"
      ? { text, language: $("language").value }
      : { url: text, language: $("language").value };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      await supabaseClient.auth.signOut();
      throw new Error("Your session is no longer valid. Please sign in again.");
    }
    if (!response.ok) {
      let detail = `Server error (${response.status})`;
      try {
        const body = await response.json();
        if (body.detail) detail = body.detail;
      } catch {}
      throw new Error(detail);
    }

    const result = await response.json();
    latestResult = {
      ...result,
      input: text,
      createdAt: new Date().toISOString()
    };

    showResult(result);
    historyItems.unshift(latestResult);
    historyItems = historyItems.slice(0, 30);

    if (historyStorageKey) {
      localStorage.setItem(historyStorageKey, JSON.stringify(historyItems));
    }
    renderHistory();
    renderStats();
  } catch (error) {
    errorBoxMessage(error);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Analyze with AI <span>→</span>';
  }
}

function errorBoxMessage(error) {
  const box = $("errorBox");
  box.textContent = `Could not complete scan: ${error.message}. Check your sign-in and Python server.`;
  box.classList.remove("hidden");
  $("emptyResult").classList.remove("hidden");
}

function showResult(result) {
  $("resultContent").classList.remove("hidden");
  $("emptyResult").classList.add("hidden");

  const score = Math.max(0, Math.min(100, Number(result.score) || 0));
  $("scoreValue").textContent = score;
  $("scoreRing").style.background =
    `conic-gradient(${score >= 65 ? "var(--red)" : score >= 30 ? "var(--amber)" : "var(--green)"} ${score * 3.6}deg, #dfd2c1 0deg)`;

  $("scoreLabel").textContent = result.label || "Assessment complete";
  $("scoreSummary").textContent = result.type === "url"
    ? `Pattern-based URL assessment for ${result.normalized_url}`
    : "Message assessment using visible warning signs and the configured AI explanation.";

  $("resultBadge").textContent = (result.label || "RESULT").toUpperCase();
  $("resultBadge").className =
    `result-badge ${score >= 65 ? "high" : score >= 30 ? "medium" : "low"}`;

  $("flagsList").replaceChildren();
  (result.flags || []).forEach(flag => {
    const item = document.createElement("li");
    item.textContent = flag;
    $("flagsList").appendChild(item);
  });

  $("aiExplanation").textContent = result.explanation || "No explanation returned.";
}

function renderStats() {
  $("totalScans").textContent = historyItems.length;
  $("threatsFound").textContent =
    historyItems.filter(item => Number(item.score) >= 30).length;
}

function renderHistory() {
  const target = $("historyList");
  if (!target) return;

  if (!historyItems.length) {
    target.innerHTML = '<div class="empty-history">No scans yet. Your completed scans will appear here.</div>';
    return;
  }

  target.replaceChildren();
  historyItems.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-item";

    const icon = document.createElement("div");
    icon.className = "history-type";
    icon.textContent = item.type === "url" ? "↗" : "▤";

    const description = document.createElement("div");
    description.className = "history-desc";

    const title = document.createElement("b");
    title.textContent = item.input || "Scan";

    const small = document.createElement("small");
    small.textContent =
      `${item.type === "url" ? "URL scan" : "Message scan"} · ${new Date(item.createdAt).toLocaleString()}`;

    description.append(title, small);

    const risk = document.createElement("span");
    const score = Number(item.score) || 0;
    risk.className =
      `history-risk ${score >= 65 ? "high" : score >= 30 ? "medium" : "low"}`;
    risk.textContent = `${score}/100`;

    row.append(icon, description, risk);
    target.appendChild(row);
  });
}

// Start with an empty history display; authentication then loads the current user's history.
renderHistory();
renderStats();
initializeAuthentication();
