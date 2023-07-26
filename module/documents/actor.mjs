/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class FabulaUltimaActor extends Actor {
  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.fabulaultima || {};

    this._calculateResources(actorData);
    this._handleStatusEffects(actorData);
    this._calculateOffenses(actorData);
    this._calculateDefenses(actorData);
    this._calculateInitOrInitMod(actorData);

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  _calculateOffenses(actorData) {
    const matt = actorData.system.derived.matt.bonus ?? 0;
    const ratt = actorData.system.derived.ratt.bonus ?? 0;
    const satt = actorData.system.derived.satt.bonus ?? 0;
    const bdam = actorData.system.derived.bdam.bonus ?? 0;
    actorData.system.derived.matt.value = matt;
    actorData.system.derived.ratt.value = ratt;
    actorData.system.derived.satt.value = satt;
    actorData.system.derived.bdam.value = bdam;
  }

  _calculateDefenses(actorData) {
    const equipped = [];
    actorData.items.forEach((item) => {
      if (item.system.isEquipped?.value) {
        equipped.push(item);
      }
    });

    const armor = equipped.find((item) => item.type === "armor");
    const dex = actorData.system.attributes.dex.current;
    const baseDef = armor
      ? armor.system.isMartial.value
        ? armor.system.def.value
        : armor.system.def.value + dex
      : dex;

    const otherArmors = equipped.filter(
      (item) => item.type === "shield" || item.type === "accessory"
    );
    const otherDef = otherArmors.reduce((def, item) => {
      def += item.system.def.value;

      return def;
    }, 0);
    const bonusDef = actorData.system.derived.def.bonus ?? 0;

    var def = baseDef + otherDef + bonusDef;

    const nonWeapons = equipped.filter((item) => item.type !== "weapon");
    const ins = actorData.system.attributes.ins.current;
    const otherMDef = nonWeapons.reduce((mdef, item) => {
      mdef += item.system.mdef.value;

      return mdef;
    }, 0);
    const bonusMDef = actorData.system.derived.mdef.bonus ?? 0;

    var mdef = ins + otherMDef + bonusMDef;

    const dred = actorData.system.derived.dred.value + actorData.system.derived.dred.bonus;

    if (actorData.system.derived.def.override) {
      def = Math.max(def, actorData.system.derived.def.override);
    }
    if (actorData.system.derived.mdef.override) {
      mdef = Math.max(def, actorData.system.derived.mdef.override);
    }

    actorData.system.derived.def.value = def;
    actorData.system.derived.mdef.value = mdef;
    actorData.system.derived.dred.value = dred;
  }

  _calculateResources(actorData) {
    const systemData = actorData.system;
    const classes = actorData.items.filter((item) => item.type === "class");
    if (actorData.type === "character") {
      var levelCalc = 0;
      for (let i = 0; i < classes.length; i++) {
        levelCalc += classes[i].system.level.value;
      }
      systemData.level.value = levelCalc;
    }
    const classesWithHp = classes.filter(
      (item) => item.system.benefits.hp.value
    );
    const classesWithMp = classes.filter(
      (item) => item.system.benefits.mp.value
    );
    const classesWithIp = classes.filter(
      (item) => item.system.benefits.ip.value
    );
    const hpMultiplier =
      actorData.type !== "npc"
        ? 1
        : systemData.isChampion.value !== 1
          ? systemData.isChampion.value
          : systemData.isElite.value
            ? 2
            : 1;
    const mpMultiplier =
      actorData.type !== "npc" ? 1 : systemData.isChampion.value !== 1 ? 2 : 1;
    const levelVal =
      actorData.type === "npc"
        ? systemData.level.value * 2
        : systemData.level.value;
    systemData.resources.hp.max =
      (systemData.attributes.mig.base * 5 +
        levelVal +
        classesWithHp.length * 5 +
        systemData.resources.hp.bonus) *
      hpMultiplier;
    if (actorData.type === "npc") {
      if (actorData.system.isCompanion.value) {
        systemData.resources.hp.max = ((actorData.system.companion.skill * systemData.attributes.mig.base) + (Math.floor(actorData.system.companion.master * 0.5)) + systemData.resources.hp.bonus);
      }
    }
    systemData.resources.hp.crisis =
      (Math.floor(systemData.resources.hp.max / 2));
    systemData.resources.hp.percent =
      (systemData.resources.hp.value / systemData.resources.hp.max).toFixed(2);
    systemData.resources.mp.max =
      (systemData.attributes.wlp.base * 5 +
        systemData.level.value +
        classesWithMp.length * 5 +
        systemData.resources.mp.bonus) *
      mpMultiplier;
    if (actorData.type === "character") {
      systemData.resources.ip.max = 6 + classesWithIp.length * 2;
    }
  }

  _handleStatusEffects(actorData) {
    const systemData = actorData.system;

    const statMods = {};

    Object.keys(systemData.attributes).forEach(
      (attrKey) => (statMods[attrKey] = 0)
    );
    actorData.temporaryEffects.forEach((effect) => {
      const status = CONFIG.statusEffects.find(
        (status) => status.id === effect.flags.core.statusId
      );

      if (status) {
        if (["dex", "ins", "mig", "wlp"].includes(status.stats[0])) {
          status.stats.forEach((attrKey) => (statMods[attrKey] += status.mod));
        }
        else if (["def", "mdef"].includes(status.stats[0])) {
          if (status.stats[0] === "def") {
            systemData.derived.def.override = status.mod;
          }
          else {
            systemData.derived.mdef.override = status.mod;
          }
        }
      }
    });
    for (let [key, attr] of Object.entries(systemData.attributes)) {
      let newVal = attr.base + statMods[key];
      if (newVal > 12) {
        newVal = 12;
      }
      if (newVal < 6) {
        newVal = 6;
      }

      attr.current = newVal;
    }
  }

  _calculateInitOrInitMod(actorData) {
    const equipped = actorData.items.filter(
      (item) =>
        item.system.isEquipped?.value &&
        ["armor", "shield", "accessory"].includes(item.type)
    );
    const initMod = equipped.reduce((mod, item) => {
      const itemMod = item.system.init?.value ?? 0;
      return (mod += itemMod);
    }, 0);
    const initBonus = actorData.system.derived.init?.bonus ?? 0;
    const eliteOrChampBonus =
      actorData.type !== "npc"
        ? 0
        : actorData.system.isChampion.value !== 1
          ? actorData.system.isChampion.value
          : actorData.system.isElite.value
            ? 2
            : 0;

    actorData.system.derived.init.value =
      actorData.type === "npc"
        ? initMod +
        (actorData.system.attributes.dex.base +
          actorData.system.attributes.ins.base) /
        2 +
        initBonus +
        eliteOrChampBonus
        : initMod + initBonus;
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== "character") return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;

    // Loop through ability scores, and add their modifiers to our sheet output.
    // for (let [key, ability] of Object.entries(systemData.abilities)) {
    // Calculate the modifier using d20 rules.
    // ability.mod = Math.floor((ability.value - 10) / 2);
    // }
  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== "npc") return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== "character") return;

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    // if (data.abilities) {
    //   for (let [k, v] of Object.entries(data.abilities)) {
    //     data[k] = foundry.utils.deepClone(v);
    //   }
    // }

    // Add level for easier access, or fall back to 0.
    // if (data.attributes.level) {
    //   data.lvl = data.attributes.level.value ?? 0;
    // }
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== "npc") return;

    // Process additional NPC data here.
  }

  async _preUpdate(changed, options, user) {
    const changedHP = changed.system?.resources?.hp;
    const currentHP = this.system.resources.hp;
    const changedMP = changed.system?.resources?.mp;
    const currentMP = this.system.resources.mp;
    if (typeof changedHP?.value === "number" && currentHP) {
      const hpChange = changedHP.value - currentHP.value;
      const levelChanged = !!changed.system && "level" in changed.system;
      if (hpChange !== 0 && !levelChanged) options.damageTaken = hpChange * -1;
    }
    if (typeof changedMP?.value === "number" && currentMP) {
      const mpChange = changedMP.value - currentMP.value;
      const levelChanged = !!changed.system && "level" in changed.system;
      if (mpChange !== 0 && !levelChanged) options.mindTaken = mpChange * -1;
    }

    await super._preUpdate(changed, options, user);
  }

  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    //console.log(changed);

    if (options.damageTaken) {
      this.showFloatyText(options.damageTaken, 'hp');
    }
    else if (options.mindTaken) {
      this.showFloatyText(options.mindTaken, 'mp')
    }
  }

  async showFloatyText(input, pool) {
    if (_token?.x) {
      let scrollingTextArgs;
      const gridSize = canvas.scene.grid.size;
      if (typeof input === "number") {
        let fillCol = '';
        if (pool === "hp") {
          fillCol = input < 0 ? "lightgreen" : "white";
        }
        else {
          fillCol = input < 0 ? "lightblue" : "darkblue";
        }
        scrollingTextArgs = [
          { x: _token.x + gridSize / 2, y: _token.y + gridSize - 20 },
          Math.abs(input),
          {
            fill: fillCol,
            fontSize: 32,
            stroke: 0x000000,
            strokeThickness: 4,
          },
        ];
      }
      if (!scrollingTextArgs) return;

      await _token._animation;
      await canvas.interface?.createScrollingText(...scrollingTextArgs);
    }
    else {
      return;
    }
  }
  _preCreate(data, user) {
    super._preCreate(data, user);

    if (data.type === "character") {
      let initData = {
        prototypeToken: {
          displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
          displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
          disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
          actorLink: true,
          sight: {
            enabled: true,
          },

        },
      };
      this.updateSource(initData);
      console.log(this);
    }
    else {
      let initData = {
        prototypeToken: {
          displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
          displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
          disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
        },
      };
      this.updateSource(initData);
      console.log(this);
    }
  }
}

/**
 *         "flags.barbrawl.resourceBars": {
          "bar1": {
            id: "bar1",
            mincolor: "#FF0000",
            maxcolor: "#80FF00",
            position: "bottom-inner",
            attribute: "resources.hp",
            visibility: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
          },
          "bar2": {
            id: "bar2",
            mincolor: "#000080",
            maxcolor: "#80B3FF",
            position: "top-inner",
            attribute: "resources.mp",
            visibility: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
            indentRight: 50,
            shareHeight: true,
          },
          "bar3": {
            id: "bar3",
            mincolor: "#000000",
            maxcolor: "#FFFFFF",
            position: "top-inner",
            attribute: "resources.ip",
            visibility: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
            indentLeft: 50,
            shareHeight: true,
          },
        },
 */