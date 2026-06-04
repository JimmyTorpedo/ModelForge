/* 
========================================================================
ModelForge Component Templates (views.js)
========================================================================
Contains the template literal views for the dashboard, chat, settings,
and training pages. Uses the premium dark glassmorphism CSS class framework.
*/

var VIEW_BUILDER = `
<div class="chat-view">
  <div class="dash-header" style="padding: 20px 0 14px; border-bottom: 1px solid var(--border-glass); margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
    <div>
      <div style="display:flex;align-items:center;gap:12px">
        <button onclick="navigate('mymodels')" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);display:flex;padding:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
        <h2 id="builder-model-name-header" style="margin:0;font-size:20px">Building Model: modelforge-custom</h2>
      </div>
      <p id="builder-engine-status-text" style="margin: 6px 0 0 34px; font-size:13px; color:var(--accent-purple); font-weight:600; display:flex; align-items:center; gap:6px">
        <span id="builder-engine-dot" style="width:7px;height:7px;border-radius:50%;background:var(--accent-purple);box-shadow:0 0 8px var(--accent-purple);display:inline-block;animation:pulse 1.5s infinite"></span> 
        <span id="builder-engine-name">Gemini Interview Specialist Active</span>
      </p>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <select class="premium-modal-input" id="builder-engine-selector" onchange="changeBuilderEngine(this.value)" style="padding: 6px 12px; font-size:12px; margin:0; width:auto; min-width:145px;">
        <option value="free">Free Cloud Engine</option>
        <option value="gemini">Google Gemini API</option>
        <option value="gpu">Private GPU Node</option>
      </select>
    </div>
  </div>
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
      <div class="input-wrap" style="position:relative;">
        <textarea id="chat-input" rows="1" placeholder="Describe the specific tasks you want your custom AI model to do..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}" oninput="autoGrow(this)" style="padding-right: 175px;"></textarea>
        
        <div class="chat-engine-pill-wrap" style="position:absolute; right:48px; top:50%; transform:translateY(-50%); display:flex; align-items:center; z-index: 10;">
          <!-- Model Switcher Pill -->
          <div class="gemini-pill-btn" onclick="toggleEngineDropdown(event)">
            <span id="gemini-pill-active-name">Gemini Pro</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-left: 4px;"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>

        <!-- Upload icon -->
        <button class="upload-btn" onclick="document.getElementById('file-input').click()" title="Upload PDF">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>

        <div class="gemini-dropdown-popover hidden" id="gemini-engine-popover">
          <div class="gemini-popover-item active" id="popover-item-free" onclick="selectEnginePopover('free', 'Free Cloud', event)">
            <div class="popover-item-check">&#10003;</div>
            <div class="popover-item-content">
              <div class="popover-item-title">Free Cloud Engine</div>
              <div class="popover-item-desc">Zero-cost cloud assistant - no API keys required</div>
            </div>
          </div>
          
          <div class="gemini-popover-item" id="popover-item-gemini" onclick="selectEnginePopover('gemini', 'Gemini Pro', event)">
            <div class="popover-item-check">&#10003;</div>
            <div class="popover-item-content">
              <div class="popover-item-title">Gemini 1.5 Pro</div>
              <div class="popover-item-desc">Math, programming, and advanced tasks</div>
            </div>
          </div>
          
          <div class="gemini-popover-item" id="popover-item-gpu" onclick="selectEnginePopover('gpu', 'Private GPU', event)">
            <div class="popover-item-check">&#10003;</div>
            <div class="popover-item-content">
              <div class="popover-item-title">Private GPU Node</div>
              <div class="popover-item-desc">Fast, secure dedicated reasoning — zero cloud leaks</div>
            </div>
          </div>
          
          <div class="gemini-popover-divider"></div>
          
          <div class="gemini-popover-item disabled" style="opacity: 0.5; cursor: not-allowed;" onclick="event.stopPropagation()">
            <div class="popover-item-check"></div>
            <div class="popover-item-content">
              <div class="popover-item-title" style="display:flex; align-items:center; gap:6px;">Thinking Mode <span style="font-size:9px; background:var(--accent-purple); color:#fff; padding:1px 5px; border-radius:10px; font-weight:700;">PRO</span></div>
              <div class="popover-item-desc">Deep reasoning and step-by-step logic</div>
            </div>
          </div>
        </div>
      </div>
      <button class="send-btn" id="send-btn" onclick="sendMessage()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
</div>`;

var VIEW_PROJECTS = `
<div class="dashboard-view">
  <div class="dash-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
    <div>
      <h2>Project Hub</h2>
      <p>Organize, build, and deploy your custom AI model adapters under isolated directory folders.</p>
    </div>
    <button class="new-model-btn" onclick="showCreateProjectModal()" style="font-size: 13.5px; padding: 10px 20px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right:2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Project
    </button>
  </div>
  
  <div class="projects-grid" id="projects-grid-container">
    <!-- Generated Dynamically -->
  </div>
</div>`;

var VIEW_PROPOSAL = `
<div class="proposal-view">
  <h2>Your AI Model Proposal</h2>
  <p class="proposal-subtitle">Review the blueprint specification before starting the dedicated private GPU fine-tuning.</p>
  
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
  
  <div class="proposal-card" id="proposal-specs-card">
    <h3>Gathered Specifications</h3>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; font-size: 13.5px; line-height: 1.5;">
      <div><span style="color:var(--text-secondary)">Use Case / Industry:</span> <strong id="spec-usecase" style="color:var(--text-primary)">Customer Support Agent</strong></div>
      <div><span style="color:var(--text-secondary)">Expected Daily Scale:</span> <strong id="spec-scale" style="color:var(--text-primary)">Not specified</strong></div>
      <div><span style="color:var(--text-secondary)">Tone of Voice:</span> <strong id="spec-tone" style="color:var(--text-primary)">Professional / Conversational</strong></div>
      <div><span style="color:var(--text-secondary)">Internal PDF Training Data:</span> <strong id="spec-pdfs" style="color:var(--text-primary)">None uploaded</strong></div>
    </div>
  </div>

  <div class="proposal-card">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <h3 style="margin:0;">Precision &amp; Capacity Tuning (LoRA Rank)</h3>
      <span style="font-size:12px; color:var(--text-primary); background:rgba(139, 92, 246, 0.15); border:1px solid rgba(139, 92, 246, 0.25); padding:3px 10px; border-radius:12px; font-weight:600;" id="proposal-lora-rank-badge">Rank: 16 (Standard)</span>
    </div>
    <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 16px; line-height: 1.5;">
      Adjust parameters density. A higher rank increases the model's memory capacity for exact details and rules, but consumes slightly more workstation compute memory.
    </p>
    <div style="display:flex; align-items:center; gap:16px;">
      <span style="font-size:12px; color:var(--text-secondary); font-weight:600;">16 (Recommended)</span>
      <input type="range" id="proposal-lora-rank-slider" min="16" max="32" step="8" value="16" style="flex:1; accent-color:var(--accent-purple); cursor:pointer;" oninput="updateLoraRankSlider(this.value)" />
      <span style="font-size:12px; color:var(--text-secondary); font-weight:600;">32 (High Precision)</span>
    </div>
  </div>
  
  <div class="proposal-card">
    <h3>Trained Capabilities</h3>
    <ul style="list-style:none;display:flex;flex-direction:column;gap:10px">
      <li style="font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:10px"><span style="color:var(--accent-purple);font-weight:800">&#10003;</span> Ingest and synthesize PDF document facts</li>
      <li style="font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:10px"><span style="color:var(--accent-purple);font-weight:800">&#10003;</span> Strictly bounded question answering (no hallucination)</li>
      <li style="font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:10px"><span style="color:var(--accent-purple);font-weight:800">&#10003;</span> Dedicated local REST API endpoint and WebSocket state</li>
      <li style="font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:10px"><span style="color:var(--accent-purple);font-weight:800">&#10003;</span> Portable model weights ready for production GGUF export</li>
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
  <div class="status-banner" style="margin-bottom: 20px;">
    <div class="status-dot" id="train-status-dot-top"></div>
    <div>
      <div style="font-size:15px;font-weight:700;color:var(--text-primary)" id="train-status-text">Status: Starting Engine...</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:2px" id="train-status-sub">Connecting to secure private GPU compute node...</div>
    </div>
  </div>
  
  <div id="training-error-card" class="phase-card hidden" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); margin: 0 0 24px; padding: 16px; display: none; gap: 14px; align-items: flex-start; text-align: left; border-radius: 12px; border: 1px solid rgba(239,68,68,0.25);">
    <div class="phase-dot" style="background: #f87171; box-shadow: 0 0 8px #ef4444; width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; flex-shrink: 0;"></div>
    <div style="flex: 1;">
      <div style="font-size:14px; font-weight:700; color:#fca5a5;">Connection / Pipeline Error</div>
      <div id="training-error-details" style="font-size:12.5px; color:#fecaca; margin-top: 4px; line-height: 1.4; font-family: monospace;">Unknown connection error.</div>
      <div style="margin-top: 10px; display: flex; gap: 8px;">
        <button class="model-badge" style="background: rgba(255,255,255,0.1); border: 1px solid var(--border-glass); color: var(--text-primary); cursor: pointer; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; font-family: inherit;" onclick="retryTrainingPipeline()">Retry Connection</button>
        <button class="model-badge" style="background: rgba(255,255,255,0.1); border: 1px solid var(--border-glass); color: var(--text-primary); cursor: pointer; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; font-family: inherit;" onclick="useAlternativeLocalUrl()">Try 127.0.0.1</button>
      </div>
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
      <div style="font-size:13.5px;color:var(--text-secondary);font-weight:500" id="phase-export-text">GGUF Quantization &amp; Inference Export (pending)</div>
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
    <button id="btn-cancel-training" class="project-action-btn delete" style="padding:10px 24px;font-size:13px;background:rgba(239, 68, 68, 0.08) !important; color:#fca5a5 !important; border-color:rgba(248, 113, 113, 0.2) !important; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" onclick="cancelTrainingPipeline()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
      Safety Stop Training ⚠️
    </button>
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
<div class="dashboard-view" style="padding: 24px;">
  <div class="projects-grid" id="workspaces-grid-container">
    <!-- Generated Dynamically -->
  </div>
</div>`;

var VIEW_MYMODELS = `
<div class="dashboard-view">
  <div class="dash-header" style="border-bottom: 1px solid var(--border-glass); padding-bottom: 20px; margin-bottom: 24px;">
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px">
      <button onclick="navigate('dashboard')" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);display:flex;padding:0" title="Back to Workspaces"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
      <div id="workspace-detail-icon-wrap" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(139,92,246,0.12); color: var(--accent-purple); display:flex; align-items:center; justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </div>
      <h2 id="workspace-detail-title" style="margin:0; font-size:24px">Workspace: Main Workspace</h2>
      <span class="model-badge" id="workspace-detail-badge" style="background:rgba(139,92,246,0.1);color:#c084fc;border:1px solid rgba(139,92,246,0.2);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;margin-left:8px;">Solo Developer</span>
    </div>
    <p id="workspace-detail-desc" style="color:var(--text-secondary); font-size:13.5px; margin-left:44px; margin-bottom:16px; line-height: 1.5;">Active workspace for housing custom-trained LoRA models.</p>
    <div style="display:flex; gap:10px; margin-left:44px">
      <button class="model-badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);border:1px solid var(--border-glass);cursor:pointer;padding:6px 14px;border-radius:8px;font-size:12px;" onclick="showCustomizeWorkspaceModal(activeWorkspaceId)">Customize Workspace</button>
      <button class="model-badge" style="background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);cursor:pointer;padding:6px 14px;border-radius:8px;font-size:12px;" onclick="deleteActiveWorkspace()">Delete Workspace</button>
    </div>
  </div>
  
  <div class="model-list">
    <div class="model-list-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
      <h3 style="font-size:16px; font-weight:700;">Custom LLMs & AI Models</h3>
      <button class="new-model-btn" onclick="showCreateModelModal()" style="font-size: 13px; padding: 8px 16px; background: var(--gradient-tech); box-shadow: var(--glow-shadow);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right:2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 
        Create Custom LLM
      </button>
    </div>
    <div class="model-list-body" id="mymodels-list-container">
      <!-- Generated Dynamically -->
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
<div class="billing-view" style="padding: 24px;">
  <div class="billing-header" style="margin-bottom:24px">
    <h2>Billing Overview</h2>
    <p style="color:var(--text-secondary); font-size:14px; margin-top:4px;">Manage your subscriptions, usage, and ledger history.</p>
  </div>
  
  <div class="usage-card">
    <div class="usage-card-left">
      <div class="usage-label">CURRENT MONTH USAGE</div>
      <div class="usage-amount">$142.50 <span class="usd">USD</span></div>
      <div class="usage-progress-wrap">
        <div class="usage-progress-bar" style="width: 45%;"></div>
      </div>
      <div class="usage-progress-label">45% of $300 limit</div>
    </div>
    <div class="usage-card-right">
      <button class="pay-now-btn" onclick="triggerPaymentCheckout()">PAY NOW</button>
      <div class="autopay-note">Auto-pay enabled on 1st of month</div>
    </div>
  </div>
  
  <div class="billing-section-title">Subscription Tiers</div>
  <div class="tiers-grid">
    <div class="tier-card">
      <div class="tier-name">Standard</div>
      <div class="tier-price">$29<span class="mo">/mo</span></div>
      <ul class="tier-features">
        <li><span class="tick">✓</span> Up to 10k API calls</li>
        <li><span class="tick">✓</span> Basic Support</li>
      </ul>
      <button class="tier-btn" onclick="selectSubTier('Standard')">Select Plan</button>
    </div>
    
    <div class="tier-card active">
      <div class="tier-badge">CURRENT</div>
      <div class="tier-name">Pro</div>
      <div class="tier-price">$99<span class="mo">/mo</span></div>
      <ul class="tier-features">
        <li><span class="tick">✓</span> 100k API calls</li>
        <li><span class="tick">✓</span> Priority Support</li>
        <li><span class="tick">✓</span> Custom Models</li>
      </ul>
      <button class="tier-btn active" disabled>Current Plan</button>
    </div>
    
    <div class="tier-card">
      <div class="tier-name" style="color: var(--accent-purple);">Enterprise</div>
      <div class="tier-price">Custom</div>
      <ul class="tier-features">
        <li><span class="tick">✓</span> Unlimited API calls</li>
        <li><span class="tick">✓</span> 24/7 Dedicated Support</li>
      </ul>
      <button class="tier-btn" onclick="selectSubTier('Enterprise')">Contact Sales</button>
    </div>
  </div>
  
  <div class="billing-section-title">Billing History</div>
  <div class="history-table-wrap">
    <table class="history-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="billing-history-rows">
        <tr>
          <td>2023-10-01</td>
          <td>Pro Plan - October</td>
          <td>$99.00</td>
          <td><span class="badge badge-paid">Paid</span></td>
        </tr>
        <tr>
          <td>2023-09-01</td>
          <td>Pro Plan - September</td>
          <td>$99.00</td>
          <td><span class="badge badge-paid">Paid</span></td>
        </tr>
        <tr>
          <td>2023-08-15</td>
          <td>Compute Overage (Compute Instance A)</td>
          <td>$43.50</td>
          <td><span class="badge badge-paid">Paid</span></td>
        </tr>
        <tr>
          <td>2023-08-01</td>
          <td>Pro Plan - August</td>
          <td>$99.00</td>
          <td><span class="badge badge-processed">Processed</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>`;

var VIEW_SETTINGS = `
<div class="settings-view" style="padding: 24px;">
  <div class="settings-header" style="margin-bottom: 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
    <div>
      <h2>System Settings</h2>
      <p style="color:var(--text-secondary); font-size:14px; margin-top:4px;">Configure your global workspace parameters and security protocols.</p>
    </div>
    <button class="project-action-btn delete" onclick="logOutSession()" style="padding: 10px 20px; font-size:13px; font-weight:600; background:rgba(239,68,68,0.08) !important; color:#fca5a5 !important; border-color:rgba(248,113,113,0.2) !important; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Sign Out
    </button>
  </div>
  
  <div class="settings-card" style="margin-bottom: 24px;">
    <div class="settings-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
      <h3 style="margin:0; font-size:16px; font-weight:700;">API Management</h3>
      <button class="project-action-btn" onclick="generateNewApiKey()" style="padding: 8px 14px; font-size:12px;">+ Generate New Key</button>
    </div>
    
    <div class="api-keys-list" id="settings-api-keys-container" style="display:flex; flex-direction:column; gap:12px;">
      <!-- Generated Dynamically -->
    </div>
  </div>
  
  <div class="settings-two-col" style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom: 24px;">
    <div class="settings-card">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 16px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-purple);"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <h3 style="margin:0; font-size:16px; font-weight:700;">Security Core</h3>
      </div>
      
      <div class="settings-control-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px; padding-bottom:12px; border-bottom: 1px solid var(--border-glass);">
        <div>
          <div style="font-size:14px; font-weight:600; color:var(--text-primary);">Two-Factor Authentication</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Require 2FA for all team members.</div>
        </div>
        <label class="switch-toggle">
          <input type="checkbox" id="settings-2fa-toggle" onchange="toggle2FASetting(this.checked)" />
          <span class="slider-toggle"></span>
        </label>
      </div>
      
      <div class="settings-control-block" style="margin-bottom: 16px;">
        <label style="font-size:13px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">Session Timeout</label>
        <select class="premium-modal-input" id="settings-session-timeout" onchange="saveSessionTimeoutSetting(this.value)" style="margin: 0;">
          <option value="1">1 Hour (Default)</option>
          <option value="4">4 Hours</option>
          <option value="24">24 Hours</option>
        </select>
      </div>

      <div class="settings-control-block">
        <label style="font-size:13px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">Google Gemini API Key</label>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Enter your key to enable the cloud Gemini Onboarding Chat.</div>
        <input type="password" id="settings-gemini-api-key" class="premium-modal-input" placeholder="AIzaSy..." onchange="saveGeminiApiKeySetting(this.value)" style="width: 100%; box-sizing: border-box; margin: 0;" />
      </div>
    </div>
    
    <div class="settings-card">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 16px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-purple);"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        <h3 style="margin:0; font-size:16px; font-weight:700;">Backend API Connection</h3>
      </div>
      
      <div style="font-size:12.5px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
        Expose your backend to Vercel or GitHub Pages. For remote work (e.g. at school), start the remote tunnel and enter the generated public HTTPS URL here.
      </div>
      
      <div class="settings-control-block" style="margin-bottom: 16px;">
        <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">Backend Base URL</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="settings-backend-url" class="premium-modal-input" placeholder="http://localhost:8000" style="flex:1; margin:0; font-size:13px;" />
          <button class="project-action-btn" onclick="saveBackendUrl()" style="padding: 10px 14px; font-size:12.5px; background:var(--accent-purple) !important; color:#fff !important; border-color:var(--accent-purple) !important; font-weight:600; white-space:nowrap;">Save &amp; Connect</button>
        </div>
      </div>
      
      <div style="display:flex; align-items:center; justify-content:space-between; font-size:12.5px; color:var(--text-secondary); padding-top: 12px; border-top:1px solid var(--border-glass);">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:600;">Status:</span>
          <span id="settings-connection-status" class="connection-status-pill disconnected">Disconnected</span>
        </div>
        <button class="project-action-btn" onclick="testBackendConnection()" style="padding: 6px 10px; font-size:11px; background:transparent; border-color:var(--border-glass); cursor:pointer;">Check Link ⚡</button>
      </div>
    </div>
  </div>
  
  <div class="settings-card" style="margin-bottom: 24px;">
    <div style="display:flex; align-items:center; gap:8px; margin-bottom: 16px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-green);"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      <h3 style="margin:0; font-size:16px; font-weight:700;">Cloud Database Connection (Supabase)</h3>
    </div>
    <div style="font-size:13px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5;">
      Provide your Supabase credentials to securely synchronize models, chat transcripts, and workspace parameters directly to the cloud. All database data transfers run in-memory directly from this browser session.
    </div>
    
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom: 16px;">
      <div class="settings-control-block" style="margin:0;">
        <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">Supabase Project URL</label>
        <input type="text" id="settings-supabase-url" class="premium-modal-input" placeholder="https://your-project.supabase.co" style="width: 100%; box-sizing: border-box; margin: 0; font-size:13px;" />
      </div>
      <div class="settings-control-block" style="margin:0;">
        <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">Supabase Anonymous Public Key</label>
        <input type="password" id="settings-supabase-key" class="premium-modal-input" placeholder="eyJhbGciOi..." style="width: 100%; box-sizing: border-box; margin: 0; font-size:13px;" />
      </div>
    </div>
    
    <div style="display:flex; justify-content:flex-end;">
      <button class="project-action-btn" onclick="saveSupabaseSettings()" style="padding: 10px 20px; font-size:13px; background:var(--accent-purple) !important; color:#fff !important; border-color:var(--accent-purple) !important; font-weight:600; cursor:pointer;">Sync &amp; Connect Cloud Database ⚡</button>
    </div>
  </div>

  <div class="settings-card" style="margin-bottom: 24px;">
    <h3 style="margin:0 0 16px; font-size:16px; font-weight:700;">Workspace Preferences</h3>
    
    <div class="settings-control-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; padding-bottom:12px; border-bottom: 1px solid var(--border-glass);">
      <div>
        <div style="font-size:14px; font-weight:600; color:var(--text-primary);">Default AI Onboarding Engine</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Select which AI backend drives your model design interviews.</div>
      </div>
      <select class="premium-modal-input" id="settings-default-engine" onchange="saveDefaultEngineSetting(this.value)" style="width: 180px; margin: 0; padding: 6px 12px;">
        <option value="free">Free Cloud Engine</option>
        <option value="gemini">Google Gemini API</option>
        <option value="gpu">Private GPU Node</option>
      </select>
    </div>
    
    <div class="settings-control-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; padding-bottom:12px; border-bottom: 1px solid var(--border-glass);">
      <div>
        <div style="font-size:14px; font-weight:600; color:var(--text-primary);">Auto-scale Compute</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Dynamically allocate resources during peak loads.</div>
      </div>
      <label class="switch-toggle">
        <input type="checkbox" id="settings-autoscale-toggle" onchange="togglePrefSetting('autoscale', this.checked)" />
        <span class="slider-toggle"></span>
      </label>
    </div>
    
    <div class="settings-control-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; padding-bottom:12px; border-bottom: 1px solid var(--border-glass);">
      <div>
        <div style="font-size:14px; font-weight:600; color:var(--text-primary);">Verbose Logging</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Capture all trace events (increases storage usage).</div>
      </div>
      <label class="switch-toggle">
        <input type="checkbox" id="settings-logging-toggle" onchange="togglePrefSetting('logging', this.checked)" />
        <span class="slider-toggle"></span>
      </label>
    </div>
    
    <div class="settings-control-row" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:14px; font-weight:600; color:var(--text-primary);">Experimental Features</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Enable beta UI components and alpha APIs.</div>
      </div>
      <label class="switch-toggle">
        <input type="checkbox" id="settings-experimental-toggle" onchange="togglePrefSetting('experimental', this.checked)" />
        <span class="slider-toggle"></span>
      </label>
    </div>
  </div>

  
  <div class="settings-card danger" style="border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.02) !important;">
    <div style="display:flex; align-items:center; gap:8px; margin-bottom: 4px;">
      <span style="color: #fca5a5; font-size:16px;">⚠️</span>
      <h3 style="margin:0; font-size:16px; font-weight:700; color:#fca5a5;">Danger Zone</h3>
    </div>
    <div style="font-size:13px; color: #9ca3af; margin-bottom: 16px;">Irreversible actions that will permanently affect your data.</div>
    
    <div class="settings-control-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; padding-bottom:12px; border-bottom: 1px solid rgba(239, 68, 68, 0.1);">
      <div>
        <div style="font-size:14px; font-weight:600; color:var(--text-primary);">Delete All Workspaces</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Remove all compute instances and local data.</div>
      </div>
      <button class="project-action-btn delete" onclick="settingsDeleteAllWorkspaces()" style="padding: 8px 16px; font-size:12px; font-weight:600;">Delete Data</button>
    </div>
    
    <div class="settings-control-row" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:14px; font-weight:600; color:var(--text-primary);">Deactivate Account</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Permanently close this account and purge billing.</div>
      </div>
      <button class="project-action-btn delete" onclick="settingsDeactivateAccount()" style="padding: 8px 16px; font-size:12px; font-weight:600; background:#f87171 !important; color:#080c14 !important; border-color:#f87171 !important;">Deactivate</button>
    </div>
  </div>
</div>`;

var VIEW_LANDING = `
<div class="landing-container">
  <nav class="landing-nav">
    <div class="landing-logo" onclick="navigate('landing')">
      <div class="logo-mark">MF</div>
      <span>ModelForge</span>
    </div>
    <div class="landing-nav-btns">
      <button class="btn-landing-signin" onclick="navigate('auth')">Sign In</button>
      <button class="btn-landing-cta" onclick="enterConsole()">Launch Console</button>
    </div>
  </nav>

  <div class="hero-section">
    <div class="hero-badge">Sovereign AI Infrastructure</div>
    <h1>The Custom AI Platform for B2B Teams &amp; Solo Devs</h1>
    <p class="hero-subtitle">Build, train, and deploy private custom AI models locally on your physical hardware or host them on our managed cloud. Zero cloud leakage, 100% data control.</p>
    
    <div class="hero-ctas">
      <button class="btn-landing-primary" onclick="enterConsole()">Get Started Free →</button>
      <button class="btn-landing-outline" onclick="scrollToFeatures()">Explore Architecture</button>
    </div>
  </div>

  <div class="landing-visual-wrap">
    <div class="terminal-simulator">
      <div class="terminal-header">
        <div class="terminal-dots"><span></span><span></span><span></span></div>
        <div class="terminal-title">modelforge-qlora-engine ~ private-compute-bridge</div>
        <div class="terminal-badge">LIVE TELEMETRY</div>
      </div>
      <div class="terminal-content" id="terminal-ticker-box">
        <div class="t-line"><span class="t-green">[SYSTEM]</span> Initializing physical hardware bridge on port 8000...</div>
        <div class="t-line"><span class="t-green">[SYSTEM]</span> Private Dedicated GPU Node active (High-speed VRAM, PCIe Gen 4)</div>
        <div class="t-line"><span class="t-purple">[QLORA]</span>  Pre-loading foundation weights: Qwen-7B-Instruct (4-bit quantized)</div>
        <div class="t-line"><span class="t-purple">[QLORA]</span>  Active adapter: none (listening for dataset trigger)</div>
        <div class="t-line"><span class="t-blue">[CLIENT]</span> Connected to Cloud Ledger Database (Supabase Sync active)</div>
        <div class="t-line t-pulse-cursor"><span class="t-blue">[SYSTEM]</span> Ready to build... _</div>
      </div>
    </div>
  </div>

  <div class="features-section" id="landing-features">
    <div class="features-header">
      <span class="features-tag">Sovereign Business Intelligence</span>
      <h3>What Can You Achieve with ModelForge?</h3>
      <p class="section-subtitle">Train private AI brains on your own files, automate customer support, and run infinite AI tasks with zero cloud fees.</p>
    </div>
    
    <div class="features-showcase">
      <!-- Feature Row 1: Customer Support Chatbot -->
      <div class="feature-row alternating">
        <div class="feature-info-col">
          <div class="feature-tag-pill purple">Automated Support Bot</div>
          <h4>An AI support agent that answers perfectly, 24/7</h4>
          <p class="feature-description">
            Stop relying on generic public AI models that know nothing about your business policies, pricing, or products. ModelForge reads your manuals, support logs, and guides to train a dedicated support copilot. It answers customer questions instantly and perfectly, with 100% brand alignment and zero hallucinations.
          </p>
          <div class="feature-benefit-list">
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>24/7 Instant Resolutions</strong>
                <span>Give your clients immediate, helpful answers at any hour of the day or night.</span>
              </div>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>Strict Fact Bounding</strong>
                <span>Our models never make things up—they only speak from the facts in your uploaded files.</span>
              </div>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>1-Click Website Embed</strong>
                <span>Copy and paste a simple HTML script to add a beautiful support chat bubble to your website.</span>
              </div>
            </div>
          </div>
        </div>
        <div class="feature-visual-col">
          <div class="premium-mockup-card chat-widget-mockup">
            <div class="mockup-header">
              <div class="mockup-header-left">
                <span class="mockup-dot red"></span>
                <span class="mockup-dot yellow"></span>
                <span class="mockup-dot green"></span>
                <span class="mockup-title">CUSTOMER SUPPORT ASSISTANT</span>
              </div>
              <span class="mockup-status active">ONLINE</span>
            </div>
            <div class="mockup-body chat-widget-body">
              <div class="chat-thread-container">
                <div class="chat-msg client">
                  <div class="chat-avatar c-logo">U</div>
                  <div class="chat-bubble">Do you offer a custom SLA for enterprise teams?</div>
                </div>
                <div class="chat-msg bot">
                  <div class="chat-avatar bot-logo">MF</div>
                  <div class="chat-bubble">
                    Yes! Based on page 12 of <strong>SLA_Enterprise_Guide.pdf</strong>, we guarantee a 99.9% uptime SLA for dedicated hardware nodes, with 24/7 priority support and direct Slack bridge access.
                  </div>
                </div>
              </div>
              <div class="chat-mockup-input">
                <span class="mock-input-text">Ask a question to your custom AI...</span>
                <button class="mock-send-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Row 2: Secure Corporate Brain -->
      <div class="feature-row alternating reverse">
        <div class="feature-info-col">
          <div class="feature-tag-pill green">Secure Corporate Brain</div>
          <h4>Unlock the collective knowledge of all your company files</h4>
          <p class="feature-description">
            Tired of searching through messy folders, Google Drive, and employee manuals? ModelForge creates a private, intelligent search engine over your company's entire file library. Employees can instantly ask questions and synthesize complex reports, without any data ever leaving your secure local workstations.
          </p>
          <div class="feature-benefit-list">
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>100% Data Sovereignty</strong>
                <span>Keep all intellectual property, customer logs, and sensitive data safely inside your building.</span>
              </div>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>Neural Document Indexing</strong>
                <span>Instantly upload PDFs, spreadsheets, CSVs, and text documents to expand your AI's brain.</span>
              </div>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>HIPAA & GDPR Compliance</strong>
                <span>Perfect for healthcare, finance, and legal teams requiring strict data sandboxing.</span>
              </div>
            </div>
          </div>
        </div>
        <div class="feature-visual-col">
          <div class="premium-mockup-card model-training-mockup">
            <div class="mockup-header">
              <div class="mockup-header-left">
                <span class="mockup-dot red"></span>
                <span class="mockup-dot yellow"></span>
                <span class="mockup-dot green"></span>
                <span class="mockup-title">SECURE INTERNAL DATA GATEWAY</span>
              </div>
              <span class="mockup-status learning" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.3);">SANDBOXED</span>
            </div>
            <div class="mockup-body">
              <div class="upload-source-list">
                <div class="source-item active">
                  <svg class="source-icon" style="color: var(--accent-green);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  <div class="source-meta">
                    <span class="source-name">Q3_Financial_Projections.xlsx</span>
                    <span class="source-size">6.8 MB &middot; 42 Sheets</span>
                  </div>
                  <span class="source-status-badge" style="background: rgba(16, 185, 129, 0.12); color: #34d399;">INDEXED</span>
                </div>
                <div class="source-item active">
                  <svg class="source-icon" style="color: var(--accent-green);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  <div class="source-meta">
                    <span class="source-name">Internal_Employee_Handbook.pdf</span>
                    <span class="source-size">14.2 MB &middot; 242 Pages</span>
                  </div>
                  <span class="source-status-badge" style="background: rgba(16, 185, 129, 0.12); color: #34d399;">INDEXED</span>
                </div>
              </div>
              <div class="training-progress-section">
                <div class="progress-info-row">
                  <span>Neural Ingestion Engine</span>
                  <span class="progress-percentage" style="color: #34d399;">SECURE ACTIVE</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill animate-progress" style="width: 100%; background: linear-gradient(135deg, #10b981, #3b82f6); box-shadow: 0 0 10px rgba(16, 185, 129, 0.5); animation: none;"></div>
                </div>
                <div class="progress-grid-metrics">
                  <div class="metric-card-mini">
                    <span class="metric-label">Access</span>
                    <span class="metric-val">Private</span>
                  </div>
                  <div class="metric-card-mini">
                    <span class="metric-label">Cloud Leak</span>
                    <span class="metric-val green">0%</span>
                  </div>
                  <div class="metric-card-mini">
                    <span class="metric-label">Status</span>
                    <span class="metric-val green">Locked 🔒</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Row 3: Eradicate Public Cloud Costs -->
      <div class="feature-row alternating">
        <div class="feature-info-col">
          <div class="feature-tag-pill blue">Zero Cloud Costs</div>
          <h4>Stop paying per prompt. Own your AI weights forever</h4>
          <p class="feature-description">
            Public cloud providers charge you for every single message and search, leading to huge, unpredictable bills as your team grows. With ModelForge, your models run locally on your own GPU workstation or on our dedicated flat-rate cloud servers. Run a million prompts for a flat cost of $0/month.
          </p>
          <div class="feature-benefit-list">
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>Absolute Cost Defeat</strong>
                <span>Eliminate monthly cloud API surcharges and save thousands of dollars in SaaS expenses.</span>
              </div>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>Complete Weight Ownership</strong>
                <span>Own your custom-trained AI model weights forever with no vendor lock-in or IP restrictions.</span>
              </div>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <div>
                <strong>Immediate ROI</strong>
                <span>Your physical workstation hardware pays for itself in weeks and runs for free forever.</span>
              </div>
            </div>
          </div>
        </div>
        <div class="feature-visual-col">
          <div class="premium-mockup-card cost-savings-mockup">
            <div class="mockup-header">
              <div class="mockup-header-left">
                <span class="mockup-dot red"></span>
                <span class="mockup-dot yellow"></span>
                <span class="mockup-dot green"></span>
                <span class="mockup-title">COMPUTE FINANCIAL LEDGER</span>
              </div>
              <span class="mockup-status optimized">OPTIMIZED</span>
            </div>
            <div class="mockup-body savings-layout">
              <div class="cost-row public-cloud">
                <div class="cost-meta">
                  <span class="cost-label">OpenAI & AWS Cloud Prompts</span>
                  <span class="cost-amount red">$14,850/mo</span>
                </div>
                <div class="cost-bar-wrap">
                  <div class="cost-bar red" style="width: 100%;"></div>
                </div>
              </div>
              
              <div class="cost-row modelforge-local">
                <div class="cost-meta">
                  <span class="cost-label">ModelForge Workstation Compute</span>
                  <span class="cost-amount green">$0.00/mo</span>
                </div>
                <div class="cost-bar-wrap">
                  <div class="cost-bar green glow-bar" style="width: 12%;"></div>
                </div>
              </div>
              
              <div class="savings-highlights">
                <div class="savings-circle-metric">
                  <svg class="circular-chart green" viewBox="0 0 36 36">
                    <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="circle" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div class="percentage-inside">100%</div>
                </div>
                <div class="savings-text-col">
                  <h5>Sovereign Financial Defeat</h5>
                  <p>100% reduction in cloud API overhead. Your local physical GPU node runs free forever.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <footer class="landing-footer" style="padding: 40px 24px; text-align: center; border-top: 1px solid var(--border-glass); margin-top: 48px; font-size: 13px; color: var(--text-muted); line-height: 1.6;">
    <p style="margin: 0 0 12px 0; font-weight: 500;">ModelForge &copy; 2026 &middot; Private Sovereign Compute AI Platform &middot; Proprietary B2B Enterprise License.</p>
    <p style="margin: 0; font-weight: 600;">
      <span style="cursor:pointer; text-decoration:underline; margin: 0 10px; color: var(--text-muted); transition: var(--transition-smooth);" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'" onclick="showTermsOfServiceModal()">Terms of Service</span> &middot; 
      <span style="cursor:pointer; text-decoration:underline; margin: 0 10px; color: var(--text-muted); transition: var(--transition-smooth);" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'" onclick="showPrivacyPolicyModal()">Privacy Policy</span> &middot; 
      <span style="cursor:pointer; text-decoration:underline; margin: 0 10px; color: var(--text-muted); transition: var(--transition-smooth);" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'" onclick="showCopyrightModal()">Software Copyrights &amp; License</span>
    </p>
  </footer>
</div>`;

var VIEW_AUTH = `
<div class="auth-container">
  <div class="auth-logo" onclick="navigate('landing')">
    <div class="logo-mark">MF</div>
    <h2>ModelForge</h2>
  </div>
  
  <div class="auth-card">
    <div class="auth-tabs">
      <button class="auth-tab-btn active" id="tab-login" onclick="toggleAuthTab('login')">Log In</button>
      <button class="auth-tab-btn" id="tab-signup" onclick="toggleAuthTab('signup')">Sign Up</button>
    </div>
    
    <div class="auth-form-box">
      <h3 id="auth-title">Welcome Back</h3>
      <p class="auth-subtitle" id="auth-subtitle">Enter your details to access the local AI console.</p>
      
      <form onsubmit="handleAuthSubmit(event)" id="auth-form">
        <div class="auth-input-group">
          <label for="auth-email">Operator Email</label>
          <input type="email" id="auth-email" placeholder="developer@company.com" required />
        </div>
        <div class="auth-input-group">
          <label for="auth-password">Session Passcode</label>
          <input type="password" id="auth-password" placeholder="••••••••" required />
        </div>
        
        <div class="auth-extra-row" id="auth-extra-row">
          <label class="remember-me">
            <input type="checkbox" id="auth-remember" checked />
            Keep session active
          </label>
        </div>
        
        <button type="submit" class="btn-auth-primary" id="auth-submit-btn">Enter Console</button>
      </form>
    </div>
  </div>
  
  <p class="auth-footer-text">Protected by local bridge protocols. Access password is required if public host.</p>
</div>`;

var VIEW_APIGATEWAY = `
<div class="apigateway-view" style="padding: 24px;">
  <div class="dash-header" style="padding: 0 0 14px; border-bottom: 1px solid var(--border-glass); margin-bottom: 24px;">
    <h2>API Integration Gateway</h2>
    <p style="color:var(--text-secondary); font-size:14px; margin-top:4px;">Deploy your custom-trained AI models into external business websites and applications using lightweight widgets or direct API calls.</p>
  </div>

  <div class="settings-two-col" style="display:grid; grid-template-columns: 1.2fr 1fr; gap:24px; align-items:start;">
    <!-- Left Column: API Controls & Snippets -->
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- API Keys Card -->
      <div class="settings-card" style="margin:0">
        <div class="settings-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">API Authentication Keys</h3>
          <button class="project-action-btn" onclick="generateGatewayApiKey()" style="padding: 8px 14px; font-size:12px;">+ Generate New Key</button>
        </div>
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
          Use these secure API keys to authorize customer support widgets or make direct backend API calls. Keep them strictly confidential.
        </div>
        <div class="api-key-chip" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(0,0,0,0.2) !important; border:1px solid var(--border-glass) !important; border-radius:8px;">
          <code style="color:var(--accent-purple); font-size:13.5px; font-weight:600; letter-spacing:0.05em;" id="gateway-api-key-text">mf_live_42a8b9f1d02caefb109c12</code>
          <button class="copy-key-btn" onclick="copyGatewayApiKey()" style="font-size:11px; padding:4px 8px; background:transparent; border-color:var(--border-glass);">Copy Key</button>
        </div>
      </div>

      <!-- Copilot Integration Card -->
      <div class="settings-card" style="margin:0">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">Integration Snippets</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; font-weight:600; color:var(--text-secondary);">Target Model:</span>
            <select class="premium-modal-input" id="api-model-selector" onchange="updateApiSnippets(this.value)" style="padding: 6px 12px; font-size:12px; margin:0; width:auto; min-width:150px;">
              <!-- Populated dynamically -->
            </select>
          </div>
        </div>
        
        <!-- Snippet Tabs -->
        <div class="auth-tab-row" style="display:flex; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border-glass); padding-bottom:10px;">
          <button class="auth-tab-btn active" id="tab-snippet-widget" onclick="toggleSnippetTab('widget')" style="font-size:12px; padding:6px 12px;">JS Chatbot Widget</button>
          <button class="auth-tab-btn" id="tab-snippet-curl" onclick="toggleSnippetTab('curl')" style="font-size:12px; padding:6px 12px;">cURL API</button>
          <button class="auth-tab-btn" id="tab-snippet-python" onclick="toggleSnippetTab('python')" style="font-size:12px; padding:6px 12px;">Python SDK</button>
          <button class="auth-tab-btn" id="tab-snippet-node" onclick="toggleSnippetTab('node')" style="font-size:12px; padding:6px 12px;">NodeJS Fetch</button>
        </div>

        <div style="position:relative;">
          <pre style="background:rgba(0,0,0,0.3) !important; border:1px solid var(--border-glass) !important; border-radius:8px; padding:14px; margin:0; overflow-x:auto; font-family:'Fira Code', monospace; font-size:12px; color:#c084fc; max-height:220px;" id="gateway-snippet-code">
<!-- Loading... -->
          </pre>
          <button class="copy-snippet-btn" onclick="copyGatewaySnippet()" style="position:absolute; right:10px; top:10px; font-size:10px; padding:4px 8px;">Copy</button>
        </div>
      </div>
    </div>

    <!-- Right Column: API Live Test Bench -->
    <div class="settings-card" style="margin:0; height:100%; display:flex; flex-direction:column; justify-content:space-between; min-height:480px;">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-glass); padding-bottom:14px; margin-bottom:14px;">
          <h3 style="margin:0; font-size:15px; font-weight:700;">Copilot Test Bench Widget</h3>
          <span style="font-size:11px; background:rgba(16, 185, 129, 0.1); color:#10b981; padding:3px 8px; border-radius:12px; font-weight:700; border:1px solid rgba(16, 185, 129, 0.2); display:flex; align-items:center; gap:4px;" id="testbench-tunnel-badge">
            <span style="width:6px; height:6px; background:#10b981; border-radius:50%; display:inline-block; animation:pulse 1.5s infinite"></span>
            GPU Tunnel Active
          </span>
        </div>
        
        <!-- Live Chat Simulator area -->
        <div id="gateway-chat-messages" style="display:flex; flex-direction:column; gap:12px; max-height:300px; min-height:260px; overflow-y:auto; padding:8px 4px; font-size:13px;">
          <div style="display:flex; flex-direction:column; gap:4px; max-width:85%; background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:8px 8px 8px 0; align-self:flex-start;">
            <strong>Copilot Agent:</strong>
            <span>Hello! I am your custom-trained business AI. Query me through this live API Test Bench!</span>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid var(--border-glass); padding-top:14px; margin-top:14px;">
        <div style="display:flex; gap:8px;">
          <input type="text" id="gateway-chat-input" placeholder="Ask your custom AI a customer support question..." onkeydown="if(event.key==='Enter'){sendGatewayTestMessage()}" class="premium-modal-input" style="margin:0; font-size:13px; padding:10px 14px;" />
          <button class="send-btn" onclick="sendGatewayTestMessage()" style="padding:10px 16px; background:var(--gradient-tech); border:none; border-radius:8px; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>`;
