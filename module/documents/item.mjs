/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class FabulaUltimaItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
  getRollData() {
    // If present, return the actor's roll data.
    if (!this.actor) return null;
    const rollData = this.actor.getRollData();
    // Grab the item's system data as well.
    rollData.item = foundry.utils.deepClone(this.system);

    return rollData;
  }

  getWeaponDisplayData() {
    if (this.type !== "weapon") {
      return false;
    }


    const qualText = this.system.quality?.value
      ? this.system.quality.value
      : "No Quality.";
    const qualityString = `${this.system.hands.value} ⬩ ${this.system.type.value} ⬩ ${qualText}`;
    let attackString = `【${this.system.attributes.primary.value.toUpperCase()} + ${this.system.attributes.secondary.value.toUpperCase()}】`;
    if (this.system.accuracy.value > 0) {
      attackString += ` +${this.system.accuracy.value}`;
    }
    var damGlyph = '';
    switch (this.system.damageType.value) {
      case 'physical':
        damGlyph = "'";
        break;
      case 'air':
        damGlyph = 'a';
        break;
      case 'bolt':
        damGlyph = 'b'
        break;
      case 'dark':
        damGlyph = 'd';
        break;
      case 'earth':
        damGlyph = 'E';
        break;
      case 'fire':
        damGlyph = 'f';
        break;
      case 'ice':
        damGlyph = 'i';
        break;
      case 'light':
        damGlyph = 'l';
        break;
      case 'poison':
        damGlyph = 't';
        break;
      default:
        damGlyph = 'c';
        break;
    }
    const damageString = `【HR + ${this.system.damage.value}】<span class="glyph" title="${this.system.damageType.value}">${damGlyph}</span>`;

    return {
      attackString,
      damageString,
      qualityString,
    };
  }

  async getSingleRollForItem(usedItem = null, addName = false) {
    const item = usedItem ?? this;
    let content = "";

    const hasDamage =
      item.type === "weapon" ||
      (["spell", "skill", "miscAbility"].includes(item.type) &&
        item.system.rollInfo?.damage?.hasDamage?.value);

    const attrs =
      item.type === "weapon"
        ? item.system.attributes
        : item.system.rollInfo.attributes;
    let accVal =
      item.type === "weapon"
        ? item.system.accuracy.value
        : item.system.rollInfo.accuracy.value;
    accVal = accVal ?? 0;

    const primary = this.actor.system.attributes[attrs.primary.value].current;
    const secondary =
      this.actor.system.attributes[attrs.secondary.value].current;
    const roll = new Roll("1d@prim + 1d@sec + @mod", {
      prim: primary,
      sec: secondary,
      mod: accVal,
    });
    await roll.evaluate({ async: true });
    //roll.toMessage({
    //});
    const bonusAccVal = usedItem ? this.system.rollInfo.accuracy.value : 0;
    const bonusAccValString = bonusAccVal
      ? ` + ${bonusAccVal} (${this.type})`
      : "";

    let effectBonus = item.type === "weapon"
      ? item.system.type === "Melee"
        ? this.actor.system.derived.matt.value
        : item.system.type === "Ranged"
          ? this.actor.system.derived.ratt.value
          : this.actor.system.derived.matt.value
      : item.type === "spell"
        ? this.actor.system.derived.satt.value
        : 0;
    if (this.actor.system.isCompanion?.value) {
      effectBonus += this.actor.system.companion.skill;      
    }

    const effectBonusString = effectBonus ? ` + ${effectBonus}` : '';

    const acc = roll.total + bonusAccVal + effectBonus;
    const diceResults = roll.terms
      .filter((term) => term.results)
      .map((die) => die.results[0].result);
    const hands = item.type === "weapon" ? item.system.hands.value : "";
    const hr =
      this.system.rollInfo && this.system.rollInfo.useWeapon?.hrZero?.value
        ? 0
        : hands === "Dual-Wielding"
          ? 0
          : Math.max(...diceResults);
    const isFumble = diceResults[0] === 1 && diceResults[1] === 1;
    const isCrit =
      !isFumble && diceResults[0] === diceResults[1] && diceResults[0] >= 6;

    const accString = `${diceResults[0]
      } <strong>(${attrs.primary.value.toUpperCase()})</strong> + ${diceResults[1]
      } <strong>(${attrs.secondary.value.toUpperCase()})</strong> + ${accVal} <strong>(${item.type
      })</strong>${bonusAccValString}${effectBonusString}`;
    const fumbleString = isFumble ? "<strong>FUMBLE!</strong><br />" : "";
    const critString = isCrit ? "<strong>CRITICAL HIT!</strong><br />" : "";

    if (addName) {
      content += `<div class="card-section weapon-name"><div class="section-label">WEP</div><div class="section-content"><strong>${item.name}</strong></div></div>`;
    }

    content += `
    <div class="accuracy">
          <div class="accuracy-title">ACC</div>
          <div class="accuracy-content">
            <div class="crit-label">${critString}${fumbleString}</div>
            <div class="accuracy-label">
              ${accString}
            </div>
            <div class="accuracy-result">
              <span class="accuracy-result-label">
                <strong>
                  <span class="accuracy-result-number">${acc}</span> to hit!
                </strong>
              </span><br />
    `

    var hit = false;

    const targets = Array.from(game.user.targets);

    if (targets.length) {
      content += `<div class="targets-row">`;
      for (let i = 0; i < targets.length; i++) {
        var hitText = "miss";
        if (isFumble) {
          console.log("Fumble!");
          hitText = "fumble";
        }
        else if (isCrit) {
          hit = true;
          console.log("Crit!");
          hitText = "crit";
        }
        else if (acc > targets[i].actor.system.derived.def.value) {
          hit = true;
          console.log("Hit!");
          hitText = "hit";
        }
        content += `
            <div class="target-box ">
              <div class="target-name">${targets[i].name}</div>
              <div class="target-hit ${hitText}">${hitText}!</div>
            </div>
          `;
      }
      content += `</div>`;
    }
    else {
      hit = true;

    }

    content += `
        </div>
      </div>
    </div>`;

    if (hasDamage && hit) {
      let damVal =
        item.type === "weapon"
          ? item.system.damage.value
          : item.system.rollInfo.damage.value;
      damVal = damVal ?? 0;

      const bonusDamVal = usedItem ? this.system.rollInfo.damage.value : 0;
      const bonusDamUni = this.actor.system.derived.bdam.value ? this.actor.system.derived.bdam.value : 0;
      const bonusDamUniString = ` + ${bonusDamUni}`;
      const damage = hr + damVal + bonusDamVal + bonusDamUni;
      const damType =
        item.type === "weapon"
          ? item.system.damageType.value
          : item.system.rollInfo.damage.type.value;
      var damGlyph = '';
      switch (damType) {
        case 'physical':
          damGlyph = "'";
          break;
        case 'air':
          damGlyph = 'a';
          break;
        case 'bolt':
          damGlyph = 'b'
          break;
        case 'dark':
          damGlyph = 'd';
          break;
        case 'earth':
          damGlyph = 'E';
          break;
        case 'fire':
          damGlyph = 'f';
          break;
        case 'ice':
          damGlyph = 'i';
          break;
        case 'light':
          damGlyph = 'l';
          break;
        case 'poison':
          damGlyph = 't';
          break;
        default:
          damGlyph = 'c';
          break;
      }

      content += `
      <div class="damage">
        <div class="damage-title">
          DMG
        </div>
        <div class="damage-content">
          <div class="damage-label">
            ${hr} <strong>[HR]</strong> + ${damVal}${bonusDamUniString}
          </div>
          <div class="damage-result damage-${damType}">
            ${damage} <span class="damage-type"><span class="damage-glyph" title="${damType}"> ${damGlyph}</span></span>
          </div>
        </div>
      </div>`;
    }

    return content;
  }

  async getRollString() {
    const item = this;
    let content = "";
    const isSpellOrSkill = ["spell", "skill", "miscAbility"].includes(
      item.type
    );

    const hasRoll =
      item.type === "weapon" || (isSpellOrSkill && item.system.hasRoll?.value);

    if (hasRoll) {
      const usesWeapons =
        isSpellOrSkill &&
        (item.system.rollInfo?.useWeapon?.accuracy?.value ||
          item.system.rollInfo?.useWeapon?.damage?.value);

      if (usesWeapons) {
        const equippedWeapons = item.actor.items.filter(
          (singleItem) =>
            singleItem.type === "weapon" && singleItem.system.isEquipped?.value
        );
        const itemContents = [];
        for (let i = 0; i < equippedWeapons.length; i++) {
          const data = await this.getSingleRollForItem(
            equippedWeapons[i],
            true
          );
          itemContents.push(data);
          content = itemContents;
        }
      } else {
        content = await this.getSingleRollForItem();
      }
    }

    return content;
  }

  getSpellDataString() {
    const item = this;
    return item.type === "spell"
      ? `<div class="spelldesc"> <div><strong>MP:</strong> ${item.system.mpCost.value}</div> <div><strong>Target:</strong> ${item.system.target.value}</div> <div><strong>Duration:</strong> ${item.system.duration.value}</div> </div>`
      : "";
  }

  getLevelString() {
    const item = this;
    return item.type === "class" ? `<div><strong>Level:</strong> ${item.system.level.value}</div>` : item.type === "skill" ? `<div><strong>Class:</strong> ${item.system.class.value}</div><div><strong>Skill Level:</strong> ${item.system.level.value}</div>` : "";
  }

  getCostString() {
    const item = this;
    return item.type === "consumable" ? `<div><strong>IP Cost:</strong> ${item.system.ipCost.value}</div>` : "";
  }

  getMergeString() {
    const item = this;
    return (item.system.merge && item.system.miscType.value === "arcanum") ? `<div class="card-section"><div class="section-label">Merge</div><div class="section-content">${item.system.merge}</div></div>` : "";
  }

  getDismissString() {
    const item = this;
    return (item.system.dismiss && item.system.miscType.value === "arcanum") ? `<div class="card-section"><div class="section-label">Dismiss</div><div class="section-content">${item.system.dismiss}</div></div>` : "";
  }

  getChantString() {
    const item = this;
    const actor = item.actor;
    let chantString = "";
    if (item.type === "miscAbility" && item.system.miscType.value === "chanttone") {
      chantString = `
      <div class="card-section">
        <div class="section-label">
          Volume
        </div>
        <div class="section-content">
          <div><strong>Low Volume:</strong> 10 MP, Yourself or one creature you can see which can hear you.</div><div><strong>Medium Volume:</strong> 20 MP, every ally who can hear you</div><div><strong>High Volume:</strong> 30 MP, every enemy who can hear you.</div>
        </div>
      </div>
      <div class="card-section">
        <div class="section-label">
          Key
        </div>
        <div class="section-content"><div class="chantkey"><strong>Key</strong> <p>Type, Status, Attribute, Recovery</p></div><hr />`;
      const knownKeys = item.actor.items.filter(
        (singleItem) =>
          singleItem.type === "miscAbility" && singleItem.system.miscType.value === "chantkey"
      );
      const keyContents = [];
      for (let i = 0; i < knownKeys.length; i++) {
        chantString += `<div class="chantkey"><strong>${knownKeys[i].name}</strong> ${knownKeys[i].system.description}</div>`;
      }
      chantString += `</div>
      </div>
      `;
    }
    return chantString;
  }

  getTargetFromNumber(num) {
    if (num <= 6) {
      return "You <b>or</b> one ally you can see that is present on the scene";
    } else if (num <= 11) {
      return "One enemy you can see that is present on the scene";
    } else if (num <= 16) {
      return "You <b>and</b> every ally present on the scene";
    } else {
      return "Every enemy present on the scene";
    }
  }

  getEffectFromNumber(num, level) {
    const damageVal = level >= 40 ? 40 : level >= 20 ? 30 : 20;

    switch (num) {
      case 1:
        return "treats their <b>Dexterity</b> and <b>Might</b> dice as if they were one size higher (up to a maximum of <b>d12</b> until the end of your next turn.";
      case 2:
        return "treats their <b>Insight</b> and <b>Willpower</b> dice as if they were one size higher (up to a maximum of <b>d12</b> until the end of your next turn.";
      case 3:
        return `suffers ${damageVal} <b>air</b> damage.`;
      case 4:
        return `suffers ${damageVal} <b>bolt</b> damage.`;
      case 5:
        return `suffers ${damageVal} <b>dark</b> damage.`;
      case 6:
        return `suffers ${damageVal} <b>earth</b> damage.`;
      case 7:
        return `suffers ${damageVal} <b>fire</b> damage.`;
      case 8:
        return `suffers ${damageVal} <b>ice</b> damage.`;
      case 9:
        return `gains Resistance to <b>air</b> and <b>fire</b> damage until the end of the scene.`;
      case 10:
        return `gains Resistance to <b>bolt</b> and <b>ice</b> damage until the end of the scene.`;
      case 11:
        return `gains Resistance to <b>dark</b> and <b>earth</b> damage until the end of the scene.`;
      case 12:
        return "suffers <b>enraged</b>.";
      case 13:
        return "suffers <b>poisoned</b>.";
      case 14:
        return "suffers <b>dazed</b>, <b>shaken</b>, <b>slow</b>, and <b>weak</b>.";
      case 15:
        return "recovers from all status effects.";
      case 16:
      case 17:
        return "recovers 50 Hit Points and 50 Mind Points.";
      case 18:
        return "recovers 100 Hit Points.";
      case 19:
        return "recovers 100 Mind Points.";
      case 20:
        return "recovers 100 Hit Points and 100 Mind Points.";
    }
  }

  async getAlchemyString() {
    const item = this;
    const level = item.actor.system.level.value;
    let string = '';
    if (item.type === "miscAbility" && item.system.miscType.value === "alchemy") {
      string = '<div class="card-section"><div class="section-label">Alchemy</div><div class="section-content">';
      const numRolls = item.name.includes("Superior")
        ? 4
        : item.name.includes("Advanced")
          ? 3
          : 2;
      const shouldTrim = !item.name.includes("(all)");
      const rollParts = [];
      for (let i = 0; i < numRolls; i++) {
        rollParts.push("1d20");
      }
      const roll = new Roll(rollParts.join(" + "), {});
      await roll.evaluate();
      const diceResults = roll.terms
        .filter((term) => term.results)
        .map((die) => die.results[0].result);

      const allEffects = [];
      const allEffectsOutput = [];

      diceResults.forEach((num, i) => {
        const thisResultEffects = [];
        const thisResultOutput = [];
        const target = this.getTargetFromNumber(num);
        const isFriends = target.includes("ally");
        if (!shouldTrim || !isFriends) {
          const damEffect = `${target} suffers 20 <b>poison</b> damage.`;
          thisResultEffects.push(damEffect);
          thisResultOutput.push({
            combo: `${num}+Any`,
            effect: damEffect,
          });
        }
        const healEffect = `${target} recovers 30 Hit Points.`;
        thisResultEffects.push(healEffect);
        thisResultOutput.push({
          combo: `${num}+Any`,
          effect: healEffect,
        });

        const otherResults = [...diceResults];
        otherResults.splice(i, 1);

        otherResults.forEach((res) => {
          const effect = `${target} ${this.getEffectFromNumber(res, level)}`;
          const effectForFriends = !effect.includes("suffers");
          const effectForFoes =
            !effect.includes("treats") &&
            !effect.includes("gains") &&
            !effect.includes("recovers from");
          const shouldInclude =
            !shouldTrim ||
            (isFriends && effectForFriends) ||
            (!isFriends && effectForFoes);
          if (!thisResultEffects.includes(effect) && shouldInclude) {
            thisResultEffects.push(effect);
            thisResultOutput.push({
              combo: `${num}+${res}`,
              effect,
            });
          }
        });

        thisResultOutput.forEach((effect) => {
          if (!allEffects.includes(effect.effect)) {
            allEffects.push(effect.effect);
            allEffectsOutput.push({
              combo: effect.combo,
              effect: effect.effect,
            });
          }
        });
      });

      string += `Rolls: ${diceResults.join(" ")}<br /><br />`;
      string += `<b>Possible Effects:</b><table><tr><th>Combo</th><th>Effect</th></tr>`;
      allEffectsOutput.forEach((effect) => {
        string += `<tr><td style="width:65px;">${effect.combo}</td><td>${effect.effect}</td></tr>`;
      });
      string += "</table>";
      string += '</div></div>';
    }
    return string;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get("core", "rollMode");

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      const descTone = item.system.miscType?.value === "chanttone" ? "TONE" : "INFO";
      const desc = item.system.description ? `<div class="chat-desc"><div class="desc-title">${ descTone }</div><div class="desc-content">${item.system.description}</div></div>` : "";
      const attackData = await this.getRollString();
      const spellString = this.getSpellDataString();
      const levelString = this.getLevelString();
      const costString = this.getCostString();
      const alchemyString = await this.getAlchemyString();
      const mergeString = this.getMergeString();
      const dismissString = this.getDismissString();
      const chantString = this.getChantString();
      var startRoll = '<div class="item-roll ' + item.type + '">';
      const endRoll = '</div>';
      var qualityString = "";
      if (item.system.quality?.value) {
        qualityString = item.system.quality.value;
      }
      else if (spellString) {
        qualityString = spellString;
      }
      else if (levelString) {
        qualityString = levelString;
      }
      else if (costString) {
        qualityString = costString;
      }
      else if (this.type === "miscAbility") {
        switch(item.system.miscType.value) {
          case "arcanum":
            qualityString = `<div><strong>Domains:</strong> ${this.system.domain.value}</div>`;
            break;
          case "alchemy":
            qualityString = `<div><strong>Alchemical Invention</strong></div>`;
            break;
          case "infusion":
            qualityString = `<div><strong>Infusion Invention</strong></div>`;
            break;
          case "magitech":
            qualityString = `<div><strong>Magitech Invention</strong></div>`;
            break;
          case "chantkey":
            qualityString = `<div><strong>Chant Key:</strong> Choose one key, one tone, and one volume.</div>`;
            break;
          case "chanttone":
            qualityString = '<div><strong>Chant Tone:</strong> Choose one key, one tone, and one volume.</div>';
            break;
          case "dance":
            qualityString = `<div><strong>Dance Duration:</strong> ${item.system.duration.value}</div>`;
            break;
          case "symbol":
            qualityString = `<div><strong>Symbol</strong></div>`;
            break;
          case "invocation":
            qualityString = `<div><strong>Invocation</strong></div>`;
            break;
          default:
            qualityString = `<div class="capitalize"><strong>Misc. Ability:</strong> ${item.system.miscType.value}</div>`;
            break;
        }
      }
      else if (this.type === "quirk") {
        qualityString = `<div>Quirk</div>`
      }
      else if (this.type === "activity") {
        qualityString = `<div><strong>Target:</strong> ${ this.system.target.value }</div>`
      }
      else if (this.type === "zerotrigger") {
        qualityString = `<div><strong>Filled Segments:</strong> ${ this.system.filled.value }</div>`
      }
      else if (this.type === "zeroeffect") {
        qualityString = `<div>Unleash Zero Power!</div>`
      }
      else {
        qualityString = "No Quality";
      }
      const attackString = Array.isArray(attackData)
        ? attackData.join("")
        : attackData;

      const label = `
        <div class="message-head">
          <div class="message-img">
            <img src="${item.img}" width="48" height="48" />
          </div>
          <div class="message-title">
            <div class="message-name">
              ${item.name}
            </div>
            <div class="message-quality">
              ${qualityString}
            </div>
          </div>
        </div>
      `;

      let content = [
        startRoll,
        chantString,
        desc,
        mergeString,
        dismissString,
        attackString,
        alchemyString,
        endRoll,
      ]
        .filter((part) => part)
        .join("");

      content = content ? `${content}` : "";

      var shouldShowNotification =
        ["spell", "zeroeffect"].includes(item.type) ||
        item.system.showTitleCard?.value;

      if (item.system.hideTitleCard?.value === true) {
        shouldShowNotification = false;
      }

      let floatingText = `<div class="fabula-floating"><img src="${item.img}" width="48" height="48" /></div> <span>${item.name}</span>`;
      let floatingType = "fabulaultima-spellname";
      let floatingImg = item.img;
      if (item.type === "zeroeffect") {
        floatingType = "fabulaultima-spellname zeropower";
      }
      if (shouldShowNotification) {
        socketlib.system.executeForEveryone("floatingText", floatingText, floatingType, floatingImg);
      }

      ChatMessage.create({
        speaker: speaker,
        rollMode: 'roll',
        flavor: label,
        content,
        flags: {
          item: this,
        },
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      const label = `
        <div class="message-head">
          <div class="message-img">
            <img src="${item.img}" width="48" height="48" />
          </div>
          <div class="message-title">
            <div class="message-name">
              ${item.name}
            </div>
          </div>
        </div>`;
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.item.formula, rollData);
      // If you need to store the value first, uncomment the next line.
      // let result = await roll.roll({async: true});
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }
}
