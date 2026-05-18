
var VIEW_BUILDER = `
<div class="chat-view">
  <div class="chat-messages" id="chat-messages"></div>
  <div class="input-bar">
    <div class="drop-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Drop PDF training data here, or click to upload
    </div>
    <div class="file-chip hidden" id="file-chip">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
      <span class="chip-name"></span>
      <button onclick="clearFile()">&#215;</button>
    </div>
    <input type="file" id="file-input" accept=".pdf" class="hidden" onchange="handleFile(this.files[0])"/>
    <div class="input-row">
      <div class="input-wrap">
        <textarea id="chat-input" rows="1" placeholder="Describe what you want your AI to do..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
        <button class="upload-btn" onclick="document.getElementById('file-input').click()" title="Upload PDF">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
      </div>
      <button class="send-btn" onclick="sendMessage()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
</div>`;

var VIEW_PROPOSAL = `
<div class="proposal-view">
  <h2>Your Model Proposal</h2>
  <p class="proposal-subtitle">Review the specification before we begin training.</p>
  <div class="proposal-card">
    <h3>Model Specification</h3>
    <div class="spec-grid">
      <div class="spec-item"><div class="label">Model Size</div><div class="value highlight-purple">4B</div><div class="sub">Parameters</div></div>
      <div class="spec-item"><div class="label">Focus Area</div><div class="value" style="font-size:14px;margin-top:4px">Your Use Case</div><div class="sub">Custom domain</div></div>
      <div class="spec-item"><div class="label">Est. Training</div><div class="value">2&#8211;5</div><div class="sub">Days</div></div>
    </div>
  </div>
  <div class="proposal-card">
    <h3>Capabilities</h3>
    <ul style="list-style:none;display:flex;flex-direction:column;gap:8px">
      <li style="font-size:14px;color:#374151;display:flex;align-items:center;gap:8px"><span style="color:#6d28d9;font-weight:700">&#10003;</span> Trained on your internal PDF documents</li>
      <li style="font-size:14px;color:#374151;display:flex;align-items:center;gap:8px"><span style="color:#6d28d9;font-weight:700">&#10003;</span> Domain-specific question answering</li>
      <li style="font-size:14px;color:#374151;display:flex;align-items:center;gap:8px"><span style="color:#6d28d9;font-weight:700">&#10003;</span> REST API endpoint included</li>
      <li style="font-size:14px;color:#374151;display:flex;align-items:center;gap:8px"><span style="color:#6d28d9;font-weight:700">&#10003;</span> Chat interface widget</li>
    </ul>
  </div>
  <div class="proposal-card">
    <h3>Cost Estimate</h3>
    <p style="font-size:14px;color:#374151">Training will use <strong>3 credits</strong>. You currently have <strong>10 credits</strong> available.</p>
  </div>
  <div class="action-row">
    <button class="btn-primary" onclick="startTrainingPipeline()">&#128640; Approve &amp; Start Training</button>
    <button class="btn-outline" onclick="navigate('builder')">&#9998; Modify Requirements</button>
  </div>
</div>`;

var VIEW_TRAINING = `
<div class="training-view">
  <div class="status-banner">
    <div class="status-dot" id="train-status-dot-top"></div>
    <div>
      <div style="font-size:14px;font-weight:600;color:#111827" id="train-status-text">Status: Starting Pipeline...</div>
      <div style="font-size:12px;color:#9ca3af" id="train-status-sub">Connecting to local RTX 4060 Ti backend...</div>
    </div>
  </div>
  <div class="progress-ring-wrap">
    <div class="ring-container">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="64" stroke="#f3f4f6" stroke-width="12" fill="none"/>
        <circle id="train-ring-path" cx="80" cy="80" r="64" stroke="url(#pgrad)" stroke-width="12" fill="none" stroke-dasharray="402" stroke-dashoffset="402" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s ease;"/>
        <defs><linearGradient id="pgrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#6d28d9"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs>
      </svg>
      <div class="ring-text"><div class="ring-percent" id="train-ring-percent">0%</div><div class="ring-label">Complete</div></div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;display:flex;gap:12px;align-items:center" id="phase-data_prep">
      <div style="width:8px;height:8px;border-radius:50%;background:#e5e7eb;flex-shrink:0" id="phase-data_prep-dot"></div>
      <div style="font-size:13px;color:#374151" id="phase-data_prep-text">Data generation (pending)</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;display:flex;gap:12px;align-items:center" id="phase-validation">
      <div style="width:8px;height:8px;border-radius:50%;background:#e5e7eb;flex-shrink:0" id="phase-validation-dot"></div>
      <div style="font-size:13px;color:#374151" id="phase-validation-text">QA validation (pending)</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:10px;padding:14px 18px;display:flex;gap:12px;align-items:center" id="phase-training">
      <div style="width:8px;height:8px;border-radius:50%;background:#e5e7eb;flex-shrink:0" id="phase-training-dot"></div>
      <div style="font-size:13px;color:#9ca3af" id="phase-training-text">Fine-tuning in progress (pending)</div>
    </div>
  </div>
  <div class="credit-widget">
    <div class="credit-info"><div class="used">Credits used so far</div><div class="remaining">1.2 / 3</div></div>
    <button class="topup-btn" onclick="navigate('billing')">+ Top Up Credits</button>
  </div>
  <div style="margin-top:16px;text-align:center">
    <button class="btn-outline" style="display:inline-block;padding:10px 28px;font-size:14px;margin-right:10px" onclick="navigate('proposal')">Back</button>
    <button class="btn-primary" style="display:inline-block;padding:10px 28px;font-size:14px;margin-right:10px" onclick="navigate('deployment')">Preview Deployment Options</button>
    <button class="btn-outline" style="display:inline-block;padding:10px 28px;font-size:14px;margin-top:10px" onclick="previewTrainingData()">View Training Data</button>
  </div>
</div>`;

var VIEW_DEPLOYMENT = `
<div class="deploy-view">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
    <button onclick="navigate('training')" style="background:none;border:none;cursor:pointer;color:#6b7280;padding:0"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
    <h2 style="margin:0">Choose Your Deployment</h2>
  </div>
  <p class="sub" style="margin-left:36px">Select how you want to run your custom AI model.</p>
  <div class="pricing-grid">
    <div class="price-card">
      <h3>&#128421; Self-Hosted</h3>
      <div class="price">&#8364;29<span>/month</span></div>
      <p>Run on your own servers. Full control, maximum privacy.</p>
      <ul>
        <li>Model weights download</li>
        <li>Docker container included</li>
        <li>Unlimited local API calls</li>
        <li>Community support</li>
      </ul>
      <button class="price-card-btn outline" onclick="alert('Mock API Key: mf_live_xxxxxxxxxxxxxxxx')">Generate API Key</button>
    </div>
    <div class="price-card popular">
      <div class="popular-badge">Most Popular</div>
      <h3>&#9729; Managed Cloud</h3>
      <div class="price">Pay-per-token</div>
      <p>We host and scale it for you. Zero infrastructure headaches.</p>
      <div class="slider-wrap">
        <label style="font-size:12px;color:#6b7280">Estimate monthly usage:</label>
        <input type="range" min="10" max="500" value="50" oninput="document.getElementById('slider-est').textContent='~\u20AC'+(this.value*0.4).toFixed(0)+'/month for '+this.value+'k tokens'"/>
        <div class="slider-estimate" id="slider-est">~&#8364;20/month for 50k tokens</div>
      </div>
      <ul>
        <li>Auto-scaling infrastructure</li>
        <li>99.9% uptime SLA</li>
        <li>Analytics dashboard</li>
        <li>Priority support</li>
      </ul>
      <button class="price-card-btn filled">Get Started</button>
    </div>
    <div class="price-card">
      <h3>&#128190; Buy Outright</h3>
      <div class="price">&#8364;499<span> one-time</span></div>
      <p>Own the model weights forever. No subscriptions, no lock-in.</p>
      <ul>
        <li>Full IP ownership</li>
        <li>Source weights included</li>
        <li>Lifetime updates (1 yr)</li>
        <li>Commercial license</li>
      </ul>
      <button class="price-card-btn outline">Purchase Model</button>
    </div>
  </div>
</div>`;

var VIEW_DASHBOARD = `
<div class="dashboard-view">
  <div class="dash-header"><h2>Welcome back, John &#128075;</h2><p>Here's what's happening with your AI models today.</p></div>
  <div class="stat-grid">
    <div class="stat-card"><div class="s-label">Active Models</div><div class="s-value">1</div><div class="s-change">&#8593; 1 this month</div></div>
    <div class="stat-card"><div class="s-label">Credits Used</div><div class="s-value">3</div><div class="s-change">7 remaining</div></div>
    <div class="stat-card"><div class="s-label">API Calls (7d)</div><div class="s-value">1.2k</div><div class="s-change">&#8593; 23% vs last week</div></div>
    <div class="stat-card"><div class="s-label">Avg Response</div><div class="s-value">0.8s</div><div class="s-change">&#8595; 12% faster</div></div>
  </div>
  <div class="model-list">
    <div class="model-list-header"><h3>Your Models</h3><button class="new-model-btn" onclick="navigate('builder')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Model</button></div>
    <div class="model-row" onclick="navigate('mymodels')"><div class="model-dot ready"></div><div class="model-name" id="dashboard-model-name">modelforge-custom</div><div class="model-meta">7B params · Last used just now</div><div class="model-badge badge-ready">Ready</div></div>
  </div>
</div>`;

var VIEW_MYMODELS = `
<div class="dashboard-view">
  <div class="dash-header"><h2>My Models</h2><p>Manage and deploy your custom AI models.</p></div>
  <div class="model-list">
    <div class="model-list-header"><h3>All Models (1)</h3><button class="new-model-btn" onclick="navigate('builder')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Model</button></div>
    <div class="model-row">
      <div class="model-dot ready" onclick="navigate('modeltest')" style="cursor:pointer"></div>
      <div class="model-name" id="mymodels-model-name" onclick="navigate('modeltest')" style="cursor:pointer">modelforge-custom</div>
      <div class="model-meta" onclick="navigate('modeltest')" style="cursor:pointer">7B params · Local RTX 4060 Ti · Ready</div>
      <div style="display:flex;gap:8px;margin-left:auto;">
        <button class="model-badge" style="background:#f3f4f6;color:#4b5563;border:none;cursor:pointer;" onclick="renameModel()">Edit</button>
        <button class="model-badge" style="background:#fee2e2;color:#ef4444;border:none;cursor:pointer;" onclick="if(confirm('Are you sure you want to delete this model?')) alert('Model deleted! (Mockup only)')">Delete</button>
        <div class="model-badge badge-ready" onclick="navigate('modeltest')" style="cursor:pointer">Test Model</div>
      </div>
    </div>
  </div>
</div>`;

var VIEW_MODELTEST = `
<div class="chat-view">
  <div class="dash-header" style="padding: 20px 30px 10px; border-bottom: 1px solid #e5e7eb;">
    <div style="display:flex;align-items:center;gap:12px">
      <button onclick="navigate('mymodels')" style="background:none;border:none;cursor:pointer;color:#6b7280"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
      <h2 id="test-model-name-header" style="margin:0;font-size:18px">Testing: modelforge-custom</h2>
    </div>
    <p style="margin: 4px 0 0 32px; font-size:13px; color:#10b981;">&#11044; Connected to local RTX 4060 Ti</p>
  </div>
  <div class="chat-messages" id="test-chat-messages"></div>
  <div class="input-bar">
    <div class="input-row">
      <div class="input-wrap">
        <textarea id="test-chat-input" rows="1" placeholder="Ask your custom model a question..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendTestMessage()}" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
      </div>
      <button class="send-btn" onclick="sendTestMessage()" id="test-send-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
</div>`;

var VIEW_BILLING = `
<div class="billing-view">
  <h2>Billing</h2>
  <div class="billing-card">
    <h3>Credit Balance</h3>
    <div style="font-size:32px;font-weight:800;color:#111827">10 <span style="font-size:16px;color:#9ca3af;font-weight:500">credits remaining</span></div>
    <div class="credit-bar-wrap"><div class="credit-bar"></div></div>
    <div style="font-size:12px;color:#9ca3af;margin-bottom:14px">3 of 10 credits used this cycle</div>
    <button class="btn-primary" style="display:inline-block;padding:10px 24px;font-size:14px;width:auto">+ Add Credits</button>
  </div>
  <div class="billing-card">
    <h3>Current Plan</h3>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:16px;font-weight:700;color:#111827">Starter Plan</div><div style="font-size:13px;color:#9ca3af">10 credits/month &middot; Renews May 29</div></div>
      <button class="topup-btn">Upgrade</button>
    </div>
  </div>
  <div class="billing-card">
    <h3>Recent Transactions</h3>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;font-size:14px"><span style="color:#374151">Support Assistant v2 training</span><span style="color:#6d28d9;font-weight:600">-3 credits</span></div>
      <div style="display:flex;justify-content:space-between;font-size:14px"><span style="color:#374151">Monthly credit top-up</span><span style="color:#10b981;font-weight:600">+10 credits</span></div>
    </div>
  </div>
</div>`;

var VIEW_SETTINGS = `
<div class="settings-view">
  <h2>Settings</h2>
  <div class="settings-section">
    <div class="settings-section-title">Account</div>
    <div class="setting-row"><div><label>Full Name</label><div class="hint">John Doe</div></div><button class="topup-btn">Edit</button></div>
    <div class="setting-row"><div><label>Email</label><div class="hint">john@company.com</div></div><button class="topup-btn">Edit</button></div>
    <div class="setting-row"><div><label>Company</label><div class="hint">Acme Corp</div></div><button class="topup-btn">Edit</button></div>
  </div>
  <div class="settings-section">
    <div class="settings-section-title">Backend Connection</div>
    <div class="setting-row" style="flex-direction:column;align-items:stretch;gap:10px;">
      <div><label>Secure Tunnel URL</label><div class="hint">Enter your Pinggy or localhost.run link to connect your local GPU.</div></div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="settings-backend-url" placeholder="https://..." style="flex:1;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;" />
        <button class="btn-primary" style="padding:8px 16px;width:auto;font-size:13px;" onclick="saveBackendUrl()">Connect</button>
      </div>
    </div>
  </div>
  <div class="settings-section">
    <div class="settings-section-title">Notifications</div>
    <div class="setting-row"><div><label>Training complete alerts</label><div class="hint">Get notified when your model finishes</div></div><button class="toggle on" id="t-notif" onclick="toggleSetting('notif')"></button></div>
    <div class="setting-row"><div><label>Product updates</label><div class="hint">News about new features</div></div><button class="toggle" id="t-updates" onclick="toggleSetting('updates')"></button></div>
    <div class="setting-row"><div><label>Weekly usage reports</label><div class="hint">Summary of API usage</div></div><button class="toggle on" id="t-reports" onclick="toggleSetting('reports')"></button></div>
  </div>
  <div class="settings-section">
    <div class="settings-section-title">Danger Zone</div>
    <div class="setting-row"><div><label style="color:#ef4444">Delete Account</label><div class="hint">Permanently delete all data</div></div><button class="topup-btn" style="color:#ef4444;border-color:#fecaca">Delete</button></div>
  </div>
</div>`;
