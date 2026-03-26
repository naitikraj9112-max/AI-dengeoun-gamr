/**
 * DiceRoller — D&D dice simulation
 */
export class DiceRoller {
  static roll(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  static rollD4()   { return this.roll(4); }
  static rollD6()   { return this.roll(6); }
  static rollD8()   { return this.roll(8); }
  static rollD10()  { return this.roll(10); }
  static rollD12()  { return this.roll(12); }
  static rollD20()  { return this.roll(20); }
  static rollD100() { return this.roll(100); }

  /**
   * Roll multiple dice: e.g. "2d6+3"
   * Returns { rolls: [3, 5], modifier: 3, total: 11 }
   */
  static parse(notation) {
    const match = notation.toLowerCase().match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!match) return { rolls: [this.rollD20()], modifier: 0, total: this.rollD20() };
    
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;
    
    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(this.roll(sides));
    }
    
    const sum = rolls.reduce((a, b) => a + b, 0);
    return { rolls, modifier, total: sum + modifier };
  }

  /**
   * 4d6 drop lowest for stat generation
   */
  static rollStat() {
    const rolls = [this.rollD6(), this.rollD6(), this.rollD6(), this.rollD6()];
    rolls.sort((a, b) => a - b);
    return rolls[1] + rolls[2] + rolls[3]; // drop lowest
  }

  /**
   * Roll a full set of 6 stats
   */
  static rollStatArray() {
    return Array.from({ length: 6 }, () => this.rollStat());
  }

  /**
   * Calculate ability modifier from stat value
   */
  static modifier(stat) {
    return Math.floor((stat - 10) / 2);
  }

  /**
   * Format modifier as string: "+2" or "-1"
   */
  static modifierStr(stat) {
    const mod = this.modifier(stat);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  /**
   * Roll initiative: d20 + DEX modifier
   */
  static rollInitiative(dexStat) {
    const roll = this.rollD20();
    const mod = this.modifier(dexStat);
    return { roll, modifier: mod, total: roll + mod };
  }

  /**
   * Roll attack: d20 + modifier vs AC
   */
  static rollAttack(attackMod) {
    const roll = this.rollD20();
    const isCrit = roll === 20;
    const isFumble = roll === 1;
    return {
      roll,
      modifier: attackMod,
      total: roll + attackMod,
      isCrit,
      isFumble
    };
  }
}
