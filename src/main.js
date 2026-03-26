/**
 * AI Dungeon Master — Main Application Entry Point
 */
import './styles/index.css';
import { GameState, RACES, CLASSES, PHASES } from './engine/GameState.js';
import { DiceRoller } from './engine/DiceRoller.js';
import { CombatSystem } from './engine/CombatSystem.js';
import { StoryGenerator } from './ai/StoryGenerator.js';
import { ImageGenerator } from './ai/ImageGenerator.js';

// ============================================
// INITIALIZATION
// ============================================
const game = new GameState();
const combat = new CombatSystem(game);
const story = new StoryGenerator(game);
const imageGen = new ImageGenerator();

let currentStats = [];
let creationStep = 0;
const CREATION_STEPS = ['step-name', 'step-race', 'step-class', 'step-stats', 'step-summary'];

// ============================================
// DOM REFERENCES
// ============================================
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================
// LOADING SCREEN
// ============================================
setTimeout(() => {
  const loadingScreen = $('loading-screen');
  loadingScreen.style.opacity = '0';
  loadingScreen.style.transition = 'opacity 0.6s ease';
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    showCharacterCreation();
  }, 600);
}, 2200);

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// SETTINGS MODAL
// ============================================
function initSettings() {
  $('open-settings').addEventListener('click', () => $('settings-modal').classList.remove('hidden'));
  $('close-settings').addEventListener('click', () => $('settings-modal').classList.add('hidden'));
  
  // Close on overlay click
  $('settings-modal').addEventListener('click', (e) => {
    if (e.target === $('settings-modal')) $('settings-modal').classList.add('hidden');
  });
  
  // Toggle key visibility
  $('toggle-key-visibility').addEventListener('click', () => {
    const input = $('api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  
  // Toggle buttons
  $$('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });
  
  // Load saved settings
  $('api-key-input').value = game.settings.apiKey;
  $('text-speed').value = game.settings.textSpeed;
  if (!game.settings.audioEnabled) $('toggle-audio').classList.remove('active');
  if (!game.settings.sfxEnabled) $('toggle-sfx').classList.remove('active');
  
  // Save settings
  $('save-settings').addEventListener('click', () => {
    game.saveSettings({
      apiKey: $('api-key-input').value.trim(),
      textSpeed: parseInt($('text-speed').value),
      audioEnabled: $('toggle-audio').classList.contains('active'),
      sfxEnabled: $('toggle-sfx').classList.contains('active'),
    });
    $('settings-modal').classList.add('hidden');
    showToast('Settings saved!', 'success');
  });
}

// ============================================
// CHARACTER CREATION
// ============================================
function showCharacterCreation() {
  game.setPhase(PHASES.CHARACTER_CREATION);
  $('character-creation').classList.remove('hidden');
  
  // Populate race options
  const raceGrid = $('race-options');
  raceGrid.innerHTML = RACES.map(r => `
    <div class="option-card" data-id="${r.id}">
      <span class="option-icon">${r.icon}</span>
      <div class="option-name">${r.name}</div>
      <div class="option-desc">${r.desc}</div>
    </div>
  `).join('');
  
  // Populate class options
  const classGrid = $('class-options');
  classGrid.innerHTML = CLASSES.map(c => `
    <div class="option-card" data-id="${c.id}">
      <span class="option-icon">${c.icon}</span>
      <div class="option-name">${c.name}</div>
      <div class="option-desc">${c.desc}</div>
    </div>
  `).join('');
  
  // Option card selection
  raceGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.option-card');
    if (!card) return;
    raceGrid.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    game.setCharacterRace(card.dataset.id);
  });
  
  classGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.option-card');
    if (!card) return;
    classGrid.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    game.setCharacterClass(card.dataset.id);
  });
  
  // Roll initial stats
  rollStats();
  
  // Reroll button
  $('reroll-stats').addEventListener('click', rollStats);
  
  // Navigation
  $('next-step').addEventListener('click', nextCreationStep);
  $('prev-step').addEventListener('click', prevCreationStep);
  
  // Enter key on name input
  $('char-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') nextCreationStep();
  });
}

function rollStats() {
  currentStats = DiceRoller.rollStatArray();
  const statNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const statIcons = ['💪', '🏃', '❤️', '🧠', '👁️', '✨'];
  
  $('stat-rolls').innerHTML = currentStats.map((val, i) => `
    <div class="stat-card">
      <div class="stat-label">${statIcons[i]} ${statNames[i]}</div>
      <div class="stat-value">${val}</div>
      <div class="stat-mod">(${DiceRoller.modifierStr(val)})</div>
    </div>
  `).join('');
}

function nextCreationStep() {
  // Validate current step
  if (creationStep === 0) {
    const name = $('char-name').value.trim();
    if (!name) { showToast('Enter your character name!', 'error'); return; }
    game.setCharacterName(name);
  }
  if (creationStep === 1 && !game.character.race) {
    showToast('Choose your race!', 'error'); return;
  }
  if (creationStep === 2 && !game.character.class) {
    showToast('Choose your class!', 'error'); return;
  }
  if (creationStep === 3) {
    game.setCharacterStats(currentStats);
  }
  
  // Show summary on last step
  if (creationStep === 3) {
    game.finalizeCharacter();
    renderCharacterSummary();
  }
  
  if (creationStep < CREATION_STEPS.length - 1) {
    $(CREATION_STEPS[creationStep]).classList.add('hidden');
    $(CREATION_STEPS[creationStep]).classList.remove('active');
    creationStep++;
    $(CREATION_STEPS[creationStep]).classList.remove('hidden');
    $(CREATION_STEPS[creationStep]).classList.add('active');
    
    // Update nav buttons
    $('prev-step').classList.toggle('hidden', creationStep === 0);
    if (creationStep === CREATION_STEPS.length - 1) {
      $('next-step').textContent = '⚔️ Begin Adventure';
    }
  } else {
    // Start the game!
    startGame();
  }
}

function prevCreationStep() {
  if (creationStep > 0) {
    $(CREATION_STEPS[creationStep]).classList.add('hidden');
    $(CREATION_STEPS[creationStep]).classList.remove('active');
    creationStep--;
    $(CREATION_STEPS[creationStep]).classList.remove('hidden');
    $(CREATION_STEPS[creationStep]).classList.add('active');
    
    $('prev-step').classList.toggle('hidden', creationStep === 0);
    $('next-step').textContent = 'Continue →';
  }
}

function renderCharacterSummary() {
  const c = game.character;
  const statNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  
  $('char-summary').innerHTML = `
    <div class="summary-name">${c.name}</div>
    <div class="summary-race-class">${c.race?.icon} ${c.race?.name} ${c.class?.icon} ${c.class?.name}</div>
    <div style="margin-top:0.5rem; font-size:0.9rem; color: var(--text-secondary);">
      ❤️ HP: ${c.maxHp} | 🛡️ AC: ${c.ac} | 💰 Gold: ${c.gold}
    </div>
    <div class="summary-stats">
      ${statNames.map(s => `
        <div class="summary-stat">
          <div class="summary-stat-label">${s}</div>
          <div class="summary-stat-value">${c.stats[s]}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// GAME START
// ============================================
async function startGame() {
  $('character-creation').classList.add('hidden');
  $('game-screen').classList.remove('hidden');
  game.setPhase(PHASES.EXPLORATION);
  
  updateCharacterSidebar();
  initGameInput();
  initSettings();
  
  // Show typing indicator
  showTyping(true);
  
  // Generate opening narration
  const response = await story.generateOpening();
  showTyping(false);
  
  // Display the opening
  handleStoryResponse(response);
}

// ============================================
// CHARACTER SIDEBAR
// ============================================
function updateCharacterSidebar() {
  const c = game.character;
  $('char-display-name').textContent = c.name;
  $('char-race-class').textContent = `${c.race?.name || ''} ${c.class?.name || ''}`;
  
  // Portrait
  $('char-portrait').querySelector('.portrait-placeholder').textContent = c.class?.icon || '🧙';
  
  // HPBar
  updateHPBar();
  updateXPBar();
  
  // Stats
  const statNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  $('stats-display').innerHTML = statNames.map(s => `
    <div class="stat-mini">
      <span class="stat-mini-label">${s}</span>
      <span class="stat-mini-value">${c.stats[s]} (${DiceRoller.modifierStr(c.stats[s])})</span>
    </div>
  `).join('');
  
  updateInventoryDisplay();
  updateQuestLog();
}

function updateHPBar() {
  const c = game.character;
  const pct = (c.hp / c.maxHp) * 100;
  $('hp-fill').style.width = `${pct}%`;
  $('hp-fill').classList.toggle('low', pct < 30);
  $('hp-text').textContent = `${c.hp} / ${c.maxHp}`;
}

function updateXPBar() {
  const c = game.character;
  const pct = (c.xp / c.xpToLevel) * 100;
  $('xp-fill').style.width = `${pct}%`;
  $('xp-text').textContent = `${c.xp} / ${c.xpToLevel}`;
}

function updateInventoryDisplay() {
  const inv = game.character.inventory;
  if (inv.length === 0) {
    $('inventory-list').innerHTML = '<p class="empty-text">No items yet</p>';
  } else {
    $('inventory-list').innerHTML = inv.map(item => `
      <div class="inventory-item">
        <span class="inventory-item-icon">${item.icon}</span>
        <span>${item.name}</span>
      </div>
    `).join('');
  }
}

function updateQuestLog() {
  const quests = game.questLog;
  if (quests.length === 0) {
    $('quest-log').innerHTML = '<p class="empty-text">No quests yet</p>';
  } else {
    $('quest-log').innerHTML = quests.map(q => `
      <div class="quest-item ${q.completed ? 'completed' : ''}">
        ${q.completed ? '✅' : '📋'} ${q.title}
      </div>
    `).join('');
  }
}

// ============================================
// NARRATIVE PANEL
// ============================================
function addNarrativeEntry(text, type = 'narrator', extra = {}) {
  const storyContent = $('story-content');
  const entry = document.createElement('div');
  entry.className = 'story-entry';
  
  if (type === 'narrator') {
    entry.innerHTML = `<div class="story-narrator"></div>`;
    typewriterEffect(entry.querySelector('.story-narrator'), text);
  } else if (type === 'action') {
    entry.innerHTML = `<div class="story-action">➤ ${text}</div>`;
  } else if (type === 'dialogue') {
    entry.innerHTML = `
      <div class="story-dialogue">
        <span class="npc-name">${extra.npcName}:</span> "${text}"
      </div>
    `;
  } else if (type === 'combat') {
    entry.innerHTML = `<div class="story-combat">⚔️ ${text}</div>`;
  }
  
  storyContent.appendChild(entry);
  
  // Auto-scroll
  setTimeout(() => {
    $('narrative-panel').scrollTop = $('narrative-panel').scrollHeight;
  }, 100);
  
  // Add to game state
  game.addStoryEntry({ text, type, ...extra });
}

function typewriterEffect(element, text) {
  let i = 0;
  const speed = game.settings.textSpeed;
  
  function type() {
    if (i < text.length) {
      // Handle HTML-like formatting
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  
  type();
}

function showTyping(show) {
  $('typing-indicator').classList.toggle('hidden', !show);
  if (show) {
    $('narrative-panel').scrollTop = $('narrative-panel').scrollHeight;
  }
}

// ============================================
// PLAYER INPUT
// ============================================
function initGameInput() {
  $('send-action').addEventListener('click', sendCustomAction);
  $('custom-action').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendCustomAction();
  });
}

function renderChoices(choices) {
  const container = $('choice-buttons');
  const keys = ['A', 'B', 'C', 'D'];
  
  container.innerHTML = choices.map((choice, i) => `
    <button class="choice-btn" data-choice="${choice}">
      <span class="choice-key">${keys[i] || (i + 1)}</span>${choice}
    </button>
  `).join('');
  
  container.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => handleChoice(btn.dataset.choice));
  });
}

function clearChoices() {
  $('choice-buttons').innerHTML = '';
}

async function handleChoice(choice) {
  if (story.isGenerating) return;
  
  clearChoices();
  disableInput(true);
  
  // Show player action
  addNarrativeEntry(choice, 'action');
  
  showTyping(true);
  game.nextTurn();
  $('turn-counter').textContent = `Turn ${game.turn}`;
  
  const response = await story.generateContinuation(choice);
  showTyping(false);
  
  handleStoryResponse(response);
  disableInput(false);
}

async function sendCustomAction() {
  const input = $('custom-action');
  const action = input.value.trim();
  if (!action || story.isGenerating) return;
  
  input.value = '';
  await handleChoice(action);
}

function disableInput(disabled) {
  $('send-action').disabled = disabled;
  $('custom-action').disabled = disabled;
  $$('.choice-btn').forEach(btn => btn.disabled = disabled);
}

// ============================================
// STORY RESPONSE HANDLER
// ============================================
async function handleStoryResponse(response) {
  // Display narrative
  addNarrativeEntry(response.narrative, 'narrator');
  
  // NPC dialogue
  if (response.npcDialogue) {
    setTimeout(() => {
      addNarrativeEntry(response.npcDialogue.text, 'dialogue', { npcName: response.npcDialogue.name });
    }, 500);
  }
  
  // Items
  if (response.items && response.items.length > 0) {
    response.items.forEach(item => {
      game.addItem(item);
      showToast(`Found: ${item.icon} ${item.name}`, 'success');
    });
    updateInventoryDisplay();
  }
  
  // Quest
  if (response.quest) {
    game.addQuest(response.quest);
    showToast(`New Quest: ${response.quest.title}`, 'success');
    updateQuestLog();
  }
  
  // XP
  if (response.xpReward > 0) {
    game.gainXP(response.xpReward);
    showToast(`+${response.xpReward} XP`, 'success');
    updateXPBar();
  }
  
  // Scene image
  updateSceneImage(response.sceneDescription);
  
  // Combat trigger
  if (response.combatTrigger) {
    setTimeout(() => startCombat(response.enemyType), 2000);
    return;
  }
  
  // Render choices
  setTimeout(() => {
    renderChoices(response.choices);
  }, Math.min(response.narrative.length * game.settings.textSpeed, 3000));
}

// ============================================
// SCENE VIEWER
// ============================================
function updateSceneImage(description) {
  if (!description) return;
  
  const viewer = $('scene-viewer');
  viewer.innerHTML = `
    <div class="scene-placeholder">
      <span>🎨</span>
      <p>Generating scene...</p>
    </div>
    <div class="scene-shimmer"></div>
  `;
  
  const url = imageGen.generateSceneUrl(description);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    viewer.innerHTML = '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.alt = description;
    viewer.appendChild(img);
  };
  img.onerror = () => {
    viewer.innerHTML = `
      <div class="scene-placeholder">
        <span>🏰</span>
        <p>${description}</p>
      </div>
    `;
  };
  img.src = url;
}

// ============================================
// COMBAT
// ============================================
function startCombat(enemyType) {
  game.setPhase(PHASES.COMBAT);
  addNarrativeEntry('A hostile creature emerges from the shadows!', 'combat');
  
  const overlay = $('combat-overlay');
  overlay.classList.remove('hidden');
  
  combat.startCombat();
  
  // Update combat UI
  $('combat-player-name').textContent = game.character.name;
  $('player-combatant').querySelector('.combatant-portrait').textContent = game.character.class?.icon || '🧙';
  updateCombatHP();
}

function updateCombatHP() {
  const playerPct = (game.character.hp / game.character.maxHp) * 100;
  $('combat-player-hp').style.width = `${playerPct}%`;
  $('combat-player-hp').classList.toggle('low', playerPct < 30);
  
  if (combat.enemy) {
    $('combat-enemy-name').textContent = combat.enemy.name;
    $('enemy-portrait').textContent = combat.enemy.icon;
    const enemyPct = (combat.enemy.hp / combat.enemy.maxHp) * 100;
    $('combat-enemy-hp').style.width = `${enemyPct}%`;
  }
}

// Combat event listeners
combat.on('combatStart', (data) => {
  $('initiative-order').innerHTML = data.turnOrder.map((name, i) => 
    `<span class="initiative-token ${i === 0 ? 'active' : ''}">${name}</span>`
  ).join('');
  $('combat-log').innerHTML = '';
  updateCombatHP();
  setCombatButtonsEnabled(data.playerFirst);
});

combat.on('combatLog', (entry) => {
  const log = $('combat-log');
  const div = document.createElement('div');
  div.className = `combat-log-entry ${entry.type}`;
  div.textContent = entry.text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
});

combat.on('diceRoll', (data) => {
  addDiceLogEntry(data);
  showDiceAnimation(data);
});

combat.on('enemyDamage', () => {
  updateCombatHP();
  $('enemy-combatant').classList.add('shake');
  setTimeout(() => $('enemy-combatant').classList.remove('shake'), 500);
});

combat.on('playerDamage', () => {
  updateCombatHP();
  updateHPBar();
  $('player-combatant').classList.add('shake');
  setTimeout(() => $('player-combatant').classList.remove('shake'), 500);
});

combat.on('turnChange', (data) => {
  setCombatButtonsEnabled(data.playerTurn);
});

combat.on('combatEnd', async (data) => {
  setCombatButtonsEnabled(false);
  
  setTimeout(async () => {
    $('combat-overlay').classList.add('hidden');
    game.setPhase(PHASES.EXPLORATION);
    updateHPBar();
    updateXPBar();
    updateCharacterSidebar();
    
    if (data.died) {
      // Player was defeated — heal them back to partial HP
      game.heal(Math.floor(game.character.maxHp * 0.3));
      updateHPBar();
    }
    
    showTyping(true);
    const response = await story.generatePostCombat(data.won, data.enemy?.name || 'the enemy');
    showTyping(false);
    handleStoryResponse(response);
  }, 2000);
});

// Combat button handlers
$$('.btn-combat').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action === 'attack') combat.playerAttack();
    else if (action === 'defend') combat.playerDefend();
    else if (action === 'magic') combat.playerMagic();
    else if (action === 'flee') combat.playerFlee();
  });
});

function setCombatButtonsEnabled(enabled) {
  $$('.btn-combat').forEach(btn => btn.disabled = !enabled);
}

// ============================================
// DICE LOG
// ============================================
function addDiceLogEntry(data) {
  const log = $('dice-log');
  // Remove empty text
  const emptyText = log.querySelector('.empty-text');
  if (emptyText) emptyText.remove();
  
  const entry = document.createElement('div');
  const isCrit = data.result === 20;
  const isFail = data.result === 1;
  entry.className = `dice-entry ${isCrit ? 'crit' : ''} ${isFail ? 'fail' : ''}`;
  entry.innerHTML = `
    <span class="dice-entry-icon">🎲</span>
    <span>${data.type}:</span>
    <span class="dice-entry-result">${data.result}${data.total !== data.result ? ` (${data.total})` : ''}</span>
    ${isCrit ? '<span>⭐ CRIT!</span>' : ''}
    ${isFail ? '<span>💀 FUMBLE</span>' : ''}
  `;
  
  log.insertBefore(entry, log.firstChild);
  
  // Keep max 20 entries
  while (log.children.length > 20) {
    log.removeChild(log.lastChild);
  }
}

function showDiceAnimation(data) {
  const display = $('dice-display');
  const result = $('dice-result');
  
  display.classList.remove('hidden');
  result.textContent = data.result;
  result.style.animation = 'none';
  result.offsetHeight; // Reflow
  result.style.animation = 'diceReveal 0.5s ease';
  
  setTimeout(() => display.classList.add('hidden'), 1500);
}

// ============================================
// GAME STATE EVENT LISTENERS
// ============================================
game.on('hpChange', () => {
  updateHPBar();
});

game.on('xpChange', () => {
  updateXPBar();
});

game.on('levelUp', (char) => {
  showToast(`🎉 LEVEL UP! You are now level ${char.level}!`, 'success');
  updateCharacterSidebar();
});

game.on('inventoryUpdate', () => {
  updateInventoryDisplay();
});

game.on('questUpdate', () => {
  updateQuestLog();
});

game.on('playerDeath', () => {
  showToast('💀 You have fallen...', 'error');
});

// ============================================
// AMBIENT AUDIO (simple Web Audio)
// ============================================
let audioCtx = null;

function initAudio() {
  if (audioCtx || !game.settings.audioEnabled) return;
  
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Simple ambient drone
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    
    // Add subtle pad
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(160, audioCtx.currentTime);
    gain2.gain.setValueAtTime(0.008, audioCtx.currentTime);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start();
  } catch (e) {
    console.log('Audio not available');
  }
}

// Start audio on first user interaction
document.addEventListener('click', () => initAudio(), { once: true });

console.log('🐉 AI Dungeon Master loaded');
