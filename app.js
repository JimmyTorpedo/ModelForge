/* 
========================================================================
ModelForge Frontend Core Application Logic (app.js)
========================================================================
Handles onboarding AI chats, training pipeline WebSockets, local-first
state management, model inventories, profile editors, and Supabase cloud DB.
*/

// ─── Security Check & Configuration ──────────────────────────────────────────
var metaViewport = document.querySelector('meta[name=viewport]');
if (metaViewport) {
  metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
}

if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && !window.location.hostname.endsWith(".local")) {
  var pwd = prompt("Enter access password to view demo:");
  if (pwd !== "madeira2026") {
    document.body.innerHTML = "<h1 style='text-align:center;margin-top:20vh;color:#111827;font-family:sans-serif'>Access Denied</h1>";
    throw new Error("Access Denied");
  }
}

function getBaseUrl() {
  var url = localStorage.getItem("backendBaseUrl") || "http://localhost:8000";
  return url.trim().replace(/\/$/, "");
}

function getApiUrl() { return getBaseUrl() + "/chat/direct"; }
function getUploadUrl() { return getBaseUrl() + "/upload"; }
function getRundownUrl() { return getBaseUrl() + "/rundown"; }
function getTrainUrl() { return getBaseUrl() + "/train"; }
function getWsUrl() {
  var base = getBaseUrl();
  if (base) return base.replace(/^http/, 'ws') + "/ws/progress";
  var wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return wsProtocol + "//" + window.location.host + "/ws/progress";
}

// ─── Gemini API Configuration (For Onboarding Builder) ───────────────────────
var GEMINI_API_KEY = "AIzaSyCyZo98Ygk9Tz-0Z1wcDJn28myAuMfCrhk";
var GEMINI_MODEL   = "gemini-flash-latest"; // Must use latest for free tier
var GEMINI_URL     = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY;

// System instruction injected into every Gemini call
var SYSTEM_PROMPT = "You are the onboarding assistant for ModelForge, a SaaS platform that " +
  "helps non-technical business owners build custom AI models. " +
  "Your job is to interview the user to deeply understand their requirements before allowing them to proceed. " +
  "You MUST gather the following information, asking only 1 or 2 questions at a time to keep it conversational:\\n" +
  "1. The primary use case and industry.\\n" +
  "2. The scale of usage (e.g. daily users or queries).\\n" +
  "3. The specific Tone of Voice the AI should use (e.g. professional, casual, empathetic).\\n" +
  "4. Any strict rules, formatting requirements, or edge cases the AI must handle.\\n" +
  "5. Whether they have internal PDF documents to upload as training data.\\n\\n" +
  "Keep your answers concise, friendly, and professional. Do NOT tell the user you have everything you need until ALL 5 of these points have been explicitly discussed and clarified. Once all 5 points are thoroughly covered, tell the user you have everything you need and suggest they click the 'Generate Model Proposal' button.";

var MOCK_FALLBACK = [
  "That's a great use case! To design the perfect model, a couple of quick questions:\n\n• What industry or department is this for? (e.g., Sales, Legal, Customer Support)\n• Roughly how many people will use the AI daily?\n\nAlso, feel free to upload any PDF documents you'd like the model to learn from!",
  "Excellent context, thank you! Just one more thing before I put together your proposal — do you already have internal PDF documents (manuals, FAQs, playbooks) that the model could be trained on? Even a few pages make a big difference.\n\nOnce you confirm, I have everything I need to generate your Model Proposal.",
  "Perfect — I have everything I need! Here's a quick summary of what I've captured:\n\n📦  Model Size: 7B parameters\n🎯  Focus Area: Your specified domain\n⏱️  Estimated Training: 10-20 minutes\n\nReady to review the full proposal? Click the button below to proceed."
];
var mockFallbackIndex = 0;

// ─── App State ────────────────────────────────────────────────────────────────
var messages          = [];   // Builder onboarding chat
var testMessages      = [];   // Custom model testing chat
var geminiHistory     = [];   // [{role:"user"|"model", parts:[{text}]}] for Gemini context
var uploadedFile      = null;
var activeView        = 'builder';
var sidebarCollapsed  = false;
var toggleStates      = {notif: true, updates: false, reports: true};
var isFetching        = false;

// Dynamic model catalog state
var customModels      = [];

// ─── Supabase State Manager ──────────────────────────────────────────────────
var supabaseClient    = null;

function initSupabase() {
  var url = localStorage.getItem("supabaseUrl") || "";
  var key = localStorage.getItem("supabaseKey") || "";
  if (url && key && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url, key);
      console.log("Connected to Supabase Database successfully.");
      return true;
    } catch (e) {
      console.error("Supabase initialization error:", e);
    }
  }
  supabaseClient = null;
  return false;
}

// ─── Cloud Sync Operations ──────────────────────────────────────────────────
async function syncProfileFromCloud() {
  if (!supabaseClient) return;
  try {
    var { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', 'default_user')
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') { // not found
        await saveProfileToCloud({
          id: 'default_user',
          full_name: 'John Doe',
          email: 'john@company.com',
          company: 'Acme Corp',
          credits: 10
        });
      } else {
        throw error;
      }
    } else if (data) {
      localStorage.setItem('profile_name', data.full_name);
      localStorage.setItem('profile_email', data.email);
      localStorage.setItem('profile_company', data.company);
      localStorage.setItem('credits_remaining', data.credits.toString());
      updateProfileDOM();
    }
  } catch (e) {
    console.warn("User profile cloud sync failed:", e);
  }
}

async function saveProfileToCloud(profile) {
  if (!supabaseClient) return;
  try {
    await supabaseClient
      .from('user_profiles')
      .upsert({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        company: profile.company,
        credits: parseInt(profile.credits),
        updated_at: new Date().toISOString()
      });
  } catch (e) {
    console.warn("Could not save profile to Supabase:", e);
  }
}

async function syncModelsFromCloud() {
  if (!supabaseClient) return;
  try {
    var { data, error } = await supabaseClient
      .from('models')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    if (data && data.length > 0) {
      customModels = data;
      saveModelsLocal();
      renderModelsList();
    }
  } catch (e) {
    console.warn("Models cloud sync failed:", e);
  }
}

async function syncChatsFromCloud() {
  if (!supabaseClient) return;
  try {
    var { data: obData } = await supabaseClient.from('chat_histories').select('messages').eq('id', 'onboarding').single();
    if (obData && obData.messages && obData.messages.length > 0) {
      messages = obData.messages;
      geminiHistory = [];
      messages.forEach(function(m) {
        if (!m.typing && !m.error) {
          geminiHistory.push({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          });
        }
      });
      renderMessages();
    }
  } catch (e) {
    console.warn("Chat onboarding cloud sync failed:", e);
  }
}

async function saveChatToCloud(id, chatType, msgs, modelTag = null) {
  if (!supabaseClient) return;
  try {
    var payload = {
      id: id,
      chat_type: chatType,
      messages: msgs,
      updated_at: new Date().toISOString()
    };
    if (modelTag) {
      payload.model_tag = modelTag;
    }
    await supabaseClient
      .from('chat_histories')
      .upsert(payload);
    console.log("Chat history '" + id + "' synced to Supabase successfully.");
  } catch (e) {
    console.warn("Could not save chat to Supabase:", e);
  }
}

async function syncChatFromCloud(id) {
  if (!supabaseClient) return [];
  try {
    var { data, error } = await supabaseClient
      .from('chat_histories')
      .select('messages')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') { // not found
        return [];
      }
      throw error;
    }
    return (data && data.messages) ? data.messages : [];
  } catch (e) {
    console.warn("Could not sync chat from Supabase:", e);
    return [];
  }
}

// ─── Helpers & Storage ───────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function autoGrow(element) {
  var prev = element.style.height;
  element.style.height = 'auto';
  var next = element.scrollHeight + 'px';
  if (prev !== next) {
    element.style.height = next;
  } else {
    element.style.height = prev;
  }
}

function saveModelsLocal() {
  localStorage.setItem('customModels', JSON.stringify(customModels));
}

function loadModelsLocal() {
  var data = localStorage.getItem('customModels');
  if (data) {
    try {
      customModels = JSON.parse(data);
    } catch (e) {
      customModels = [];
    }
  } else {
    // Scaffold initial default model record
    customModels = [
      {
        tag: "modelforge-custom",
        name: "modelforge-custom",
        params: "7B",
        status: "ready",
        created_at: new Date().toISOString()
      }
    ];
    saveModelsLocal();
  }
}

function updateProfileDOM() {
  var name = localStorage.getItem('profile_name') || 'John Doe';
  var email = localStorage.getItem('profile_email') || 'john@company.com';
  var company = localStorage.getItem('profile_company') || 'Acme Corp';
  var credits = localStorage.getItem('credits_remaining') || '10';
  
  // Settings view inputs
  var nameEl = document.getElementById('settings-profile-name');
  if (nameEl) nameEl.textContent = name;
  var emailEl = document.getElementById('settings-profile-email');
  if (emailEl) emailEl.textContent = email;
  var companyEl = document.getElementById('settings-profile-company');
  if (companyEl) companyEl.textContent = company;
  
  // Dashboard & Navigation titles
  var dashHeaderEl = document.getElementById('dash-header-title');
  if (dashHeaderEl) dashHeaderEl.textContent = "Welcome back, " + name + " 👋";
  var dashCreditsEl = document.getElementById('dash-stat-credits');
  if (dashCreditsEl) dashCreditsEl.textContent = credits;
  
  var navCreditsBadge = document.querySelector('.credits-badge');
  if (navCreditsBadge) {
    navCreditsBadge.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Credits: ' + credits;
  }
  
  // Proposal & Ledger views
  var proposalCredits = document.getElementById('proposal-credits-avail');
  if (proposalCredits) proposalCredits.textContent = credits + ' credits';
  
  var billingCredits = document.getElementById('billing-credits-balance');
  if (billingCredits) billingCredits.textContent = credits;
  
  var billingUsage = document.getElementById('billing-usage-summary');
  if (billingUsage) {
    var consumed = 10 - parseInt(credits);
    billingUsage.textContent = consumed + ' of 10 monthly credits consumed';
  }
  
  var billingBar = document.getElementById('billing-credit-bar-progress');
  if (billingBar) {
    billingBar.style.width = (parseInt(credits) * 10) + '%';
  }
  
  // Top Navigation Profile User Avatar Initials
  var avatar = document.querySelector('.user-avatar');
  if (avatar) {
    var initials = name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().substring(0, 2);
    avatar.textContent = initials || 'JD';
    avatar.title = name;
  }
}

function editProfileField(field) {
  var label = field === 'name' ? 'Operator Name' : field === 'email' ? 'Corporate Email' : 'Startup Entity';
  var key = 'profile_' + field;
  var currentVal = localStorage.getItem(key) || (field === 'name' ? 'John Doe' : field === 'email' ? 'john@company.com' : 'Acme Corp');
  
  var newVal = prompt("Enter new " + label + ":", currentVal);
  if (newVal !== null && newVal.trim() !== "") {
    newVal = newVal.trim();
    localStorage.setItem(key, newVal);
    
    // Save to Supabase Cloud
    if (supabaseClient) {
      var updatePayload = {};
      if (field === 'name') updatePayload.full_name = newVal;
      if (field === 'email') updatePayload.email = newVal;
      if (field === 'company') updatePayload.company = newVal;
      
      supabaseClient
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', 'default_user')
        .then(function(res) {
          console.log("Supabase profile sync completed.");
        });
    } else {
      // Offline mode saving
      var credits = localStorage.getItem('credits_remaining') || '10';
      saveProfileToCloud({
        id: 'default_user',
        full_name: field === 'name' ? newVal : (localStorage.getItem('profile_name') || 'John Doe'),
        email: field === 'email' ? newVal : (localStorage.getItem('profile_email') || 'john@company.com'),
        company: field === 'company' ? newVal : (localStorage.getItem('profile_company') || 'Acme Corp'),
        credits: credits
      });
    }
    
    updateProfileDOM();
  }
}

function saveBackendUrl() {
  var el = document.getElementById('settings-backend-url');
  if (el) {
    var val = el.value.trim();
    localStorage.setItem("backendBaseUrl", val);
    alert("Hardware secure API bridge connection updated successfully!");
  }
}

function saveSupabaseSettings() {
  var urlEl = document.getElementById('settings-supabase-url');
  var keyEl = document.getElementById('settings-supabase-key');
  if (!urlEl || !keyEl) return;
  
  var url = urlEl.value.trim();
  var key = keyEl.value.trim();
  
  if (url && key) {
    localStorage.setItem("supabaseUrl", url);
    localStorage.setItem("supabaseKey", key);
    
    var ok = initSupabase();
    if (ok) {
      alert("Connected to Supabase Project successfully! Syncing database tables...");
      syncProfileFromCloud();
      syncModelsFromCloud();
      syncChatsFromCloud();
    } else {
      alert("Failed to connect to Supabase. Check the URL and Public Anon Key credentials.");
    }
  } else if (!url && !key) {
    localStorage.removeItem("supabaseUrl");
    localStorage.removeItem("supabaseKey");
    supabaseClient = null;
    alert("Supabase cloud database disabled. Reverting back to local storage offline mode.");
    updateProfileDOM();
    renderModelsList();
  } else {
    alert("Please provide both the Supabase URL and Anonymous Public Key.");
  }
}

function resetWorkspaceState() {
  if (!confirm("Are you sure you want to completely wipe the local browser workspace state memory? This will reset custom profiles, model catalog configurations, and connection URLs.")) return;
  localStorage.clear();
  window.location.reload();
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function navigate(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  
  var viewEl = document.getElementById('view-' + view);
  if (viewEl) viewEl.classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.toggle('active', n.dataset.view === view);
  });
  
  // Close sliding mobile drawer overlay upon selection
  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('mobile-open');
}

// ─── Model Inventory Renderings ──────────────────────────────────────────────
function renderModelsList() {
  var container = document.getElementById('mymodels-list-container');
  if (!container) return;
  
  if (customModels.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">No custom local models built. Use Onboarding Chat to create one.</div>';
    
    var dashList = document.querySelector('#view-dashboard .model-list');
    if (dashList) {
      var header = dashList.querySelector('.model-list-header');
      dashList.innerHTML = '';
      if (header) dashList.appendChild(header);
      var emp = document.createElement('div');
      emp.style = "padding:24px;text-align:center;color:var(--text-muted);font-size:13px;";
      emp.textContent = "No trained models active.";
      dashList.appendChild(emp);
    }
    
    var statActive = document.getElementById('dash-stat-active-models');
    if (statActive) statActive.textContent = "0";
    return;
  }
  
  // Render full inventory list
  container.innerHTML = customModels.map(function(m) {
    var isReady = m.status === 'ready';
    var dotClass = isReady ? 'ready' : 'training';
    var badgeText = isReady ? 'Online' : 'Fine-Tuning';
    var badgeClass = isReady ? 'badge-ready' : 'badge-training';
    
    return `<div class="model-row">
      <div class="model-dot ${dotClass}" onclick="navigate('modeltest')" style="cursor:pointer"></div>
      <div class="model-name" onclick="startModelTestChat('${m.tag}')" style="cursor:pointer">${m.name}</div>
      <div class="model-meta" onclick="startModelTestChat('${m.tag}')" style="cursor:pointer">${m.params} parameters &middot; Local RTX 4060 Ti &middot; ${m.status.toUpperCase()}</div>
      <div style="display:flex;gap:8px;margin-left:auto;align-items:center">
        <button class="model-badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);border:1px solid var(--border-glass);cursor:pointer;padding:4px 10px" onclick="renameModel('${m.tag}')">Rename</button>
        <button class="model-badge" style="background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);cursor:pointer;padding:4px 10px" onclick="deleteModel('${m.tag}')">Delete</button>
        <div class="model-badge ${badgeClass}" onclick="startModelTestChat('${m.tag}')" style="cursor:pointer">${isReady ? 'Test Chat' : 'Monitoring'}</div>
      </div>
    </div>`;
  }).join('');
  
  // Sync dashboard models widget
  var dashList = document.querySelector('#view-dashboard .model-list');
  if (dashList) {
    var header = dashList.querySelector('.model-list-header');
    dashList.innerHTML = '';
    if (header) dashList.appendChild(header);
    
    customModels.slice(0, 3).forEach(function(m) {
      var isReady = m.status === 'ready';
      var dotClass = isReady ? 'ready' : 'training';
      var badgeClass = isReady ? 'badge-ready' : 'badge-training';
      var badgeText = isReady ? 'Online' : 'Fine-Tuning';
      
      var row = document.createElement('div');
      row.className = 'model-row';
      row.onclick = function() { startModelTestChat(m.tag); };
      row.innerHTML = `<div class="model-dot ${dotClass}"></div>
        <div class="model-name">${m.name}</div>
        <div class="model-meta">${m.params} params &middot; Active</div>
        <div class="model-badge ${badgeClass}">${badgeText}</div>`;
      dashList.appendChild(row);
    });
  }
  
  var statActive = document.getElementById('dash-stat-active-models');
  var activeCount = customModels.filter(function(m) { return m.status === 'ready'; }).length;
  if (statActive) statActive.textContent = activeCount.toString();
}

function renameModel(tag) {
  var model = customModels.find(function(m) { return m.tag === tag; });
  if (!model) return;
  
  var newName = prompt("Enter a new name for your model:", model.name);
  if (newName && newName.trim() !== "") {
    newName = newName.trim();
    var oldName = model.name;
    model.name = newName;
    
    saveModelsLocal();
    
    // REST backend bridge renaming call
    fetch(getBaseUrl() + "/rename_model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_tag: tag, new_tag: tag, new_name: newName })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
       console.log("Renamed model directory on hard drive:", d);
    })
    .catch(function(e) {
       console.warn("FastAPI server offline — model directories not modified on disk.");
    });
    
    if (supabaseClient) {
      supabaseClient
        .from('models')
        .update({ name: newName })
        .eq('tag', tag)
        .then(function() {
          console.log("Renamed model synced to cloud Supabase table.");
        });
    }
    
    renderModelsList();
  }
}

function deleteModel(tag) {
  if (!confirm("Are you sure you want to permanently delete '" + tag + "'? This will completely wipe all fine-tuned LoRA weights and directory folders from your local RTX 4060 Ti graphics card disk!")) return;
  
  customModels = customModels.filter(function(m) { return m.tag !== tag; });
  saveModelsLocal();
  
  // REST backend deletion call
  fetch(getBaseUrl() + "/delete_model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag: tag })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
     console.log("Permanently deleted model directory on disk:", d);
  })
  .catch(function(e) {
     console.warn("FastAPI server offline — local directories not modified.");
  });
  
  if (supabaseClient) {
    supabaseClient.from('models').delete().eq('tag', tag).then();
    supabaseClient.from('chat_histories').delete().eq('id', 'testing_' + tag).then();
  }
  
  renderModelsList();
  navigate('mymodels');
}

// ─── Chat Rendering ───────────────────────────────────────────────────────────
function renderMessages() {
  var win = document.getElementById('chat-messages');
  if (!win) return;

  win.innerHTML = messages.map(function(m) {
    if (m.typing) {
      return '<div class="bubble-row">' +
        '<div class="avatar-sm avatar-ai">MF</div>' +
        '<div class="bubble bubble-ai">' +
          '<div class="typing-dots"><span></span><span></span><span></span></div>' +
        '</div>' +
      '</div>';
    }

    if (m.error) {
      return '<div class="bubble-row">' +
        '<div class="avatar-sm avatar-ai" style="background:var(--accent-red)">!</div>' +
        '<div class="bubble bubble-ai" style="border-color:rgba(239,68,68,0.25);background:rgba(239,68,68,0.03);color:#fca5a5">' +
          '<strong>Connection Fault:</strong> ' + esc(m.text) +
        '</div>' +
      '</div>';
    }

    var isUser  = m.role === 'user';
    var fileTag = m.file
      ? '<div style="font-size:11px;opacity:.75;margin-bottom:6px">&#128206; ' + esc(m.file) + '</div>'
      : '';
    var btn = m.showBtn
      ? '<button class="proposal-btn" onclick="openProposalView()">&#10024; Generate Model Proposal</button>'
      : '';

    return '<div class="bubble-row ' + (isUser ? 'user' : '') + '">' +
      '<div class="avatar-sm ' + (isUser ? 'avatar-user' : 'avatar-ai') + '">' +
        (isUser ? 'You' : 'MF') +
      '</div>' +
      '<div class="bubble ' + (isUser ? 'bubble-user' : 'bubble-ai') + '">' +
        fileTag + esc(m.text) + btn +
      '</div>' +
    '</div>';

  }).join('');

  win.scrollTop = win.scrollHeight;
}

function renderTestMessages() {
  var win = document.getElementById('test-chat-messages');
  if (!win) return;

  win.innerHTML = testMessages.map(function(m) {
    if (m.typing) {
      return '<div class="bubble-row">' +
        '<div class="avatar-sm avatar-ai">MF</div>' +
        '<div class="bubble bubble-ai">' +
          '<div class="typing-dots"><span></span><span></span><span></span></div>' +
        '</div>' +
      '</div>';
    }
    if (m.error) {
      return '<div class="bubble-row">' +
        '<div class="avatar-sm avatar-ai" style="background:var(--accent-red)">!</div>' +
        '<div class="bubble bubble-ai" style="border-color:rgba(239,68,68,0.25);background:rgba(239,68,68,0.03);color:#fca5a5">' +
          '<strong>Error:</strong> ' + esc(m.text) +
        '</div>' +
      '</div>';
    }
    var isUser = m.role === 'user';
    return '<div class="bubble-row ' + (isUser ? 'user' : '') + '">' +
      '<div class="avatar-sm ' + (isUser ? 'avatar-user' : 'avatar-ai') + '">' +
        (isUser ? 'You' : 'MF') +
      '</div>' +
      '<div class="bubble ' + (isUser ? 'bubble-user' : 'bubble-ai') + '">' +
        esc(m.text) +
      '</div>' +
    '</div>';
  }).join('');

  win.scrollTop = win.scrollHeight;
}

// ─── Onboarding Gemini Interview ───────────────────────────────────────────────
function callBuilderAI(userText, fileContext) {
  if (isFetching) return;
  isFetching = true;

  var sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = true;

  messages.push({ typing: true });
  renderMessages();

  var fullMessage = userText;
  if (fileContext) {
    fullMessage += '\n\n[The user has attached a PDF named "' + fileContext + '" as training data.]';
  }
  geminiHistory.push({ role: "user", parts: [{ text: fullMessage }] });

  var payload = {
    system_instruction: { parts: { text: SYSTEM_PROMPT } },
    contents: geminiHistory,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
  };

  fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function(r) {
    if (!r.ok) throw new Error('Gemini API quota exceeded or offline.');
    return r.json();
  })
  .then(function(data) {
    messages = messages.filter(function(m) { return !m.typing; });
    var aiText = "";
    try {
      aiText = data.candidates[0].content.parts[0].text;
      geminiHistory.push({ role: "model", parts: [{ text: aiText }] });
    } catch (e) {
      aiText = "Sorry, I received an invalid response from the API.";
    }

    var signalsReady = /generate model proposal|ready to proceed|click.*proposal|proposal button/i.test(aiText) || geminiHistory.length >= 5;
    messages.push({ role: 'ai', text: aiText, showBtn: signalsReady });
    renderMessages();
    
    if (supabaseClient) {
      saveChatToCloud('onboarding', 'onboarding', messages);
    }
  })
  .catch(function(err) {
    messages = messages.filter(function(m) { return !m.typing; });
    var text = MOCK_FALLBACK[Math.min(mockFallbackIndex, MOCK_FALLBACK.length - 1)];
    mockFallbackIndex++;
    
    geminiHistory.push({ role: "model", parts: [{ text: text }] });
    var signalsReady = mockFallbackIndex >= MOCK_FALLBACK.length;
    messages.push({ role: 'ai', text: text, showBtn: signalsReady });
    renderMessages();
    
    if (supabaseClient) {
      saveChatToCloud('onboarding', 'onboarding', messages);
    }
  })
  .finally(function() {
    isFetching = false;
    if (sendBtn) sendBtn.disabled = false;
  });
}

function openProposalView() {
  // Capture focus area from history if possible
  var usecase = "Customer Support Agent";
  var historyText = geminiHistory.map(function(h) { return h.parts[0].text; }).join(" ");
  if (/legal/i.test(historyText)) usecase = "Legal Document Searcher";
  else if (/automotive/i.test(historyText)) usecase = "Automotive Tech Specs";
  else if (/finance|sales/i.test(historyText)) usecase = "Financial Analyst";
  
  var usecaseEl = document.getElementById('proposal-usecase');
  if (usecaseEl) usecaseEl.textContent = usecase;
  
  navigate('proposal');
}

// ─── Local Inference Chat Triggers ────────────────────────────────────────────
var activeTestingTag = "modelforge-custom";

function startModelTestChat(tag) {
  activeTestingTag = tag;
  var h2 = document.getElementById('test-model-name-header');
  if (h2) h2.textContent = "Testing: " + tag;
  
  navigate('modeltest');
  
  testMessages = [];
  renderTestMessages();
  
  testMessages.push({ typing: true });
  renderTestMessages();
  
  if (supabaseClient) {
    syncChatFromCloud('testing_' + tag).then(function(cloudMsgs) {
      if (cloudMsgs && cloudMsgs.length > 0) {
        testMessages = cloudMsgs;
        renderTestMessages();
      } else {
        triggerLocalGreeting();
      }
    });
  } else {
    triggerLocalGreeting();
  }
}

function triggerLocalGreeting() {
  testMessages = testMessages.filter(function(m) { return !m.typing; });
  var greet = "Hi! Welcome back. I am your specialized AI model '" + activeTestingTag + "' fine-tuned on your uploaded PDFs. What support questions can I answer today?";
  testMessages.push({ role: 'ai', text: greet });
  renderTestMessages();
}

function callLocalAPI(userText) {
  if (isFetching) return;
  isFetching = true;

  var sendBtn = document.getElementById('test-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  testMessages.push({ typing: true });
  renderTestMessages();

  fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText, model_tag: activeTestingTag })
  })
  .then(function(r) {
    if (!r.ok) throw new Error('Local API returned ' + r.status);
    return r.json();
  })
  .then(function(data) {
    testMessages = testMessages.filter(function(m) { return !m.typing; });
    var aiText = (data.response || '').trim() || 'No response received.';
    testMessages.push({ role: 'ai', text: aiText });
    renderTestMessages();
    
    if (supabaseClient) {
      saveChatToCloud('testing_' + activeTestingTag, 'testing', testMessages, activeTestingTag);
    }
  })
  .catch(function(err) {
    testMessages = testMessages.filter(function(m) { return !m.typing; });
    testMessages.push({ role: 'ai', text: 'Connection failed with the local GPU API. Is your FastAPI server running at ' + getBaseUrl() + '?', error: true });
    renderTestMessages();
  })
  .finally(function() {
    isFetching = false;
    if (sendBtn) sendBtn.disabled = false;
  });
}

// ─── Event Ingestors ─────────────────────────────────────────────────────────
function sendMessage() {
  if (isFetching) return;
  var inp  = document.getElementById('chat-input');
  var text = inp.value.trim();
  if (!text) return;

  var fileName = uploadedFile ? uploadedFile.name : null;

  messages.push({ role: 'user', text: text, file: fileName });
  inp.value = '';
  inp.style.height = 'auto';
  clearFile();
  renderMessages();

  callBuilderAI(text, fileName);
}

function sendTestMessage() {
  if (isFetching) return;
  var inp  = document.getElementById('test-chat-input');
  var text = inp.value.trim();
  if (!text) return;

  testMessages.push({ role: 'user', text: text });
  inp.value = '';
  inp.style.height = 'auto';
  renderTestMessages();

  callLocalAPI(text);
}

// ─── Drag & Drop / File uploads ───────────────────────────────────────────────
function clearFile() {
  uploadedFile = null;
  var chip = document.getElementById('file-chip');
  if (chip) chip.classList.add('hidden');
  var fi = document.getElementById('file-input');
  if (fi) fi.value = '';
}

function handleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Please upload PDF document types only.'); return;
  }
  uploadedFile = file;
  var chip = document.getElementById('file-chip');
  if (chip) {
    chip.classList.remove('hidden');
    chip.querySelector('.chip-name').textContent =
      file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
  }

  // Upload PDF files to local backend server
  var formData = new FormData();
  formData.append('file', file);
  fetch(getUploadUrl(), { method: 'POST', body: formData })
    .then(function(r) { return r.json(); })
    .then(function(d) { console.log('Saved to local data dir:', d.saved_to); })
    .catch(function() { console.warn('FastAPI server offline — PDF not uploaded to disk folder.'); });
}

// ─── Sidebar Menu collapse/open mechanisms ──────────────────────────────────
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  var sb  = document.getElementById('sidebar');
  var btn = document.getElementById('collapse-btn');
  if (sb) sb.classList.toggle('collapsed', sidebarCollapsed);
  if (btn) {
    btn.querySelector('svg').style.transform = sidebarCollapsed ? 'rotate(180deg)' : '';
  }
}

function toggleSidebarMobile() {
  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('mobile-open');
}

function toggleSetting(key) {
  toggleStates[key] = !toggleStates[key];
  var el = document.getElementById('t-' + key);
  if (el) el.classList.toggle('on', toggleStates[key]);
}

function toggleLightTheme() {
  var isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('lightThemeActive', isLight ? 'true' : 'false');
  var el = document.getElementById('t-lighttheme');
  if (el) el.classList.toggle('on', isLight);
}

// ─── Training Websocket Pipeline integrations ────────────────────────────────
var wsTraining = null;

function startTrainingPipeline() {
  var credits = parseInt(localStorage.getItem('credits_remaining') || '10');
  if (credits < 3) {
    alert("Insufficient credits to start fine-tuning! Please top up your ledger balance in Billing.");
    return;
  }
  
  // Deduct credits
  credits = credits - 3;
  localStorage.setItem('credits_remaining', credits.toString());
  updateProfileDOM();
  
  if (supabaseClient) {
    saveProfileToCloud({
      id: 'default_user',
      full_name: localStorage.getItem('profile_name') || 'John Doe',
      email: localStorage.getItem('profile_email') || 'john@company.com',
      company: localStorage.getItem('profile_company') || 'Acme Corp',
      credits: credits
    });
  }

  // Generate model metadata record tag
  var modelName = "modelforge-" + Math.random().toString(36).substring(2, 7);
  
  // Add training metadata row
  var exists = customModels.find(function(m) { return m.tag === modelName; });
  if (!exists) {
    customModels.unshift({
      tag: modelName,
      name: modelName,
      params: "7B",
      status: "training",
      created_at: new Date().toISOString()
    });
    saveModelsLocal();
  }
  
  navigate('training');
  connectTrainingWS();

  // Save conversation rundown
  var rundownText = geminiHistory.map(function(m) {
    return (m.role === 'user' ? 'USER' : 'AI') + ":\n" + m.parts[0].text;
  }).join("\n\n");

  fetch(getRundownUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: rundownText })
  }).then(function(r) {
    if (!r.ok) throw new Error("Rundown error");
    return fetch(getTrainUrl() + "?model_tag=" + modelName, { method: "POST" });
  }).then(function(r) {
    if (!r.ok && r.status !== 409) throw new Error("Training start failed");
  }).catch(function(err) {
    console.error("Hardware API error:", err);
  });
}

function connectTrainingWS() {
  if (wsTraining) wsTraining.close();
  wsTraining = new WebSocket(getWsUrl());
  
  wsTraining.onmessage = function(event) {
    var data = JSON.parse(event.data);
    
    if (data.event === "state") {
      if (data.data.status === "running") {
        if (data.data.phase) updateTrainingPhase(data.data.phase);
        if (data.data.step > 0) {
          var pct = Math.floor((data.data.step / Math.max(data.data.total, 1)) * 100);
          updateTrainingProgress(pct, data.data.step, data.data.total, data.data.loss);
        }
      } else if (data.data.status === "complete") {
        completeTraining(data.data.model_tag);
      }
    } else if (data.event === "phase") {
      updateTrainingPhase(data.phase);
    } else if (data.event === "progress") {
      updateTrainingProgress(data.percent, data.step, data.total, data.loss);
    } else if (data.event === "complete") {
      completeTraining(data.model_tag);
    } else if (data.event === "error") {
      document.getElementById("train-status-text").textContent = "Status: Hardware Interrupted";
      document.getElementById("train-status-sub").textContent = data.message;
      document.getElementById("train-status-dot-top").style.background = "var(--accent-red)";
      document.getElementById("train-status-dot-top").style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.5)";
    }
  };
}

function updateTrainingPhase(phase) {
  var phases = ['data_prep', 'validation', 'training', 'export'];
  var currentIdx = phases.indexOf(phase);
  
  if (phase === 'data_prep') {
    document.getElementById("train-status-text").textContent = "Status: Parsing Documents";
    document.getElementById("train-status-sub").textContent = "Ingesting PDFs and running synthetic Alpaca generator...";
    document.getElementById("training-credits-pct").textContent = "0.4 / 3.0";
  } else if (phase === 'validation') {
    document.getElementById("train-status-text").textContent = "Status: De-duplication Check";
    document.getElementById("train-status-sub").textContent = "Filtering synthetic hallucinations and tokenizing dataset...";
    document.getElementById("training-credits-pct").textContent = "0.8 / 3.0";
  } else if (phase === 'training') {
    document.getElementById("train-status-text").textContent = "Status: Gradient Fine-Tuning";
    document.getElementById("train-status-sub").textContent = "Training LoRA layers on local RTX 4060 Ti GPU...";
    document.getElementById("training-credits-pct").textContent = "1.8 / 3.0";
  } else if (phase === 'export') {
    document.getElementById("train-status-text").textContent = "Status: Compiling quantizations";
    document.getElementById("train-status-sub").textContent = "Quantizing to 4-bit GGUF and loading in local Ollama service...";
    document.getElementById("training-credits-pct").textContent = "2.8 / 3.0";
  }
  
  phases.forEach(function(p, i) {
    var card = document.getElementById("phase-" + p);
    var dot = document.getElementById("phase-" + p + "-dot");
    var txt = document.getElementById("phase-" + p + "-text");
    if (!card || !dot || !txt) return;
    
    dot.style.animation = "none";
    card.style.background = "var(--bg-secondary)";
    card.style.borderColor = "var(--border-glass)";
    
    if (i < currentIdx) {
      dot.style.background = "var(--accent-green)";
      dot.style.boxShadow = "0 0 8px var(--accent-green)";
      txt.style.color = "var(--text-primary)";
      txt.textContent = txt.textContent.replace(" (pending)", "").replace(" (in progress)", "") + " ✓";
    } else if (i === currentIdx) {
      dot.style.background = "var(--accent-orange)";
      dot.style.boxShadow = "0 0 8px var(--accent-orange)";
      dot.style.animation = "pulse 1.5s infinite";
      card.style.background = "rgba(139, 92, 246, 0.05)";
      card.style.borderColor = "rgba(139, 92, 246, 0.2)";
      txt.style.color = "#c084fc";
      if (!txt.textContent.includes("in progress")) {
        txt.textContent = txt.textContent.replace(" (pending)", " (in progress)");
      }
    } else {
      dot.style.background = "var(--bg-tertiary)";
      dot.style.boxShadow = "none";
      txt.style.color = "var(--text-secondary)";
    }
  });
}

function updateTrainingProgress(percent, step, total, loss) {
  var pctText = document.getElementById("train-ring-percent");
  var path = document.getElementById("train-ring-path");
  var sub = document.getElementById("train-status-sub");
  
  if (pctText) pctText.textContent = percent + "%";
  if (path) {
    var offset = 402 - (402 * (percent / 100));
    path.style.strokeDashoffset = offset;
  }
  if (sub) {
    sub.textContent = "Epoch gradient step " + step + "/" + total + " | Minibatch Loss: " + loss.toFixed(4);
  }
}

function completeTraining(tag) {
  // Update state row
  var model = customModels.find(function(m) { return m.tag === tag; });
  if (model) {
    model.status = "ready";
  } else {
    customModels.unshift({
      tag: tag,
      name: tag,
      params: "7B",
      status: "ready",
      created_at: new Date().toISOString()
    });
  }
  saveModelsLocal();
  
  if (supabaseClient) {
    supabaseClient
      .from('models')
      .upsert({
        tag: tag,
        name: tag,
        params: "7B",
        status: "ready",
        created_at: new Date().toISOString()
      }).then();
  }
  
  document.getElementById("train-status-text").textContent = "Status: Complete";
  document.getElementById("train-status-sub").textContent = "Custom adapter '" + tag + "' loaded globally.";
  document.getElementById("train-status-dot-top").style.background = "var(--accent-green)";
  document.getElementById("train-status-dot-top").style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.5)";
  document.getElementById("training-credits-pct").textContent = "3.0 / 3.0";
  
  var dot = document.getElementById("phase-training-dot");
  var txt = document.getElementById("phase-training-text");
  if (dot) { dot.style.background = "var(--accent-green)"; dot.style.animation = "none"; dot.style.boxShadow = "0 0 8px var(--accent-green)"; }
  if (txt) { txt.textContent = "Fine-tuning on hardware complete ✓"; }
  
  var dotExp = document.getElementById("phase-export-dot");
  var txtExp = document.getElementById("phase-export-text");
  if (dotExp) { dotExp.style.background = "var(--accent-green)"; dotExp.style.animation = "none"; dotExp.style.boxShadow = "0 0 8px var(--accent-green)"; }
  if (txtExp) { txtExp.textContent = "GGUF Quantization & Ollama Export complete ✓"; }
  
  updateTrainingProgress(100, 100, 100, 0.0);
  renderModelsList();
}

function previewTrainingData() {
  fetch(getBaseUrl() + "/dataset")
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (!res.data || res.data.length === 0) {
      alert("No synthetic dataset generated yet. Please wait for the parsing/generation phases.");
      return;
    }
    
    var content = res.data.map(function(p, i) {
      return "Q" + (i+1) + ": " + p.instruction + "\n" + "A" + (i+1) + ": " + p.output;
    }).join("\n\n-----------------\n\n");
    
    var overlay = document.createElement("div");
    overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
    
    var box = document.createElement("div");
    box.style = "background:var(--bg-secondary);border:1px solid var(--border-glass);color:var(--text-primary);width:90%;max-width:800px;height:80%;border-radius:18px;padding:24px;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.5)";
    
    var ta = document.createElement("textarea");
    ta.readOnly = true;
    ta.style = "flex:1;resize:none;padding:14px;border:1px solid var(--border-glass);border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;background:var(--bg-primary);color:var(--text-primary);";
    ta.value = content;
    
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "Dismiss Preview";
    closeBtn.className = "btn-primary";
    closeBtn.style = "margin-top:16px;padding:12px;width:100%;";
    closeBtn.onclick = function() { overlay.remove(); };
    
    var h2 = document.createElement("h2");
    h2.textContent = "Generated Alpaca Q&A Dataset (" + res.data.length + " pairs)";
    h2.style = "margin-top:0;margin-bottom:16px;font-size:18px;font-weight:700;";
    
    box.appendChild(h2);
    box.appendChild(ta);
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  })
  .catch(function() {
    alert("Could not load dataset. Hardware FastAPI server might be offline.");
  });
}

// ─── Navigation Sidebar Builder nav items ──────────────────────────────────────
var NAV_ITEMS = [
  ['builder',   'Model Builder', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'],
  ['dashboard', 'Core Dashboard', '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'],
  ['mymodels',  'Model Inventory', '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'],
  ['billing',   'Ledger Billing', '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>'],
  ['settings',  'System Settings', '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14"/>']
];

// ─── Bootstrap Scaffolder ────────────────────────────────────────────────────
function buildApp() {
  var sidebarItems = NAV_ITEMS.map(function(item) {
    return '<div class="nav-item' + (item[0] === 'builder' ? ' active' : '') +
      '" data-view="' + item[0] + '" onclick="navigate(\'' + item[0] + '\')">' +
      '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        item[2] +
      '</svg>' +
      '<span>' + item[1] + '</span>' +
    '</div>';
  }).join('');

  var viewDefs = [
    ['builder',    VIEW_BUILDER],
    ['dashboard',  VIEW_DASHBOARD],
    ['mymodels',   VIEW_MYMODELS],
    ['modeltest',  VIEW_MODELTEST],
    ['proposal',   VIEW_PROPOSAL],
    ['training',   VIEW_TRAINING],
    ['deployment', VIEW_DEPLOYMENT],
    ['billing',    VIEW_BILLING],
    ['settings',   VIEW_SETTINGS]
  ];

  var viewsHtml = viewDefs.map(function(vd) {
    return '<div class="view' + (vd[0] === 'builder' ? ' active' : '') +
      '" id="view-' + vd[0] + '">' + vd[1] + '</div>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<nav class="navbar">' +
      '<div class="nav-logo" onclick="navigate(\'dashboard\')">' +
        '<button class="mobile-menu-btn" onclick="event.stopPropagation();toggleSidebarMobile()">&#9776;</button>' +
        '<div class="logo-mark">MF</div>' +
        '<span style="margin-left:4px">ModelForge</span>' +
      '</div>' +
      '<div class="credits-badge">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
          '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' +
        '</svg>' +
        'Credits: 10' +
      '</div>' +
      '<div class="nav-right">' +
        '<div class="user-avatar" onclick="navigate(\'settings\')">JD</div>' +
      '</div>' +
    '</nav>' +
    '<div class="layout">' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-toggle">' +
          '<button class="toggle-btn" id="collapse-btn" onclick="toggleSidebar()">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
              '<path d="M15 18l-6-6 6-6"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        sidebarItems +
      '</aside>' +
      '<main class="main">' + viewsHtml + '</main>' +
    '</div>';

  // Seed default onboarding chat triggers
  var welcomeText = "Welcome to ModelForge! I'm your local AI onboarding specialist.\n\n" +
    "I'm here to help you structure, customize, and fine-tune your proprietary open-source model using local hardware resources — no cloud data leaks.\n\n" +
    "To begin designing your blueprint: what tasks should your custom model perform, and do you have raw manuals or FAQ PDFs I can extract training prompts from?";

  geminiHistory.push({ role: 'model', parts: [{ text: welcomeText }] });
  messages.push({ role: 'ai', text: welcomeText });

  setTimeout(function() { 
    renderMessages(); 
    renderTestMessages();
  }, 200);

  // Setup drag-and-drop document upload bindings
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    var dz = document.getElementById('drop-zone');
    if (dz) dz.classList.add('active');
  });
  document.addEventListener('dragleave', function() {
    var dz = document.getElementById('drop-zone');
    if (dz) dz.classList.remove('active');
  });
  document.addEventListener('drop', function(e) {
    e.preventDefault();
    var dz = document.getElementById('drop-zone');
    if (dz) dz.classList.remove('active');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  
  // Set connection URLs inside input fields
  var settingsUrlEl = document.getElementById('settings-backend-url');
  if (settingsUrlEl) settingsUrlEl.value = getBaseUrl();
  
  var sbUrl = localStorage.getItem("supabaseUrl") || "";
  var sbKey = localStorage.getItem("supabaseKey") || "";
  var settingsSbUrl = document.getElementById('settings-supabase-url');
  if (settingsSbUrl) settingsSbUrl.value = sbUrl;
  var settingsSbKey = document.getElementById('settings-supabase-key');
  if (settingsSbKey) settingsSbKey.value = sbKey;
  
  // Load dynamic models list
  loadModelsLocal();
  renderModelsList();
  
  // Connect database and sync on load
  initSupabase();
  syncProfileFromCloud();
  syncModelsFromCloud();
  syncChatsFromCloud();
  
  // Populate profiles
  updateProfileDOM();

  // Bootstrap Light/White Theme preference
  var lightActive = localStorage.getItem('lightThemeActive') !== 'false';
  if (lightActive) {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
  setTimeout(function() {
    var toggleEl = document.getElementById('t-lighttheme');
    if (toggleEl) {
      toggleEl.classList.toggle('on', lightActive);
    }
  }, 100);
}

buildApp();
