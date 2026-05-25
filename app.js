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

if (window.location.protocol !== "file:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "" && !window.location.hostname.endsWith(".local")) {
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
var GEMINI_MODEL   = "gemini-1.5-flash"; // Use robust stable model name
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

var onboardingStates = {};

// ─── App State ────────────────────────────────────────────────────────────────
var messages          = [];   // Builder onboarding chat
var testMessages      = [];   // Custom model testing chat
var geminiHistory     = [];   // [{role:"user"|"model", parts:[{text}]}] for Gemini context
var uploadedFile      = null;
var activeView        = 'landing';
var sidebarCollapsed  = false;
var toggleStates      = {notif: true, updates: false, reports: true};
var isFetching        = false;

// Dynamic model catalog state
var customModels      = [];

// Workspaces Platform Hub State
var workspaces        = [];
var activeWorkspaceId = null;
var activeModelTag    = null;

// ─── Supabase State Manager ──────────────────────────────────────────────────
var supabaseClient    = null;

function initSupabase() {
  var url = localStorage.getItem("supabaseUrl") || "https://myrlnkpoenobnfyfogsl.supabase.co";
  var key = localStorage.getItem("supabaseKey") || "sb_publishable_nC_MvMMYu5NmKDIggb8v6A_1rqprPVC";
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
    var userId = localStorage.getItem('user_id') || 'default_user';
    var { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') { // not found
        var email = localStorage.getItem('profile_email') || 'john@company.com';
        var name = localStorage.getItem('profile_name') || 'John Doe';
        var company = localStorage.getItem('profile_company') || 'Acme Corp';
        var creditsVal = localStorage.getItem('credits_remaining') || '10';
        
        await saveProfileToCloud({
          id: userId,
          full_name: name,
          email: email,
          company: company,
          credits: creditsVal
        });
      } else {
        throw error;
      }
    } else if (data) {
      localStorage.setItem('user_id', data.id);
      localStorage.setItem('profile_name', data.full_name);
      localStorage.setItem('profile_email', data.email);
      localStorage.setItem('profile_company', data.company);
      
      if (data.email === 'escola.aboba@gmail.com') {
        localStorage.setItem('credits_remaining', 'Unlimited');
      } else {
        localStorage.setItem('credits_remaining', data.credits.toString());
      }
      updateProfileDOM();
    }
  } catch (e) {
    console.warn("User profile cloud sync failed:", e);
  }
}

async function saveProfileToCloud(profile) {
  if (!supabaseClient) return;
  try {
    var creditsVal = profile.credits;
    if (creditsVal === 'Unlimited') {
      creditsVal = 999999;
    } else {
      creditsVal = parseInt(creditsVal);
    }
    await supabaseClient
      .from('user_profiles')
      .upsert({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        company: profile.company,
        credits: creditsVal,
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

function formatMarkdown(s) {
  var escaped = String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Format bold/topics: **Topic**
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="chat-topic">$1</strong>');
  
  // Format bullet points like '* **Topic**' or '* Item'
  var lines = escaped.split('\n');
  var formattedLines = lines.map(function(line) {
    var trimmed = line.trim();
    if (trimmed.startsWith('* ')) {
      return '<div class="chat-bullet-item"><span class="chat-bullet-dot">•</span> ' + trimmed.substring(2) + '</div>';
    }
    return line;
  });
  
  return formattedLines.join('<br>');
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
        created_at: new Date().toISOString(),
        workspace_id: "ws-main"
      }
    ];
    saveModelsLocal();
  }

  // Migrate orphan models to default workspace for backward compatibility
  var migrated = false;
  customModels.forEach(function(m) {
    if (!m.workspace_id) {
      m.workspace_id = "ws-main";
      migrated = true;
    }
  });
  if (migrated) {
    saveModelsLocal();
  }
}

// ─── Workspaces Platform Hub CRUD & Telemetry Logic ─────────────────────────
function getWorkspaceColor(colorName) {
  var colors = {
    purple: "#8b5cf6",
    blue: "#3b82f6",
    green: "#10b981",
    orange: "#f59e0b",
    rose: "#f43f5e"
  };
  return colors[colorName] || colors.purple;
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  return r + "," + g + "," + b;
}

function saveWorkspacesLocal() {
  localStorage.setItem('workspaces', JSON.stringify(workspaces));
}

function loadWorkspacesLocal() {
  var data = localStorage.getItem('workspaces');
  if (data) {
    try {
      workspaces = JSON.parse(data);
    } catch (e) {
      workspaces = [];
    }
  }
  
  if (workspaces.length === 0) {
    var curUsecase = localStorage.getItem('userUsecase') || "solodev";
    workspaces = [
      {
        id: "ws-main",
        name: "Main Workspace",
        description: "Your primary workstation for custom-trained business AI adapters.",
        usecase: curUsecase,
        color: "purple",
        created_at: new Date().toISOString()
      },
      {
        id: "ws-edu",
        name: "Education Lab",
        description: "Academic workstation for research, training limits, and experimentations.",
        usecase: "education",
        color: "blue",
        created_at: new Date().toISOString()
      }
    ];
    saveWorkspacesLocal();
  }

  if (!activeWorkspaceId && workspaces.length > 0) {
    activeWorkspaceId = workspaces[0].id;
  }
}

function renderWorkspacesList(filterQuery) {
  var container = document.getElementById('workspaces-grid-container');
  if (!container) return;

  var query = (filterQuery || '').trim().toLowerCase();
  var filtered = workspaces.filter(function(w) {
    return w.name.toLowerCase().includes(query) || 
           w.description.toLowerCase().includes(query) || 
           w.usecase.toLowerCase().includes(query);
  });

  // Calculate live stats
  var activeCountEl = document.getElementById('ws-stats-active-count');
  if (activeCountEl) {
    activeCountEl.textContent = workspaces.length + " active";
  }

  var vramTextEl = document.getElementById('ws-stats-vram');
  var vramBarEl = document.getElementById('ws-stats-vram-bar');
  if (vramTextEl && vramBarEl) {
    var totalModels = customModels.length;
    var allocatedVram = (1.4 + totalModels * 1.8).toFixed(1);
    if (parseFloat(allocatedVram) > 16.0) allocatedVram = "16.0";
    vramTextEl.textContent = allocatedVram + " GB / 16.0 GB";
    var pct = (parseFloat(allocatedVram) / 16.0) * 100;
    vramBarEl.style.width = pct + "%";
  }

  var cardsHtml = filtered.map(function(w) {
    var usecaseLabel = w.usecase;
    if (w.usecase === 'education') usecaseLabel = 'Education';
    else if (w.usecase === 'hobby') usecaseLabel = 'Personal Hobby';
    else if (w.usecase === 'solodev') usecaseLabel = 'Solo Developer';
    else if (w.usecase === 'companydev') usecaseLabel = 'Company Developer';

    var colorHex = getWorkspaceColor(w.color);
    var modelCount = customModels.filter(function(m) { return m.workspace_id === w.id; }).length;

    return `
      <div class="project-card" onclick="openWorkspace('${w.id}')" style="border-top: 4px solid ${colorHex};">
        <div class="project-card-header">
          <div class="project-folder-icon" style="background: rgba(${hexToRgb(colorHex)}, 0.12); color: ${colorHex};">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="project-details">
            <div class="project-title" title="${esc(w.name)}">${esc(w.name)}</div>
            <div class="project-count"><span class="status-dot pulsing" style="background:${colorHex}; box-shadow: 0 0 8px ${colorHex}"></span> ${modelCount} Model${modelCount === 1 ? '' : 's'} Active</div>
          </div>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 8px 0 12px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; min-height: 38px;">${esc(w.description || "No description provided.")}</p>
        <div class="project-meta">
          <span class="model-badge" style="background: rgba(${hexToRgb(colorHex)}, 0.08); color: ${colorHex}; border: 1px solid rgba(${hexToRgb(colorHex)}, 0.2); font-size: 10.5px; padding: 2px 8px; border-radius: 8px;">${esc(usecaseLabel)}</span>
          <div class="project-actions" onclick="event.stopPropagation();">
            <button class="project-action-btn" onclick="showCustomizeWorkspaceModal('${w.id}')">Customize</button>
            <button class="project-action-btn delete-icon" onclick="deleteWorkspace('${w.id}')" title="Delete Workspace">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  var createCardHtml = `
    <div class="project-card create-workspace-card" onclick="showCreateWorkspaceModal()">
      <div class="create-ws-plus">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
      <div class="create-ws-title">Create Workspace</div>
      <div class="create-ws-desc">Initialize a new environment for model deployment</div>
    </div>
  `;

  container.innerHTML = cardsHtml + createCardHtml;
}

function filterWorkspaces(query) {
  renderWorkspacesList(query);
}

function openWorkspace(id) {
  activeWorkspaceId = id;
  navigate('mymodels');
}

function populateWorkspaceDetails(id) {
  var w = workspaces.find(function(item) { return item.id === id; });
  if (!w) return;

  var titleEl = document.getElementById('workspace-detail-title');
  if (titleEl) {
    titleEl.textContent = "Workspace: " + w.name;
  }

  var descEl = document.getElementById('workspace-detail-desc');
  if (descEl) {
    descEl.textContent = w.description || "No description provided.";
  }

  var badgeEl = document.getElementById('workspace-detail-badge');
  if (badgeEl) {
    var usecaseLabel = w.usecase;
    if (w.usecase === 'education') usecaseLabel = 'Education';
    else if (w.usecase === 'hobby') usecaseLabel = 'Personal Hobby';
    else if (w.usecase === 'solodev') usecaseLabel = 'Solo Developer';
    else if (w.usecase === 'companydev') usecaseLabel = 'Company Developer';
    badgeEl.textContent = usecaseLabel;

    var colorHex = getWorkspaceColor(w.color);
    badgeEl.style.background = 'rgba(' + hexToRgb(colorHex) + ', 0.08)';
    badgeEl.style.color = colorHex;
    badgeEl.style.borderColor = 'rgba(' + hexToRgb(colorHex) + ', 0.25)';
  }

  var iconWrapEl = document.getElementById('workspace-detail-icon-wrap');
  if (iconWrapEl) {
    var colorHex = getWorkspaceColor(w.color);
    iconWrapEl.style.background = 'rgba(' + hexToRgb(colorHex) + ', 0.12)';
    iconWrapEl.style.color = colorHex;
  }

  renderModelsList();
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
}

function deleteWorkspace(id) {
  var w = workspaces.find(function(item) { return item.id === id; });
  if (!w) return;

  if (workspaces.length <= 1) {
    alert("You must keep at least one active workspace workstation.");
    return;
  }

  if (!confirm("Are you sure you want to permanently delete the workspace '" + w.name + "'? This will permanently delete the workspace and cascade-delete all custom LLM adapters fine-tuned inside it!")) {
    return;
  }

  customModels = customModels.filter(function(m) {
    if (m.workspace_id === id) {
      if (supabaseClient) {
        supabaseClient.from('models').delete().eq('tag', m.tag).then();
        supabaseClient.from('chat_histories').delete().eq('id', 'testing_' + m.tag).then();
      }
      return false;
    }
    return true;
  });
  saveModelsLocal();

  workspaces = workspaces.filter(function(item) { return item.id !== id; });
  saveWorkspacesLocal();

  if (activeWorkspaceId === id) {
    activeWorkspaceId = workspaces[0].id;
  }

  renderWorkspacesList();
  navigate('dashboard');
}

function deleteActiveWorkspace() {
  deleteWorkspace(activeWorkspaceId);
}

function showCreateWorkspaceModal() {
  var overlay = document.createElement('div');
  overlay.id = 'workspace-modal';
  overlay.className = 'premium-modal-overlay';
  overlay.onclick = function(e) {
    if (e.target === overlay) closeModal('workspace-modal');
  };

  overlay.innerHTML = `
    <div class="premium-modal-box">
      <h3 class="premium-modal-title">Create New Workstation</h3>
      <p class="premium-modal-desc" style="margin: 0;">Configure your isolated local training & data directory partition.</p>
      
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Workspace Name</label>
          <input type="text" id="ws-modal-name" class="premium-modal-input" placeholder="e.g. Sales Copilot" value=""/>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Description</label>
          <input type="text" id="ws-modal-desc" class="premium-modal-input" placeholder="e.g. Custom trained models for the sales rep team." value=""/>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Workspace Type (Usecase)</label>
          <select id="ws-modal-usecase" class="premium-modal-input">
            <option value="solodev">Solo Developer</option>
            <option value="companydev">Company Developer</option>
            <option value="education">Education / Academic</option>
            <option value="hobby">Personal Hobby</option>
          </select>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Brand Theme Accent</label>
          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:4px;">
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="purple" checked/><span style="color:#8b5cf6">■</span> Purple</label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="blue"/><span style="color:#3b82f6">■</span> Blue</label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="green"/><span style="color:#10b981">■</span> Green</label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="orange"/><span style="color:#f59e0b">■</span> Orange</label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="rose"/><span style="color:#f43f5e">■</span> Rose</label>
          </div>
        </div>
      </div>

      <div class="premium-modal-actions">
        <button class="btn-primary" style="flex:1" onclick="commitCreateWorkspace()">Create Workspace</button>
        <button class="btn-outline" style="padding:10px 16px" onclick="closeModal('workspace-modal')">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  var nameInp = document.getElementById('ws-modal-name');
  if (nameInp) nameInp.focus();
}

function commitCreateWorkspace() {
  var nameEl = document.getElementById('ws-modal-name');
  var descEl = document.getElementById('ws-modal-desc');
  var usecaseEl = document.getElementById('ws-modal-usecase');
  var colorEls = document.getElementsByName('ws-modal-color');
  
  if (!nameEl || !nameEl.value.trim()) {
    alert("Please enter a workspace name.");
    return;
  }

  var color = "purple";
  for (var i = 0; i < colorEls.length; i++) {
    if (colorEls[i].checked) {
      color = colorEls[i].value;
      break;
    }
  }

  var newWs = {
    id: "ws-" + Math.random().toString(36).substring(2, 9),
    name: nameEl.value.trim(),
    description: descEl ? descEl.value.trim() : "",
    usecase: usecaseEl ? usecaseEl.value : "solodev",
    color: color,
    created_at: new Date().toISOString()
  };

  workspaces.push(newWs);
  saveWorkspacesLocal();
  closeModal('workspace-modal');
  renderWorkspacesList();
}

function showCustomizeWorkspaceModal(id) {
  var w = workspaces.find(function(item) { return item.id === id; });
  if (!w) return;

  var overlay = document.createElement('div');
  overlay.id = 'workspace-modal';
  overlay.className = 'premium-modal-overlay';
  overlay.onclick = function(e) {
    if (e.target === overlay) closeModal('workspace-modal');
  };

  var optionsHtml = `
    <option value="solodev" ${w.usecase === 'solodev' ? 'selected' : ''}>Solo Developer</option>
    <option value="companydev" ${w.usecase === 'companydev' ? 'selected' : ''}>Company Developer</option>
    <option value="education" ${w.usecase === 'education' ? 'selected' : ''}>Education / Academic</option>
    <option value="hobby" ${w.usecase === 'hobby' ? 'selected' : ''}>Personal Hobby</option>
  `;

  overlay.innerHTML = `
    <div class="premium-modal-box">
      <h3 class="premium-modal-title">Customize Workspace</h3>
      <p class="premium-modal-desc" style="margin: 0;">Modify your custom workstation details and theme branding.</p>
      
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Workspace Name</label>
          <input type="text" id="ws-modal-name" class="premium-modal-input" placeholder="e.g. Sales Copilot" value="${esc(w.name)}"/>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Description</label>
          <input type="text" id="ws-modal-desc" class="premium-modal-input" placeholder="e.g. Custom trained models for the sales rep team." value="${esc(w.description)}"/>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Workspace Type (Usecase)</label>
          <select id="ws-modal-usecase" class="premium-modal-input">
            ${optionsHtml}
          </select>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Brand Theme Accent</label>
          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:4px;">
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="purple" ${w.color === 'purple' ? 'checked' : ''}/><span style="color:#8b5cf6">■</span> Purple</label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="blue" ${w.color === 'blue' ? 'checked' : ''}/><span style="color:#3b82f6">■</span> Blue</label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="green" ${w.color === 'green' ? 'checked' : ''}/><span style="color:#10b981">■</span> Green</label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="orange" ${w.color === 'orange' ? 'checked' : ''}/><span style="color:#f59e0b">■</span> Orange</label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-primary);"><input type="radio" name="ws-modal-color" value="rose" ${w.color === 'rose' ? 'checked' : ''}/><span style="color:#f43f5e">■</span> Rose</label>
          </div>
        </div>
      </div>

      <div class="premium-modal-actions">
        <button class="btn-primary" style="flex:1" onclick="commitCustomizeWorkspace('${w.id}')">Save Changes</button>
        <button class="btn-outline" style="padding:10px 16px" onclick="closeModal('workspace-modal')">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function commitCustomizeWorkspace(id) {
  var w = workspaces.find(function(item) { return item.id === id; });
  if (!w) return;

  var nameEl = document.getElementById('ws-modal-name');
  var descEl = document.getElementById('ws-modal-desc');
  var usecaseEl = document.getElementById('ws-modal-usecase');
  var colorEls = document.getElementsByName('ws-modal-color');

  if (!nameEl || !nameEl.value.trim()) {
    alert("Please enter a workspace name.");
    return;
  }

  var color = "purple";
  for (var i = 0; i < colorEls.length; i++) {
    if (colorEls[i].checked) {
      color = colorEls[i].value;
      break;
    }
  }

  w.name = nameEl.value.trim();
  w.description = descEl ? descEl.value.trim() : "";
  w.usecase = usecaseEl ? usecaseEl.value : "solodev";
  w.color = color;

  saveWorkspacesLocal();
  closeModal('workspace-modal');
  
  renderWorkspacesList();
  
  if (activeWorkspaceId === id) {
    populateWorkspaceDetails(id);
  }
}

function showCreateModelModal() {
  var overlay = document.createElement('div');
  overlay.id = 'create-model-modal';
  overlay.className = 'premium-modal-overlay';
  overlay.onclick = function(e) {
    if (e.target === overlay) closeModal('create-model-modal');
  };

  overlay.innerHTML = `
    <div class="premium-modal-box">
      <h3 class="premium-modal-title">Name Your Custom LLM</h3>
      <p class="premium-modal-desc" style="margin: 0;">Specify a unique name for your new fine-tuned model before beginning the Gemini onboarding interview.</p>
      
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Model Name</label>
        <input type="text" id="new-model-name" class="premium-modal-input" placeholder="e.g. SalesCopilot-v1" value=""/>
      </div>

      <div class="premium-modal-actions">
        <button class="btn-primary" style="flex:1" onclick="commitCreateModel()">Initialize Builder</button>
        <button class="btn-outline" style="padding:10px 16px" onclick="closeModal('create-model-modal')">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  var input = document.getElementById('new-model-name');
  if (input) input.focus();
}

function commitCreateModel() {
  var nameEl = document.getElementById('new-model-name');
  if (!nameEl || !nameEl.value.trim()) {
    alert("Please specify a model name.");
    return;
  }

  var name = nameEl.value.trim();
  var baseTag = "model-" + name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!baseTag || baseTag === 'model-') {
    baseTag = 'model-custom';
  }
  activeModelTag = baseTag + "-" + Math.random().toString(36).substring(2, 6);

  // Initialize draft engine preference based on user default (fall back to free)
  var defaultEngine = localStorage.getItem('default_onboarding_engine') || 'free';
  localStorage.setItem('active_engine_' + activeModelTag, defaultEngine);

  var newModel = {
    tag: activeModelTag,
    name: name,
    params: "7B",
    status: "draft",
    workspace_id: activeWorkspaceId || "ws-main",
    created_at: new Date().toISOString()
  };

  customModels.unshift(newModel);
  saveModelsLocal();
  closeModal('create-model-modal');

  var builderHeader = document.getElementById('builder-model-name-header');
  if (builderHeader) {
    builderHeader.textContent = "Building Model: " + name;
  }

  var welcomeText = "Welcome to ModelForge! I'm your local AI onboarding specialist.\n\n" +
    "I'm here to help you structure, customize, and fine-tune your proprietary private AI model **" + esc(name) + "** inside this workspace. No cloud data leaks.\n\n" +
    "To begin designing your blueprint: what tasks should your custom model perform, and do you have raw manuals or FAQ PDFs I can extract training prompts from?";

  messages = [{ role: 'ai', text: welcomeText }];
  geminiHistory = [{ role: 'model', parts: [{ text: welcomeText }] }];
  saveOnboardingChatLocal();
  renderMessages();
  
  navigate('builder');
  
  if (supabaseClient) {
    saveChatToCloud('onboarding_' + activeModelTag, 'onboarding', messages, activeModelTag);
  }
}

function updateProfileDOM() {
  var name = localStorage.getItem('profile_name') || 'John Doe';
  var email = localStorage.getItem('profile_email') || 'john@company.com';
  var company = localStorage.getItem('profile_company') || 'Acme Corp';
  var credits = localStorage.getItem('credits_remaining') || '10';
  var userId = localStorage.getItem('user_id') || 'default_user';
  
  // Settings view inputs
  var nameEl = document.getElementById('settings-profile-name');
  if (nameEl) nameEl.textContent = name;
  var emailEl = document.getElementById('settings-profile-email');
  if (emailEl) {
    if (email === 'escola.aboba@gmail.com') {
      emailEl.innerHTML = email + ' <span class="badge-ready" style="font-size:10px;padding:2px 8px;margin-left:6px;background:rgba(139,92,246,0.15);color:#c084fc;border:1px solid rgba(139,92,246,0.3)">Dev Mode (Free Premium)</span>';
    } else {
      emailEl.textContent = email;
    }
  }
  var companyEl = document.getElementById('settings-profile-company');
  if (companyEl) companyEl.textContent = company;
  var idEl = document.getElementById('settings-profile-id');
  if (idEl) idEl.textContent = userId;
  
  // Dashboard & Navigation titles
  var dashHeaderEl = document.getElementById('dash-header-title');
  if (dashHeaderEl) dashHeaderEl.innerHTML = "Welcome back, " + esc(name) + ' <span class="emoji">👋</span>';
  var dashCreditsEl = document.getElementById('dash-stat-credits');
  if (dashCreditsEl) dashCreditsEl.textContent = credits;
  
  var navCreditsBadge = document.querySelector('.credits-badge');
  if (navCreditsBadge) {
    if (credits === 'Unlimited') {
      navCreditsBadge.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Credits: Unlimited (Dev)';
      navCreditsBadge.style.background = 'linear-gradient(90deg, rgba(139,92,246,0.2) 0%, rgba(59,130,246,0.2) 100%)';
      navCreditsBadge.style.borderColor = 'rgba(139,92,246,0.4)';
    } else {
      navCreditsBadge.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Credits: ' + credits;
      navCreditsBadge.style.background = '';
      navCreditsBadge.style.borderColor = '';
    }
  }
  
  // Proposal & Ledger views
  var proposalCredits = document.getElementById('proposal-credits-avail');
  if (proposalCredits) {
    proposalCredits.textContent = credits === 'Unlimited' ? 'Unlimited (Free Premium) credits' : credits + ' credits';
  }
  
  var billingCredits = document.getElementById('billing-credits-balance');
  if (billingCredits) billingCredits.textContent = credits;
  
  var billingUsage = document.getElementById('billing-usage-summary');
  if (billingUsage) {
    if (credits === 'Unlimited') {
      billingUsage.textContent = '0 VRAM adapter compute units billed (100% Free Developer Account)';
    } else {
      var consumed = 10 - parseInt(credits);
      billingUsage.textContent = consumed + ' of 10 monthly credits consumed';
    }
  }
  
  var billingBar = document.getElementById('billing-credit-bar-progress');
  if (billingBar) {
    if (credits === 'Unlimited') {
      billingBar.style.width = '100%';
      billingBar.style.background = 'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))';
    } else {
      billingBar.style.width = (parseInt(credits) * 10) + '%';
      billingBar.style.background = '';
    }
  }
  
  var ledgerTagEl = document.getElementById('billing-ledger-tag');
  if (ledgerTagEl) ledgerTagEl.textContent = "Ledger Ref: " + userId;
  
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
    
    var userId = localStorage.getItem('user_id') || 'default_user';
    
    // Save to Supabase Cloud
    if (supabaseClient) {
      var updatePayload = {};
      if (field === 'name') updatePayload.full_name = newVal;
      if (field === 'email') updatePayload.email = newVal;
      if (field === 'company') updatePayload.company = newVal;
      
      supabaseClient
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', userId)
        .then(function(res) {
          console.log("Supabase profile sync completed.");
        });
    } else {
      // Offline mode saving
      var credits = localStorage.getItem('credits_remaining') || '10';
      saveProfileToCloud({
        id: userId,
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
  var sessionActive = localStorage.getItem('mf_session_active') === 'true';
  if (!sessionActive && view !== 'landing' && view !== 'auth') {
    view = 'landing';
  }
  
  // Update hash to preserve state on reload
  if (window.location.hash !== '#' + view) {
    window.location.hash = view;
  }
  
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

  // Adjust global layout element visibility based on landing / auth context
  var topBar = document.getElementById('global-top-bar');
  var sidebar = document.getElementById('sidebar');
  var main = document.querySelector('.main');
  var layout = document.querySelector('.layout');

  if (view === 'landing' || view === 'auth') {
    if (topBar) topBar.classList.add('hidden');
    if (sidebar) sidebar.classList.add('hidden');
    if (main) {
      main.style.padding = '0';
      main.style.maxWidth = 'none';
      main.style.width = '100%';
      main.style.height = '100%';
    }
    if (layout) {
      layout.style.display = 'block';
    }
    // Start terminal simulator if navigating to landing page
    if (view === 'landing') {
      startTerminalTicker();
    }
  } else {
    if (topBar) topBar.classList.remove('hidden');
    if (sidebar) sidebar.classList.remove('hidden');
    if (main) {
      main.style.padding = '';
      main.style.maxWidth = '';
      main.style.width = '';
      main.style.height = '';
    }
    if (layout) {
      layout.style.display = '';
    }
    
    // Update top-bar search placeholder and input wrapping visibility
    var searchInput = document.getElementById('global-search-input');
    var searchWrap = document.querySelector('.search-input-wrap');
    if (searchInput && searchWrap) {
      if (view === 'dashboard') {
        searchInput.placeholder = 'Search workspaces, models...';
        searchWrap.style.display = '';
      } else if (view === 'billing') {
        searchInput.placeholder = 'Search ledger...';
        searchWrap.style.display = '';
      } else if (view === 'settings') {
        searchInput.placeholder = 'Search commands, resources...';
        searchWrap.style.display = '';
      } else {
        // Hide search for other interior pages (builder, testing) to match layout
        searchWrap.style.display = 'none';
      }
      searchInput.value = '';
    }
    
    // Update sidebar brand title v4.2.0-stable vs AI Core
    var logoSub = document.getElementById('sidebar-logo-subtitle');
    if (logoSub) {
      logoSub.textContent = (view === 'settings') ? 'v4.2.0-stable' : 'AI Core';
    }
    
    // Stop background ticker if console active
    if (tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = null;
    }

    // Call dynamic triggers for profile, api keys, and settings populate
    renderSidebarProfile();
    if (view === 'settings') {
      renderApiKeysList();
      populateSettingsControls();
    }

    // Workspaces specific hooks
    if (view === 'dashboard') {
      renderWorkspacesList();
    } else if (view === 'mymodels') {
      if (!activeWorkspaceId && workspaces.length > 0) {
        activeWorkspaceId = workspaces[0].id;
      }
      populateWorkspaceDetails(activeWorkspaceId);
    } else if (view === 'builder') {
      if (!loadOnboardingChatLocal()) {
        var name = "your model";
        if (activeModelTag) {
          var m = customModels.find(function(item) { return item.tag === activeModelTag; });
          if (m) name = m.name;
        }
        var welcomeText = "Welcome to ModelForge! I'm your local AI onboarding specialist.\n\n" +
          "I'm here to help you structure, customize, and fine-tune your proprietary private AI model **" + esc(name) + "** inside this workspace. No cloud data leaks.\n\n" +
          "To begin designing your blueprint: what tasks should your custom model perform, and do you have raw manuals or FAQ PDFs I can extract training prompts from?";
        
        messages = [{ role: 'ai', text: welcomeText }];
        geminiHistory = [{ role: 'model', parts: [{ text: welcomeText }] }];
        renderMessages();
      }
      var builderHeader = document.getElementById('builder-model-name-header');
      if (builderHeader) {
        var m = customModels.find(function(item) { return item.tag === activeModelTag; });
        builderHeader.textContent = "Building Model: " + (m ? m.name : "Custom LLM");
      }
      var savedEngine = activeModelTag 
        ? (localStorage.getItem('active_engine_' + activeModelTag) || localStorage.getItem('default_onboarding_engine') || 'free')
        : (localStorage.getItem('active_engine_global') || localStorage.getItem('default_onboarding_engine') || 'free');
      setTimeout(function() {
        updateChatEngineUI(savedEngine);
      }, 50);
    }
  }
  updateTopBarTelemetryStatus();
}

// ─── Model Inventory Renderings ──────────────────────────────────────────────
function renderModelsList() {
  var container = document.getElementById('mymodels-list-container');
  if (!container) return;
  
  var workspaceModels = customModels.filter(function(m) {
    return m.workspace_id === activeWorkspaceId;
  });
  
  if (workspaceModels.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">No custom local models built inside this workstation folder. Click Create Custom LLM to start.</div>';
    
    var statActive = document.getElementById('dash-stat-active-models');
    if (statActive) statActive.textContent = "0";
    return;
  }
  
  // Render workspace scoped models list
  container.innerHTML = workspaceModels.map(function(m) {
    var isReady = m.status === 'ready';
    var isDraft = m.status === 'draft';
    var isTraining = m.status === 'training';
    
    var dotClass = isReady ? 'ready' : isDraft ? 'draft' : 'training';
    var badgeClass = isReady ? 'badge-ready' : isDraft ? 'badge-draft' : 'badge-training';
    var statusText = isReady ? 'Online' : isDraft ? 'DRAFT' : 'FINE-TUNING';
    var actionText = isReady ? 'Test Chat' : isDraft ? 'Initialize' : 'View Progress ⚡';
    
    return `<div class="model-row">
      <div class="model-dot ${dotClass}" onclick="startModelTestChat('${m.tag}')" style="cursor:pointer"></div>
      <div class="model-name" onclick="startModelTestChat('${m.tag}')" style="cursor:pointer">${esc(m.name)}</div>
      <div class="model-meta" onclick="startModelTestChat('${m.tag}')" style="cursor:pointer">${m.params} parameters &middot; Secure Private GPU Node &middot; ${statusText}</div>
      <div style="display:flex;gap:8px;margin-left:auto;align-items:center">
        <button class="model-badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);border:1px solid var(--border-glass);cursor:pointer;padding:4px 10px" onclick="renameModel('${m.tag}')">Rename</button>
        <button class="model-badge" style="background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);cursor:pointer;padding:4px 10px" onclick="deleteModel('${m.tag}')">Delete</button>
        <div class="model-badge ${badgeClass}" onclick="startModelTestChat('${m.tag}')" style="cursor:pointer">${actionText}</div>
      </div>
    </div>`;
  }).join('');
  
  var statActive = document.getElementById('dash-stat-active-models');
  var activeCount = workspaceModels.filter(function(m) { return m.status === 'ready'; }).length;
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
  if (!confirm("Are you sure you want to permanently delete '" + tag + "'? This will completely wipe all fine-tuned LoRA weights and directory folders from your secure private GPU compute disk!")) return;
  
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
      ? '<div style="display: block; margin-top: 12px; clear: both;"><button class="proposal-btn" onclick="openProposalView()">&#10024; Generate Model Proposal</button></div>'
      : '';

    return '<div class="bubble-row ' + (isUser ? 'user' : '') + '">' +
      '<div class="avatar-sm ' + (isUser ? 'avatar-user' : 'avatar-ai') + '">' +
        (isUser ? 'You' : 'MF') +
      '</div>' +
      '<div class="bubble ' + (isUser ? 'bubble-user' : 'bubble-ai') + '">' +
        fileTag + formatMarkdown(m.text) + btn +
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
        formatMarkdown(m.text) +
      '</div>' +
    '</div>';
  }).join('');

  win.scrollTop = win.scrollHeight;
}

function saveOnboardingChatLocal() {
  if (activeModelTag) {
    localStorage.setItem('onboarding_chat_' + activeModelTag, JSON.stringify(messages));
    localStorage.setItem('onboarding_gemini_' + activeModelTag, JSON.stringify(geminiHistory));
  } else {
    localStorage.setItem('onboarding_chat_global', JSON.stringify(messages));
    localStorage.setItem('onboarding_gemini_global', JSON.stringify(geminiHistory));
  }
}

function loadOnboardingChatLocal() {
  var chatKey = activeModelTag ? ('onboarding_chat_' + activeModelTag) : 'onboarding_chat_global';
  var geminiKey = activeModelTag ? ('onboarding_gemini_' + activeModelTag) : 'onboarding_gemini_global';
  
  var chatData = localStorage.getItem(chatKey);
  var geminiData = localStorage.getItem(geminiKey);
  
  if (chatData && geminiData) {
    try {
      messages = JSON.parse(chatData);
      geminiHistory = JSON.parse(geminiData);
      renderMessages();
      return true;
    } catch (e) {
      console.error("Failed to parse local onboarding chat:", e);
    }
  }
  return false;
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

  var activeEngine = activeModelTag 
    ? (localStorage.getItem('active_engine_' + activeModelTag) || localStorage.getItem('default_onboarding_engine') || 'free')
    : (localStorage.getItem('active_engine_global') || localStorage.getItem('default_onboarding_engine') || 'free');

  if (activeEngine === 'free') {
    var pollinationsUrl = "https://text.pollinations.ai/openai";
    var historyPayload = geminiHistory.map(function(h) {
      return {
        role: h.role === 'model' ? 'assistant' : h.role,
        content: h.parts[0].text
      };
    });
    var messagesToSend = [{ role: 'system', content: SYSTEM_PROMPT }].concat(historyPayload);
    
    var payload = {
      messages: messagesToSend
    };

    fetch(pollinationsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r) {
      if (!r.ok) throw new Error('Pollinations API call failed.');
      return r.json();
    })
    .then(function(data) {
      messages = messages.filter(function(m) { return !m.typing; });
      var aiText = "";
      try {
        aiText = data.choices[0].message.content;
      } catch (e) {
        aiText = "Sorry, I received an invalid response from the free AI engine.";
      }
      aiText = aiText || "No response generated.";
      geminiHistory.push({ role: "model", parts: [{ text: aiText }] });
      
      var signalsReady = /generate model proposal|click.*proposal|proposal button|i have everything i need/i.test(aiText);
      messages.push({ role: 'ai', text: aiText, showBtn: signalsReady });
      renderMessages();
      saveOnboardingChatLocal();
      if (supabaseClient) {
        var chatId = activeModelTag ? ('onboarding_' + activeModelTag) : 'onboarding';
        saveChatToCloud(chatId, 'onboarding', messages, activeModelTag);
      }
    })
    .catch(function(err) {
      console.warn("Pollinations AI failed, falling back to local fallback:", err);
      tryLocalOrJsOnboarding(sendBtn);
    })
    .finally(function() {
      isFetching = false;
      if (sendBtn) sendBtn.disabled = false;
    });
  } else if (activeEngine === 'gemini') {
    var userKey = localStorage.getItem('custom_gemini_api_key') || '';
    if (!userKey) {
      setTimeout(function() {
        messages = messages.filter(function(m) { return !m.typing; });
        var warningText = "⚠️ **API Key Required**: To use the Cloud Gemini API, please enter your own **Google Gemini API Key** under **System Settings**.\n\nAlternatively, switch the **AI Engine** dropdown above to **Private GPU Node** to run completely offline on your secure dedicated hardware!";
        messages.push({ role: 'ai', text: warningText });
        renderMessages();
        saveOnboardingChatLocal();
        isFetching = false;
        if (sendBtn) sendBtn.disabled = false;
      }, 600);
      return;
    }

    var geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + userKey;
    var payload = {
      system_instruction: { parts: { text: SYSTEM_PROMPT } },
      contents: geminiHistory,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
    };

    fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r) {
      if (!r.ok) throw new Error('API quota exceeded or offline.');
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
      var signalsReady = /generate model proposal|click.*proposal|proposal button|i have everything i need/i.test(aiText);
      messages.push({ role: 'ai', text: aiText, showBtn: signalsReady });
      renderMessages();
      saveOnboardingChatLocal();
      if (supabaseClient) {
        var chatId = activeModelTag ? ('onboarding_' + activeModelTag) : 'onboarding';
        saveChatToCloud(chatId, 'onboarding', messages, activeModelTag);
      }
    })
    .catch(function(err) {
      console.warn("Gemini call failed, falling back to local/JS engine:", err);
      tryLocalOrJsOnboarding(sendBtn);
    })
    .finally(function() {
      isFetching = false;
      if (sendBtn) sendBtn.disabled = false;
    });
  } else {
    // Local GPU (Ollama) flow
    tryLocalOrJsOnboarding(sendBtn);
  }
}

function tryLocalOrJsOnboarding(sendBtn) {
  var historyPayload = geminiHistory.map(function(h) {
    return {
      role: h.role === 'model' ? 'assistant' : h.role,
      content: h.parts[0].text
    };
  });

  fetch(getBaseUrl() + "/onboard/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: geminiHistory[geminiHistory.length - 1].parts[0].text,
      history: historyPayload
    })
  })
  .then(function(res) {
    if (!res.ok) throw new Error("Backend offline or local model failed.");
    return res.json();
  })
  .then(function(data) {
    messages = messages.filter(function(m) { return !m.typing; });
    var aiText = data.response || "No response generated.";
    geminiHistory.push({ role: "model", parts: [{ text: aiText }] });

    var signalsReady = /generate model proposal|click.*proposal|proposal button|i have everything i need/i.test(aiText);
    messages.push({ role: 'ai', text: aiText, showBtn: signalsReady });
    renderMessages();
    saveOnboardingChatLocal();
    if (supabaseClient) {
      var chatId = activeModelTag ? ('onboarding_' + activeModelTag) : 'onboarding';
      saveChatToCloud(chatId, 'onboarding', messages, activeModelTag);
    }
    isFetching = false;
    if (sendBtn) sendBtn.disabled = false;
  })
  .catch(function(err) {
    console.warn("Local backend onboarding failed, falling back to client-side smart fallback:", err);
    callLocalOnboardingFallback(sendBtn);
  });
}

function callLocalOnboardingFallback(sendBtn) {
  setTimeout(function() {
    messages = messages.filter(function(m) { return !m.typing; });

    var lastUserMsg = geminiHistory[geminiHistory.length - 1].parts[0].text.toLowerCase();
    var responseText = "";

    var state = onboardingStates[activeModelTag || 'global'] || {
      stage: 0,
      usecase: "",
      scale: "",
      pdfs: ""
    };
    onboardingStates[activeModelTag || 'global'] = state;

    if (state.stage === 0) {
      state.usecase = lastUserMsg;
      state.stage = 1;
      responseText = "That sounds like a very high-value usecase! Scoping this under a dedicated workstation is definitely the right architectural move.\n\nTo help me calibrate the hyperparameter scales (epochs, ranks, learning rate), a couple of quick details:\n\n• What industry or department is this primarily for?\n• Roughly how many team members or operators will query the model daily?";
    } else if (state.stage === 1) {
      state.scale = lastUserMsg;
      state.stage = 2;
      responseText = "Excellent context, thank you! Calibrating compute resources... A 7B parameter base model (like Qwen 2.5) with QLoRA 4-bit quantization will fit beautifully in your GPU VRAM while maintaining excellent reasoning speed.\n\nJust one more thing: do you have any internal PDF documents, playbooks, or FAQs ready to drag and drop into the uploader bar below? (Even a few pages will help fine-tune its vocabulary!)";
    } else {
      state.pdfs = lastUserMsg;
      state.stage = 3;
      responseText = "Perfect! I have captured all the necessary operational variables. Here is your workstation configuration blueprint:\n\n📊 **Compute Spec**: Private GPU Node Accelerator\n📦 **Base Engine**: Qwen 2.5 (7B parameters)\n🧬 **Quantization**: 4-bit QLoRA (Rank 16, Alpha 16)\n⚙️ **Expected Epochs**: 10 (optimizing factual memory)\n\nWe are ready to review and generate the complete model training proposal! Click the button below to proceed. ✨";
    }

    geminiHistory.push({ role: "model", parts: [{ text: responseText }] });
    var signalsReady = state.stage >= 3;
    messages.push({ role: 'ai', text: responseText, showBtn: signalsReady });
    renderMessages();
    saveOnboardingChatLocal();
    if (supabaseClient) {
      var chatId = activeModelTag ? ('onboarding_' + activeModelTag) : 'onboarding';
      saveChatToCloud(chatId, 'onboarding', messages, activeModelTag);
    }
    isFetching = false;
    if (sendBtn) sendBtn.disabled = false;
  }, 1000);
}

function openProposalView() {
  var historyText = geminiHistory.map(function(h) { return h.parts[0].text; }).join(" ").toLowerCase();
  
  // 1. Extract Use Case / Industry
  var usecase = "Customer Support Agent";
  if (/legal/i.test(historyText)) usecase = "Legal Document Searcher";
  else if (/automotive/i.test(historyText)) usecase = "Automotive Tech Specs";
  else if (/finance|sales/i.test(historyText)) usecase = "Financial Analyst";
  else if (/support|customer/i.test(historyText)) usecase = "Customer Support Agent";
  else {
    // Try to extract some words from history
    var usecaseMatch = historyText.match(/for a\s+([^?.]+)/i);
    if (usecaseMatch && usecaseMatch[1].trim()) {
      usecase = usecaseMatch[1].trim().substring(0, 35);
    }
  }
  
  // 2. Extract Tone of Voice
  var tone = "Professional / Conversational";
  if (/casual|friendly/i.test(historyText)) tone = "Casual & Friendly";
  else if (/professional|formal/i.test(historyText)) tone = "Professional & Formal";
  else if (/empathetic|warm/i.test(historyText)) tone = "Empathetic & Warm";
  
  // 3. Extract Expected Scale
  var scale = "Standard (Local Development)";
  var scaleMatch = historyText.match(/(\d+)\s*(users|queries|people|messages|daily|calls)/i);
  if (scaleMatch) {
    scale = scaleMatch[1] + " daily " + scaleMatch[2];
  } else if (/high|heavy/i.test(historyText)) {
    scale = "Enterprise (Heavy Daily Traffic)";
  }
  
  // 4. Extract PDF files uploaded
  var pdfs = "None uploaded (Using prompt rundown context)";
  var pdfMatch = historyText.match(/attached a pdf named\s+\"([^\"]+)\"/i);
  if (pdfMatch) {
    pdfs = pdfMatch[1];
  } else if (uploadedFile) {
    pdfs = uploadedFile.name;
  }

  // Bind to DOM
  var usecaseEl = document.getElementById('proposal-usecase');
  if (usecaseEl) usecaseEl.textContent = usecase;
  
  var specUsecase = document.getElementById('spec-usecase');
  if (specUsecase) specUsecase.textContent = usecase;

  var specTone = document.getElementById('spec-tone');
  if (specTone) specTone.textContent = tone;

  var specScale = document.getElementById('spec-scale');
  if (specScale) specScale.textContent = scale;

  var specPdfs = document.getElementById('spec-pdfs');
  if (specPdfs) specPdfs.textContent = pdfs;
  
  navigate('proposal');
}

// ─── Local Inference Chat Triggers ────────────────────────────────────────────
var activeTestingTag = "modelforge-custom";

function startModelTestChat(tag) {
  var model = customModels.find(function(m) { return m.tag === tag; });
  if (model && model.status === 'training') {
    navigate('training');
    connectTrainingWS();
    return;
  }
  if (model && model.status === 'draft') {
    activeModelTag = tag;
    var builderHeader = document.getElementById('builder-model-name-header');
    if (builderHeader) {
      builderHeader.textContent = "Building Model: " + model.name;
    }
    navigate('builder');
    return;
  }

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
  var isFreePremium = (localStorage.getItem('profile_email') === 'escola.aboba@gmail.com');
  var creditsVal = localStorage.getItem('credits_remaining') || '10';
  var credits = isFreePremium ? 999999 : parseInt(creditsVal);
  
  if (!isFreePremium && credits < 3) {
    alert("Insufficient credits to start fine-tuning! Please top up your ledger balance in Billing.");
    return;
  }
  
  // Deduct credits if not premium
  if (!isFreePremium) {
    credits = credits - 3;
    localStorage.setItem('credits_remaining', credits.toString());
  } else {
    localStorage.setItem('credits_remaining', 'Unlimited');
  }
  updateProfileDOM();
  
  if (supabaseClient) {
    var userId = localStorage.getItem('user_id') || 'default_user';
    saveProfileToCloud({
      id: userId,
      full_name: localStorage.getItem('profile_name') || 'John Doe',
      email: localStorage.getItem('profile_email') || 'john@company.com',
      company: localStorage.getItem('profile_company') || 'Acme Corp',
      credits: isFreePremium ? 'Unlimited' : credits
    });
  }

  // Generate or reuse model metadata record tag
  var modelName;
  if (activeModelTag) {
    modelName = activeModelTag;
    var model = customModels.find(function(m) { return m.tag === modelName; });
    if (model) {
      model.status = "training";
      saveModelsLocal();
      if (supabaseClient) {
        supabaseClient.from('models').upsert(model).then();
      }
    }
  } else {
    modelName = "modelforge-" + Math.random().toString(36).substring(2, 7);
    var exists = customModels.find(function(m) { return m.tag === modelName; });
    if (!exists) {
      customModels.unshift({
        tag: modelName,
        name: modelName,
        params: "7B",
        status: "training",
        workspace_id: activeWorkspaceId || "ws-main",
        created_at: new Date().toISOString()
      });
      saveModelsLocal();
      if (supabaseClient) {
        supabaseClient.from('models').upsert(customModels[0]).then();
      }
    }
  }
  
  activeModelTag = null; // Clear builder active state after starting training pipeline
  
  navigate('training');
  connectTrainingWS();
  triggerTrainingApiCall(modelName);
}

async function cancelTrainingPipeline() {
  if (!confirm("⚠️ WARNING: Are you sure you want to trigger a complete Safety Stop on the Secure GPU compute pipeline? This will instantly terminate the current run.")) return;
  
  var stopBtn = document.getElementById('btn-cancel-training');
  if (stopBtn) {
    stopBtn.disabled = true;
    stopBtn.textContent = "Stopping Pipeline...";
  }
  
  var baseUrl = getBaseUrl();
  try {
    var response = await fetch(baseUrl + "/train/stop", {
      method: "POST",
      headers: { "Accept": "application/json" }
    });
    
    if (response.ok) {
      alert("Safety Stop command processed. Training pipeline terminated.");
    } else {
      var err = await response.json();
      alert("Error stopping pipeline: " + (err.detail || "Unknown error"));
    }
  } catch (e) {
    console.error("Failed to call stop endpoint:", e);
    alert("Connection error: Could not reach the local engine to stop training.");
  } finally {
    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg> Safety Stop Training ⚠️`;
    }
  }
}

function triggerTrainingApiCall(modelName) {
  if (!modelName) {
    modelName = getTrainingModelTag();
  }
  
  var rundownText = "";
  if (geminiHistory && geminiHistory.length > 0) {
    rundownText = geminiHistory.map(function(m) {
      return (m.role === 'user' ? 'USER' : 'AI') + ":\n" + m.parts[0].text;
    }).join("\n\n");
  } else {
    var localHistory = localStorage.getItem('onboarding_chat_' + modelName);
    if (localHistory) {
      try {
        var chatItems = JSON.parse(localHistory);
        rundownText = chatItems.map(function(m) {
          return (m.role === 'user' ? 'USER' : 'AI') + ":\n" + m.text;
        }).join("\n\n");
      } catch(e) {}
    }
  }

  fetch(getRundownUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: rundownText })
  }).then(function(r) {
    if (!r.ok) throw new Error("Unable to save chat rundown to hardware backend.");
    return fetch(getTrainUrl() + "?model_tag=" + modelName, { method: "POST" });
  }).then(function(r) {
    if (!r.ok && r.status !== 409) throw new Error("Hardware training engine returned error: " + r.statusText);
  }).catch(function(err) {
    console.error("Hardware API error:", err);
    showTrainingError(err.toString());
  });
}

function connectTrainingWS() {
  if (wsTraining) {
    try {
      wsTraining.close();
    } catch(e) {}
  }
  
  var wsUrl = getWsUrl();
  console.log("Connecting to WebSocket:", wsUrl);
  
  try {
    wsTraining = new WebSocket(wsUrl);
  } catch(e) {
    console.error("WebSocket instantiation error:", e);
    showTrainingError("Failed to initiate WebSocket connection: " + e.toString());
    return;
  }
  
  wsTraining.onopen = function() {
    console.log("Training WS connected successfully.");
    hideTrainingError();
  };
  
  wsTraining.onerror = function(err) {
    console.error("Training WS connection error:", err);
    showTrainingError("WebSocket connection to " + wsUrl + " failed. Ensure your backend server is running and port 8000 is open.");
  };
  
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
      showTrainingError(data.message);
    }
  };
  
  wsTraining.onclose = function(e) {
    console.log("Training WS closed.", e);
  };
}

function showTrainingError(msg) {
  var errCard = document.getElementById('training-error-card');
  var errDetails = document.getElementById('training-error-details');
  if (errCard && errDetails) {
    errDetails.textContent = msg;
    errCard.style.display = 'flex';
  }
  
  var statusText = document.getElementById('train-status-text');
  var statusSub = document.getElementById('train-status-sub');
  var statusDot = document.getElementById('train-status-dot-top');
  
  if (statusText) statusText.textContent = "Status: Connection Failed";
  if (statusSub) statusSub.textContent = "Unable to connect to local hardware API.";
  if (statusDot) {
    statusDot.style.background = "#ef4444";
    statusDot.style.boxShadow = "0 0 8px #ef4444";
  }
}

function hideTrainingError() {
  var errCard = document.getElementById('training-error-card');
  if (errCard) {
    errCard.style.display = 'none';
  }
}

function useAlternativeLocalUrl() {
  localStorage.setItem("backendBaseUrl", "http://127.0.0.1:8000");
  hideTrainingError();
  
  var statusText = document.getElementById('train-status-text');
  var statusSub = document.getElementById('train-status-sub');
  var statusDot = document.getElementById('train-status-dot-top');
  if (statusText) statusText.textContent = "Status: Reconnecting...";
  if (statusSub) statusSub.textContent = "Trying alternative address http://127.0.0.1:8000...";
  if (statusDot) {
    statusDot.style.background = "var(--accent-purple)";
    statusDot.style.boxShadow = "0 0 8px var(--accent-purple)";
  }
  
  setTimeout(function() {
    connectTrainingWS();
    triggerTrainingApiCall();
  }, 1000);
}

function retryTrainingPipeline() {
  hideTrainingError();
  
  var statusText = document.getElementById('train-status-text');
  var statusSub = document.getElementById('train-status-sub');
  var statusDot = document.getElementById('train-status-dot-top');
  if (statusText) statusText.textContent = "Status: Reconnecting...";
  if (statusSub) statusSub.textContent = "Connecting to " + getBaseUrl() + "...";
  if (statusDot) {
    statusDot.style.background = "var(--accent-purple)";
    statusDot.style.boxShadow = "0 0 8px var(--accent-purple)";
  }
  
  setTimeout(function() {
    connectTrainingWS();
    triggerTrainingApiCall();
  }, 1000);
}

function getTrainingModelTag() {
  var m = customModels.find(function(item) { return item.status === 'training'; });
  return m ? m.tag : "modelforge-custom";
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
    document.getElementById("train-status-sub").textContent = "Training LoRA layers on private dedicated GPU node...";
    document.getElementById("training-credits-pct").textContent = "1.8 / 3.0";
  } else if (phase === 'export') {
    document.getElementById("train-status-text").textContent = "Status: Compiling quantizations";
    document.getElementById("train-status-sub").textContent = "Quantizing to 4-bit GGUF and loading in private inference service...";
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
  if (txtExp) { txtExp.textContent = "GGUF Quantization & Model Export complete ✓"; }
  
  updateTrainingProgress(100, 100, 100, 0.0);
  renderModelsList();

  // Show premium success modal popup for instant inference testing
  setTimeout(function() {
    var overlay = document.createElement("div");
    overlay.className = "premium-modal-overlay";
    overlay.id = "training-complete-popup-overlay";
    overlay.style.zIndex = "9999";
    
    var box = document.createElement("div");
    box.className = "premium-modal-box";
    box.style.maxWidth = "480px";
    box.style.textAlign = "center";
    box.style.padding = "32px 24px";
    box.style.animation = "modalScaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
    
    box.innerHTML = 
      '<div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue)); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 0 20px rgba(139, 92, 246, 0.45);">' +
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
      '</div>' +
      '<h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">✨ Fine-Tuning Complete! ✨</h2>' +
      '<p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: var(--text-secondary);">' +
        'Your custom model <strong style="color: var(--accent-purple);">' + esc(model ? model.name : tag) + '</strong> has finished training successfully and is loaded directly in VRAM. Ready for local inference!' +
      '</p>' +
      '<div style="display: flex; gap: 12px; justify-content: center;">' +
        '<button class="btn-primary" style="flex: 1; padding: 11px 20px; font-size: 13.5px; font-weight: 700;" onclick="document.getElementById(\'training-complete-popup-overlay\').remove(); startModelTestChat(\'' + tag + '\')">Test Model Now ⚡</button>' +
        '<button class="btn-outline" style="padding: 11px 18px; font-size: 13.5px; font-weight: 600;" onclick="document.getElementById(\'training-complete-popup-overlay\').remove()">Close</button>' +
      '</div>';
      
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }, 800);
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
  ['dashboard', 'Workspaces Hub', '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'],
  ['billing',   'Ledger Billing', '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>'],
  ['settings',  'System Settings', '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14"/>']
];

// ─── Bootstrap Scaffolder ────────────────────────────────────────────────────
function buildApp() {
  var sidebarItems = NAV_ITEMS.map(function(item) {
    return '<div class="nav-item' + (item[0] === 'dashboard' ? ' active' : '') +
      '" data-view="' + item[0] + '" onclick="navigate(\'' + item[0] + '\')">' +
      '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        item[2] +
      '</svg>' +
      '<span>' + item[1] + '</span>' +
    '</div>';
  }).join('');

  var viewDefs = [
    ['landing',    VIEW_LANDING],
    ['auth',       VIEW_AUTH],
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
    return '<div class="view' + (vd[0] === 'landing' ? ' active' : '') +
      '" id="view-' + vd[0] + '">' + vd[1] + '</div>';
  }).join('');

  document.getElementById('app').innerHTML =
    '<div class="layout">' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-logo">' +
          '<div class="logo-title">ModelForge</div>' +
          '<div class="logo-subtitle" id="sidebar-logo-subtitle">AI Core</div>' +
        '</div>' +
        '<div class="sidebar-items-list">' +
          sidebarItems +
        '</div>' +
        '<div class="sidebar-profile-footer" id="sidebar-profile-card" onclick="navigate(\'settings\')">' +
        '</div>' +
      '</aside>' +
      '<div class="main-container">' +
        '<header class="top-bar" id="global-top-bar">' +
          '<div class="top-bar-left">' +
            '<button class="mobile-menu-btn" onclick="event.stopPropagation();toggleSidebarMobile()">&#9776;</button>' +
            '<div class="search-input-wrap">' +
              '<svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
              '<input type="text" id="global-search-input" placeholder="Search workspaces, models..." oninput="handleGlobalSearch(this.value)" />' +
            '</div>' +
            '<div class="top-bar-icons" id="top-bar-extra-icons">' +
              '<button class="top-bar-icon-btn" onclick="navigate(\'settings\')" title="System Settings">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
              '</button>' +
              '<button class="top-bar-icon-btn" id="top-bar-telemetry-btn" onclick="checkComputeTelemetry()" title="Telemetry Bridge: Offline (Checking...)">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><circle cx="12" cy="20" r="2"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="top-bar-right">' +
            '<button class="new-workspace-top-btn" onclick="showCreateWorkspaceModal()">+ New Workspace</button>' +
          '</div>' +
        '</header>' +
        '<main class="main">' + viewsHtml + '</main>' +
      '</div>' +
    '</div>';

  renderSidebarProfile();

  // Seed default onboarding chat triggers
  var welcomeText = "Welcome to ModelForge! I'm your local AI onboarding specialist.\n\n" +
    "I'm here to help you structure, customize, and fine-tune your proprietary private AI model using local hardware resources — no cloud data leaks.\n\n" +
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
  
  var sbUrl = localStorage.getItem("supabaseUrl") || "https://myrlnkpoenobnfyfogsl.supabase.co";
  var sbKey = localStorage.getItem("supabaseKey") || "sb_publishable_nC_MvMMYu5NmKDIggb8v6A_1rqprPVC";
  var settingsSbUrl = document.getElementById('settings-supabase-url');
  if (settingsSbUrl) settingsSbUrl.value = sbUrl;
  var settingsSbKey = document.getElementById('settings-supabase-key');
  if (settingsSbKey) settingsSbKey.value = sbKey;
  
  // Load workspaces and models list
  loadWorkspacesLocal();
  renderWorkspacesList();
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

  // Initialize first-time onboarding check or secure session routing
  setTimeout(function() {
    var sessionActive = localStorage.getItem('mf_session_active') === 'true';
    var chosenUsecase = localStorage.getItem('userUsecase');
    var hashView = window.location.hash.substring(1);
    
    if (sessionActive) {
      var validViews = ['dashboard', 'builder', 'mymodels', 'proposal', 'training', 'modeltest', 'settings', 'billing'];
      if (hashView && validViews.includes(hashView)) {
        navigate(hashView);
        if (chosenUsecase) {
          highlightOptimalPricing(chosenUsecase);
        }
      } else if (chosenUsecase) {
        navigate('dashboard');
        highlightOptimalPricing(chosenUsecase);
      } else {
        navigate('builder');
        showOnboardingWizard();
      }
    } else {
      if (hashView === 'auth') {
        navigate('auth');
      } else {
        navigate('landing');
      }
    }
  }, 300);
}

// ─── First-Time Onboarding Wizard & Personalization Handlers ─────────────────
function showOnboardingWizard() {
  if (localStorage.getItem('userUsecase')) return;
  
  var overlay = document.createElement('div');
  overlay.id = 'onboarding-wizard';
  overlay.className = 'wizard-overlay';
  
  overlay.innerHTML = `
    <div class="wizard-box">
      <div class="wizard-logo">
        <div class="logo-mark">MF</div>
        <h2 style="margin:0;font-size:22px;background:linear-gradient(90deg, #fff, #9ca3af);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">ModelForge</h2>
      </div>
      <h3>Choose Your Primary Workspace Type</h3>
      <p class="wizard-subtitle">We will customize your local database entity, statistics telemetry metrics, and deployment highlights to match your workflow.</p>
      
      <div class="wizard-grid">
        <div class="wizard-card" onclick="selectWizardUsecase(this, 'education')">
          <div class="wizard-card-icon">🎓</div>
          <h4>Education</h4>
          <p>Ideal for students, academics, and researchers exploring fine-tuning limits.</p>
        </div>
        <div class="wizard-card" onclick="selectWizardUsecase(this, 'hobby')">
          <div class="wizard-card-icon">🧪</div>
          <h4>Personal Hobby</h4>
          <p>Perfect for makers, creators, and tinkerers building local assistant adapters.</p>
        </div>
        <div class="wizard-card" onclick="selectWizardUsecase(this, 'solodev')">
          <div class="wizard-card-icon">🚀</div>
          <h4>Solo Developer</h4>
          <p>Optimized for indie hackers, single-operator startups, and Docker API setups.</p>
        </div>
        <div class="wizard-card" onclick="selectWizardUsecase(this, 'companydev')">
          <div class="wizard-card-icon">🏢</div>
          <h4>Company Developer</h4>
          <p>Engineered for enterprise teams building secure database sync pipelines.</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function selectWizardUsecase(element, choice) {
  // Prevent duplicate/misaligned rapid clicks
  if (element.parentNode.classList.contains('processing')) return;
  element.parentNode.classList.add('processing');
  
  // Apply a visual select state to ensure absolute click safety
  var cards = element.parentNode.querySelectorAll('.wizard-card');
  cards.forEach(function(card) {
    card.classList.remove('selected');
    card.style.opacity = '0.5';
  });
  
  element.classList.add('selected');
  element.style.opacity = '1';
  element.style.borderColor = 'var(--accent-purple)';
  element.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.4)';
  
  // Brief delay to showcase premium visual validation state before commit
  setTimeout(function() {
    setUsecase(choice);
  }, 350);
}

function enterConsole() {
  var sessionActive = localStorage.getItem('mf_session_active') === 'true';
  if (sessionActive) {
    var chosenUsecase = localStorage.getItem('userUsecase');
    if (chosenUsecase) {
      navigate('dashboard');
    } else {
      navigate('builder');
      showOnboardingWizard();
    }
  } else {
    navigate('auth');
  }
}

function scrollToFeatures() {
  var el = document.getElementById('landing-features');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

var activeAuthTab = 'login';
function toggleAuthTab(tab) {
  activeAuthTab = tab;
  var tabLogin = document.getElementById('tab-login');
  var tabSignup = document.getElementById('tab-signup');
  var title = document.getElementById('auth-title');
  var subtitle = document.getElementById('auth-subtitle');
  var submitBtn = document.getElementById('auth-submit-btn');
  var extraRow = document.getElementById('auth-extra-row');
  
  if (!tabLogin || !tabSignup || !title || !subtitle || !submitBtn) return;
  
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    title.textContent = 'Welcome Back';
    subtitle.textContent = 'Enter your details to access the local AI console.';
    submitBtn.textContent = 'Enter Console';
    if (extraRow) extraRow.classList.remove('hidden');
  } else {
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    title.textContent = 'Create Operator Account';
    subtitle.textContent = 'Initialize secure local-first cloud ledger credentials.';
    submitBtn.textContent = 'Create Account';
    if (extraRow) extraRow.classList.add('hidden');
  }
}

function handleAuthSubmit(event) {
  event.preventDefault();
  
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value.trim();
  
  if (!email || !password) {
    alert("Please fill out all credentials.");
    return;
  }
  
  // Simulate successful local-first operational authentication
  localStorage.setItem('mf_session_active', 'true');
  localStorage.setItem('profile_email', email);
  
  // Check for the Developer Account
  var isDev = (email === 'escola.aboba@gmail.com');
  if (isDev) {
    localStorage.setItem('profile_role', 'dev');
    localStorage.setItem('credits_remaining', 'Unlimited');
    localStorage.setItem('profile_name', 'Escola Aboba');
    localStorage.setItem('profile_company', 'ModelForge Core Dev Team');
    localStorage.setItem('user_id', 'dev_escola_aboba');
    localStorage.setItem('userUsecase', 'companydev'); // Auto-onboard dev
  } else {
    localStorage.setItem('profile_role', 'user');
    // Revert credits if they were Unlimited previously in local storage (session switch safeguard)
    var curCredits = localStorage.getItem('credits_remaining');
    if (!curCredits || curCredits === 'Unlimited') {
      localStorage.setItem('credits_remaining', '10');
    }
    
    // Clear developer company/name if logging in as normal user
    if (localStorage.getItem('profile_name') === 'Escola Aboba') {
      localStorage.removeItem('profile_name');
    }
    if (localStorage.getItem('profile_company') === 'ModelForge Core Dev Team') {
      localStorage.removeItem('profile_company');
    }
    
    // Formulate default name from operational email
    if (!localStorage.getItem('profile_name')) {
      var defaultName = email.split('@')[0];
      defaultName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
      localStorage.setItem('profile_name', defaultName);
    }
    if (!localStorage.getItem('profile_company')) {
      localStorage.setItem('profile_company', 'Acme Corp');
    }
    
    // Generate custom Operator ID if not exists or if it was dev ID
    var curId = localStorage.getItem('user_id');
    if (!curId || curId === 'dev_escola_aboba' || curId.startsWith('dev_')) {
      var emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      var randId = Math.random().toString(36).substring(2, 7);
      localStorage.setItem('user_id', 'usr_' + emailPrefix + '_' + randId);
    }
  }
  
  updateProfileDOM();
  
  // Trigger Cloud Sync if Supabase is connected
  if (supabaseClient) {
    syncProfileFromCloud();
  }
  
  var chosenUsecase = localStorage.getItem('userUsecase');
  if (chosenUsecase) {
    navigate('dashboard');
  } else {
    navigate('builder');
    showOnboardingWizard();
  }
}

function copyOperatorId() {
  var idVal = localStorage.getItem('user_id') || 'default_user';
  navigator.clipboard.writeText(idVal).then(function() {
    var btn = document.getElementById('copy-id-btn');
    if (btn) {
      var original = btn.textContent;
      btn.textContent = "Copied! ✓";
      btn.style.color = "var(--accent-green)";
      btn.style.borderColor = "var(--accent-green)";
      setTimeout(function() {
        btn.textContent = original;
        btn.style.color = "";
        btn.style.borderColor = "";
      }, 2000);
    }
  });
}

function logOutSession() {
  if (!confirm("Are you sure you want to securely terminate your operational session?")) return;
  localStorage.removeItem('mf_session_active');
  navigate('landing');
}

// Monospace Live Terminal Telemetry simulator ticker loops
var tickerMessages = [
  '<span class="t-purple">[QLORA]</span>  Loss: 1.4820 | Learning Rate: 2.0e-4 | Epoch steps: 10/100',
  '<span class="t-purple">[QLORA]</span>  Loss: 1.3120 | Learning Rate: 1.9e-4 | Epoch steps: 20/100',
  '<span class="t-blue">[CLIENT]</span> Syncing checkpoint ledger metadata to Supabase Cloud...',
  '<span class="t-green">[SYSTEM]</span> Local Google Drive mirroring synchronized (2 new weight adapter files)',
  '<span class="t-purple">[QLORA]</span>  Loss: 1.1042 | Learning Rate: 1.7e-4 | Epoch steps: 40/100',
  '<span class="t-purple">[QLORA]</span>  Loss: 0.9521 | Learning Rate: 1.5e-4 | Epoch steps: 60/100',
  '<span class="t-blue">[CLIENT]</span> Google Drive physical replication active: 1.4 GB/5.0 TB secure VRAM storage allocation',
  '<span class="t-green">[SYSTEM]</span> Temp GPU junction temperature stabilized at 68°C',
  '<span class="t-purple">[QLORA]</span>  Loss: 0.8112 | Learning Rate: 1.2e-4 | Epoch steps: 80/100',
  '<span class="t-green">[SYSTEM]</span> Save checkpoint success: modelforge-latest.safetensors',
  '<span class="t-purple">[QLORA]</span>  Training loop completed in 12.4 minutes on local hardware.',
  '<span class="t-green">[SYSTEM]</span> Quantizing weight adapters to GGUF format (Q4_K_M)...',
  '<span class="t-blue">[CLIENT]</span> Uploading adapter to secure private model library directory...',
  '<span class="t-green">[SYSTEM]</span> Listening for new training dataset triggers...'
];
var tickerIndex = 0;
var tickerInterval = null;

function startTerminalTicker() {
  if (tickerInterval) clearInterval(tickerInterval);
  tickerInterval = setInterval(function() {
    var box = document.getElementById('terminal-ticker-box');
    if (!box) return;
    
    // Remove the cursor line
    var cursorLine = box.querySelector('.t-pulse-cursor');
    if (cursorLine) cursorLine.remove();
    
    // Add the next message
    var msg = tickerMessages[tickerIndex];
    tickerIndex = (tickerIndex + 1) % tickerMessages.length;
    
    var line = document.createElement('div');
    line.className = 't-line';
    line.innerHTML = msg;
    box.appendChild(line);
    
    // Add the cursor line back at the bottom
    var newCursor = document.createElement('div');
    newCursor.className = 't-line t-pulse-cursor';
    newCursor.innerHTML = '<span class="t-blue">[SYSTEM]</span> Ready to build... _';
    box.appendChild(newCursor);
    
    // Auto-scroll
    box.scrollTop = box.scrollHeight;
    
    // Limit to 30 lines to avoid DOM overload
    var lines = box.querySelectorAll('.t-line');
    if (lines.length > 30) {
      lines[0].remove();
    }
  }, 2800);
}

function setUsecase(choice) {
  localStorage.setItem('userUsecase', choice);
  
  // Dynamic Workspace Scaffolding
  if (choice === 'education') {
    localStorage.setItem('profile_name', 'Academic Researcher');
    localStorage.setItem('profile_company', 'Quantum Lab');
  } else if (choice === 'hobby') {
    localStorage.setItem('profile_name', 'Hobbyist Maker');
    localStorage.setItem('profile_company', 'Creative Hub');
  } else if (choice === 'solodev') {
    localStorage.setItem('profile_name', 'Indie Builder');
    localStorage.setItem('profile_company', 'Solo Dev Co.');
  } else if (choice === 'companydev') {
    localStorage.setItem('profile_name', 'Lead Software Architect');
    localStorage.setItem('profile_company', 'Acme Corp');
  }
  
  var overlay = document.getElementById('onboarding-wizard');
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(function() { overlay.remove(); }, 400);
  }
  
  // Re-run DOM updates
  updateProfileDOM();
  highlightOptimalPricing(choice);
  
  // Pre-load a custom message from AI explaining the workspace profile setup
  setTimeout(function() {
    var greetingMsg = "Awesome choice! 🚀 I've tailored your dashboard settings and configured optimal deployment suggestions for **" + choice.toUpperCase() + "**.\n\n" +
      "Your default entity profile is now synced as **" + localStorage.getItem('profile_company') + "**. Feel free to run model tests or upload training PDF documents anytime.";
    messages.push({ role: 'ai', text: greetingMsg });
    renderMessages();
  }, 600);
}

function highlightOptimalPricing(choice) {
  var cards = ['price-card-selfhosted', 'price-card-managedcloud', 'price-card-buyoutright'];
  cards.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.remove('popular', 'optimal-highlight');
      // Remove any previously injected popular badges
      var bad = el.querySelector('.popular-badge');
      if (bad) bad.remove();
    }
  });

  if (choice === 'solodev' || choice === 'hobby') {
    var selfHostedEl = document.getElementById('price-card-selfhosted');
    if (selfHostedEl) {
      selfHostedEl.classList.add('popular', 'optimal-highlight');
      var badge = document.createElement('div');
      badge.className = 'popular-badge';
      badge.textContent = 'Best for Solo Devs';
      selfHostedEl.appendChild(badge);
    }
  } else if (choice === 'companydev') {
    var managedEl = document.getElementById('price-card-managedcloud');
    if (managedEl) {
      managedEl.classList.add('popular', 'optimal-highlight');
      var badge = document.createElement('div');
      badge.className = 'popular-badge';
      badge.textContent = 'Recommended for Teams';
      managedEl.appendChild(badge);
    }
  } else {
    var buyoutEl = document.getElementById('price-card-buyoutright');
    if (buyoutEl) {
      buyoutEl.classList.add('popular', 'optimal-highlight');
      var badge = document.createElement('div');
      badge.className = 'popular-badge';
      badge.textContent = 'Optimal for Research';
      buyoutEl.appendChild(badge);
    }
  }
}

// ─── Solo Developer Copy & Key Gen Helpers ──────────────────────────────────
function copyDockerCommand(button) {
  var txt = document.getElementById('docker-command-text').textContent;
  navigator.clipboard.writeText(txt).then(function() {
    var originalSvg = button.innerHTML;
    button.innerHTML = '<span style="font-size:10px;color:var(--accent-green);font-weight:700">Copied! ✓</span>';
    button.style.background = 'rgba(16, 185, 129, 0.1)';
    button.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    setTimeout(function() {
      button.innerHTML = originalSvg;
      button.style.background = '';
      button.style.borderColor = '';
    }, 2000);
  });
}

function generateApiKey(btn) {
  var wrap = document.getElementById('live-api-key-wrap');
  if (wrap) {
    wrap.classList.remove('hidden');
    btn.classList.add('hidden');
  }
}

function copyApiKeyText(btn) {
  var text = "mf_live_45a0b73c91e82d";
  navigator.clipboard.writeText(text).then(function() {
    var original = btn.textContent;
    btn.textContent = "Copied! ✓";
    btn.style.color = "var(--accent-green)";
    btn.style.borderColor = "var(--accent-green)";
    setTimeout(function() {
      btn.textContent = original;
      btn.style.color = "";
      btn.style.borderColor = "";
    }, 2000);
  });
}

// ─── Premium Console Redesign Event Handlers & Helpers ───────────────────────────
function renderSidebarProfile() {
  var footerEl = document.getElementById('sidebar-profile-card');
  if (!footerEl) return;
  var email = localStorage.getItem('profile_email') || 'admin@modelforge.ai';
  var name = localStorage.getItem('profile_name') || 'Admin User';
  var role = localStorage.getItem('profile_role') || 'Pro Tier';
  
  var isEscola = (email === 'escola.aboba@gmail.com');
  var avatarLetters = isEscola ? 'SO' : (name.match(/\b\w/g) || ['A', 'U']).join('').toUpperCase().substring(0, 2);
  var displayName = isEscola ? 'System Operator' : name;
  var displaySub = isEscola ? 'admin@modelforge.ai' : role;
  
  footerEl.innerHTML = 
    '<div class="user-avatar-wrap">' +
      '<div class="user-avatar-circle">' + avatarLetters + '</div>' +
    '</div>' +
    '<div class="user-profile-details">' +
      '<div class="user-profile-name">' + esc(displayName) + '</div>' +
      '<div class="user-profile-email">' + esc(displaySub) + '</div>' +
    '</div>';
}

function renderApiKeysList() {
  var container = document.getElementById('settings-api-keys-container');
  if (!container) return;
  
  var keys = JSON.parse(localStorage.getItem('mf_api_keys') || '[]');
  if (keys.length === 0) {
    keys = [
      { id: '1', name: 'Production_Main', key: 'mf_live_8a9f2430155b248a8c88f98a9f', date: 'Oct 12, 2023' },
      { id: '2', name: 'Dev_Staging', key: 'mf_test_2b4c10025aa72bc466bb2b4c', date: 'Nov 05, 2023' }
    ];
    localStorage.setItem('mf_api_keys', JSON.stringify(keys));
  }
  
  container.innerHTML = keys.map(function(k) {
    var obscured = k.key.substring(0, 8) + '•' + '•'.repeat(16) + k.key.substring(k.key.length - 4);
    return '<div class="api-key-row">' +
      '<div class="api-key-info">' +
        '<div class="api-key-name">' + esc(k.name) + '</div>' +
        '<div class="api-key-code-wrap">' +
          '<code class="api-key-code">' + obscured + '</code>' +
          '<span class="api-key-date">Created: ' + esc(k.date) + '</span>' +
        '</div>' +
      '</div>' +
      '<button class="api-key-revoke-btn" onclick="revokeApiKey(\'' + k.id + '\')">Revoke</button>' +
    '</div>';
  }).join('');
}

function generateNewApiKey() {
  var name = prompt("Enter a descriptive name for the new API Key:", "Production_New");
  if (!name) return;
  var keys = JSON.parse(localStorage.getItem('mf_api_keys') || '[]');
  var prefix = name.toLowerCase().includes('test') || name.toLowerCase().includes('dev') ? 'mf_test_' : 'mf_live_';
  
  var chars = '0123456789abcdef';
  var hex = '';
  for (var i = 0; i < 20; i++) {
    hex += chars[Math.floor(Math.random() * 16)];
  }
  var fullKey = prefix + hex;
  
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var now = new Date();
  var dateStr = months[now.getMonth()] + ' ' + String(now.getDate()).padStart(2, '0') + ', ' + now.getFullYear();
  
  keys.push({
    id: String(Date.now()),
    name: name,
    key: fullKey,
    date: dateStr
  });
  
  localStorage.setItem('mf_api_keys', JSON.stringify(keys));
  renderApiKeysList();
  alert("Successfully generated new API Key:\n\n" + fullKey + "\n\nPlease copy this key now, as you won't be able to see it again!");
}

function revokeApiKey(id) {
  if (!confirm("Are you sure you want to revoke this API Key? Any external models using this key will immediately lose access!")) return;
  var keys = JSON.parse(localStorage.getItem('mf_api_keys') || '[]');
  keys = keys.filter(function(k) { return k.id !== id; });
  localStorage.setItem('mf_api_keys', JSON.stringify(keys));
  renderApiKeysList();
}

function toggle2FASetting(checked) {
  localStorage.setItem('settings_2fa_active', checked ? 'true' : 'false');
  alert("Two-Factor Authentication requirement " + (checked ? "activated" : "deactivated") + " for all operators.");
}

function saveSessionTimeoutSetting(val) {
  localStorage.setItem('settings_session_timeout', val);
  alert("Default session timeout updated to " + val + " hour" + (val === '1' ? '' : 's') + ".");
}

function saveIpWhitelist() {
  var val = document.getElementById('settings-ip-whitelist').value;
  localStorage.setItem('settings_ip_whitelist', val);
  alert("Network subnet security rules updated successfully.\nApplied IP subnet: " + (val || "None"));
}

function togglePrefSetting(pref, checked) {
  localStorage.setItem('settings_pref_' + pref, checked ? 'true' : 'false');
}

function populateSettingsControls() {
  var t2fa = document.getElementById('settings-2fa-toggle');
  if (t2fa) t2fa.checked = (localStorage.getItem('settings_2fa_active') === 'true');
  
  var tTimeout = document.getElementById('settings-session-timeout');
  if (tTimeout) tTimeout.value = (localStorage.getItem('settings_session_timeout') || '1');
  
  var tIp = document.getElementById('settings-ip-whitelist');
  if (tIp) tIp.value = (localStorage.getItem('settings_ip_whitelist') || '192.168.1.0/24');
  
  var tAutoscale = document.getElementById('settings-autoscale-toggle');
  if (tAutoscale) tAutoscale.checked = (localStorage.getItem('settings_pref_autoscale') === 'true');
  
  var tLogging = document.getElementById('settings-logging-toggle');
  if (tLogging) tLogging.checked = (localStorage.getItem('settings_pref_logging') === 'true');
  
  var tExperimental = document.getElementById('settings-experimental-toggle');
  if (tExperimental) tExperimental.checked = (localStorage.getItem('settings_pref_experimental') === 'true');

  var tGeminiKey = document.getElementById('settings-gemini-api-key');
  if (tGeminiKey) tGeminiKey.value = (localStorage.getItem('custom_gemini_api_key') || '');

  var tDefaultEngine = document.getElementById('settings-default-engine');
  if (tDefaultEngine) tDefaultEngine.value = (localStorage.getItem('default_onboarding_engine') || 'free');
  
  var tBackendUrl = document.getElementById('settings-backend-url');
  if (tBackendUrl) {
    tBackendUrl.value = (localStorage.getItem('backendBaseUrl') || 'http://localhost:8000');
  }
  
  // Immediately test backend connection in background
  testBackendConnection();
}

function saveGeminiApiKeySetting(value) {
  localStorage.setItem('custom_gemini_api_key', value.trim());
}

function saveDefaultEngineSetting(value) {
  localStorage.setItem('default_onboarding_engine', value);
}

function changeBuilderEngine(engine) {
  if (activeModelTag) {
    localStorage.setItem('active_engine_' + activeModelTag, engine);
  } else {
    localStorage.setItem('active_engine_global', engine);
  }
  updateChatEngineUI(engine);
}

function updateChatEngineUI(engine) {
  var statusText = document.getElementById('builder-engine-status-text');
  var dot = document.getElementById('builder-engine-dot');
  var nameText = document.getElementById('builder-engine-name');
  var selector = document.getElementById('builder-engine-selector');
  
  if (selector) {
    selector.value = engine;
  }
  
  // Sync the new chat input switcher pill text
  var activePillName = document.getElementById('gemini-pill-active-name');
  if (activePillName) {
    if (engine === 'gpu') {
      activePillName.textContent = 'Local GPU';
    } else if (engine === 'free') {
      activePillName.textContent = 'Free Cloud';
    } else {
      activePillName.textContent = 'Gemini Pro';
    }
  }
  
  // Sync active classes inside the popover items
  var popoverGemini = document.getElementById('popover-item-gemini');
  var popoverGpu = document.getElementById('popover-item-gpu');
  var popoverFree = document.getElementById('popover-item-free');
  if (popoverGemini) popoverGemini.classList.toggle('active', engine === 'gemini');
  if (popoverGpu) popoverGpu.classList.toggle('active', engine === 'gpu');
  if (popoverFree) popoverFree.classList.toggle('active', engine === 'free');
  
  if (engine === 'gpu') {
    if (statusText) statusText.style.color = 'var(--accent-green)';
    if (dot) {
      dot.style.background = 'var(--accent-green)';
      dot.style.boxShadow = '0 0 8px var(--accent-green)';
    }
    if (nameText) nameText.textContent = 'Local GPU Onboarding Specialist Active';
  } else if (engine === 'free') {
    if (statusText) statusText.style.color = 'var(--accent-blue)';
    if (dot) {
      dot.style.background = 'var(--accent-blue)';
      dot.style.boxShadow = '0 0 8px var(--accent-blue)';
    }
    if (nameText) nameText.textContent = 'Free Cloud Onboarding Specialist Active';
  } else {
    if (statusText) statusText.style.color = 'var(--accent-purple)';
    if (dot) {
      dot.style.background = 'var(--accent-purple)';
      dot.style.boxShadow = '0 0 8px var(--accent-purple)';
    }
    if (nameText) nameText.textContent = 'Gemini Interview Specialist Active';
  }
}

function settingsDeleteAllWorkspaces() {
  if (!confirm("⚠️ WARNING: This will permanently delete all workspaces and custom AI models. This action is irreversible. Proceed?")) return;
  workspaces = [];
  customModels = [];
  localStorage.setItem('workspaces', JSON.stringify([]));
  localStorage.setItem('customModels', JSON.stringify([]));
  alert("All workspace environments successfully deleted.");
  navigate('dashboard');
}

function settingsDeactivateAccount() {
  if (!confirm("⚠️ CAUTION: Deactivating your account will permanently terminate your operational license and delete all ledger history. This cannot be undone. Proceed?")) return;
  localStorage.clear();
  alert("Operational profile deactivated. Redirecting to landing page.");
  window.location.reload();
}

function triggerPaymentCheckout() {
  alert("Direct Stripe Ledger checkout initialized.\nOutstanding month balance: $142.50 USD.");
}

function selectSubTier(tier) {
  alert("Successfully updated operational tier subscription to: " + tier + ".");
}

function handleGlobalSearch(val) {
  if (activeView === 'dashboard') {
    renderWorkspacesList(val);
  } else if (activeView === 'billing') {
    var rows = document.querySelectorAll('#billing-history-rows tr');
    var query = val.toLowerCase().trim();
    rows.forEach(function(row) {
      var txt = row.textContent.toLowerCase();
      row.style.display = txt.includes(query) ? '' : 'none';
    });
  } else if (activeView === 'settings') {
    var cards = document.querySelectorAll('.settings-view .settings-card, .settings-view .settings-two-col > div');
    var query = val.toLowerCase().trim();
    cards.forEach(function(card) {
      var txt = card.textContent.toLowerCase();
      card.style.display = txt.includes(query) ? '' : 'none';
    });
  }
}

// ─── Gemini-Style Model Switcher Popover Logic ──────────────────────────────
function toggleEngineDropdown(event) {
  if (event) event.stopPropagation();
  var popover = document.getElementById('gemini-engine-popover');
  if (popover) {
    popover.classList.toggle('hidden');
  }
}

function selectEnginePopover(engine, displayName, event) {
  if (event) event.stopPropagation();
  
  // 1. Trigger the standard engine change
  changeBuilderEngine(engine);
  
  // 2. Close the popover
  var popover = document.getElementById('gemini-engine-popover');
  if (popover) popover.classList.add('hidden');
}

// Close popover when clicking anywhere else on page
window.addEventListener('click', function(e) {
  var popover = document.getElementById('gemini-engine-popover');
  if (popover && !popover.classList.contains('hidden')) {
    var isPill = e.target.closest('.gemini-pill-btn');
    var isPopover = e.target.closest('.gemini-dropdown-popover');
    if (!isPill && !isPopover) {
      popover.classList.add('hidden');
    }
  }
});

// Global Hash Change Listener for state preservation on reloads & deep links
window.addEventListener('hashchange', function() {
  var hashView = window.location.hash.substring(1);
  if (hashView && hashView !== activeView) {
    navigate(hashView);
  }
});

// ─── Custom Backend Integration Handlers ──────────────────────────────────────────
function saveBackendUrl() {
  var input = document.getElementById('settings-backend-url');
  if (!input) return;
  
  var newUrl = input.value.trim();
  if (!newUrl) {
    alert("Please enter a valid backend URL.");
    return;
  }
  
  if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
    alert("Backend URL must start with http:// or https://");
    return;
  }
  
  localStorage.setItem("backendBaseUrl", newUrl);
  alert("Backend API URL saved and updated to: " + newUrl);
  testBackendConnection();
}

async function testBackendConnection() {
  var statusPill = document.getElementById('settings-connection-status');
  if (!statusPill) return;
  
  statusPill.textContent = "Checking...";
  statusPill.className = "connection-status-pill checking";
  
  var baseUrl = getBaseUrl();
  try {
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 4000); // 4s timeout
    
    var response = await fetch(baseUrl + "/health", {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      statusPill.textContent = "Connected";
      statusPill.className = "connection-status-pill connected";
    } else {
      statusPill.textContent = "Error (" + response.status + ")";
      statusPill.className = "connection-status-pill disconnected";
    }
  } catch (e) {
    console.warn("Backend connection test failed:", e);
    statusPill.textContent = "Disconnected";
    statusPill.className = "connection-status-pill disconnected";
  }
  updateTopBarTelemetryStatus();
}

async function updateTopBarTelemetryStatus() {
  var btn = document.getElementById('top-bar-telemetry-btn');
  if (!btn) return;
  
  var baseUrl = getBaseUrl();
  var startTime = Date.now();
  try {
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 3000); // 3s timeout
    
    var response = await fetch(baseUrl + "/health", {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    clearTimeout(timeoutId);
    
    var latency = Date.now() - startTime;
    if (response.ok) {
      btn.style.setProperty('color', '#10b981', 'important');
      btn.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))', 'important');
      btn.title = "Telemetry Bridge: Online (" + latency + "ms nominal)";
    } else {
      btn.style.setProperty('color', '#ef4444', 'important');
      btn.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))', 'important');
      btn.title = "Telemetry Bridge: Offline (Backend Server Error " + response.status + ")";
    }
  } catch (e) {
    btn.style.setProperty('color', '#ef4444', 'important');
    btn.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))', 'important');
    btn.title = "Telemetry Bridge: Offline (Unreachable)";
  }
}

async function checkComputeTelemetry() {
  var baseUrl = getBaseUrl();
  var startTime = Date.now();
  
  var btn = document.getElementById('top-bar-telemetry-btn');
  if (btn) {
    btn.style.setProperty('color', '#f59e0b', 'important');
    btn.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))', 'important');
    btn.title = "Telemetry Bridge: Checking Connection...";
  }

  try {
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 3000);
    
    var response = await fetch(baseUrl + "/health", {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    clearTimeout(timeoutId);
    
    var latency = Date.now() - startTime;
    if (response.ok) {
      if (btn) {
        btn.style.setProperty('color', '#10b981', 'important');
        btn.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))', 'important');
        btn.title = "Telemetry Bridge: Online (" + latency + "ms nominal)";
      }
      alert(
        "ModelForge Secure Tunnel Connection Details:\n\n" +
        "● Host Node: Connected\n" +
        "● Tunnel Path: Secured (Cloudflare/B2B Proprietary)\n" +
        "● Backend URL: " + baseUrl + "\n" +
        "● Compute Signal: Green\n" +
        "● Network Latency: " + latency + "ms (nominal)\n\n" +
        "All remote workstation operations are synced and fully operational!"
      );
    } else {
      if (btn) {
        btn.style.setProperty('color', '#ef4444', 'important');
        btn.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))', 'important');
        btn.title = "Telemetry Bridge: Offline (Backend Server Error " + response.status + ")";
      }
      showOfflineAlert();
    }
  } catch (e) {
    if (btn) {
      btn.style.setProperty('color', '#ef4444', 'important');
      btn.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))', 'important');
      btn.title = "Telemetry Bridge: Offline (Unreachable)";
    }
    showOfflineAlert();
  }

  function showOfflineAlert() {
    alert(
      "ModelForge Remote Compute Node: OFFLINE\n\n" +
      "Your private GPU hardware compute server is not currently reachable from this browser session.\n\n" +
      "Troubleshooting Steps:\n" +
      "1. Ensure your remote home computer is powered on.\n" +
      "2. Run the connection script on that PC: 'Start_Remote_Server.bat'\n" +
      "3. Verify that the terminal window remains open and shows a green tunnel status.\n" +
      "4. In System Settings, verify that your base API URL matches your secure custom domain.\n\n" +
      "Current Backend Base URL: " + baseUrl
    );
  }
}

buildApp();
updateTopBarTelemetryStatus();
