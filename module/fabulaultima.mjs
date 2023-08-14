// Import document classes.
import { FabulaUltimaActor } from "./documents/actor.mjs";
import { FabulaUltimaItem } from "./documents/item.mjs";
// Import sheet classes.
import { FabulaUltimaActorSheet } from "./sheets/actor-sheet.mjs";
import { FabulaUltimaItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { FABULAULTIMA } from "./helpers/config.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.fabulaultima = {
    FabulaUltimaActor,
    FabulaUltimaItem,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.FABULAULTIMA = FABULAULTIMA;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d@attributes.dex.current + 1d@attributes.ins.current + @derived.init.value",
    decimals: 2,
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = FabulaUltimaActor;
  CONFIG.Item.documentClass = FabulaUltimaItem;

  CONFIG.statusEffects = [
    {
      id: "dazed",
      label: "Dazed",
      icon: "systems/fabulaultima/images/Dazed.webp",
      stats: ["ins"],
      mod: -2,
    },
    {
      id: "enraged",
      label: "Enraged",
      icon: "systems/fabulaultima/images/Enraged.webp",
      stats: ["dex", "ins"],
      mod: -2,
    },
    {
      id: "shaken",
      label: "Shaken",
      icon: "systems/fabulaultima/images/Shaken.webp",
      stats: ["wlp"],
      mod: -2,
    },
    {
      id: "slow",
      label: "Slow",
      icon: "systems/fabulaultima/images/Slow.webp",
      stats: ["dex"],
      mod: -2,
    },
    {
      id: "poisoned",
      label: "Poisoned",
      icon: "systems/fabulaultima/images/Poisoned.webp",
      stats: ["mig", "wlp"],
      mod: -2,
    },
    {
      id: "weak",
      label: "Weak",
      icon: "systems/fabulaultima/images/Weak.webp",
      stats: ["mig"],
      mod: -2,
    },
    {
      id: "accelerated",
      label: "Accelerated",
      icon: "systems/fabulaultima/images/Accelerated.webp",
      stats: ["ins"],
      mod: 0,
    },
    {
      id: "aura",
      label: "Aura",
      icon: "systems/fabulaultima/images/Aura.webp",
      stats: ["mdef"],
      mod: 12,
    },
    {
      id: "barrier",
      label: "Barrier",
      icon: "systems/fabulaultima/images/Barrier.webp",
      stats: ["def"],
      mod: 12,
    },
    {
      id: "dex-up",
      label: "DEX Up",
      icon: "systems/fabulaultima/images/DexUp.webp",
      stats: ["dex"],
      mod: 2,
    },
    {
      id: "ins-up",
      label: "INS Up",
      icon: "systems/fabulaultima/images/InsUp.webp",
      stats: ["ins"],
      mod: 2,
    },
    {
      id: "mig-up",
      label: "MIG Up",
      icon: "systems/fabulaultima/images/MigUp.webp",
      stats: ["mig"],
      mod: 2,
    },
    {
      id: "wlp-up",
      label: "WLP Up",
      icon: "systems/fabulaultima/images/WlpUp.webp",
      stats: ["wlp"],
      mod: 2,
    },
	{
      id: "crisis",
      label: "Crisis",
      icon: "systems/fabulaultima/images/Status_Bleeding.png",
      stats: ["ins"],
      mod: 0,
    },
    {
      id: "ko",
      label: "KO",
      icon: "systems/fabulaultima/images/KO.webp",
      stats: ["ins"],
      mod: 0,
    },
    {
      id: "weapon",
      label: "Weapon Buff",
      icon: "systems/fabulaultima/images/wepbuff.webp",
      stats: ["ins"],
      mod:0,
    },
    {
      id: "symbol",
      label: "Symbol",
      icon: "systems/fabulaultima/images/symbol.webp",
      stats: ["ins"],
      mod:0,
    }
  ];

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("fabulaultima", FabulaUltimaActorSheet, {
    makeDefault: true,
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("fabulaultima", FabulaUltimaItemSheet, {
    makeDefault: true,
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper("concat", function () {
  var outStr = "";
  for (var arg in arguments) {
    if (typeof arguments[arg] != "object") {
      outStr += arguments[arg];
    }
  }
  return outStr;
});

Handlebars.registerHelper("toLowerCase", function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper("toUpperCase", function (str) {
  return str.toUpperCase();
});

Handlebars.registerHelper("math", function(lvalue, operator, rvalue, options) {
  lvalue = parseFloat(lvalue);
  rvalue = parseFloat(rvalue);
      
  return {
      "+": lvalue + rvalue,
      "-": lvalue - rvalue,
      "*": (lvalue * rvalue).toFixed(2),
      "/": lvalue / rvalue,
      "%": lvalue % rvalue
  }[operator];
});

Handlebars.registerHelper('ifGreater', function(arg1, arg2, options) {
  return (arg1 > arg2) ? options.fn(this) : options.inverse(this);
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

  game.settings.register("fabulaultima", "enableZero", {
		name: "Enable Zero Powers",
		hint: "Adds a section under abilities for zero powers.",
		scope: "world",
		default: false,
		type: Boolean,
		config: true,
		requiresReload: true,
	});
  game.settings.register("fabulaultima", "enableZeroClock", {
		name: "Enable Zero Power Resource",
		hint: "Adds a resource to the character sheet for Zero Power progress. Does nothing without Zero Powers. Disable if using a different method.",
		scope: "world",
		default: false,
		type: Boolean,
		config: true,
		requiresReload: true,
	});
  game.settings.register("fabulaultima", "enableQuirks", {
		name: "Enable Quirks",
		hint: "Adds a section for Quirks above classes in the Features section.",
		scope: "world",
		default: false,
		type: Boolean,
		config: true,
		requiresReload: true,
	});
  game.settings.register("fabulaultima", "enableActivities", {
		name: "Enable Camp Activities",
		hint: "Adds a section for Camp Activities.",
		scope: "world",
		default: false,
		type: Boolean,
		config: true,
		requiresReload: true,
	});

});

Hooks.once("socketlib.ready", () => {
  const socket = socketlib.registerSystem("fabulaultima");
  socket.register("floatingText", displayFloatingText);
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item") return;
  if (!data.uuid.includes("Actor.") && !data.uuid.includes("Token.")) {
    return ui.notifications.warn(
      "You can only create macro buttons for owned Items"
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.fabulaultima.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "fabulaultima.itemMacro": true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: "Item",
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}

function displayFloatingText(text,type) {
  ui.notifications.queue.push({
    message: text,
    type: type,
    timestamp: new Date().getTime(),
    permanent: false,
    console: false,
  });
  if (ui.notifications.rendered) ui.notifications.fetch();
}