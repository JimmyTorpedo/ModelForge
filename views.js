/* 
========================================================================
ModelForge Component Templates (views.js)
========================================================================
Contains the template literal views for the dashboard, chat, settings,
and training pages. Uses the premium dark glassmorphism CSS class framework.
*/

var VIEW_BUILDER = `
<div class="chat-view">
  <div class="chat-messages" id="chat-messages"></div>
  <div class="input-bar">
    <div class="drop-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Drop PDF training documents here, or click to upload
    </div>
    <div class="file-chip hidden" id="file-chip">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
      <span class="chip-name"></span>
      <button onclick="clearFile()">&times;</button>
    </div>
    <input type="file" id="file-input" accept=".pdf" class="hidden" onchange="handleFile(this.files[0])"/>
    <div class="input-row">
      <div class="input-wrap">
        <textarea id="chat-input" rows="1" placeholder="Describe the specific tasks you want your custom AI model to do..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}" oninput="autoGrow(this)"></textarea>
        <button class="upload-btn" onclick="document.getElementById('file-input').click()" title="Upload PDF">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
      </div>
      <button class="send-btn" id="send-btn" onclick="sendMessage()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
</div>`;

var VIEW_PROPOSAL = `
<div class="proposal-view">
  <h2>Your AI Model Proposal</h2>
  <p class="proposal-subtitle">Review the blueprint specification before starting the local RTX 4060 Ti fine-tuning.</p>
  
  <div class="proposal-card">
    <h3>Model Blueprint</h3>
    <div class="spec-grid">
      <div class="spec-item">
        <div class="label">Base Foundation</div>
        <div class="value highlight-purple">Qwen 7B</div>
        <div class="sub">Instruct (4-bit QLoRA)</div>
      </div>
      <div class="spec-item">
        <div class="label">Focus Area</div>
        <div class="value" style="font-size:14px;font-weight:600;margin-top:4px" id="proposal-usecase">Your Domain Specs</div>
        <div class="sub">Fine-tuned Knowledge</div>
      </div>
      <div class="spec-item">
        <div class="label">Est. Training</div>
        <div class="value">10 - 20m</div>
        <div class="sub">High-speed Local GPU</div>
      </div>
    </div>
  </div>
  
  <div class="proposal-card">
    <h3>Trained Capabilities</h3>
    <ul style="list-style:none;display:flex;flex-direction:column;gap:10px">
      <li style="font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:10px"><span style="color:var(--accent-purple);font-weight:800">&#10003;</span> Ingest and synthesize PDF document facts</li>
      <li style="font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:10px"><span style="color:var(--accent-purple);font-weight:800">&#10003;</span> Strictly bounded question answering (no hallucination)</li>
      <li style="font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:10px"><span style="color:var(--accent-purple);font-weight:800">&#10003;</span> Dedicated local REST API endpoint and WebSocket state</li>
      <li style="font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:10px"><span style="color:var(--accent-purple);font-weight:800">&#10003;</span> Portable model weights ready for GGUF/Ollama export</li>
    </ul>
  </div>
  
  <div class="proposal-card">
    <h3>Resource Cost</h3>
    <p style="font-size:14px;color:var(--text-secondary)">Fine-tuning will consume <strong>3 credits</strong> from your account balance. You currently have <strong id="proposal-credits-avail">10 credits</strong> available.</p>
  </div>
  
  <div class="action-row">
    <button class="btn-primary" onclick="startTrainingPipeline()">&#128640; Approve &amp; Start Training</button>
    <button class="btn-outline" onclick="navigate('builder')">&#9998; Modify Blueprint</button>
  </div>
</div>`;

var VIEW_TRAINING = `
<div class="training-view">
  <div class="status-banner">
    <div class="status-dot" id="train-status-dot-top"></div>
    <div>
      <div style="font-size:15px;font-weight:700;color:var(--text-primary)" id="train-status-text">Status: Starting Engine...</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:2px" id="train-status-sub">Connecting to local RTX 4060 Ti hardware...</div>
    </div>
  </div>
  
  <div class="progress-ring-wrap">
    <div class="ring-container">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="64" stroke="rgba(255,255,255,0.04)" stroke-width="10" fill="none"/>
        <circle id="train-ring-path" cx="80" cy="80" r="64" stroke="url(#pgrad)" stroke-width="10" fill="none" stroke-dasharray="402" stroke-dashoffset="402" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s ease;"/>
        <defs>
          <linearGradient id="pgrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="var(--accent-purple)"/>
            <stop offset="100%" stop-color="var(--accent-blue)"/>
          </linearGradient>
        </defs>
      </svg>
      <div class="ring-text">
        <div class="ring-percent" id="train-ring-percent">0%</div>
        <div class="ring-label">Complete</div>
      </div>
    </div>
  </div>
  
  <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px">
    <div class="phase-card" id="phase-data_prep">
      <div class="phase-dot" id="phase-data_prep-dot"></div>
      <div style="font-size:13.5px;color:var(--text-secondary);font-weight:500" id="phase-data_prep-text">Data Ingestion &amp; Generation (pending)</div>
    </div>
    <div class="phase-card" id="phase-validation">
      <div class="phase-dot" id="phase-validation-dot"></div>
      <div style="font-size:13.5px;color:var(--text-secondary);font-weight:500" id="phase-validation-text">QA Validation &amp; De-duplication (pending)</div>
    </div>
    <div class="phase-card" id="phase-training">
      <div class="phase-dot" id="phase-training-dot"></div>
      <div style="font-size:13.5px;color:var(--text-secondary);font-weight:500" id="phase-training-text">QLoRA Fine-Tuning on Local GPU (pending)</div>
    </div>
    <div class="phase-card" id="phase-export">
      <div class="phase-dot" id="phase-export-dot"></div>
      <div style="font-size:13.5px;color:var(--text-secondary);font-weight:500" id="phase-export-text">GGUF Quantization &amp; Ollama Export (pending)</div>
    </div>
  </div>
  
  <div class="credit-widget">
    <div class="credit-info">
      <div class="used">Estimated Credits consumed</div>
      <div class="remaining" id="training-credits-pct">0.0 / 3.0</div>
    </div>
    <button class="topup-btn" onclick="navigate('billing')">+ Top Up Balance</button>
  </div>
  
  <div style="margin-top:24px;text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <button class="btn-outline" style="padding:10px 24px;font-size:13px;" onclick="navigate('proposal')">Back</button>
    <button class="btn-primary" style="padding:10px 24px;font-size:13px;" onclick="navigate('deployment')">Preview Deployment Tiers</button>
    <button class="btn-outline" style="padding:10px 24px;font-size:13px;" onclick="previewTrainingData()">View Training Data</button>
  </div>
</div>`;

var VIEW_DEPLOYMENT = `
<div class="deploy-view">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;justify-content:center">
    <button onclick="navigate('mymodels')" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:0;display:flex"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
    <h2 style="margin:0">Choose Your Deployment Tier</h2>
  </div>
  <p class="sub">Select how you want to run, scale, and host your custom AI model.</p>
  
  <div class="pricing-grid">
    <div class="price-card" id="price-card-selfhosted">
      <h3>&#128421; Self-Hosted</h3>
      <div class="price">&#8364;29<span>/month</span></div>
      <p>Run locally or on your private cloud. Ultimate privacy, zero data escape.</p>
      
      <div class="docker-snippet-wrap">
        <div class="snippet-title">Docker Run command</div>
        <div class="snippet-body">
          <code id="docker-command-text">docker run -d -p 8000:8000 -v ./models:/app/models modelforge:latest</code>
          <button class="copy-snippet-btn" onclick="copyDockerCommand(this)" title="Copy Docker Command">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </button>
        </div>
      </div>

      <ul>
        <li>Model weights download (GGUF)</li>
        <li>Docker runtime setup files</li>
        <li>Unlimited local API operations</li>
        <li>Community forum access</li>
      </ul>
      <div style="display:flex;gap:6px;align-items:center;margin-top:auto;">
        <button class="price-card-btn outline" style="flex:1" onclick="generateApiKey(this)">Generate API Key</button>
        <div class="api-key-chip hidden" id="live-api-key-wrap">
          <code id="live-api-key">mf_live_45a0...</code>
          <button class="copy-key-btn" onclick="copyApiKeyText(this)">Copy</button>
        </div>
      </div>
    </div>
    
    <div class="price-card popular" id="price-card-managedcloud">
      <div class="popular-badge">Recommended</div>
      <h3>&#9729; Managed Cloud</h3>
      <div class="price">Pay-per-token</div>
      <p>We deploy on dedicated cloud GPUs. Zero dev-ops or hardware worries.</p>
      <div class="slider-wrap">
        <label style="font-size:11px;color:var(--text-secondary)">Estimated monthly tokens:</label>
        <input type="range" min="10" max="500" value="50" oninput="document.getElementById('slider-est').textContent='~&#8364;'+(this.value*0.4).toFixed(0)+'/month for '+this.value+'k tokens'"/>
        <div class="slider-estimate" id="slider-est">~&#8364;20/month for 50k tokens</div>
      </div>
      <ul>
        <li>Auto-scaling inference endpoints</li>
        <li>99.9% high-availability SLA</li>
        <li>Token analytics tracker dashboard</li>
        <li>24/7 dedicated priority support</li>
      </ul>
      <button class="price-card-btn filled" onclick="alert('Managed deployment initiated! Setting up cloud instance...')">Deploy Model</button>
    </div>
    
    <div class="price-card" id="price-card-buyoutright">
      <h3>&#128190; Buy Outright</h3>
      <div class="price">&#8364;499<span> one-time</span></div>
      <p>Own the fine-tuned model weights forever. Full IP ownership and freedom.</p>
      <ul>
        <li>Full commercial licensing rights</li>
        <li>Raw 16-bit weight downloads</li>
        <li>12 months of model upgrades</li>
        <li>Transferable IP documentation</li>
      </ul>
      <button class="price-card-btn outline" onclick="alert('Purchase request submitted. Our team will contact you.')">Purchase Weights</button>
    </div>
  </div>
</div>`;

var VIEW_DASHBOARD = `
<div class="dashboard-view">
  <div class="dash-header">
    <h2 id="dash-header-title">Welcome, John <span class="emoji">&#128075;</span></h2>
    <p>Here is the health metrics and status of your local AI engine.</p>
  </div>
  
  <div class="stat-grid">
    <div class="stat-card">
      <div class="s-label">Active Models</div>
      <div class="s-value" id="dash-stat-active-models">1</div>
      <div class="s-change">&#8593; 1 trained local</div>
    </div>
    <div class="stat-card">
      <div class="s-label">Credits Remaining</div>
      <div class="s-value" id="dash-stat-credits">10</div>
      <div class="s-change">Account balance</div>
    </div>
    <div class="stat-card">
      <div class="s-label">Direct API Queries</div>
      <div class="s-value">1.2k</div>
      <div class="s-change">&#8593; 24% vs last week</div>
    </div>
    <div class="stat-card">
      <div class="s-label">Avg Local Latency</div>
      <div class="s-value">0.72s</div>
      <div class="s-change">&#8595; 15% VRAM optimized</div>
    </div>
  </div>
  
  <div class="model-list">
    <div class="model-list-header">
      <h3>My Local AI Models</h3>
      <button class="new-model-btn" onclick="navigate('builder')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right:2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 
        Build Model
      </button>
    </div>
    <div class="model-row" onclick="navigate('mymodels')">
      <div class="model-dot ready"></div>
      <div class="model-name" id="dashboard-model-name">modelforge-custom</div>
      <div class="model-meta">7B parameters &middot; Ready for Local Inference</div>
      <div class="model-badge badge-ready">Online</div>
    </div>
  </div>
</div>`;

var VIEW_MYMODELS = `
<div class="dashboard-view">
  <div class="dash-header">
    <h2>Model Inventory</h2>
    <p>Manage, test, and permanently edit your fine-tuned model directories.</p>
  </div>
  
  <div class="model-list">
    <div class="model-list-header">
      <h3>Available Local LoRA Adapters</h3>
      <button class="new-model-btn" onclick="navigate('builder')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right:2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 
        Build Model
      </button>
    </div>
    <div class="model-list-body" id="mymodels-list-container">
      <!-- Generated Dynamically -->
      <div class="model-row">
        <div class="model-dot ready" onclick="navigate('modeltest')" style="cursor:pointer"></div>
        <div class="model-name" id="mymodels-model-name" onclick="navigate('modeltest')" style="cursor:pointer">modelforge-custom</div>
        <div class="model-meta" onclick="navigate('modeltest')" style="cursor:pointer">7B params &middot; Local RTX 4060 Ti &middot; Ready</div>
        <div style="display:flex;gap:8px;margin-left:auto;align-items:center">
          <button class="model-badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);border:1px solid var(--border-glass);cursor:pointer;padding:4px 10px" onclick="renameModel()">Rename</button>
          <button class="model-badge" style="background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);cursor:pointer;padding:4px 10px" onclick="deleteModel('modelforge-custom')">Delete</button>
          <div class="model-badge badge-ready" onclick="navigate('modeltest')" style="cursor:pointer">Test Chat</div>
        </div>
      </div>
    </div>
  </div>
</div>`;

var VIEW_MODELTEST = `
<div class="chat-view">
  <div class="dash-header" style="padding: 20px 0 14px; border-bottom: 1px solid var(--border-glass);">
    <div style="display:flex;align-items:center;gap:12px">
      <button onclick="navigate('mymodels')" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);display:flex;padding:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
      <h2 id="test-model-name-header" style="margin:0;font-size:20px">Testing: modelforge-custom</h2>
    </div>
    <p style="margin: 6px 0 0 34px; font-size:13px; color:var(--accent-green); font-weight:600; display:flex; align-items:center; gap:6px">
      <span style="width:7px;height:7px;border-radius:50%;background:var(--accent-green);box-shadow:0 0 8px var(--accent-green);display:inline-block"></span> 
      Direct VRAM Inference Active
    </p>
  </div>
  <div class="chat-messages" id="test-chat-messages"></div>
  <div class="input-bar">
    <div class="input-row">
      <div class="input-wrap">
        <textarea id="test-chat-input" rows="1" placeholder="Ask your custom fine-tuned model a question..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendTestMessage()}" oninput="autoGrow(this)"></textarea>
      </div>
      <button class="send-btn" id="test-send-btn" onclick="sendTestMessage()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
</div>`;

var VIEW_BILLING = `
<div class="billing-view">
  <h2>Resource Billing</h2>
  
  <div class="billing-card">
    <h3>Credit Ledger Balance</h3>
    <div style="font-size:36px;font-weight:800;color:var(--text-primary);display:flex;align-items:baseline;gap:6px">
      <span id="billing-credits-balance">10</span> 
      <span style="font-size:15px;color:var(--text-secondary);font-weight:500">credits remaining</span>
    </div>
    <div class="credit-bar-wrap">
      <div class="credit-bar" id="billing-credit-bar-progress" style="width: 70%"></div>
    </div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px" id="billing-usage-summary">3 of 10 monthly credits consumed</div>
    <button class="btn-primary" style="padding:10px 24px;font-size:13px;width:auto" onclick="alert('Top-up checkout mock triggered!')">+ Add Balance Credits</button>
  </div>
  
  <div class="billing-card">
    <h3>Current Subscription</h3>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary)">Enterprise Starter Plan</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">10 credits credited monthly &middot; Renews June 1, 2026</div>
      </div>
      <button class="topup-btn" onclick="alert('Enterprise tier upgrade is currently handled by customer support.')">Upgrade Plan</button>
    </div>
  </div>
  
  <div class="billing-card">
    <h3>Recent Ledger Transactions</h3>
    <div style="display:flex;flex-direction:column;gap:12px" id="billing-ledger-list">
      <div style="display:flex;justify-content:space-between;font-size:14px;border-bottom:1px solid var(--border-glass);padding-bottom:10px">
        <span style="color:var(--text-secondary)">Fine-tuning model: modelforge-custom</span>
        <span style="color:#f87171;font-weight:700">-3 credits</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px">
        <span style="color:var(--text-secondary)">Standard Account Provisioning</span>
        <span style="color:var(--accent-green);font-weight:700">+10 credits</span>
      </div>
    </div>
  </div>
</div>`;

var VIEW_SETTINGS = `
<div class="settings-view">
  <h2>System Configuration</h2>
  
  <div class="settings-section">
    <div class="settings-section-title">Developer User Profile</div>
    <div class="setting-row">
      <div>
        <label>Operator Name</label>
        <div class="hint" id="settings-profile-name">John Doe</div>
      </div>
      <button class="topup-btn" onclick="editProfileField('name')">Edit</button>
    </div>
    <div class="setting-row">
      <div>
        <label>Corporate Email</label>
        <div class="hint" id="settings-profile-email">john@company.com</div>
      </div>
      <button class="topup-btn" onclick="editProfileField('email')">Edit</button>
    </div>
    <div class="setting-row">
      <div>
        <label>Startup Entity</label>
        <div class="hint" id="settings-profile-company">Acme Corp</div>
      </div>
      <button class="topup-btn" onclick="editProfileField('company')">Edit</button>
    </div>
  </div>
  
  <div class="settings-section">
    <div class="settings-section-title">Hardware Secure Bridge</div>
    <div class="setting-row" style="flex-direction:column;align-items:stretch;gap:12px;">
      <div>
        <label>Secure GPU Tunnel URL</label>
        <div class="hint" style="margin-bottom:4px">Enter your Pinggy, localhost.run, or cloudflared link to connect the frontend to your local RTX 4060 Ti API.</div>
      </div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="settings-backend-url" placeholder="http://localhost:8000" style="flex:1;padding:10px 14px;border:1px solid var(--border-glass);border-radius:10px;font-size:13px;background:rgba(0,0,0,0.15);color:var(--text-primary);" />
        <button class="btn-primary" style="padding:10px 18px;width:auto;font-size:13px;" onclick="saveBackendUrl()">Connect</button>
      </div>
    </div>
  </div>

  <div class="settings-section">
    <div class="settings-section-title">Cloud Database Connection (Supabase)</div>
    <div class="setting-row" style="flex-direction:column;align-items:stretch;gap:12px;">
      <div>
        <label>Supabase Project URL</label>
        <div class="hint" style="margin-bottom:6px">Provide your Supabase URL (e.g., https://xyz.supabase.co) to securely save configurations, chat transcripts, and custom models to the cloud.</div>
      </div>
      <input type="text" id="settings-supabase-url" placeholder="https://your-project.supabase.co" style="padding:10px 14px;border:1px solid var(--border-glass);border-radius:10px;font-size:13px;background:rgba(0,0,0,0.15);color:var(--text-primary);" />
      
      <div>
        <label>Supabase Anonymous Public Key</label>
        <div class="hint" style="margin-bottom:6px">Anonymous Public API key found in API Settings.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;width:100%">
        <input type="password" id="settings-supabase-key" placeholder="eyJhbGciOi..." style="padding:10px 14px;border:1px solid var(--border-glass);border-radius:10px;font-size:13px;background:rgba(0,0,0,0.15);color:var(--text-primary);width:100%" />
        <button class="btn-primary" style="padding:12px;width:100%;font-size:13.5px;margin-top:4px" onclick="saveSupabaseSettings()">Sync Cloud Database</button>
      </div>
    </div>
  </div>
  
  <div class="settings-section">
    <div class="settings-section-title">System Preferences</div>
    <div class="setting-row">
      <div>
        <label>Email alerts upon complete</label>
        <div class="hint">Notify me immediately when fine-tuning finishes</div>
      </div>
      <button class="toggle on" id="t-notif" onclick="toggleSetting('notif')"></button>
    </div>
    <div class="setting-row">
      <div>
        <label>Weekly developer usage digests</label>
        <div class="hint">Receive automated performance logs</div>
      </div>
      <button class="toggle on" id="t-reports" onclick="toggleSetting('reports')"></button>
    </div>
    <div class="setting-row">
      <div>
        <label>White Theme (Light Mode)</label>
        <div class="hint">Toggle between white background light mode and cyber dark mode</div>
      </div>
      <button class="toggle on" id="t-lighttheme" onclick="toggleLightTheme()"></button>
    </div>
  </div>
  
  <div class="settings-section" style="border-color:rgba(239,68,68,0.25)">
    <div class="settings-section-title" style="color:var(--accent-red);background:rgba(239,68,68,0.03)">Danger Zone</div>
    <div class="setting-row">
      <div>
        <label style="color:#f87171">Reset Local Workspace State</label>
        <div class="hint">Permanently delete configurations and local browser memory</div>
      </div>
      <button class="topup-btn" style="color:#f87171;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.05)" onclick="resetWorkspaceState()">Reset Workspace</button>
    </div>
  </div>
</div>`;
