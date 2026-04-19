// ═══════════════════════════════════════════════════════════════
//  WH40K UNIFIED — Dark Heresy / Rogue Trader / Only War
//  Foundry VTT Game System
// ═══════════════════════════════════════════════════════════════

// ── INIT ────────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log("WH40K Unified | Initialising the Imperium's finest systems...");

  // Register all sheets
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("wh40k-unified", WH40KCharacterSheet, {
    types: ["character"], makeDefault: true, label: "Character Sheet"
  });
  Actors.registerSheet("wh40k-unified", WH40KNPCSheet, {
    types: ["npc"], makeDefault: true, label: "NPC Sheet"
  });
  Actors.registerSheet("wh40k-unified", WH40KVoidShipSheet, {
    types: ["voidship"], makeDefault: true, label: "Void Ship Sheet"
  });
  Actors.registerSheet("wh40k-unified", WH40KVehicleSheet, {
    types: ["vehicle"], makeDefault: true, label: "Vehicle Sheet"
  });
  Actors.registerSheet("wh40k-unified", WH40KKnightSheet, {
    types: ["knight"], makeDefault: true, label: "Imperial Knight Sheet"
  });
  Actors.registerSheet("wh40k-unified", WH40KFighterSheet, {
    types: ["fighter"], makeDefault: true, label: "Fighter Sheet"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("wh40k-unified", WH40KItemSheet, {
    makeDefault: true, label: "Item Sheet"
  });

  // Handlebars helpers
  Handlebars.registerHelper("wh40k_charVal", (char) => {
    if (!char) return 0;
    return (char.base || 0) + (char.advance || 0);
  });
  Handlebars.registerHelper("wh40k_pct", (v, m) => {
    if (!m || m <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((v / m) * 100)));
  });
  Handlebars.registerHelper("wh40k_selected", (a, b) => a === b ? "selected" : "");
  Handlebars.registerHelper("wh40k_checked", (v) => v ? "checked" : "");
  Handlebars.registerHelper("wh40k_keys", (obj) => obj ? Object.keys(obj) : []);
  Handlebars.registerHelper("wh40k_eq", (a, b) => a === b);
  Handlebars.registerHelper("wh40k_or", (a, b) => a || b);

  console.log("WH40K Unified | Sheets and helpers registered.");
});

Hooks.once("ready", () => {
  console.log("WH40K Unified | Ready. For the Emperor!");
  // Make the roll helper globally available for macros
  window.WH40K = { roll: WH40KRoll.characteristic };
});

// ── CORE ROLL ENGINE ────────────────────────────────────────────

class WH40KRoll {
  /**
   * Roll d100 against a target number.
   * Posts a formatted result to chat.
   * @param {Actor} actor
   * @param {string} label     — what is being tested
   * @param {number} target    — the characteristic/skill value to roll under
   * @param {number} modifier  — situational modifier (+ or -)
   */
  static async characteristic(actor, label, target, modifier = 0) {
    const finalTarget = target + modifier;
    const roll = await new Roll("1d100").evaluate();
    const result = roll.total;

    // Degrees of success/failure (Wh40K: every 10 points = 1 degree)
    let degrees, outcome, outcomeClass;
    if (result <= finalTarget) {
      degrees = Math.floor((finalTarget - result) / 10) + 1;
      outcome = `Success (${degrees} ${degrees === 1 ? "degree" : "degrees"})`;
      outcomeClass = "wh40k-success";
      // Righteous Fury — roll of 1-5 on a hit
      if (result <= 5) {
        outcome = `⚡ RIGHTEOUS FURY! (${degrees} degrees)`;
        outcomeClass = "wh40k-critical";
      }
    } else {
      degrees = Math.floor((result - finalTarget) / 10) + 1;
      outcome = `Failure (${degrees} ${degrees === 1 ? "degree" : "degrees"})`;
      outcomeClass = "wh40k-failure";
      // Confirmed Fumble — roll of 96-100 on a miss
      if (result >= 96) {
        outcome = `💀 PERILS / FUMBLE! (${degrees} degrees)`;
        outcomeClass = "wh40k-fumble";
      }
    }

    const content = `
      <div class="wh40k-roll-card">
        <div class="wh40k-roll-header">
          <span class="wh40k-roll-actor">${actor.name}</span>
          <span class="wh40k-roll-label">${label}</span>
        </div>
        <div class="wh40k-roll-body">
          <div class="wh40k-roll-dice">${result}</div>
          <div class="wh40k-roll-details">
            <div>Target: <b>${finalTarget}</b>${modifier !== 0 ? ` (${target}${modifier >= 0 ? "+" : ""}${modifier})` : ""}</div>
            <div class="${outcomeClass}">${outcome}</div>
          </div>
        </div>
      </div>`;

    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll]
    });

    return { result, target: finalTarget, success: result <= finalTarget, degrees };
  }

  /** Damage roll — posts to chat */
  static async damage(actor, weaponName, damageFormula, penetration, damageType) {
    const roll = await new Roll(damageFormula).evaluate();
    const content = `
      <div class="wh40k-roll-card">
        <div class="wh40k-roll-header">
          <span class="wh40k-roll-actor">${actor.name}</span>
          <span class="wh40k-roll-label">⚔ ${weaponName} — Damage</span>
        </div>
        <div class="wh40k-roll-body">
          <div class="wh40k-roll-dice">${roll.total}</div>
          <div class="wh40k-roll-details">
            <div>Formula: <b>${damageFormula}</b></div>
            <div>Pen: <b>${penetration}</b> &nbsp; Type: <b>${damageType}</b></div>
          </div>
        </div>
      </div>`;
    await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll] });
    return roll.total;
  }
}

// ── BASE SHEET ──────────────────────────────────────────────────
// All sheets extend this — shared logic lives here

class WH40KBaseSheet extends ActorSheet {
  /** Build safe data object — never calls super.getData() to avoid system conflicts */
  getData() {
    return {
      actor:      this.actor,
      system:     this.actor.system,
      name:       this.actor.name,
      img:        this.actor.img,
      isEditable: this.isEditable,
      owner:      this.actor.isOwner,
      items:      this.actor.items,
      // Grouped items for easy template access
      weapons:    this.actor.items.filter(i => i.type === "weapon"),
      armour:     this.actor.items.filter(i => i.type === "armour"),
      gear:       this.actor.items.filter(i => i.type === "gear"),
      talents:    this.actor.items.filter(i => i.type === "talent"),
      traits:     this.actor.items.filter(i => i.type === "trait"),
      powers:     this.actor.items.filter(i => i.type === "psychicpower"),
      shipcomponents: this.actor.items.filter(i => i.type === "shipcomponent"),
      vehiclecomponents: this.actor.items.filter(i => i.type === "vehiclecomponent")
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;
    
    // Manual tab handling — reliable across all Foundry versions
    html.find(".wh40k-tab").click(ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      html.find(".wh40k-tab").removeClass("active");
      ev.currentTarget.classList.add("active");
      html.find(".wh40k-tab-panel").hide();
      html.find(`.wh40k-tab-panel[data-tab="${tab}"]`).show();
    });
    // Show first tab on open
    html.find(".wh40k-tab-panel").hide();
    html.find(".wh40k-tab-panel").first().show();
    html.find(".wh40k-tab").first().addClass("active");
    // Inline item editing — click item name to open sheet
    html.find(".wh40k-item-name").click(ev => {
      const id   = ev.currentTarget.closest("[data-item-id]").dataset.itemId;
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });

    // Delete item
    html.find(".wh40k-item-delete").click(ev => {
      const id = ev.currentTarget.closest("[data-item-id]").dataset.itemId;
      this.actor.items.get(id)?.delete();
    });

    // Add item buttons
    html.find("[data-action='add-item']").click(ev => {
      const type = ev.currentTarget.dataset.type;
      Item.create({ name: `New ${type}`, type }, { parent: this.actor });
    });

    // Characteristic roll — click on characteristic name/value
    html.find(".wh40k-char-roll").click(ev => {
      const charKey = ev.currentTarget.dataset.char;
      const char    = this.actor.system.characteristics?.[charKey];
      if (!char) return;
      const total = (char.base || 0) + (char.advance || 0);
      WH40KRoll.characteristic(this.actor, game.i18n.localize(`WH40K.Characteristics.${charKey}`), total);
    });

    // Weapon attack roll
    html.find(".wh40k-weapon-roll").click(ev => {
      const id     = ev.currentTarget.closest("[data-item-id]").dataset.itemId;
      const weapon = this.actor.items.get(id);
      if (!weapon) return;
      const bs     = this.actor.system.characteristics?.bs;
      const bsVal  = bs ? (bs.base + bs.advance) : 25;
      WH40KRoll.characteristic(this.actor, `Attack: ${weapon.name}`, bsVal);
    });

    // Weapon damage roll
    html.find(".wh40k-weapon-damage").click(ev => {
      const id     = ev.currentTarget.closest("[data-item-id]").dataset.itemId;
      const weapon = this.actor.items.get(id);
      if (!weapon) return;
      WH40KRoll.damage(this.actor, weapon.name, weapon.system.damage, weapon.system.penetration, weapon.system.damageType);
    });
  }

  /** Shared: percentage bar width calculation */
  _pct(value, max) {
    if (!max || max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  }

  /** Shared: post action message to chat */
  async _chatMsg(label, bodyHtml) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh40k-roll-card">
        <div class="wh40k-roll-header">
          <span class="wh40k-roll-actor">${this.actor.name}</span>
          <span class="wh40k-roll-label">${label}</span>
        </div>
        <div class="wh40k-roll-body" style="display:block;padding:8px;">${bodyHtml}</div>
      </div>`
    });
  }
}

// ── CHARACTER SHEET ─────────────────────────────────────────────

class WH40KCharacterSheet extends WH40KBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "character"],
      template: "systems/wh40k-unified/templates/character-sheet.html",
      width: 800, height: 720,
      tabs: [{ navSelector: ".wh40k-tabs", contentSelector: ".wh40k-tab-content", initial: "core" }],
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    const sys  = data.system;
    // Compute characteristic totals for display
    if (sys.characteristics) {
      data.chars = {};
      for (const [k, c] of Object.entries(sys.characteristics)) {
        data.chars[k] = {
          ...c,
          total:   (c.base || 0) + (c.advance || 0),
          bonus:   Math.floor(((c.base || 0) + (c.advance || 0)) / 10)
        };
      }
    }
    data.woundsPct  = this._pct(sys.wounds?.value, sys.wounds?.max);
    data.fatiguePct = this._pct(sys.fatigue?.value, sys.fatigue?.max);
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Fate point burn
    html.find("[data-action='burn-fate']").click(() => {
      const fate = this.actor.system.fate;
      if (fate.max > 0) this.actor.update({ "system.fate.max": fate.max - 1, "system.fate.value": Math.min(fate.value, fate.max - 1) });
    });

    // Use fate point
    html.find("[data-action='use-fate']").click(() => {
      const fate = this.actor.system.fate;
      if (fate.value > 0) this.actor.update({ "system.fate.value": fate.value - 1 });
    });

    // Restore fate
    html.find("[data-action='restore-fate']").click(() => {
      const fate = this.actor.system.fate;
      this.actor.update({ "system.fate.value": fate.max });
    });

    // Take a wound
    html.find("[data-action='take-wound']").click(() => {
      const w = this.actor.system.wounds;
      if (w.value > 0) this.actor.update({ "system.wounds.value": w.value - 1 });
    });

    // Heal a wound
    html.find("[data-action='heal-wound']").click(() => {
      const w = this.actor.system.wounds;
      if (w.value < w.max) this.actor.update({ "system.wounds.value": w.value + 1 });
    });
  }
}

// ── NPC SHEET ───────────────────────────────────────────────────

class WH40KNPCSheet extends WH40KBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "npc"],
      template: "systems/wh40k-unified/templates/npc-sheet.html",
      width: 680, height: 560,
      tabs: [{ navSelector: ".wh40k-tabs", contentSelector: ".wh40k-tab-content", initial: "core" }],
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    const sys  = data.system;
    if (sys.characteristics) {
      data.chars = {};
      for (const [k, c] of Object.entries(sys.characteristics)) {
        data.chars[k] = { ...c, total: (c.base||0)+(c.advance||0), bonus: Math.floor(((c.base||0)+(c.advance||0))/10) };
      }
    }
    data.woundsPct = this._pct(sys.wounds?.value, sys.wounds?.max);
    return data;
  }
}

// ── VOID SHIP SHEET ─────────────────────────────────────────────

// ── VOID SHIP SHEET ─────────────────────────────────────────────

class WH40KVoidShipSheet extends WH40KBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "voidship"],
      template: "systems/wh40k-unified/templates/voidship-sheet.html",
      width: 860, height: 720,
      tabs: [{ navSelector: ".wh40k-tabs", contentSelector: ".wh40k-tab-content", initial: "profile" }],
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    const sys  = data.system;
    data.hullPct   = this._pct(sys.hull?.value,    sys.hull?.max);
    data.shieldPct = this._pct(sys.shields?.value, sys.shields?.max);
    data.crewPct   = this._pct(sys.crew?.value,    sys.crew?.max);
    data.moralePct = this._pct(sys.morale?.value,  sys.morale?.max);
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Skill rolls on Profile tab
    html.find(".vs-skill-roll").click(ev => {
      const skill = ev.currentTarget.dataset.skill;
      const label = ev.currentTarget.dataset.label;
      const val   = this.actor.system.skills?.[skill] ?? 40;
      WH40KRoll.characteristic(this.actor, label, val);
    });

    // Fire individual weapon component
    html.find(".vs-fire-weapon").click(ev => {
      const row  = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(row?.dataset.itemId);
      if (!item) return;
      const locked = this.actor.getFlag("wh40k-unified", "lockedOn");
      const bs     = (this.actor.system.skills?.ballisticSkill ?? 40) + (locked ? 20 : 0);
      if (locked) this.actor.unsetFlag("wh40k-unified", "lockedOn");
      WH40KRoll.characteristic(this.actor, `⚔ ${item.name}${locked ? " (+20 Lock On)" : ""}`, bs);
    });

    // Combat action buttons
    html.find("[data-action='lock-on']").click(()        => this._lockOn());
    html.find("[data-action='evasive']").click(()        => this._evasive());
    html.find("[data-action='new-course']").click(()     => this._newCourse());
    html.find("[data-action='brace']").click(()          => this._brace());
    html.find("[data-action='repair']").click(()         => this._repair());
    html.find("[data-action='ram']").click(()            => this._ram());
    html.find("[data-action='fire-all']").click(()       => this._fireAll());
    html.find("[data-action='silent-running']").click(()  => this._silentRunning());
    html.find("[data-action='torpedo-salvo']").click(()  => this._torpedoSalvo());
    html.find("[data-action='withdraw']").click(()       => this._withdraw());

    // Component add/delete
    html.find("[data-action='add-essential']").click(()    => this._addComponent("essentialComponents"));
    html.find("[data-action='add-supplemental']").click(() => this._addComponent("supplementalComponents"));
    html.find(".vs-del-comp").click(ev => {
      const row  = ev.currentTarget.closest(".vs-comp-row");
      const key  = row?.dataset.compKey;
      const type = row?.dataset.compType;
      if (key && type) this._deleteComponent(type, key);
    });

    // Live status dot update
    html.find(".vs-comp-status-sel").change(ev => {
      const dot = ev.currentTarget.closest(".vs-comp-row")?.querySelector(".vs-status-dot");
      if (dot) dot.className = `vs-status-dot vs-dot-${ev.currentTarget.value}`;
    });
  }

  // ── Combat Actions ───────────────────────────────────────────

  async _lockOn() {
    const sk = this.actor.system.skills?.ballisticSkill ?? 40;
    const res = await WH40KRoll.characteristic(this.actor, "🎯 Lock On", sk);
    if (res.success) {
      await this.actor.setFlag("wh40k-unified", "lockedOn", true);
      ui.notifications.info(`${this.actor.name} has locked on! Next attack gains +20 BS.`);
    }
  }

  async _evasive() {
    const sk = (this.actor.system.skills?.pilot ?? 40) + (this.actor.system.manoeuvrability ?? 0);
    const res = await WH40KRoll.characteristic(this.actor, "💨 Evasive Manoeuvres", sk);
    if (res.success) await this.actor.update({ "system.statusEvasive": true });
  }

  async _newCourse() {
    const sk  = (this.actor.system.skills?.pilot ?? 40) + (this.actor.system.manoeuvrability ?? 0);
    const res = await WH40KRoll.characteristic(this.actor, "🧭 Come to New Course", sk);
    const deg = res.success ? "up to 90°" : "up to 45°";
    await this._chatMsg("🧭 New Course", `Ship may turn ${deg} this turn.`);
  }

  async _brace() {
    const res = await WH40KRoll.characteristic(this.actor, "🛡 Brace for Impact", this.actor.system.skills?.command ?? 40);
    if (res.success) await this.actor.update({ "system.statusBraced": true });
  }

  async _repair() {
    const sk  = this.actor.system.skills?.techUse ?? 40;
    const res = await WH40KRoll.characteristic(this.actor, "🔧 Damage Control", sk);
    if (res.success) {
      const rep = res.degrees + Math.floor(Math.random() * 3);
      const cur = this.actor.system.hull?.value ?? 0;
      const max = this.actor.system.hull?.max   ?? 0;
      await this.actor.update({ "system.hull.value": Math.min(cur + rep, max) });
      await this._chatMsg("🔧 Repairs Complete", `${rep} Hull Integrity restored. Now at ${Math.min(cur + rep, max)}/${max}.`);
    }
  }

  async _ram() {
    const sk  = (this.actor.system.skills?.pilot ?? 40) + (this.actor.system.manoeuvrability ?? 0);
    const res = await WH40KRoll.characteristic(this.actor, "⚡ RAM", sk);
    if (res.success) {
      const dmg = await new Roll("1d10+" + Math.floor((this.actor.system.hull?.max ?? 40) / 10)).evaluate();
      await this._chatMsg("⚡ RAMMING SPEED!", `Target suffers <b style="color:#cc2222">${dmg.total} Hull damage</b>. This vessel takes <b style="color:#cc2222">${Math.floor(dmg.total / 2)}</b>.`);
    }
  }

  async _fireAll() {
    const weapons = this.actor.items.filter(i => i.type === "shipcomponent");
    if (!weapons.length) { ui.notifications.warn("No ship components configured as weapons!"); return; }
    const locked = this.actor.getFlag("wh40k-unified", "lockedOn");
    const bs     = (this.actor.system.skills?.ballisticSkill ?? 40) + (locked ? 20 : 0);
    if (locked) await this.actor.unsetFlag("wh40k-unified", "lockedOn");
    for (const w of weapons) {
      await WH40KRoll.characteristic(this.actor, `⚔ ${w.name}${locked ? " (+20)" : ""}`, bs);
    }
  }

  async _silentRunning() {
    const res = await WH40KRoll.characteristic(this.actor, "🔕 Silent Running", this.actor.system.skills?.techUse ?? 40);
    if (res.success) {
      await this.actor.update({ "system.statusSilent": true });
      await this._chatMsg("🔕 Silent Running", "Detection rating reduced by 30. All active augurs shut down.");
    }
  }

  async _torpedoSalvo() {
    const torps = this.actor.system.torpedoes;
    if (!torps || torps.value <= 0) { ui.notifications.warn("No torpedoes remaining!"); return; }
    const res = await WH40KRoll.characteristic(this.actor, "🚀 Torpedo Salvo", this.actor.system.skills?.ballisticSkill ?? 40);
    if (res.success) {
      await this.actor.update({ "system.torpedoes.value": torps.value - 1 });
      const dmg = await new Roll("2d10+4").evaluate();
      await this._chatMsg("🚀 Torpedo Impact!", `Torpedo strikes! <b style="color:#cc2222">${dmg.total} damage</b> ignoring shields. ${torps.value - 1} torpedoes remaining.`);
    } else {
      await this.actor.update({ "system.torpedoes.value": torps.value - 1 });
      await this._chatMsg("🚀 Torpedo Salvo", `Torpedo missed. ${torps.value - 1} remaining.`);
    }
  }

  async _withdraw() {
    const sk  = (this.actor.system.skills?.pilot ?? 40) + (this.actor.system.manoeuvrability ?? 0);
    const res = await WH40KRoll.characteristic(this.actor, "🏳 Withdraw", sk);
    if (res.success) {
      await this._chatMsg("🏳 Withdrawal", "Successfully disengaged from combat.");
    } else {
      await this._chatMsg("🏳 Withdrawal Failed", "Could not disengage — enemy maintains firing solutions.");
    }
  }

  // ── Component Helpers ────────────────────────────────────────

  async _addComponent(field) {
    const comps = foundry.utils.deepClone(this.actor.system[field] || {});
    comps["c" + Date.now()] = { name: "New Component", bonus: "", status: "ok" };
    await this.actor.update({ [`system.${field}`]: comps });
  }

  async _deleteComponent(type, key) {
    const comps = foundry.utils.deepClone(this.actor.system[type] || {});
    delete comps[key];
    await this.actor.update({ [`system.${type}`]: comps });
  }
}

// ── VEHICLE SHEET ───────────────────────────────────────────────

class WH40KVehicleSheet extends WH40KBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "vehicle"],
      template: "systems/wh40k-unified/templates/vehicle-sheet.html",
      width: 740, height: 640,
      tabs: [{ navSelector: ".wh40k-tabs", contentSelector: ".wh40k-tab-content", initial: "profile" }],
      resizable: true
    });
  }
  getData() {
    const data = super.getData();
    data.hullPct = this._pct(data.system.hull?.value, data.system.hull?.max);
    return data;
  }
}

// ── IMPERIAL KNIGHT SHEET ───────────────────────────────────────

class WH40KKnightSheet extends WH40KBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "knight"],
      template: "systems/wh40k-unified/templates/knight-sheet.html",
      width: 740, height: 640,
      tabs: [{ navSelector: ".wh40k-tabs", contentSelector: ".wh40k-tab-content", initial: "profile" }],
      resizable: true
    });
  }
  getData() {
    const data = super.getData();
    data.hullPct   = this._pct(data.system.hull?.value,    data.system.hull?.max);
    data.shieldPct = this._pct(data.system.shields?.value, data.system.shields?.max);
    return data;
  }
}

// ── FIGHTER SHEET ───────────────────────────────────────────────

class WH40KFighterSheet extends WH40KBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "fighter"],
      template: "systems/wh40k-unified/templates/fighter-sheet.html",
      width: 700, height: 580,
      tabs: [{ navSelector: ".wh40k-tabs", contentSelector: ".wh40k-tab-content", initial: "profile" }],
      resizable: true
    });
  }
  getData() {
    const data = super.getData();
    data.hullPct = this._pct(data.system.hull?.value, data.system.hull?.max);
    return data;
  }
}

// ── ITEM SHEET ──────────────────────────────────────────────────

class WH40KItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "item"],
      template: "systems/wh40k-unified/templates/item-sheet.html",
      width: 560, height: 480,
      resizable: true
    });
  }

  getData() {
    return {
      item:       this.item,
      system:     this.item.system,
      name:       this.item.name,
      img:        this.item.img,
      isEditable: this.isEditable,
      owner:      this.item.isOwner
    };
  }
}
