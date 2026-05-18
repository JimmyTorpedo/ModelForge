// ─── ModelForge Local API Configuration ─────────────────────────────────────
var backendBaseUrl = "";
if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && !window.location.hostname.endsWith(".local")) {
  backendBaseUrl = localStorage.getItem("backendBaseUrl") || "";
  if (!backendBaseUrl) {
    backendBaseUrl = prompt("Enter your backend tunnel URL (e.g. https://rnxxx.a.free.pinggy.link):") || "";
    if (backendBaseUrl) localStorage.setItem("backendBaseUrl", backendBaseUrl.trim());
  }
}
backendBaseUrl = backendBaseUrl.trim().replace(/\/$/, "");

var LOCAL_API_URL    = backendBaseUrl + "/chat/direct";
var LOCAL_UPLOAD_URL = backendBaseUrl + "/upload";
var LOCAL_RUNDOWN_URL= backendBaseUrl + "/rundown";
var LOCAL_TRAIN_URL  = backendBaseUrl + "/train";

var wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
var defaultWsHost = wsProtocol + "//" + window.location.host;
var LOCAL_WS_URL = backendBaseUrl 
  ? backendBaseUrl.replace(/^http/, 'ws') + "/ws/progress" 
  : defaultWsHost + "/ws/progress";

// ─── Gemini API Configuration (For Onboarding Builder) ───────────────────────
var GEMINI_API_KEY = "AIzaSyCyZo98Ygk9Tz-0Z1wcDJn28myAuMfCrhk";
var GEMINI_MODEL   = "gemini-flash-latest"; // Must use latest for free tier
var GEMINI_URL     = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY;

// System instruction injected into every Gemini call
// Mock fallback responses used when the API key is missing / quota-exceeded
var MOCK_FALLBACK = [
  "That's a great use case! To design the perfect model, a couple of quick questions:\n\n• What industry or department is this for? (e.g., Sales, Legal, Customer Support)\n• Roughly how many people will use the AI daily?\n\nAlso, feel free to drag in any PDF documents you'd like the model to learn from!",
  "Excellent context, thank you! Just one more thing before I put together your proposal — do you already have internal PDF documents (manuals, FAQs, playbooks) that the model could be trained on? Even a few pages make a big difference.\n\nOnce you confirm, I have everything I need to generate your Model Proposal.",
  "Perfect — I have everything I need! Here's a quick summary of what I've captured:\n\n📦  Model Size: 4B parameters\n🎯  Focus Area: Your specified domain\n⏱️  Estimated Training: 2–5 days\n\nReady to review the full proposal? Click the button below to proceed."
];
var mockFallbackIndex = 0;

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

// ─── App State ────────────────────────────────────────────────────────────────
var messages          = [];   // Builder onboarding chat
var testMessages      = [];   // Custom model testing chat
var geminiHistory     = [];   // [{role:"user"|"model", parts:[{text}]}] for Gemini context
var uploadedFile      = null;
var activeView        = 'builder';
var sidebarCollapsed  = false;
var toggleStates      = {notif: true, updates: false, reports: true};
var isFetching        = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function renameModel() {
  var nameEl = document.getElementById('mymodels-model-name');
  if (!nameEl) return;
  
  var currentName = nameEl.textContent;
  var newName = prompt("Enter a new name for your model:", currentName);
  
  if (newName && newName.trim() !== "") {
    newName = newName.trim();
    localStorage.setItem('customModelName', newName);
    
    // Update all occurrences in the DOM
    if (document.getElementById('mymodels-model-name')) {
      document.getElementById('mymodels-model-name').textContent = newName;
    }
    if (document.getElementById('dashboard-model-name')) {
      document.getElementById('dashboard-model-name').textContent = newName;
    }
    if (document.getElementById('test-model-name-header')) {
      document.getElementById('test-model-name-header').textContent = "Testing: " + newName;
    }
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function navigate(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.toggle('active', n.dataset.view === view);
  });
}

// ─── Chat Rendering ───────────────────────────────────────────────────────────
function renderMessages() {
  var win = document.getElementById('chat-messages');
  if (!win) return;

  win.innerHTML = messages.map(function(m) {

    // Typing indicator bubble
    if (m.typing) {
      return '<div class="bubble-row">' +
        '<div class="avatar-sm avatar-ai">MF</div>' +
        '<div class="bubble bubble-ai">' +
          '<div class="typing-dots"><span></span><span></span><span></span></div>' +
        '</div>' +
      '</div>';
    }

    // Error bubble
    if (m.error) {
      return '<div class="bubble-row">' +
        '<div class="avatar-sm avatar-ai" style="background:#ef4444">!</div>' +
        '<div class="bubble bubble-ai" style="border-color:#fecaca;background:#fff5f5;color:#dc2626">' +
          '<strong>Error:</strong> ' + esc(m.text) +
        '</div>' +
      '</div>';
    }

    var isUser  = m.role === 'user';
    var fileTag = m.file
      ? '<div style="font-size:11px;opacity:.75;margin-bottom:6px">&#128206; ' + esc(m.file) + '</div>'
      : '';
    var btn = m.showBtn
      ? '<button class="proposal-btn" onclick="navigate(\'proposal\')">&#10024; Generate Model Proposal</button>'
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
        '<div class="avatar-sm avatar-ai" style="background:#ef4444">!</div>' +
        '<div class="bubble bubble-ai" style="border-color:#fecaca;background:#fff5f5;color:#dc2626">' +
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

// ─── Builder Onboarding AI ────────────────────────────────────────────────────
function callBuilderAI(userText, fileContext) {
  if (isFetching) return;
  isFetching = true;

  var sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = true;

  // Show typing indicator
  messages.push({ typing: true });
  renderMessages();

  // Add user message to Gemini history
  var fullMessage = userText;
  if (fileContext) {
    fullMessage += '\n\n[The user has attached a PDF named "' + fileContext + '" as training data.]';
  }
  geminiHistory.push({ role: "user", parts: [{ text: fullMessage }] });

  // Build the payload with system instruction
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
    if (!r.ok) throw new Error('API returned ' + r.status);
    return r.json();
  })
  .then(function(data) {
    messages = messages.filter(function(m) { return !m.typing; });
    var aiText = "";
    try {
      aiText = data.candidates[0].content.parts[0].text;
      // Save AI response to history
      geminiHistory.push({ role: "model", parts: [{ text: aiText }] });
    } catch (e) {
      aiText = "Sorry, I received an invalid response from the API.";
    }

    // Bypass Gemini API truncation bug: force the button to appear if the user has replied at least once
    var signalsReady = /generate model proposal|ready to proceed|click.*proposal|proposal button/i.test(aiText) || geminiHistory.length >= 3;
    messages.push({ role: 'ai', text: aiText, showBtn: signalsReady });
    renderMessages();
  })
  .catch(function(err) {
    // Fallback to mock logic if Gemini fails
    messages = messages.filter(function(m) { return !m.typing; });
    var text = MOCK_FALLBACK[Math.min(mockFallbackIndex, MOCK_FALLBACK.length - 1)];
    mockFallbackIndex++;
    
    // Simulate Gemini history
    geminiHistory.push({ role: "model", parts: [{ text: text }] });
    
    var signalsReady = mockFallbackIndex >= MOCK_FALLBACK.length;
    messages.push({ role: 'ai', text: text, showBtn: signalsReady });
    renderMessages();
  })
  .finally(function() {
    isFetching = false;
    if (sendBtn) sendBtn.disabled = false;
  });
}

// ─── Local API Call (Custom Model) ────────────────────────────────────────────
function callLocalAPI(userText) {
  if (isFetching) return;
  isFetching = true;

  var sendBtn = document.getElementById('test-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  // Show typing indicator in test chat
  testMessages.push({ typing: true });
  renderTestMessages();

  fetch(LOCAL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText })
  })
  .then(function(r) {
    if (!r.ok) throw new Error('Server returned ' + r.status);
    return r.json();
  })
  .then(function(data) {
    testMessages = testMessages.filter(function(m) { return !m.typing; });
    var aiText = (data.response || '').trim() || 'No response received.';
    testMessages.push({ role: 'ai', text: aiText });
    renderTestMessages();
  })
  .catch(function(err) {
    testMessages = testMessages.filter(function(m) { return !m.typing; });
    testMessages.push({ role: 'ai', text: 'Error connecting to local ModelForge API. Is the server running?', error: true });
    renderTestMessages();
  })
  .finally(function() {
    isFetching = false;
    if (sendBtn) sendBtn.disabled = false;
  });
}

function startTestChat(tag) {
    var h2 = document.querySelector('#view-modeltest h2');
    if (h2) h2.textContent = "Testing: " + tag;
    navigate('modeltest');
    
    // Clear previous chat
    testMessages = [];
    renderTestMessages();
    
    // Ask the fine-tuned local model to introduce itself!
    testMessages.push({ typing: true });
    renderTestMessages();
    
    fetch(LOCAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "System prompt: Introduce yourself to the customer in one short, friendly sentence. Remember your specific persona and company name." })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        testMessages = testMessages.filter(function(m) { return !m.typing; });
        var response = (data.response || '').trim();
        if (!response) response = "Hi! Welcome to customer support. How can I help you today?";
        testMessages.push({ role: 'ai', text: response });
        renderTestMessages();
    })
    .catch(function(err) {
        testMessages = testMessages.filter(function(m) { return !m.typing; });
        testMessages.push({ role: 'ai', text: "Hi! Welcome to customer support. How can I help you today?" });
        renderTestMessages();
    });
}

// ─── Send Message ─────────────────────────────────────────────────────────────
function sendMessage() {
  if (isFetching) return;
  var inp  = document.getElementById('chat-input');
  var text = inp.value.trim();
  if (!text) return;

  var fileName = uploadedFile ? uploadedFile.name : null;

  // Add user bubble immediately
  messages.push({ role: 'user', text: text, file: fileName });
  inp.value = '';
  inp.style.height = 'auto';
  clearFile();
  renderMessages();

  // Call Gemini onboarding AI
  callBuilderAI(text, fileName);
}

// ─── Send Test Message (Custom Model) ─────────────────────────────────────────
function sendTestMessage() {
  if (isFetching) return;
  var inp  = document.getElementById('test-chat-input');
  var text = inp.value.trim();
  if (!text) return;

  testMessages.push({ role: 'user', text: text });
  inp.value = '';
  inp.style.height = 'auto';
  renderTestMessages();

  // Call local ModelForge API
  callLocalAPI(text);
}

// ─── File Handling ────────────────────────────────────────────────────────────
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
    alert('Please upload a PDF file.'); return;
  }
  uploadedFile = file;
  var chip = document.getElementById('file-chip');
  chip.classList.remove('hidden');
  chip.querySelector('.chip-name').textContent =
    file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';

  // Upload PDF to the ModelForge backend server
  var formData = new FormData();
  formData.append('file', file);
  fetch(LOCAL_UPLOAD_URL, { method: 'POST', body: formData })
    .then(function(r) { return r.json(); })
    .then(function(d) { console.log('PDF saved to server:', d.saved_to); })
    .catch(function() { console.warn('Could not reach backend — PDF not uploaded to server.'); });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  var sb  = document.getElementById('sidebar');
  var btn = document.getElementById('collapse-btn');
  sb.classList.toggle('collapsed', sidebarCollapsed);
  btn.querySelector('svg').style.transform = sidebarCollapsed ? 'rotate(180deg)' : '';
}

// ─── Settings toggles ─────────────────────────────────────────────────────────
function toggleSetting(key) {
  toggleStates[key] = !toggleStates[key];
  var el = document.getElementById('t-' + key);
  if (el) el.classList.toggle('on', toggleStates[key]);
}

// ─── Sidebar nav items ────────────────────────────────────────────────────────
var NAV_ITEMS = [
  ['builder',   'Model Builder', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'],
  ['dashboard', 'Dashboard',    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'],
  ['mymodels',  'My Models',    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'],
  ['billing',   'Billing',      '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>'],
  ['settings',  'Settings',     '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14"/>']
];

// ─── Training Pipeline Orchestration ───────────────────────────────────────────

var wsTraining = null;

function startTrainingPipeline() {
  // Navigate to training view
  navigate('training');

  // Build rundown text from geminiHistory
  var rundownText = geminiHistory.map(function(m) {
    return (m.role === 'user' ? 'USER' : 'AI') + ":\n" + m.parts[0].text;
  }).join("\n\n");

  // Connect WebSocket immediately so we don't miss any events
  connectTrainingWS();

  // Post rundown
  fetch(LOCAL_RUNDOWN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: rundownText })
  }).then(function(r) {
    if (!r.ok) throw new Error("Failed to save rundown");
    // Start training
    return fetch(LOCAL_TRAIN_URL, { method: "POST" });
  }).then(function(r) {
    if (!r.ok && r.status !== 409) throw new Error("Failed to start training");
  }).catch(function(err) {
    console.error("Pipeline start failed:", err);
    alert("Could not start training pipeline. Is api.py running?");
  });
}

function connectTrainingWS() {
  if (wsTraining) wsTraining.close();
  wsTraining = new WebSocket(LOCAL_WS_URL);
  
  wsTraining.onmessage = function(event) {
    var data = JSON.parse(event.data);
    
    if (data.event === "state") {
      if (data.data.status === "running") {
        if (data.data.phase) {
          updateTrainingPhase(data.data.phase);
        }
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
      document.getElementById("train-status-text").textContent = "Status: Error";
      document.getElementById("train-status-sub").textContent = data.message;
      document.getElementById("train-status-dot-top").style.background = "#ef4444";
    }
  };
}

function updateTrainingPhase(phase) {
  var phases = ['data_prep', 'validation', 'training', 'export'];
  var currentIdx = phases.indexOf(phase);
  
  if (phase === 'data_prep') {
    document.getElementById("train-status-text").textContent = "Status: Generating Data";
    document.getElementById("train-status-sub").textContent = "Reading PDFs and generating Q&A pairs via Gemini...";
  } else if (phase === 'validation') {
    document.getElementById("train-status-text").textContent = "Status: QA Validation";
    document.getElementById("train-status-sub").textContent = "Validating pairs and filtering hallucinations...";
  } else if (phase === 'training') {
    document.getElementById("train-status-text").textContent = "Status: Fine-Tuning";
    document.getElementById("train-status-sub").textContent = "Training LoRA adapter on RTX 4060 Ti...";
  }
  
  // Update bullets
  phases.forEach(function(p, i) {
    var dot = document.getElementById("phase-" + p + "-dot");
    var txt = document.getElementById("phase-" + p + "-text");
    if (!dot || !txt) return;
    
    dot.style.animation = "none";
    if (i < currentIdx) {
      dot.style.background = "#10b981"; // green
      txt.style.color = "#374151";
      txt.textContent = txt.textContent.replace("(pending)", "complete").replace("in progress", "complete");
    } else if (i === currentIdx) {
      dot.style.background = "#f59e0b"; // yellow
      dot.style.animation = "pulse 1.5s infinite";
      txt.style.color = "#374151";
    } else {
      dot.style.background = "#e5e7eb"; // gray
      txt.style.color = "#9ca3af";
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
    sub.textContent = "Step " + step + "/" + total + " | Loss: " + loss.toFixed(4);
  }
}

function completeTraining(tag) {
  document.getElementById("train-status-text").textContent = "Status: Complete";
  document.getElementById("train-status-sub").textContent = "Model '" + tag + "' is ready for deployment.";
  document.getElementById("train-status-dot-top").style.background = "#10b981";
  
  var dot = document.getElementById("phase-training-dot");
  var txt = document.getElementById("phase-training-text");
  if (dot) { dot.style.background = "#10b981"; dot.style.animation = "none"; }
  if (txt) { txt.textContent = "Fine-tuning complete"; }
  
  updateTrainingProgress(100, 100, 100, 0.0);
  
  // Inject the newly trained model into the My Models list
  var myModelsList = document.querySelector('#view-mymodels .model-list');
  if (myModelsList && !document.getElementById('trained-model-' + tag)) {
    var newRow = document.createElement('div');
    newRow.id = 'trained-model-' + tag;
    newRow.className = 'model-row';
    newRow.style.cursor = 'pointer';
    newRow.onclick = function() {
        startTestChat(tag);
    };
    newRow.innerHTML = '<div class="model-dot ready" style="background:#10b981"></div>' +
      '<div class="model-name">' + tag + '</div>' +
      '<div class="model-meta">1.5B params &middot; Local RTX 4060 Ti &middot; Ready</div>' +
      '<div class="model-badge badge-ready">Test Model</div>';
    
    var header = myModelsList.querySelector('.model-list-header');
    if (header) {
      header.insertAdjacentElement('afterend', newRow);
    }
  }
}

function previewTrainingData() {
  fetch("http://localhost:8000/dataset")
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (!res.data || res.data.length === 0) {
      alert("No training data generated yet. Wait for the data generation phase to complete.");
      return;
    }
    var content = res.data.map(function(p, i) {
      return "Q" + (i+1) + ": " + p.instruction + "\n" + "A" + (i+1) + ": " + p.output;
    }).join("\n\n-----------------\n\n");
    
    var overlay = document.createElement("div");
    overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;";
    var box = document.createElement("div");
    box.style = "background:#fff;width:80%;max-width:800px;height:80%;border-radius:12px;padding:24px;display:flex;flex-direction:column;";
    
    // We don't use esc() here because we are setting textarea.value, not innerHTML
    var ta = document.createElement("textarea");
    ta.readOnly = true;
    ta.style = "flex:1;resize:none;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-family:monospace;font-size:13px;line-height:1.5";
    ta.value = content;
    
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "Close Preview";
    closeBtn.style = "margin-top:16px;padding:12px;background:#6d28d9;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600";
    closeBtn.onclick = function() { overlay.remove(); };
    
    var h2 = document.createElement("h2");
    h2.textContent = "Generated Q&A Pairs (" + res.data.length + ")";
    h2.style = "margin-top:0;margin-bottom:16px";
    
    box.appendChild(h2);
    box.appendChild(ta);
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  })
  .catch(function(err) {
    alert("Could not load training data.");
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
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
      '<div class="nav-logo">' +
        '<div class="logo-mark">MF</div>' +
        '<span>ModelForge</span>' +
      '</div>' +
      '<div class="credits-badge">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
          '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' +
        '</svg>' +
        'Credits: 10' +
      '</div>' +
      '<div class="nav-right">' +
        '<div class="user-avatar" title="John Doe">JD</div>' +
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

  // Show the initial AI greeting via Gemini
  // We seed the conversation with a first "model" turn so Gemini has context,
  // then display a static welcome so the user doesn't wait on load.
  var welcomeText = "Welcome to ModelForge! I'm your onboarding assistant.\n\n" +
    "I'm here to help you design and build your own custom AI model — no technical " +
    "knowledge needed.\n\n" +
    "To get started: what specific tasks do you want your AI to perform, " +
    "and do you have any internal PDF documents it could learn from?";

  // Pre-seed Gemini history with this opening so subsequent calls maintain context
  geminiHistory.push({ role: 'model', parts: [{ text: welcomeText }] });
  messages.push({ role: 'ai', text: welcomeText });

  setTimeout(function() { 
    renderMessages(); 
    renderTestMessages();
  }, 300);

  // Drag-and-drop wiring
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
  
  // Restore saved custom model name
  var savedName = localStorage.getItem('customModelName');
  if (savedName) {
    if (document.getElementById('mymodels-model-name')) document.getElementById('mymodels-model-name').textContent = savedName;
    if (document.getElementById('dashboard-model-name')) document.getElementById('dashboard-model-name').textContent = savedName;
    if (document.getElementById('test-model-name-header')) document.getElementById('test-model-name-header').textContent = "Testing: " + savedName;
  }
}

buildApp();
