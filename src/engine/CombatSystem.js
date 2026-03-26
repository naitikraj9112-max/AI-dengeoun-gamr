/**
 * CombatSystem — D&D 5e-inspired turn-based combat
 */
import { DiceRoller } from './DiceRoller.js';

// Enemy templates
const ENEMY_TEMPLATES = {
  goblin:   { name: 'Goblin',    icon: '👺', hp: 12, ac: 13, attackMod: 4, damage: '1d6+2',  xp: 30 },
  skeleton: { name: 'Skeleton',  icon: '💀', hp: 15, ac: 13, attackMod: 4, damage: '1d6+2',  xp: 35 },
  wolf:     { name: 'Dire Wolf', icon: '🐺', hp: 20, ac: 13, attackMod: 5, damage: '2d6+3',  xp: 50 },
  bandit:   { name: 'Bandit',    icon: '🗡️', hp: 16, ac: 12, attackMod: 3, damage: '1d8+1',  xp: 40 },
  orc:      { name: 'Orc',       icon: '👹', hp: 25, ac: 13, attackMod: 5, damage: '1d12+3', xp: 60 },
  spider:   { name: 'Giant Spider', icon: '🕷️', hp: 18, ac: 14, attackMod: 5, damage: '1d8+3', xp: 50 },
  troll:    { name: 'Troll',     icon: '🧌', hp: 40, ac: 15, attackMod: 7, damage: '2d6+4',  xp: 120 },
  dragon:   { name: 'Young Dragon', icon: '🐉', hp: 60, ac: 17, attackMod: 9, damage: '2d10+5', xp: 250 },
};

export class CombatSystem {
  constructor(gameState) {
    this.gameState = gameState;
    this.active = false;
    this.playerTurn = true;
    this.enemy = null;
    this.turnOrder = [];
    this.log = [];
    this.isDefending = false;
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  /**
   * Get an enemy appropriate for player level
   */
  getEnemyForLevel(level) {
    const keys = Object.keys(ENEMY_TEMPLATES);
    let pool;
    if (level <= 2) pool = ['goblin', 'skeleton', 'bandit', 'spider'];
    else if (level <= 4) pool = ['wolf', 'orc', 'bandit', 'spider'];
    else if (level <= 6) pool = ['orc', 'troll', 'wolf'];
    else pool = ['troll', 'dragon'];
    
    const key = pool[Math.floor(Math.random() * pool.length)];
    const template = ENEMY_TEMPLATES[key];
    
    // Scale slightly with level
    const scale = 1 + (level - 1) * 0.15;
    return {
      ...template,
      maxHp: Math.round(template.hp * scale),
      hp: Math.round(template.hp * scale),
      ac: template.ac + Math.floor(level / 3),
      attackMod: template.attackMod + Math.floor(level / 4),
    };
  }

  /**
   * Start combat encounter
   */
  startCombat(enemyOverride = null) {
    this.active = true;
    this.log = [];
    this.isDefending = false;
    
    this.enemy = enemyOverride || this.getEnemyForLevel(this.gameState.character.level);
    
    // Roll initiative
    const playerInit = DiceRoller.rollInitiative(this.gameState.character.stats.DEX);
    const enemyInit = DiceRoller.rollInitiative(10); // enemies have 10 DEX by default
    
    this.playerTurn = playerInit.total >= enemyInit.total;
    this.turnOrder = this.playerTurn
      ? [this.gameState.character.name, this.enemy.name]
      : [this.enemy.name, this.gameState.character.name];

    this.addLog(`⚔️ Combat begins! ${this.enemy.icon} ${this.enemy.name} appears!`);
    this.addLog(`🎲 Initiative — ${this.gameState.character.name}: ${playerInit.total} vs ${this.enemy.name}: ${enemyInit.total}`);
    this.addLog(`${this.playerTurn ? '🟢 Your turn!' : '🔴 Enemy attacks first!'}`);
    
    this.emit('combatStart', {
      enemy: this.enemy,
      turnOrder: this.turnOrder,
      playerFirst: this.playerTurn,
    });

    // If enemy goes first, auto-attack after delay
    if (!this.playerTurn) {
      setTimeout(() => this.enemyTurn(), 1500);
    }
  }

  addLog(text, type = 'normal') {
    const entry = { text, type, time: Date.now() };
    this.log.push(entry);
    this.emit('combatLog', entry);
  }

  /**
   * Player attacks
   */
  playerAttack() {
    if (!this.active || !this.playerTurn) return;

    const strMod = DiceRoller.modifier(this.gameState.character.stats.STR);
    const dexMod = DiceRoller.modifier(this.gameState.character.stats.DEX);
    const cls = this.gameState.character.class;
    const attackMod = (cls?.primaryStat === 'DEX') ? dexMod : strMod;
    
    const attack = DiceRoller.rollAttack(attackMod);
    
    this.emit('diceRoll', { type: 'd20', result: attack.roll, total: attack.total });

    if (attack.isFumble) {
      this.addLog(`🎲 Attack roll: ${attack.roll} — Critical miss! You stumble!`, 'miss');
    } else if (attack.isCrit || attack.total >= this.enemy.ac) {
      // Hit!
      const weapon = this.gameState.character.inventory.find(i => i.type === 'weapon');
      const damageDice = weapon?.damage || '1d6';
      let damageRoll = DiceRoller.parse(damageDice);
      let totalDamage = damageRoll.total + attackMod;
      
      if (attack.isCrit) {
        totalDamage *= 2;
        this.addLog(`🎲 Attack: ${attack.roll} — ⭐ CRITICAL HIT! ${totalDamage} damage!`, 'crit');
      } else {
        this.addLog(`🎲 Attack: ${attack.total} vs AC ${this.enemy.ac} — Hit! ${totalDamage} damage!`, 'hit');
      }
      
      this.enemy.hp = Math.max(0, this.enemy.hp - totalDamage);
      this.emit('enemyDamage', { hp: this.enemy.hp, maxHp: this.enemy.maxHp, damage: totalDamage });
      
      if (this.enemy.hp <= 0) {
        this.victory();
        return;
      }
    } else {
      this.addLog(`🎲 Attack: ${attack.total} vs AC ${this.enemy.ac} — Miss!`, 'miss');
    }

    this.playerTurn = false;
    this.isDefending = false;
    setTimeout(() => this.enemyTurn(), 1200);
  }

  /**
   * Player defends (bonus AC this turn)
   */
  playerDefend() {
    if (!this.active || !this.playerTurn) return;
    this.isDefending = true;
    this.addLog(`🛡️ You brace for the attack! (+5 AC this turn)`, 'normal');
    
    this.playerTurn = false;
    setTimeout(() => this.enemyTurn(), 1200);
  }

  /**
   * Player uses magic
   */
  playerMagic() {
    if (!this.active || !this.playerTurn) return;
    
    const intMod = DiceRoller.modifier(this.gameState.character.stats.INT);
    const wisMod = DiceRoller.modifier(this.gameState.character.stats.WIS);
    const chaMod = DiceRoller.modifier(this.gameState.character.stats.CHA);
    const magicMod = Math.max(intMod, wisMod, chaMod);
    
    const attack = DiceRoller.rollAttack(magicMod);
    this.emit('diceRoll', { type: 'd20', result: attack.roll, total: attack.total });

    if (attack.isFumble) {
      this.addLog(`🎲 Spell fizzles! Critical failure!`, 'miss');
    } else if (attack.isCrit || attack.total >= this.enemy.ac) {
      let damageRoll = DiceRoller.parse('2d6');
      let totalDamage = damageRoll.total + magicMod;
      if (attack.isCrit) totalDamage *= 2;
      
      if (attack.isCrit) {
        this.addLog(`✨ Spell: ${attack.roll} — ⭐ CRITICAL! Devastating magic deals ${totalDamage} damage!`, 'crit');
      } else {
        this.addLog(`✨ Spell: ${attack.total} vs AC ${this.enemy.ac} — Hit! ${totalDamage} magical damage!`, 'hit');
      }
      
      this.enemy.hp = Math.max(0, this.enemy.hp - totalDamage);
      this.emit('enemyDamage', { hp: this.enemy.hp, maxHp: this.enemy.maxHp, damage: totalDamage });
      
      if (this.enemy.hp <= 0) {
        this.victory();
        return;
      }
    } else {
      this.addLog(`✨ Spell: ${attack.total} vs AC ${this.enemy.ac} — The spell misses!`, 'miss');
    }

    this.playerTurn = false;
    this.isDefending = false;
    setTimeout(() => this.enemyTurn(), 1200);
  }

  /**
   * Player attempts to flee
   */
  playerFlee() {
    if (!this.active || !this.playerTurn) return;
    
    const dexMod = DiceRoller.modifier(this.gameState.character.stats.DEX);
    const roll = DiceRoller.rollD20();
    const total = roll + dexMod;
    
    this.emit('diceRoll', { type: 'd20', result: roll, total });

    if (total >= 12) {
      this.addLog(`🏃 Flee check: ${total} — You escape successfully!`, 'normal');
      this.endCombat(false);
    } else {
      this.addLog(`🏃 Flee check: ${total} — Failed to escape!`, 'miss');
      this.playerTurn = false;
      this.isDefending = false;
      setTimeout(() => this.enemyTurn(), 1200);
    }
  }

  /**
   * Enemy turn
   */
  enemyTurn() {
    if (!this.active || this.enemy.hp <= 0) return;
    
    const attack = DiceRoller.rollAttack(this.enemy.attackMod);
    const playerAC = this.gameState.character.ac + (this.isDefending ? 5 : 0);
    
    this.emit('diceRoll', { type: 'd20', result: attack.roll, total: attack.total });

    if (attack.isFumble) {
      this.addLog(`${this.enemy.icon} ${this.enemy.name} attacks... Critical miss!`, 'miss');
    } else if (attack.isCrit || attack.total >= playerAC) {
      let damageRoll = DiceRoller.parse(this.enemy.damage);
      let totalDamage = damageRoll.total;
      if (attack.isCrit) totalDamage *= 2;
      
      if (attack.isCrit) {
        this.addLog(`${this.enemy.icon} ${this.enemy.name} — ⭐ CRITICAL HIT! ${totalDamage} damage!`, 'crit');
      } else {
        this.addLog(`${this.enemy.icon} ${this.enemy.name} attacks: ${attack.total} vs AC ${playerAC} — Hit! ${totalDamage} damage!`, 'hit');
      }
      
      this.gameState.takeDamage(totalDamage);
      this.emit('playerDamage', { hp: this.gameState.character.hp, maxHp: this.gameState.character.maxHp, damage: totalDamage });
      
      if (this.gameState.character.hp <= 0) {
        this.defeat();
        return;
      }
    } else {
      this.addLog(`${this.enemy.icon} ${this.enemy.name} attacks: ${attack.total} vs AC ${playerAC} — Miss!`, 'miss');
    }

    this.playerTurn = true;
    this.isDefending = false;
    this.addLog('🟢 Your turn!');
    this.emit('turnChange', { playerTurn: true });
  }

  /**
   * Player wins
   */
  victory() {
    this.addLog(`🏆 Victory! ${this.enemy.name} is defeated!`, 'crit');
    const xpGained = this.enemy.xp || 30;
    this.addLog(`⭐ Gained ${xpGained} XP!`, 'normal');
    this.gameState.gainXP(xpGained);
    this.endCombat(true);
  }

  /**
   * Player dies
   */
  defeat() {
    this.addLog(`💀 You have fallen in battle...`, 'hit');
    this.endCombat(false, true);
  }

  endCombat(won, died = false) {
    this.active = false;
    this.emit('combatEnd', { won, died, enemy: this.enemy });
  }
}
