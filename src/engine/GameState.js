/**
 * GameState — Central state machine for the D&D game
 */
import { DiceRoller } from './DiceRoller.js';

// D&D Races
export const RACES = [
  { id: 'human',    name: 'Human',    icon: '🧑', desc: 'Versatile & adaptable', bonus: { any: 1 } },
  { id: 'elf',      name: 'Elf',      icon: '🧝', desc: 'Graceful & perceptive', bonus: { DEX: 2 } },
  { id: 'dwarf',    name: 'Dwarf',    icon: '⛏️', desc: 'Tough & resilient',     bonus: { CON: 2 } },
  { id: 'halfling', name: 'Halfling', icon: '🍀', desc: 'Nimble & lucky',        bonus: { DEX: 2 } },
  { id: 'orc',      name: 'Half-Orc', icon: '💪', desc: 'Strong & fierce',       bonus: { STR: 2 } },
  { id: 'tiefling', name: 'Tiefling', icon: '😈', desc: 'Cunning & charismatic', bonus: { CHA: 2 } },
  { id: 'dragonborn', name: 'Dragonborn', icon: '🐲', desc: 'Proud & powerful', bonus: { STR: 2 } },
  { id: 'gnome',    name: 'Gnome',    icon: '🧪', desc: 'Clever & inventive',    bonus: { INT: 2 } },
];

// D&D Classes
export const CLASSES = [
  { id: 'fighter', name: 'Fighter',  icon: '⚔️', desc: 'Master of combat',   hitDie: 10, primaryStat: 'STR' },
  { id: 'wizard',  name: 'Wizard',   icon: '🧙', desc: 'Arcane spellcaster',  hitDie: 6,  primaryStat: 'INT' },
  { id: 'rogue',   name: 'Rogue',    icon: '🗡️', desc: 'Stealthy trickster',  hitDie: 8,  primaryStat: 'DEX' },
  { id: 'cleric',  name: 'Cleric',   icon: '✝️', desc: 'Divine healer',       hitDie: 8,  primaryStat: 'WIS' },
  { id: 'ranger',  name: 'Ranger',   icon: '🏹', desc: 'Wilderness hunter',   hitDie: 10, primaryStat: 'DEX' },
  { id: 'barbarian', name: 'Barbarian', icon: '🪓', desc: 'Raging warrior', hitDie: 12, primaryStat: 'STR' },
  { id: 'paladin', name: 'Paladin',  icon: '🛡️', desc: 'Holy champion',      hitDie: 10, primaryStat: 'STR' },
  { id: 'sorcerer', name: 'Sorcerer', icon: '✨', desc: 'Innate magic',     hitDie: 6,  primaryStat: 'CHA' },
];

const STAT_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

// Game phases
export const PHASES = {
  LOADING: 'LOADING',
  CHARACTER_CREATION: 'CHARACTER_CREATION',
  EXPLORATION: 'EXPLORATION',
  COMBAT: 'COMBAT',
  DIALOGUE: 'DIALOGUE',
  GAME_OVER: 'GAME_OVER',
};

export class GameState {
  constructor() {
    this.phase = PHASES.LOADING;
    this.turn = 1;
    this.listeners = {};
    
    // Character
    this.character = {
      name: '',
      race: null,
      class: null,
      level: 1,
      xp: 0,
      xpToLevel: 100,
      stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      maxHp: 10,
      hp: 10,
      ac: 10,
      inventory: [],
      equipment: {},
      gold: 10,
    };

    // Story context
    this.storyHistory = [];
    this.currentScene = '';
    this.questLog = [];
    
    // Combat
    this.combat = null;
    
    // Settings
    this.settings = {
      apiKey: localStorage.getItem('gemini_api_key') || '',
      textSpeed: parseInt(localStorage.getItem('text_speed') || '35'),
      audioEnabled: localStorage.getItem('audio_enabled') !== 'false',
      sfxEnabled: localStorage.getItem('sfx_enabled') !== 'false',
    };
  }

  // --- Event system ---
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // --- Phase management ---
  setPhase(phase) {
    const prevPhase = this.phase;
    this.phase = phase;
    this.emit('phaseChange', { from: prevPhase, to: phase });
  }

  // --- Character creation ---
  setCharacterName(name) {
    this.character.name = name;
  }

  setCharacterRace(raceId) {
    this.character.race = RACES.find(r => r.id === raceId);
  }

  setCharacterClass(classId) {
    this.character.class = CLASSES.find(c => c.id === classId);
  }

  setCharacterStats(statArray) {
    STAT_NAMES.forEach((name, i) => {
      this.character.stats[name] = statArray[i];
    });
    // Apply racial bonus
    if (this.character.race?.bonus) {
      Object.entries(this.character.race.bonus).forEach(([stat, val]) => {
        if (stat === 'any') {
          this.character.stats.STR += val;
          this.character.stats.DEX += val;
          this.character.stats.CON += val;
          this.character.stats.INT += val;
          this.character.stats.WIS += val;
          this.character.stats.CHA += val;
        } else {
          this.character.stats[stat] += val;
        }
      });
    }
  }

  finalizeCharacter() {
    const cls = this.character.class;
    if (cls) {
      const conMod = DiceRoller.modifier(this.character.stats.CON);
      this.character.maxHp = cls.hitDie + conMod;
      this.character.hp = this.character.maxHp;
      this.character.ac = 10 + DiceRoller.modifier(this.character.stats.DEX);
    }
    // Starting items
    this.character.inventory = [
      { name: 'Health Potion', icon: '🧪', type: 'consumable', effect: 'Restore 2d4+2 HP' },
      { name: 'Torch', icon: '🔥', type: 'tool', effect: 'Illuminate dark areas' },
    ];

    if (cls?.primaryStat === 'STR') {
      this.character.inventory.push({ name: 'Iron Sword', icon: '⚔️', type: 'weapon', damage: '1d8' });
    } else if (cls?.primaryStat === 'DEX') {
      this.character.inventory.push({ name: 'Short Bow', icon: '🏹', type: 'weapon', damage: '1d6' });
    } else if (cls?.primaryStat === 'INT' || cls?.primaryStat === 'CHA') {
      this.character.inventory.push({ name: 'Arcane Staff', icon: '🪄', type: 'weapon', damage: '1d6' });
    } else {
      this.character.inventory.push({ name: 'Mace', icon: '🔨', type: 'weapon', damage: '1d6' });
    }

    this.emit('characterReady', this.character);
  }

  // --- Story ---
  addStoryEntry(entry) {
    this.storyHistory.push(entry);
    this.emit('storyUpdate', entry);
  }

  getStoryContext(maxEntries = 12) {
    return this.storyHistory.slice(-maxEntries).map(e => {
      if (e.type === 'narrator') return `[Narrator]: ${e.text}`;
      if (e.type === 'action') return `[Player Action]: ${e.text}`;
      if (e.type === 'dialogue') return `[${e.npcName}]: ${e.text}`;
      if (e.type === 'combat') return `[Combat]: ${e.text}`;
      return e.text;
    }).join('\n');
  }

  // --- Inventory ---
  addItem(item) {
    this.character.inventory.push(item);
    this.emit('inventoryUpdate', this.character.inventory);
  }

  removeItem(index) {
    this.character.inventory.splice(index, 1);
    this.emit('inventoryUpdate', this.character.inventory);
  }

  // --- HP ---
  takeDamage(amount) {
    this.character.hp = Math.max(0, this.character.hp - amount);
    this.emit('hpChange', { hp: this.character.hp, maxHp: this.character.maxHp });
    if (this.character.hp <= 0) {
      this.emit('playerDeath');
    }
  }

  heal(amount) {
    this.character.hp = Math.min(this.character.maxHp, this.character.hp + amount);
    this.emit('hpChange', { hp: this.character.hp, maxHp: this.character.maxHp });
  }

  // --- XP ---
  gainXP(amount) {
    this.character.xp += amount;
    if (this.character.xp >= this.character.xpToLevel) {
      this.character.xp -= this.character.xpToLevel;
      this.character.level++;
      this.character.xpToLevel = Math.floor(this.character.xpToLevel * 1.5);
      const hpGain = DiceRoller.roll(this.character.class?.hitDie || 8) + DiceRoller.modifier(this.character.stats.CON);
      this.character.maxHp += Math.max(1, hpGain);
      this.character.hp = this.character.maxHp;
      this.emit('levelUp', this.character);
    }
    this.emit('xpChange', { xp: this.character.xp, xpToLevel: this.character.xpToLevel });
  }

  // --- Quest ---
  addQuest(quest) {
    this.questLog.push({ ...quest, completed: false });
    this.emit('questUpdate', this.questLog);
  }

  completeQuest(index) {
    if (this.questLog[index]) {
      this.questLog[index].completed = true;
      this.emit('questUpdate', this.questLog);
    }
  }

  // --- Settings ---
  saveSettings(settings) {
    Object.assign(this.settings, settings);
    if (settings.apiKey !== undefined) localStorage.setItem('gemini_api_key', settings.apiKey);
    if (settings.textSpeed !== undefined) localStorage.setItem('text_speed', String(settings.textSpeed));
    if (settings.audioEnabled !== undefined) localStorage.setItem('audio_enabled', String(settings.audioEnabled));
    if (settings.sfxEnabled !== undefined) localStorage.setItem('sfx_enabled', String(settings.sfxEnabled));
    this.emit('settingsUpdate', this.settings);
  }

  // --- Turns ---
  nextTurn() {
    this.turn++;
    this.emit('turnChange', this.turn);
  }

  // --- Serialization ---
  getCharacterSummary() {
    const c = this.character;
    return `${c.name}, Level ${c.level} ${c.race?.name || ''} ${c.class?.name || ''}, HP: ${c.hp}/${c.maxHp}, AC: ${c.ac}, STR: ${c.stats.STR}, DEX: ${c.stats.DEX}, CON: ${c.stats.CON}, INT: ${c.stats.INT}, WIS: ${c.stats.WIS}, CHA: ${c.stats.CHA}`;
  }
}
