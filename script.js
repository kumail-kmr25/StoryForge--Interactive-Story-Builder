/* ============================================
   StoryForge — Interactive Story Builder
   Core Application Logic
   ============================================ */

// ─── Data Layer ───────────────────────────────────
const DB_KEY = 'storyforge_data';
const PLAY_KEY = 'storyforge_play';

const AppState = {
  stories: [],
  currentStoryId: null,
  selectedNodeId: null,
  activeTab: 'editor',
  playState: null,
  sidebarOpen: false,
};

// ─── Utility Helpers ──────────────────────────────
function uid() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Storage ──────────────────────────────────────
function saveAll() {
  const data = {
    stories: AppState.stories,
    currentStoryId: AppState.currentStoryId,
  };
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch (e) {
    showToast('Storage full. Consider exporting your stories.', 'warning');
  }
}

function loadAll() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      AppState.stories = data.stories || [];
      AppState.currentStoryId = data.currentStoryId || null;
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

function savePlayState() {
  if (AppState.playState) {
    try {
      localStorage.setItem(PLAY_KEY, JSON.stringify(AppState.playState));
    } catch (e) { /* ignore */ }
  }
}

function loadPlayState() {
  try {
    const raw = localStorage.getItem(PLAY_KEY);
    if (raw) AppState.playState = JSON.parse(raw);
  } catch (e) { /* ignore */ }
}

// ─── Story CRUD ───────────────────────────────────
function getCurrentStory() {
  return AppState.stories.find(s => s.id === AppState.currentStoryId) || null;
}

function getNode(story, nodeId) {
  return story ? story.nodes.find(n => n.id === nodeId) : null;
}

function getStartNode(story) {
  return story ? story.nodes.find(n => n.type === 'start') : null;
}

function createStory(title, description, theme) {
  const startNodeId = 'node_' + uid();
  const story = {
    id: 'story_' + uid(),
    title: title || 'Untitled Story',
    description: description || '',
    theme: theme || 'dark-fantasy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: startNodeId,
        title: 'The Beginning',
        text: 'Your story begins here. Edit this node to start writing your tale...',
        type: 'start',
        endingType: null,
        choices: [],
      }
    ],
  };
  AppState.stories.push(story);
  AppState.currentStoryId = story.id;
  AppState.selectedNodeId = startNodeId;
  applyTheme(story.theme);
  saveAll();
  return story;
}

function deleteStory(storyId) {
  AppState.stories = AppState.stories.filter(s => s.id !== storyId);
  if (AppState.currentStoryId === storyId) {
    AppState.currentStoryId = AppState.stories.length > 0 ? AppState.stories[0].id : null;
    AppState.selectedNodeId = null;
    if (AppState.currentStoryId) {
      const s = getCurrentStory();
      if (s) applyTheme(s.theme);
    }
  }
  saveAll();
}

function updateStoryMeta(storyId, title, description, theme) {
  const story = AppState.stories.find(s => s.id === storyId);
  if (!story) return;
  story.title = title;
  story.description = description;
  if (theme !== story.theme) {
    story.theme = theme;
    applyTheme(theme);
  }
  story.updatedAt = new Date().toISOString();
  saveAll();
}

function addNode(storyId, title, text, type, endingType) {
  const story = AppState.stories.find(s => s.id === storyId);
  if (!story) return null;

  // If setting as start, demote existing start
  if (type === 'start') {
    story.nodes.forEach(n => {
      if (n.type === 'start') n.type = 'normal';
    });
  }

  const node = {
    id: 'node_' + uid(),
    title: title || 'New Node',
    text: text || '',
    type: type || 'normal',
    endingType: type === 'ending' ? (endingType || 'neutral') : null,
    choices: [],
  };

  story.nodes.push(node);
  story.updatedAt = new Date().toISOString();
  saveAll();
  return node;
}

function updateNode(storyId, nodeId, updates) {
  const story = AppState.stories.find(s => s.id === storyId);
  if (!story) return;
  const node = story.nodes.find(n => n.id === nodeId);
  if (!node) return;

  if (updates.type === 'start' && node.type !== 'start') {
    story.nodes.forEach(n => {
      if (n.type === 'start') n.type = 'normal';
    });
  }

  Object.assign(node, updates);

  if (node.type === 'ending') {
    node.choices = [];
    if (!node.endingType) node.endingType = 'neutral';
  } else {
    node.endingType = null;
  }

  story.updatedAt = new Date().toISOString();
  saveAll();
}

function deleteNode(storyId, nodeId) {
  const story = AppState.stories.find(s => s.id === storyId);
  if (!story) return false;
  const node = story.nodes.find(n => n.id === nodeId);
  if (!node) return false;
  if (node.type === 'start') {
    showToast('Cannot delete the start node. Set another node as start first.', 'error');
    return false;
  }

  story.nodes = story.nodes.filter(n => n.id !== nodeId);

  // Clean up choices that reference deleted node
  story.nodes.forEach(n => {
    n.choices = n.choices.filter(c => c.targetNodeId !== nodeId);
  });

  if (AppState.selectedNodeId === nodeId) {
    AppState.selectedNodeId = null;
  }

  story.updatedAt = new Date().toISOString();
  saveAll();
  return true;
}

function addChoice(storyId, nodeId, text, targetNodeId) {
  const story = AppState.stories.find(s => s.id === storyId);
  if (!story) return null;
  const node = story.nodes.find(n => n.id === nodeId);
  if (!node || node.type === 'ending') return null;

  const choice = {
    id: 'ch_' + uid(),
    text: text || 'New Choice',
    targetNodeId: targetNodeId || '',
  };
  node.choices.push(choice);
  story.updatedAt = new Date().toISOString();
  saveAll();
  return choice;
}

function updateChoice(storyId, nodeId, choiceId, updates) {
  const story = AppState.stories.find(s => s.id === storyId);
  if (!story) return;
  const node = story.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const choice = node.choices.find(c => c.id === choiceId);
  if (!choice) return;
  Object.assign(choice, updates);
  story.updatedAt = new Date().toISOString();
  saveAll();
}

function removeChoice(storyId, nodeId, choiceId) {
  const story = AppState.stories.find(s => s.id === storyId);
  if (!story) return;
  const node = story.nodes.find(n => n.id === nodeId);
  if (!node) return;
  node.choices = node.choices.filter(c => c.id !== choiceId);
  story.updatedAt = new Date().toISOString();
  saveAll();
}

// ─── Validation ───────────────────────────────────
function validateStory(story) {
  const issues = [];
  if (!story || story.nodes.length === 0) {
    issues.push({ type: 'error', msg: 'Story has no nodes.' });
    return issues;
  }

  const startNodes = story.nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    issues.push({ type: 'error', msg: 'No start node defined.' });
  } else if (startNodes.length > 1) {
    issues.push({ type: 'warning', msg: 'Multiple start nodes found.' });
  }

  const endingNodes = story.nodes.filter(n => n.type === 'ending');
  if (endingNodes.length === 0) {
    issues.push({ type: 'warning', msg: 'No ending nodes. Story has no conclusion.' });
  }

  const nodeIds = new Set(story.nodes.map(n => n.id));
  const referencedIds = new Set();

  story.nodes.forEach(n => {
    if (n.type !== 'ending' && n.choices.length === 0) {
      issues.push({ type: 'warning', msg: `"${n.title}" has no choices (dead end).` });
    }
    n.choices.forEach(c => {
      if (!c.targetNodeId || !nodeIds.has(c.targetNodeId)) {
        issues.push({ type: 'error', msg: `"${n.title}" has a broken choice link.` });
      } else {
        referencedIds.add(c.targetNodeId);
      }
    });
  });

  // Check for orphaned nodes (not reachable from start and not start itself)
  story.nodes.forEach(n => {
    if (n.type !== 'start' && !referencedIds.has(n.id)) {
      issues.push({ type: 'warning', msg: `"${n.title}" is unreachable (orphan).` });
    }
  });

  if (issues.length === 0) {
    issues.push({ type: 'success', msg: 'Story structure looks good!' });
  }

  return issues;
}

// ─── Theme ────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ─── Toast System ─────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Modal System ─────────────────────────────────
function showModal(titleText, contentHtml, onConfirm) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = titleText;
  document.getElementById('modalBody').innerHTML = contentHtml;
  overlay.classList.add('active');

  const confirmBtn = document.getElementById('modalConfirm');
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  newBtn.id = 'modalConfirm';

  if (onConfirm) {
    newBtn.style.display = '';
    newBtn.addEventListener('click', () => {
      onConfirm();
      closeModal();
    });
  } else {
    newBtn.style.display = 'none';
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// ─── Render Functions ─────────────────────────────

function renderAll() {
  renderSidebar();
  renderTopBar();
  renderWorkspace();
}

// Sidebar
function renderSidebar() {
  const story = getCurrentStory();
  const listEl = document.getElementById('storyList');
  const sidebarBtns = document.querySelectorAll('.sidebar-nav-btn');

  sidebarBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === AppState.activeTab);
  });

  if (AppState.stories.length === 0) {
    listEl.innerHTML = `<div class="text-muted text-sm" style="padding:8px 4px;">No stories yet</div>`;
  } else {
    listEl.innerHTML = AppState.stories.map(s => `
      <div class="story-list-item ${s.id === AppState.currentStoryId ? 'active' : ''}"
           data-story-id="${s.id}">
        <div style="min-width:0;flex:1;">
          <div class="story-name">${escapeHtml(s.title)}</div>
          <div class="story-meta">${s.nodes.length} nodes · ${formatDate(s.updatedAt)}</div>
        </div>
        <button class="delete-story-btn" data-delete-story="${s.id}" title="Delete story">🗑</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.story-list-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.delete-story-btn')) return;
        const sid = el.dataset.storyId;
        AppState.currentStoryId = sid;
        AppState.selectedNodeId = null;
        const st = getCurrentStory();
        if (st) applyTheme(st.theme);
        saveAll();
        renderAll();
      });
    });

    listEl.querySelectorAll('.delete-story-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = btn.dataset.deleteStory;
        const st = AppState.stories.find(s => s.id === sid);
        if (confirm(`Delete "${st ? st.title : 'this story'}"? This cannot be undone.`)) {
          deleteStory(sid);
          showToast('Story deleted.', 'info');
          renderAll();
        }
      });
    });
  }
}

// Top Bar
function renderTopBar() {
  const story = getCurrentStory();
  const titleEl = document.getElementById('currentStoryTitle');
  const badgeEl = document.getElementById('storyThemeBadge');

  if (story) {
    titleEl.textContent = story.title;
    const themeLabels = { 'dark-fantasy': '🗡️ Dark Fantasy', 'sci-fi': '🚀 Sci-Fi', 'mystery': '🔍 Mystery' };
    badgeEl.textContent = themeLabels[story.theme] || story.theme;
    badgeEl.classList.remove('hidden');
  } else {
    titleEl.textContent = 'StoryForge';
    badgeEl.classList.add('hidden');
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === AppState.activeTab);
  });
}

// Workspace Router
function renderWorkspace() {
  document.querySelectorAll('.workspace-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`panel-${AppState.activeTab}`);
  if (panel) panel.classList.add('active');

  const story = getCurrentStory();

  switch (AppState.activeTab) {
    case 'editor': renderEditor(story); break;
    case 'play': renderPlay(story); break;
    case 'map': renderPathMap(story); break;
    case 'settings': renderSettings(story); break;
  }
}

// ─── Editor Panel ─────────────────────────────────
function renderEditor(story) {
  const container = document.getElementById('editorContent');

  if (!story) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <div class="empty-title">Welcome to StoryForge</div>
        <div class="empty-text">Create your first interactive story and bring branching narratives to life.</div>
        <button class="btn btn-primary" onclick="showNewStoryModal()">✦ Create New Story</button>
      </div>
    `;
    return;
  }

  const selectedNode = story.nodes.find(n => n.id === AppState.selectedNodeId);
  const issues = validateStory(story);

  container.innerHTML = `
    <!-- Stats -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-icon">📄</span>
        <div>
          <div class="stat-value">${story.nodes.length}</div>
          <div class="stat-label">Nodes</div>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">🔀</span>
        <div>
          <div class="stat-value">${story.nodes.reduce((s, n) => s + n.choices.length, 0)}</div>
          <div class="stat-label">Choices</div>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">🏁</span>
        <div>
          <div class="stat-value">${story.nodes.filter(n => n.type === 'ending').length}</div>
          <div class="stat-label">Endings</div>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">${issues[0].type === 'success' ? '✅' : '⚠️'}</span>
        <div>
          <div class="stat-value">${issues.filter(i => i.type === 'error').length}</div>
          <div class="stat-label">Issues</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start;">
      <!-- Node List -->
      <div class="card" style="position:sticky;top:0;">
        <div class="card-header">
          <div class="card-title"><span class="icon">📑</span> Story Nodes</div>
          <button class="btn btn-primary btn-sm" id="addNodeBtn">+ Add</button>
        </div>
        <div class="node-list" id="nodeListContainer">
          ${story.nodes.length === 0 ? '<div class="text-muted text-sm text-center" style="padding:20px;">No nodes yet</div>' :
            story.nodes.map(n => {
              let dotClass = n.type;
              if (n.type === 'ending') {
                if (n.endingType === 'bad') dotClass = 'ending-bad';
                else if (n.endingType === 'secret') dotClass = 'ending-secret';
                else if (n.endingType === 'neutral') dotClass = 'ending-neutral';
              }
              let typeLabel = n.type.charAt(0).toUpperCase() + n.type.slice(1);
              if (n.type === 'ending' && n.endingType) {
                typeLabel = n.endingType.charAt(0).toUpperCase() + n.endingType.slice(1) + ' Ending';
              }
              return `
                <div class="node-item ${n.id === AppState.selectedNodeId ? 'active' : ''}" data-node-id="${n.id}">
                  <div class="node-type-dot ${dotClass}"></div>
                  <div class="node-item-info">
                    <div class="node-item-title">${escapeHtml(n.title)}</div>
                    <div class="node-item-type">${typeLabel} · ${n.choices.length} choice${n.choices.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div class="node-item-actions">
                    <button class="node-action-btn delete" data-delete-node="${n.id}" title="Delete node">🗑</button>
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>

        <!-- Validation -->
        ${issues.length > 0 ? `
          <div class="validation-list">
            ${issues.slice(0, 5).map(i => `
              <div class="validation-item ${i.type}">
                ${i.type === 'error' ? '✕' : i.type === 'warning' ? '⚠' : '✓'} ${escapeHtml(i.msg)}
              </div>
            `).join('')}
            ${issues.length > 5 ? `<div class="text-muted text-xs">+${issues.length - 5} more issues</div>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Node Editor -->
      <div>
        ${selectedNode ? renderNodeEditor(story, selectedNode) : `
          <div class="card">
            <div class="empty-state" style="padding:40px 20px;">
              <div class="empty-icon">👈</div>
              <div class="empty-title">Select a Node</div>
              <div class="empty-text">Click on a node from the list to edit its content and choices.</div>
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  // Event: Add node
  const addBtn = document.getElementById('addNodeBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const node = addNode(story.id, 'New Scene', '', 'normal', null);
      if (node) {
        AppState.selectedNodeId = node.id;
        showToast('Node created!', 'success');
        renderAll();
      }
    });
  }

  // Event: Select node
  document.querySelectorAll('.node-item[data-node-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.node-action-btn')) return;
      AppState.selectedNodeId = el.dataset.nodeId;
      renderAll();
    });
  });

  // Event: Delete node
  document.querySelectorAll('.node-action-btn.delete[data-delete-node]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nid = btn.dataset.deleteNode;
      const n = getNode(story, nid);
      if (n && n.type === 'start') {
        showToast('Cannot delete the start node. Set another node as start first.', 'error');
        return;
      }
      if (confirm(`Delete node "${n ? n.title : ''}"?`)) {
        deleteNode(story.id, nid);
        showToast('Node deleted.', 'info');
        renderAll();
      }
    });
  });

  // Bind node editor events
  bindNodeEditorEvents(story, selectedNode);
}

function renderNodeEditor(story, node) {
  const isEnding = node.type === 'ending';
  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="icon">✏️</span> Edit Node</div>
        <div class="btn-group">
          ${node.type !== 'start' ? `<button class="btn btn-danger btn-sm" id="deleteCurrentNode">Delete Node</button>` : ''}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Node Title</label>
        <input type="text" class="form-input" id="nodeTitle" value="${escapeHtml(node.title)}" placeholder="Scene title...">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Node Type</label>
          <select class="form-select" id="nodeType">
            <option value="start" ${node.type === 'start' ? 'selected' : ''}>⭐ Start</option>
            <option value="normal" ${node.type === 'normal' ? 'selected' : ''}>📄 Normal</option>
            <option value="ending" ${node.type === 'ending' ? 'selected' : ''}>🏁 Ending</option>
          </select>
        </div>
        <div class="form-group" id="endingTypeGroup" style="${isEnding ? '' : 'display:none'}">
          <label class="form-label">Ending Type</label>
          <select class="form-select" id="nodeEndingType">
            <option value="good" ${node.endingType === 'good' ? 'selected' : ''}>🌟 Good Ending</option>
            <option value="bad" ${node.endingType === 'bad' ? 'selected' : ''}>💀 Bad Ending</option>
            <option value="secret" ${node.endingType === 'secret' ? 'selected' : ''}>🔮 Secret Ending</option>
            <option value="neutral" ${node.endingType === 'neutral' ? 'selected' : ''}>⚖️ Neutral Ending</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Scene Text</label>
        <textarea class="form-textarea" id="nodeText" rows="6" placeholder="Write the scene description...">${escapeHtml(node.text)}</textarea>
      </div>
    </div>

    <!-- Choices -->
    ${!isEnding ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="icon">🔀</span> Choices</div>
        <button class="btn btn-primary btn-sm" id="addChoiceBtn">+ Add Choice</button>
      </div>

      <div id="choicesList">
        ${node.choices.length === 0 ? `
          <div class="text-muted text-sm text-center" style="padding:16px;">
            No choices yet. Add choices to connect this node to others.
          </div>
        ` : node.choices.map((c, i) => {
          const targetNode = story.nodes.find(n => n.id === c.targetNodeId);
          const isBroken = c.targetNodeId && !targetNode;
          const isMissing = !c.targetNodeId;
          return `
            <div class="choice-item">
              <div class="choice-number">${i + 1}</div>
              <div class="choice-fields">
                <input type="text" class="form-input choice-text-input" data-choice-id="${c.id}"
                       value="${escapeHtml(c.text)}" placeholder="Choice text...">
                <select class="form-select choice-target-select" data-choice-id="${c.id}">
                  <option value="">— Select target node —</option>
                  ${story.nodes.filter(n => n.id !== node.id).map(n => `
                    <option value="${n.id}" ${c.targetNodeId === n.id ? 'selected' : ''}>
                      ${n.type === 'start' ? '⭐' : n.type === 'ending' ? '🏁' : '📄'} ${escapeHtml(n.title)}
                    </option>
                  `).join('')}
                </select>
                ${isBroken ? '<div class="choice-warning">⚠ Target node no longer exists!</div>' : ''}
                ${isMissing ? '<div class="choice-warning">⚠ No target node selected</div>' : ''}
              </div>
              <button class="choice-remove-btn" data-remove-choice="${c.id}" title="Remove choice">✕</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : `
    <div class="card">
      <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem;">
        🏁 Ending nodes don't have choices. This is where the story concludes.
      </div>
    </div>
    `}
  `;
}

function bindNodeEditorEvents(story, node) {
  if (!node || !story) return;

  // Title
  const titleInput = document.getElementById('nodeTitle');
  if (titleInput) {
    titleInput.addEventListener('input', debounce(() => {
      updateNode(story.id, node.id, { title: titleInput.value });
      renderSidebar();
      renderTopBar();
      // Re-render node list only
      const listItems = document.querySelectorAll('.node-item[data-node-id]');
      listItems.forEach(el => {
        if (el.dataset.nodeId === node.id) {
          el.querySelector('.node-item-title').textContent = titleInput.value;
        }
      });
    }, 300));
  }

  // Type
  const typeSelect = document.getElementById('nodeType');
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      const newType = typeSelect.value;
      updateNode(story.id, node.id, { type: newType });
      AppState.selectedNodeId = node.id;
      renderAll();
    });
  }

  // Ending type
  const endingSelect = document.getElementById('nodeEndingType');
  if (endingSelect) {
    endingSelect.addEventListener('change', () => {
      updateNode(story.id, node.id, { endingType: endingSelect.value });
      renderAll();
    });
  }

  // Text
  const textArea = document.getElementById('nodeText');
  if (textArea) {
    textArea.addEventListener('input', debounce(() => {
      updateNode(story.id, node.id, { text: textArea.value });
    }, 400));
  }

  // Delete current node
  const delBtn = document.getElementById('deleteCurrentNode');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete node "${node.title}"?`)) {
        deleteNode(story.id, node.id);
        showToast('Node deleted.', 'info');
        renderAll();
      }
    });
  }

  // Add choice
  const addChoiceBtn = document.getElementById('addChoiceBtn');
  if (addChoiceBtn) {
    addChoiceBtn.addEventListener('click', () => {
      addChoice(story.id, node.id, 'New Choice', '');
      showToast('Choice added.', 'success');
      renderAll();
    });
  }

  // Choice text inputs
  document.querySelectorAll('.choice-text-input').forEach(input => {
    input.addEventListener('input', debounce(() => {
      updateChoice(story.id, node.id, input.dataset.choiceId, { text: input.value });
    }, 300));
  });

  // Choice target selects
  document.querySelectorAll('.choice-target-select').forEach(select => {
    select.addEventListener('change', () => {
      updateChoice(story.id, node.id, select.dataset.choiceId, { targetNodeId: select.value });
      renderAll();
    });
  });

  // Remove choice
  document.querySelectorAll('.choice-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeChoice(story.id, node.id, btn.dataset.removeChoice);
      showToast('Choice removed.', 'info');
      renderAll();
    });
  });
}

// ─── Play Mode ────────────────────────────────────
function renderPlay(story) {
  const container = document.getElementById('playContent');

  if (!story) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎮</div>
        <div class="empty-title">No Story Loaded</div>
        <div class="empty-text">Create or select a story first, then come back to play it.</div>
      </div>
    `;
    return;
  }

  const startNode = getStartNode(story);
  if (!startNode) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">No Start Node</div>
        <div class="empty-text">Your story needs a start node before you can play it.</div>
      </div>
    `;
    return;
  }

  // Initialize or restore play state
  if (!AppState.playState || AppState.playState.storyId !== story.id) {
    AppState.playState = {
      storyId: story.id,
      currentNodeId: startNode.id,
      history: [],
      ended: false,
    };
    savePlayState();
  }

  const ps = AppState.playState;
  const currentNode = getNode(story, ps.currentNodeId);

  if (!currentNode) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💔</div>
        <div class="empty-title">Broken Path</div>
        <div class="empty-text">The current node no longer exists. Please restart.</div>
        <button class="btn btn-primary" onclick="restartPlay()">Restart Story</button>
      </div>
    `;
    return;
  }

  let html = '<div class="play-container">';

  // Header
  html += `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
      <div>
        <div style="font-family:var(--font-display);font-size:1.4rem;color:var(--text-primary);">${escapeHtml(story.title)}</div>
        <div class="text-muted text-sm">${escapeHtml(story.description)}</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="restartPlay()">↻ Restart</button>
    </div>
  `;

  // History
  if (ps.history.length > 0) {
    html += '<div class="play-history">';
    ps.history.forEach(h => {
      html += `
        <div class="play-history-item">
          <div class="play-history-title">${escapeHtml(h.nodeTitle)}</div>
          <div class="play-history-text">${escapeHtml(h.nodeText)}</div>
          ${h.choiceText ? `<div class="play-history-choice">${escapeHtml(h.choiceText)}</div>` : ''}
        </div>
      `;
    });
    html += '</div>';
  }

  // Current Node
  if (currentNode.type === 'ending') {
    const endingIcons = { good: '🌟', bad: '💀', secret: '🔮', neutral: '⚖️' };
    const endingLabels = { good: 'Good Ending', bad: 'Bad Ending', secret: 'Secret Ending', neutral: 'Neutral Ending' };
    const et = currentNode.endingType || 'neutral';
    html += `
      <div class="play-ending">
        <div class="ending-icon">${endingIcons[et]}</div>
        <div class="ending-label">${endingLabels[et]}</div>
        <div class="play-current-title" style="font-size:1.1rem;margin-bottom:8px;">${escapeHtml(currentNode.title)}</div>
        <div class="ending-text">${escapeHtml(currentNode.text)}</div>
        <div class="btn-group" style="justify-content:center;">
          <button class="btn btn-primary" onclick="restartPlay()">↻ Play Again</button>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="play-current">
        <div class="play-current-title">${escapeHtml(currentNode.title)}</div>
        <div class="play-current-text">${escapeHtml(currentNode.text)}</div>
        <div class="play-choices">
          ${currentNode.choices.map(c => {
            const target = getNode(story, c.targetNodeId);
            if (!target) return '';
            return `
              <button class="play-choice-btn" data-target="${c.targetNodeId}" data-choice-text="${escapeHtml(c.text)}">
                <span class="choice-arrow">▸</span>
                <span>${escapeHtml(c.text)}</span>
              </button>
            `;
          }).join('')}
          ${currentNode.choices.length === 0 ? '<div class="text-muted text-sm">No choices available. This seems to be a dead end.</div>' : ''}
        </div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;

  // Bind play choices
  container.querySelectorAll('.play-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const choiceText = btn.dataset.choiceText;
      makePlayChoice(story, currentNode, choiceText, targetId);
    });
  });

  // Scroll to bottom
  const workspace = document.querySelector('.workspace');
  if (workspace) {
    setTimeout(() => workspace.scrollTop = workspace.scrollHeight, 50);
  }
}

function makePlayChoice(story, currentNode, choiceText, targetNodeId) {
  AppState.playState.history.push({
    nodeId: currentNode.id,
    nodeTitle: currentNode.title,
    nodeText: currentNode.text,
    choiceText: choiceText,
  });
  AppState.playState.currentNodeId = targetNodeId;

  const targetNode = getNode(story, targetNodeId);
  if (targetNode && targetNode.type === 'ending') {
    AppState.playState.ended = true;
  }

  savePlayState();
  renderPlay(story);
}

function restartPlay() {
  const story = getCurrentStory();
  if (!story) return;
  const startNode = getStartNode(story);
  AppState.playState = {
    storyId: story.id,
    currentNodeId: startNode ? startNode.id : null,
    history: [],
    ended: false,
  };
  savePlayState();
  renderPlay(story);
}

// ─── Path Map ─────────────────────────────────────
function renderPathMap(story) {
  const container = document.getElementById('mapContent');

  if (!story) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗺️</div>
        <div class="empty-title">No Story to Map</div>
        <div class="empty-text">Create or select a story to visualize its branching structure.</div>
      </div>
    `;
    return;
  }

  if (story.nodes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No Nodes Yet</div>
        <div class="empty-text">Add some nodes to your story to see the path map.</div>
      </div>
    `;
    return;
  }

  // Layout calculation using tree-based approach
  const layout = calculateMapLayout(story);

  const padding = 40;
  const canvasWidth = layout.width + padding * 2;
  const canvasHeight = layout.height + padding * 2;

  let html = `<div class="pathmap-container">
    <div class="pathmap-canvas-wrap" style="width:${canvasWidth}px;height:${canvasHeight}px;">
      <canvas class="pathmap-canvas" id="mapCanvas" width="${canvasWidth}" height="${canvasHeight}"></canvas>`;

  layout.positions.forEach(pos => {
    const node = pos.node;
    let cls = node.type;
    if (node.type === 'ending') {
      if (node.endingType === 'bad') cls = 'ending-bad';
      else if (node.endingType === 'secret') cls = 'ending-secret';
      else if (node.endingType === 'neutral') cls = 'ending-neutral';
    }
    if (node.id === AppState.selectedNodeId) cls += ' selected';

    let typeLabel = node.type;
    if (node.type === 'ending' && node.endingType) {
      typeLabel = node.endingType + ' ending';
    }

    html += `
      <div class="pathmap-node ${cls}" style="left:${pos.x + padding}px;top:${pos.y + padding}px;"
           data-node-id="${node.id}">
        <div class="pathmap-node-title">${escapeHtml(node.title)}</div>
        <div class="pathmap-node-type">${typeLabel}</div>
        <div class="pathmap-node-choices">${node.choices.length} choice${node.choices.length !== 1 ? 's' : ''}</div>
      </div>
    `;
  });

  html += '</div></div>';
  container.innerHTML = html;

  // Draw connections on canvas
  const canvas = document.getElementById('mapCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    drawConnections(ctx, layout, story, padding);
  }

  // Click to select node
  container.querySelectorAll('.pathmap-node').forEach(el => {
    el.addEventListener('click', () => {
      AppState.selectedNodeId = el.dataset.nodeId;
      AppState.activeTab = 'editor';
      renderAll();
    });
  });
}

function calculateMapLayout(story) {
  const nodeWidth = 180;
  const nodeHeight = 80;
  const hGap = 60;
  const vGap = 80;

  const positions = [];
  const posMap = {};

  // BFS from start node for tree layout
  const startNode = getStartNode(story);
  const visited = new Set();
  const levels = [];

  if (startNode) {
    const queue = [{ node: startNode, level: 0 }];
    visited.add(startNode.id);

    while (queue.length > 0) {
      const { node, level } = queue.shift();
      if (!levels[level]) levels[level] = [];
      levels[level].push(node);

      node.choices.forEach(c => {
        const target = story.nodes.find(n => n.id === c.targetNodeId);
        if (target && !visited.has(target.id)) {
          visited.add(target.id);
          queue.push({ node: target, level: level + 1 });
        }
      });
    }
  }

  // Add orphaned nodes
  const orphans = story.nodes.filter(n => !visited.has(n.id));
  if (orphans.length > 0) {
    levels.push(orphans);
  }

  // Calculate positions
  let maxWidth = 0;

  levels.forEach((level, li) => {
    const totalWidth = level.length * nodeWidth + (level.length - 1) * hGap;
    if (totalWidth > maxWidth) maxWidth = totalWidth;
  });

  levels.forEach((level, li) => {
    const totalWidth = level.length * nodeWidth + (level.length - 1) * hGap;
    const startX = (maxWidth - totalWidth) / 2;
    const y = li * (nodeHeight + vGap);

    level.forEach((node, ni) => {
      const x = startX + ni * (nodeWidth + hGap);
      const pos = { node, x, y, w: nodeWidth, h: nodeHeight };
      positions.push(pos);
      posMap[node.id] = pos;
    });
  });

  return {
    positions,
    posMap,
    width: Math.max(maxWidth, 400),
    height: levels.length * (nodeHeight + vGap) - vGap + 40,
  };
}

function drawConnections(ctx, layout, story, padding) {
  const { posMap } = layout;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Get computed style for colors
  const style = getComputedStyle(document.documentElement);
  const lineColor = style.getPropertyValue('--accent-primary').trim() || '#a78bfa';
  const mutedColor = style.getPropertyValue('--text-muted').trim() || '#7a6a95';

  story.nodes.forEach(node => {
    const fromPos = posMap[node.id];
    if (!fromPos) return;

    node.choices.forEach((choice, ci) => {
      const toPos = posMap[choice.targetNodeId];
      if (!toPos) return;

      const fromX = fromPos.x + padding + fromPos.w / 2;
      const fromY = fromPos.y + padding + fromPos.h;
      const toX = toPos.x + padding + toPos.w / 2;
      const toY = toPos.y + padding;

      // Draw curved line
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;

      const midY = (fromY + toY) / 2;

      // Handle back-links (to nodes above)
      if (toY <= fromY) {
        const offset = 20 + ci * 10;
        ctx.moveTo(fromX, fromY);
        ctx.bezierCurveTo(
          fromX + offset * 3, fromY + 40,
          toX + offset * 3, toY - 40,
          toX, toY
        );
      } else {
        ctx.moveTo(fromX, fromY);
        ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
      }

      ctx.stroke();

      // Arrow head
      ctx.globalAlpha = 0.7;
      const arrowSize = 8;
      let angle;
      if (toY <= fromY) {
        angle = Math.atan2(toY - (toY - 40), toX - (toX + 30));
      } else {
        angle = Math.atan2(toY - midY, toX - toX) || Math.PI / 2;
      }

      ctx.beginPath();
      ctx.fillStyle = lineColor;
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - arrowSize * Math.cos(angle - 0.4), toY - arrowSize * Math.sin(angle - 0.4));
      ctx.lineTo(toX - arrowSize * Math.cos(angle + 0.4), toY - arrowSize * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
    });
  });
}

// ─── Settings Panel ───────────────────────────────
function renderSettings(story) {
  const container = document.getElementById('settingsContent');

  if (!story) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚙️</div>
        <div class="empty-title">No Story Selected</div>
        <div class="empty-text">Create or select a story to edit its settings.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="max-width:600px;margin:0 auto;">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><span class="icon">📝</span> Story Details</div>
        </div>

        <div class="form-group">
          <label class="form-label">Story Title</label>
          <input type="text" class="form-input" id="settingsTitle" value="${escapeHtml(story.title)}" placeholder="Story title...">
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="settingsDescription" rows="3" placeholder="Brief description...">${escapeHtml(story.description)}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Theme</label>
          <div class="theme-chips">
            <button class="theme-chip ${story.theme === 'dark-fantasy' ? 'selected' : ''}" data-theme="dark-fantasy">
              <span class="chip-icon">🗡️</span> Dark Fantasy
            </button>
            <button class="theme-chip ${story.theme === 'sci-fi' ? 'selected' : ''}" data-theme="sci-fi">
              <span class="chip-icon">🚀</span> Sci-Fi
            </button>
            <button class="theme-chip ${story.theme === 'mystery' ? 'selected' : ''}" data-theme="mystery">
              <span class="chip-icon">🔍</span> Mystery
            </button>
          </div>
        </div>

        <button class="btn btn-primary btn-block mt-16" id="saveSettingsBtn">Save Changes</button>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><span class="icon">💾</span> Import / Export</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" id="exportBtn">📤 Export JSON</button>
          <button class="btn btn-secondary" id="importBtn">📥 Import JSON</button>
        </div>
        <input type="file" id="importFileInput" accept=".json" style="display:none;">
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><span class="icon">🗑️</span> Danger Zone</div>
        </div>
        <p class="text-muted text-sm mb-16">Deleting a story is permanent and cannot be undone.</p>
        <button class="btn btn-danger" id="deleteStoryBtn">Delete This Story</button>
      </div>
    </div>
  `;

  // Theme chips
  container.querySelectorAll('.theme-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  // Save settings
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    const title = document.getElementById('settingsTitle').value.trim() || 'Untitled Story';
    const desc = document.getElementById('settingsDescription').value.trim();
    const selectedChip = container.querySelector('.theme-chip.selected');
    const theme = selectedChip ? selectedChip.dataset.theme : story.theme;
    updateStoryMeta(story.id, title, desc, theme);
    showToast('Story settings saved!', 'success');
    renderAll();
  });

  // Export
  document.getElementById('exportBtn').addEventListener('click', () => {
    exportStory(story);
  });

  // Import
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });

  document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importStory(file);
  });

  // Delete
  document.getElementById('deleteStoryBtn').addEventListener('click', () => {
    if (confirm(`Delete "${story.title}"? This cannot be undone.`)) {
      deleteStory(story.id);
      showToast('Story deleted.', 'info');
      renderAll();
    }
  });
}

// ─── Export / Import ──────────────────────────────
function exportStory(story) {
  const data = deepClone(story);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `storyforge_${story.title.replace(/\s+/g, '_').toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Story exported!', 'success');
}

function importStory(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Validate structure
      if (!data.title || !data.nodes || !Array.isArray(data.nodes)) {
        showToast('Invalid story file format.', 'error');
        return;
      }

      // Assign new ID to avoid conflicts
      data.id = 'story_' + uid();
      data.title = data.title + ' (Imported)';
      data.updatedAt = new Date().toISOString();

      AppState.stories.push(data);
      AppState.currentStoryId = data.id;
      AppState.selectedNodeId = null;
      applyTheme(data.theme || 'dark-fantasy');
      saveAll();
      showToast('Story imported!', 'success');
      renderAll();
    } catch (err) {
      showToast('Failed to parse file. Ensure it is valid JSON.', 'error');
    }
  };
  reader.readAsText(file);
}

// ─── New Story Modal ──────────────────────────────
function showNewStoryModal() {
  const html = `
    <div class="form-group">
      <label class="form-label">Story Title</label>
      <input type="text" class="form-input" id="newStoryTitle" placeholder="Enter story title..." autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="newStoryDesc" rows="3" placeholder="Brief description of your story..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Theme</label>
      <div class="theme-chips">
        <button class="theme-chip selected" data-theme="dark-fantasy" type="button">
          <span class="chip-icon">🗡️</span> Dark Fantasy
        </button>
        <button class="theme-chip" data-theme="sci-fi" type="button">
          <span class="chip-icon">🚀</span> Sci-Fi
        </button>
        <button class="theme-chip" data-theme="mystery" type="button">
          <span class="chip-icon">🔍</span> Mystery
        </button>
      </div>
    </div>
  `;

  showModal('Create New Story', html, () => {
    const title = document.getElementById('newStoryTitle').value.trim() || 'Untitled Story';
    const desc = document.getElementById('newStoryDesc').value.trim();
    const selectedChip = document.querySelector('#modalBody .theme-chip.selected');
    const theme = selectedChip ? selectedChip.dataset.theme : 'dark-fantasy';
    createStory(title, desc, theme);
    AppState.activeTab = 'editor';
    showToast(`"${title}" created!`, 'success');
    renderAll();
  });

  // Bind theme chips in modal
  setTimeout(() => {
    document.querySelectorAll('#modalBody .theme-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#modalBody .theme-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
  }, 50);
}

// ─── Debounce ─────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Event Binding ────────────────────────────────
function initApp() {
  loadAll();
  loadPlayState();

  // Apply theme from current story or default
  const story = getCurrentStory();
  applyTheme(story ? story.theme : 'dark-fantasy');

  // Tab navigation
  document.querySelectorAll('.tab-btn, .sidebar-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.activeTab = btn.dataset.tab;
      renderAll();
      // Close mobile sidebar
      if (window.innerWidth <= 768) {
        closeMobileSidebar();
      }
    });
  });

  // New story button
  document.getElementById('newStoryBtn').addEventListener('click', showNewStoryModal);

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Mobile sidebar
  document.getElementById('mobileToggle').addEventListener('click', toggleMobileSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

  // Export all / Import buttons in sidebar
  document.getElementById('exportAllBtn').addEventListener('click', () => {
    if (AppState.stories.length === 0) {
      showToast('No stories to export.', 'warning');
      return;
    }
    const blob = new Blob([JSON.stringify(AppState.stories, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'storyforge_all_stories.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('All stories exported!', 'success');
  });

  document.getElementById('importAllBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data)) {
            // Multiple stories
            data.forEach(s => {
              s.id = 'story_' + uid();
              AppState.stories.push(s);
            });
            showToast(`${data.length} stories imported!`, 'success');
          } else if (data.title && data.nodes) {
            // Single story
            data.id = 'story_' + uid();
            AppState.stories.push(data);
            showToast('Story imported!', 'success');
          } else {
            showToast('Invalid file format.', 'error');
            return;
          }
          if (AppState.stories.length > 0) {
            AppState.currentStoryId = AppState.stories[AppState.stories.length - 1].id;
            const s = getCurrentStory();
            if (s) applyTheme(s.theme);
          }
          saveAll();
          renderAll();
        } catch (err) {
          showToast('Failed to parse file.', 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveAll();
      showToast('Saved!', 'success');
    }
  });

  renderAll();
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ─── Initialize ───────────────────────────────────
document.addEventListener('DOMContentLoaded', initApp);
