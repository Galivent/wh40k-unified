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
  Actors.registerSheet("wh40k-unified", WH40KColonySheet, {
    types: ["colony"], makeDefault: true, label: "Colony Sheet"
  });
  Actors.registerSheet("wh40k-unified", WH40KRegimentSheet, {
    types: ["regiment"], makeDefault: true, label: "Regiment Sheet"
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
    
    // Manual tab handling
    html.find(".wh40k-tab").click(ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      html.find(".wh40k-tab").removeClass("active");
      ev.currentTarget.classList.add("active");
      html.find(".wh40k-tab-panel").hide();
      html.find(`.wh40k-tab-panel[data-tab="${tab}"]`).show();
    });
    html.find(".wh40k-tab-panel").hide();
    html.find(".wh40k-tab-panel").first().show();
    html.find(".wh40k-tab").first().addClass("active");
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
    html.find("[data-action='open-battle']").click(()    => new WH40KVoidBattleApp().render(true));
    html.find("[data-action='open-crit-table']").click(()=> new WH40KCritTableApp().render(true));

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

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find("[data-action='veh-move']").click(() => {
      const sk = this.actor.system.crewDriverSkill ?? 40;
      WH40KRoll.characteristic(this.actor, "🚗 Drive (Combat)", sk);
    });

    html.find("[data-action='veh-ram']").click(async () => {
      const sk  = this.actor.system.crewDriverSkill ?? 40;
      const res = await WH40KRoll.characteristic(this.actor, "💥 Ram", sk);
      if (res.success) {
        const dmg = await new Roll("1d10+" + Math.floor((this.actor.system.hull?.max ?? 30) / 5)).evaluate();
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div class="wh40k-roll-card"><div class="wh40k-roll-header"><span class="wh40k-roll-actor">${this.actor.name}</span><span class="wh40k-roll-label">💥 Ram Impact</span></div><div class="wh40k-roll-body" style="display:block;padding:8px;"><div style="color:#f2e4c0;">Target takes <b style="color:#dd3333">${dmg.total} damage</b> to rear armour. This vehicle takes <b style="color:#dd3333">${Math.floor(dmg.total/2)}</b>.</div></div></div>`
        });
      }
    });

    html.find("[data-action='veh-fire']").click(() => {
      const weapons = this.actor.items.filter(i => i.type === "vehiclecomponent");
      if (!weapons.length) { ui.notifications.warn("No weapons configured!"); return; }
      const sk = this.actor.system.crewGunnerSkill ?? 40;
      weapons.forEach(w => WH40KRoll.characteristic(this.actor, \`⚔ \${w.name}\`, sk));
    });

    html.find("[data-action='veh-repair']").click(async () => {
      const sk  = this.actor.system.crewTechSkill ?? 35;
      const res = await WH40KRoll.characteristic(this.actor, "🔧 Emergency Repair", sk);
      if (res.success) {
        const rep = res.degrees;
        const cur = this.actor.system.hull?.value ?? 0;
        const max = this.actor.system.hull?.max   ?? 0;
        await this.actor.update({ "system.hull.value": Math.min(cur + rep, max) });
        await this._chatMsg("🔧 Repair", \`\${rep} Hull Integrity restored.\`);
      }
    });

    html.find(".veh-fire-btn").click(ev => {
      const id     = ev.currentTarget.closest("[data-item-id]").dataset.itemId;
      const weapon = this.actor.items.get(id);
      if (!weapon) return;
      const sk = this.actor.system.crewGunnerSkill ?? 40;
      WH40KRoll.characteristic(this.actor, \`⚔ \${weapon.name}\`, sk);
    });
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

// ═══════════════════════════════════════════════════════════════
//  VOID BATTLE APPLICATION
// ═══════════════════════════════════════════════════════════════

class WH40KVoidBattleApp extends Application {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "void-battle-app",
      title: "⚔ Void Conflict — Tactical Display",
      template: "systems/wh40k-unified/templates/void-battle.html",
      width: 1100,
      height: 660,
      resizable: true,
      classes: ["wh40k", "void-battle"]
    });
  }

  constructor() {
    super();
    this.round      = 1;
    this.activeId   = null;
    this.ships      = [];
    this._refreshShips();
  }

  _refreshShips() {
    this.ships = game.actors
      .filter(a => a.type === "voidship")
      .map(a => ({
        id:      a.id,
        name:    a.name,
        faction: a.system.faction ?? "neutral",
        hull:    { value: a.system.hull?.value ?? 0, max: a.system.hull?.max ?? 1 },
        shields: { value: a.system.shields?.value ?? 0, max: a.system.shields?.max ?? 0 },
        speed:   a.system.speed ?? 0,
        armour:  a.system.armour ?? 0,
        // Map position stored as flag, random initial
        x: a.getFlag("wh40k-unified", "mapX") ?? (0.1 + Math.random() * 0.8),
        y: a.getFlag("wh40k-unified", "mapY") ?? (0.1 + Math.random() * 0.8)
      }));
  }

  getData() {
    return { round: this.round };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Populate ship selector
    const sel = html.find("#vb-ship-select");
    this.ships.forEach(s => {
      const faction = s.faction.charAt(0).toUpperCase() + s.faction.slice(1);
      sel.append(`<option value="${s.id}">[${faction}] ${s.name}</option>`);
    });

    // Ship selector change
    sel.change(ev => {
      this.activeId = ev.currentTarget.value || null;
      this._updateStatBlock(html);
      this._redrawMap(html);
    });

    // Next round
    html.find("#vb-next-round").click(() => {
      this.round++;
      html.find("#vb-round").text(this.round);
      this._log(html, `<b>Round ${this.round}</b> begins. All vessels may act.`);
      // Refresh ship data from actors
      this._refreshShips();
      this._updateStatBlock(html);
      this._redrawMap(html);
    });

    // Close
    html.find("#vb-close").click(() => this.close());

    // Combat actions
    html.find(".vb-action").click(ev => {
      this._handleAction(html, ev.currentTarget.dataset.action);
    });

    // Dice
    html.find(".vb-die").click(ev => {
      const sides = parseInt(ev.currentTarget.dataset.sides);
      const roll  = Math.floor(Math.random() * sides) + 1;
      html.find("#vb-dice-result").text(roll);
      this._log(html, `Rolled <b>d${sides === 100 ? "%" : sides}: ${roll}</b>`);
    });

    // Draw initial map
    this._drawMap(html);

    // Redraw on resize
    new ResizeObserver(() => this._redrawMap(html))
      .observe(html.find("#vb-map-wrap")[0]);
  }

  // ── Actions ────────────────────────────────────────────────

  async _handleAction(html, action) {
    if (!this.activeId) {
      ui.notifications.warn("Select a vessel first.");
      return;
    }
    const actor = game.actors.get(this.activeId);
    if (!actor) return;

    // Create a temporary sheet instance to call its methods
    const sheet = new WH40KVoidShipSheet(actor);

    const actionMap = {
      "lock-on":       () => sheet._lockOn(),
      "evasive":       () => sheet._evasive(),
      "new-course":    () => sheet._newCourse(),
      "brace":         () => sheet._brace(),
      "repair":        () => sheet._repair(),
      "ram":           () => sheet._ram(),
      "fire-all":      () => sheet._fireAll(),
      "silent-running":() => sheet._silentRunning(),
      "torpedo-salvo": () => sheet._torpedoSalvo(),
      "withdraw":      () => sheet._withdraw()
    };

    if (actionMap[action]) {
      await actionMap[action]();
      // Refresh stats and map after action
      this._refreshShips();
      this._updateStatBlock(html);
      this._redrawMap(html);
    }
  }

  // ── Stat Block ─────────────────────────────────────────────

  _updateStatBlock(html) {
    const block = html.find("#vb-stat-block");
    if (!this.activeId) {
      block.html('<div class="vb-stat-empty">Select a vessel to view its status.</div>');
      return;
    }
    const actor = game.actors.get(this.activeId);
    if (!actor) return;
    const s   = actor.system;
    const pct = (v, m) => m > 0 ? Math.round((v / m) * 100) : 0;

    block.html(`
      <div style="font-family:'Cinzel',serif;font-size:0.7rem;color:#d4a840;margin-bottom:6px;">${actor.name}</div>
      <div style="font-size:0.68rem;color:#c0a060;margin-bottom:2px;">
        ${(s.shipClass||'')} ${s.shipType||''}
        &nbsp;|&nbsp; ${(s.faction||'').charAt(0).toUpperCase()+(s.faction||'').slice(1)}
      </div>
      <div style="height:1px;background:#2a2015;margin:5px 0;"></div>
      <div style="font-size:0.68rem;color:#f2e4c0;margin-bottom:2px;">
        Hull: <b style="color:#44aa44">${s.hull?.value??0}/${s.hull?.max??0}</b>
      </div>
      <div style="height:4px;background:rgba(255,255,255,0.05);margin-bottom:5px;">
        <div style="height:100%;width:${pct(s.hull?.value,s.hull?.max)}%;background:linear-gradient(90deg,#1a5a1a,#44aa44);"></div>
      </div>
      <div style="font-size:0.68rem;color:#f2e4c0;margin-bottom:2px;">
        Shields: <b style="color:#4488cc">${s.shields?.value??0}/${s.shields?.max??0}</b>
      </div>
      <div style="height:4px;background:rgba(255,255,255,0.05);margin-bottom:5px;">
        <div style="height:100%;width:${pct(s.shields?.value,s.shields?.max)}%;background:linear-gradient(90deg,#1a3a6a,#4488cc);"></div>
      </div>
      <div style="font-size:0.68rem;color:#f2e4c0;margin-bottom:2px;">
        Crew: <b style="color:#cc8844">${s.crew?.value??0}/${s.crew?.max??0}</b>
      </div>
      <div style="height:4px;background:rgba(255,255,255,0.05);margin-bottom:5px;">
        <div style="height:100%;width:${pct(s.crew?.value,s.crew?.max)}%;background:linear-gradient(90deg,#6a3a1a,#cc8844);"></div>
      </div>
      <div style="height:1px;background:#2a2015;margin:5px 0;"></div>
      <div style="font-size:0.65rem;color:#c0a060;line-height:1.7;">
        Speed: <b style="color:#f2e4c0">${s.speed??0} VU</b><br>
        Armour: <b style="color:#f2e4c0">${s.armour??0}</b><br>
        Turrets: <b style="color:#f2e4c0">${s.turrets??0}</b><br>
        Manoeuvre: <b style="color:#f2e4c0">${s.manoeuvrability??0}</b>
      </div>
      ${s.statusLockedOn  ? '<div style="color:#ffcc00;font-size:0.65rem;margin-top:4px;">🎯 LOCKED ON</div>' : ''}
      ${s.statusEvasive   ? '<div style="color:#44aaff;font-size:0.65rem;">💨 EVASIVE</div>' : ''}
      ${s.statusBraced    ? '<div style="color:#aaaaff;font-size:0.65rem;">🛡 BRACED</div>' : ''}
      ${s.statusSilent    ? '<div style="color:#888888;font-size:0.65rem;">🔕 SILENT RUNNING</div>' : ''}
    `);
  }

  // ── Map Drawing ────────────────────────────────────────────

  _drawMap(html) {
    const wrap   = html.find("#vb-map-wrap")[0];
    const canvas = html.find("#vb-canvas")[0];
    if (!canvas || !wrap) return;

    canvas.width  = wrap.clientWidth  || 600;
    canvas.height = wrap.clientHeight || 500;

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    // Background
    ctx.fillStyle = "#050408";
    ctx.fillRect(0, 0, W, H);

    // Starfield
    const stars = 300;
    for (let i = 0; i < stars; i++) {
      const x    = Math.random() * W;
      const y    = Math.random() * H;
      const r    = Math.random() < 0.04 ? 1.4 : Math.random() < 0.15 ? 0.8 : 0.4;
      const alpha = 0.3 + Math.random() * 0.7;
      // Occasional coloured stars
      const hue = Math.random() < 0.1
        ? (Math.random() < 0.5 ? "rgba(180,200,255," : "rgba(255,200,180,")
        : "rgba(255,255,255,";
      ctx.fillStyle = hue + alpha + ")";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nebula patches
    this._drawNebula(ctx, W * 0.3, H * 0.25, 150, 100, "rgba(60,20,100,0.18)");
    this._drawNebula(ctx, W * 0.7, H * 0.65, 120, 80,  "rgba(20,60,100,0.15)");

    // Grid
    ctx.strokeStyle = "rgba(201,168,76,0.07)";
    ctx.lineWidth   = 0.5;
    const grid = 50;
    for (let x = 0; x < W; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Ships
    const factionColors = {
      imperium: "#4488cc",
      chaos:    "#cc3333",
      eldar:    "#44cc88",
      ork:      "#88cc44",
      tau:      "#44aacc",
      neutral:  "#c9a84c"
    };

    this.ships.forEach(ship => {
      const sx   = ship.x * W;
      const sy   = ship.y * H;
      const col  = factionColors[ship.faction] ?? "#c9a84c";
      const isActive = ship.id === this.activeId;

      // Range ring
      ctx.strokeStyle = col.replace("rgb", "rgba").replace(")", ",0.2)") || "rgba(100,100,200,0.2)";
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Active highlight ring
      if (isActive) {
        ctx.strokeStyle = "rgba(240,192,96,0.6)";
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(sx, sy, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ship silhouette
      ctx.save();
      ctx.translate(sx, sy);
      ctx.shadowColor = col;
      ctx.shadowBlur  = isActive ? 18 : 10;
      ctx.strokeStyle = col;
      ctx.fillStyle   = col + "28"; // transparent fill
      ctx.lineWidth   = isActive ? 2 : 1.5;

      if (ship.faction === "chaos") {
        // Chaos — jagged shape
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(12, -6);
        ctx.lineTo(14, 8);
        ctx.lineTo(6, 14);
        ctx.lineTo(0, 10);
        ctx.lineTo(-6, 14);
        ctx.lineTo(-14, 8);
        ctx.lineTo(-12, -6);
        ctx.closePath();
      } else if (ship.faction === "eldar") {
        // Eldar — elegant teardrop
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.bezierCurveTo(8, -8, 6, 10, 0, 14);
        ctx.bezierCurveTo(-6, 10, -8, -8, 0, -20);
      } else {
        // Imperial / Neutral — classic warship prow
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(11, 6);
        ctx.lineTo(6, 10);
        ctx.lineTo(0, 7);
        ctx.lineTo(-6, 10);
        ctx.lineTo(-11, 6);
        ctx.closePath();
      }

      ctx.fill();
      ctx.stroke();

      // Engine glow
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = col;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 12, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
      ctx.restore();

      // Ship name label
      ctx.save();
      ctx.font        = "bold 10px 'Cinzel', serif";
      ctx.fillStyle   = col;
      ctx.textAlign   = "center";
      ctx.shadowColor = "rgba(0,0,0,0.95)";
      ctx.shadowBlur  = 5;
      const label = ship.name.length > 20 ? ship.name.slice(0, 18) + "…" : ship.name;
      ctx.fillText(label, sx, sy + 30);

      // Hull indicator below name
      const hullPct = ship.hull.max > 0 ? ship.hull.value / ship.hull.max : 0;
      const barW    = 40;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(sx - barW/2, sy + 33, barW, 4);
      ctx.fillStyle = hullPct > 0.5 ? "#44aa44" : hullPct > 0.25 ? "#cc8800" : "#cc2222";
      ctx.fillRect(sx - barW/2, sy + 33, barW * hullPct, 4);
      ctx.restore();
    });
  }

  _drawNebula(ctx, cx, cy, rx, ry, color) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, color);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.save();
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(cx, cy * (rx / ry), rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _redrawMap(html) {
    const wrap   = html.find("#vb-map-wrap")[0];
    const canvas = html.find("#vb-canvas")[0];
    if (!canvas || !wrap) return;
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    this._drawMap(html);
  }

  _log(html, msg) {
    const entry = $(`<div class="vb-log-entry">${msg}</div>`);
    html.find("#vb-log").prepend(entry);
  }
}

// Register the battle app globally for macros
Hooks.once("ready", () => {
  window.WH40K = window.WH40K || {};
  window.WH40K.openVoidBattle = () => new WH40KVoidBattleApp().render(true);
});

// ═══════════════════════════════════════════════════════════════
//  VOID SHIP CRITICAL DAMAGE TABLE
// ═══════════════════════════════════════════════════════════════

const VOID_CRIT_TABLE = [
  { roll: 1,  name: "Minor Hull Breach",        effect: "Armour reduced by 1 until repaired. No other effect." },
  { roll: 2,  name: "Crew Casualties",           effect: "Lose 1d10 Crew Integrity. Morale test or lose 1d5 Morale." },
  { roll: 3,  name: "Augur Interference",        effect: "Detection reduced by 10 for 1d5 rounds." },
  { roll: 4,  name: "Fire!",                     effect: "A fire breaks out. Lose 1 Hull Integrity per round until extinguished (Tech-Use test, Difficulty 30)." },
  { roll: 5,  name: "Weapons Malfunction",       effect: "One random weapon component is Damaged. -2 Str until repaired." },
  { roll: 6,  name: "Drive Damaged",             effect: "Speed reduced by 2 until repaired. Manoeuvrability -5." },
  { roll: 7,  name: "Void Shield Overload",      effect: "All void shields go down. They cannot regenerate for 1d5 rounds." },
  { roll: 8,  name: "Crew Panic",                effect: "Crew Morale drops by 1d10. If below 20, crew refuses orders until Command test passed." },
  { roll: 9,  name: "Structural Damage",         effect: "Hull Integrity maximum reduced by 1d5. Cannot be repaired in combat." },
  { roll: 10, name: "Bridge Hit",                effect: "Command tests at -10 for remainder of combat. Captain must pass Agility test or take 1d10 wounds." },
  { roll: 11, name: "Warp Engine Fluctuation",   effect: "Warp engine damaged. If in warp, emergency translation immediately. Roll on Warp Encounter table." },
  { roll: 12, name: "Catastrophic Hull Breach",  effect: "Lose 2d10 Hull Integrity immediately. Explosive decompression kills 1d5 Crew Integrity." },
  { roll: 13, name: "Magazine Detonation",       effect: "One weapon component destroyed. All nearby crew stations take 1d10 damage. Fire starts." },
  { roll: 14, name: "Drive Destroyed",           effect: "Speed reduced to 1 VU. Cannot use any manoeuvring actions until repaired (requires port facilities)." },
  { roll: 15, name: "CATASTROPHIC DESTRUCTION",  effect: "The vessel breaks apart. All hands lost unless evacuation is successful (Command test, Difficulty 50)." }
];

class WH40KCritTableApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "void-crit-table",
      title: "Void Ship Critical Damage",
      template: "systems/wh40k-unified/templates/crit-table.html",
      width: 560, height: 500,
      resizable: true,
      classes: ["wh40k", "crit-table"]
    });
  }

  getData() { return { entries: VOID_CRIT_TABLE }; }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("#vct-roll").click(async () => {
      const roll   = await new Roll("1d15").evaluate();
      const result = VOID_CRIT_TABLE.find(e => e.roll === roll.total) || VOID_CRIT_TABLE[roll.total - 1];
      html.find("#vct-result-roll").text(roll.total);
      html.find("#vct-result-name").text(result.name);
      html.find("#vct-result-effect").text(result.effect);
      html.find("#vct-result-block").show();

      // Highlight the row
      html.find(".vct-row").removeClass("vct-row-active");
      html.find(`.vct-row[data-roll="${roll.total}"]`).addClass("vct-row-active");

      // Post to chat
      await ChatMessage.create({
        content: `<div class="wh40k-roll-card">
          <div class="wh40k-roll-header">
            <span class="wh40k-roll-actor">Critical Damage — Roll ${roll.total}</span>
            <span class="wh40k-roll-label">${result.name}</span>
          </div>
          <div class="wh40k-roll-body" style="display:block;padding:8px;">
            <div style="color:#f2e4c0;font-size:0.9rem;line-height:1.6;">${result.effect}</div>
          </div>
        </div>`
      });
    });

    html.find(".vct-row").click(ev => {
      const roll   = parseInt(ev.currentTarget.dataset.roll);
      const result = VOID_CRIT_TABLE[roll - 1];
      html.find("#vct-result-roll").text(roll);
      html.find("#vct-result-name").text(result.name);
      html.find("#vct-result-effect").text(result.effect);
      html.find("#vct-result-block").show();
      html.find(".vct-row").removeClass("vct-row-active");
      ev.currentTarget.classList.add("vct-row-active");
    });
  }
}

Hooks.once("ready", () => {
  window.WH40K = window.WH40K || {};
  window.WH40K.openCritTable = () => new WH40KCritTableApp().render(true);
});

// ═══════════════════════════════════════════════════════════════
//  COLONY SHEET
// ═══════════════════════════════════════════════════════════════

const COLONY_BUILDING_PRESETS = {
  starport:    { name: "Starport",               icon: "🚀", type: "infrastructure", bonus: "+10 Trade, +1 Wealth/turn, enables off-world trade",     description: "A landing facility for voidships and trade vessels." },
  fortress:    { name: "Fortress",               icon: "🏰", type: "military",        bonus: "+20 Military, +10 Security, -2 Xenos raid damage",        description: "A heavily fortified military installation." },
  agri:        { name: "Agri-District",          icon: "🌾", type: "industry",        bonus: "+1 Food/turn, +5 Morale if stocked",                      description: "Vast farmlands feeding the colony population." },
  mine:        { name: "Mine Complex",           icon: "⛏",  type: "industry",        bonus: "+1 Materials/turn, +5 Infrastructure",                   description: "Extraction facilities harvesting raw materials." },
  chapel:      { name: "Chapel of the Emperor",  icon: "✝",  type: "faith",           bonus: "+10 Loyalty, +5 Morale/turn, -10 Heresy risk",           description: "A place of worship strengthening the Emperor's light." },
  medicae:     { name: "Medicae Facility",       icon: "⚕",  type: "medicae",         bonus: "+1 Medicae/turn, +5 Morale, reduces Disease severity",   description: "Hospitals and medical centres serving the populace." },
  arbites:     { name: "Arbites Precinct",       icon: "⚖",  type: "infrastructure", bonus: "+15 Security, +5 Loyalty, -15 Civil Unrest risk",         description: "Imperial law enforcers keeping order." },
  mechanicus:  { name: "Mechanicus Outpost",     icon: "⚙",  type: "knowledge",       bonus: "+10 Infrastructure, +5 Materials/turn, Tech-Use +10",    description: "Adeptus Mechanicus presence maintaining and improving technology." },
  market:      { name: "Trade Market",           icon: "💰", type: "trade",           bonus: "+15 Trade, +1 Wealth/turn, +5 Morale",                   description: "A bustling marketplace encouraging commerce." },
  barracks:    { name: "Barracks",               icon: "🎖",  type: "military",        bonus: "+10 Military, +1 Personnel/turn",                        description: "Training and housing facilities for the colony garrison." },
  hive:        { name: "Hive Block",             icon: "🏙",  type: "infrastructure", bonus: "+15 Infrastructure, houses 500,000 citizens",             description: "Towering residential structures for the masses." },
  library:     { name: "Librarium",              icon: "📚", type: "knowledge",       bonus: "+10 Loyalty, +5 Trade, Scholastic Lore tests +10",       description: "Archives and knowledge repositories." }
};

const COLONY_EVENT_TABLE = [
  { min: 1,  max: 10,  name: "Blessed Harvest",       severity: "minor",    effect: "+1 Food this turn. The Emperor provides.",                                description: "Favourable conditions have produced an exceptional harvest." },
  { min: 11, max: 20,  name: "Trade Windfall",         severity: "minor",    effect: "+1 Wealth this turn.",                                                   description: "An unexpected trade opportunity brings profit." },
  { min: 21, max: 30,  name: "Pilgrims Arrive",        severity: "minor",    effect: "+5 Loyalty, +5 Morale.",                                                 description: "A wave of faithful pilgrims arrives, strengthening devotion." },
  { min: 31, max: 40,  name: "Nothing of Note",        severity: "minor",    effect: "No effect this turn.",                                                   description: "A quiet period. Enjoy it while it lasts." },
  { min: 41, max: 50,  name: "Cult Activity Detected", severity: "minor",    effect: "-5 Security. Requires investigation.",                                   description: "Arbites have detected suspicious gatherings in the lower districts." },
  { min: 51, max: 60,  name: "Supply Shortage",        severity: "major",    effect: "-1 Food, -5 Morale.",                                                    description: "Supply chains have broken down, causing shortages." },
  { min: 61, max: 70,  name: "Labour Dispute",         severity: "major",    effect: "-5 Trade, -5 Infrastructure this turn.",                                 description: "Workers have downed tools in protest of conditions." },
  { min: 71, max: 75,  name: "Disease Outbreak",       severity: "major",    effect: "-1 Personnel, -10 Morale. Medicae (40) test to contain.",                description: "A contagion spreads through the population." },
  { min: 76, max: 80,  name: "Xenos Raid",             severity: "major",    effect: "-5 Military, random building damaged. Military (50) test to repel.",     description: "Xenos raiders strike from beyond the colony perimeter." },
  { min: 81, max: 85,  name: "Heretical Uprising",     severity: "critical", effect: "-10 Loyalty, -10 Security. Military (60) test to suppress.",            description: "A hidden cult has finally revealed itself in open rebellion." },
  { min: 86, max: 90,  name: "Warp Disturbance",       severity: "critical", effect: "-10 Morale, -10 Loyalty. WP (50) test required from colony psyker.",   description: "The veil between real space and the Warp grows dangerously thin." },
  { min: 91, max: 95,  name: "Invasion!",              severity: "critical", effect: "Full military engagement required. Military vs threat strength test.",   description: "A major enemy force launches a full-scale assault on the colony." },
  { min: 96, max: 100, name: "Catastrophe",            severity: "critical", effect: "GM determines effects. Roll on Catastrophe sub-table.",                 description: "Something has gone terribly, terribly wrong." },
];

class WH40KColonySheet extends WH40KBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "colony"],
      template: "systems/wh40k-unified/templates/colony-sheet.html",
      width: 900, height: 760,
      tabs: [{ navSelector: ".wh40k-tabs", contentSelector: ".wh40k-tab-content", initial: "overview" }],
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Tab handling
    html.find(".wh40k-tab").click(ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      html.find(".wh40k-tab").removeClass("active");
      ev.currentTarget.classList.add("active");
      html.find(".wh40k-tab-panel").hide();
      html.find(`.wh40k-tab-panel[data-tab="${tab}"]`).show();
    });
    html.find(".wh40k-tab-panel").hide();
    html.find(".wh40k-tab-panel").first().show();
    html.find(".wh40k-tab").first().addClass("active");

    // Colony actions
    html.find("[data-action='col-end-turn']").click(()    => this._endTurn());
    html.find("[data-action='col-roll-event']").click(()  => this._rollEvent());
    html.find("[data-action='col-tithe']").click(()       => this._submitTithe());

    // Add building
    html.find("[data-action='col-add-building']").click(() => this._addBuilding());

    // Delete building
    html.find(".col-del-building").click(ev => {
      const key = ev.currentTarget.dataset.key;
      this._deleteBuilding(key);
    });

    // Preset buildings
    html.find(".col-preset-btn").click(ev => {
      const preset = ev.currentTarget.dataset.preset;
      this._addPresetBuilding(preset);
    });

    // Add faction
    html.find("[data-action='col-add-faction']").click(() => this._addFaction());

    // Delete faction
    html.find(".col-del-faction").click(ev => {
      const key = ev.currentTarget.dataset.key;
      this._deleteFaction(key);
    });

    // Add event
    html.find("[data-action='col-add-event']").click(() => this._addEvent());

    // Delete event
    html.find(".col-del-event").click(ev => {
      const key = ev.currentTarget.dataset.key;
      this._deleteEvent(key);
    });

    // Faction standing dot update on select change
    html.find(".col-faction-standing-sel").change(ev => {
      const dot = ev.currentTarget.closest(".col-faction-row")?.querySelector(".col-faction-standing-dot");
      if (dot) dot.className = `col-faction-standing-dot col-standing-${ev.currentTarget.value}`;
    });

    // Draw planet visualisation
    this._drawPlanet(html);

    // Redraw when planet type changes
    html.find('[name="system.planetType"]').change(() => this._drawPlanet(html));
  }

  _drawPlanet(html) {
    const canvas = html.find("#col-planet-canvas")[0];
    if (!canvas) return;
    const planetType = this.actor.system.planetType || "civilised";
    // Use actor id as seed for consistent appearance
    const seed = Array.from(this.actor.id || "seed").reduce((a, c) => a + c.charCodeAt(0), 0);
    PlanetVis.draw(canvas, planetType, seed);
  }

  // ── Colony Actions ──────────────────────────────────────────

  async _endTurn() {
    const sys = this.actor.system;
    const updates = {};
    const log = [];

    // Process upkeep
    const newFood = Math.max(0, (sys.food?.value ?? 0) - (sys.upkeepFood ?? 0));
    const newMats = Math.max(0, (sys.materials?.value ?? 0) - (sys.upkeepMaterials ?? 0));
    const newWeal = Math.max(0, (sys.wealth?.value ?? 0) - (sys.upkeepWealth ?? 0));

    if (sys.upkeepFood > 0) {
      updates["system.food.value"] = newFood;
      log.push(`Food: ${sys.food?.value} → ${newFood} (upkeep: -${sys.upkeepFood})`);
      if (newFood <= 0) {
        updates["system.statusFamine"] = true;
        updates["system.morale.value"] = Math.max(0, (sys.morale?.value ?? 50) - 10);
        log.push(`⚠ FAMINE! No food remaining. Morale -10.`);
      }
    }

    if (sys.upkeepWealth > 0) {
      updates["system.wealth.value"] = newWeal;
      log.push(`Wealth: ${sys.wealth?.value} → ${newWeal} (upkeep: -${sys.upkeepWealth})`);
    }

    // Morale drift — moves toward 50 slowly
    const currentMorale = sys.morale?.value ?? 50;
    if (currentMorale < 50 && !sys.statusCivilUnrest) {
      const drift = Math.min(2, 50 - currentMorale);
      updates["system.morale.value"] = currentMorale + drift;
      log.push(`Morale drifts up: ${currentMorale} → ${currentMorale + drift}`);
    }

    // Warn if morale is critical
    if ((updates["system.morale.value"] ?? currentMorale) < 20) {
      updates["system.statusCivilUnrest"] = true;
      log.push(`⚠ CIVIL UNREST! Morale below 20.`);
    }

    await this.actor.update(updates);

    // Post summary to chat
    const content = `
      <div class="wh40k-roll-card">
        <div class="wh40k-roll-header">
          <span class="wh40k-roll-actor">${this.actor.name}</span>
          <span class="wh40k-roll-label">⏭ End of Colony Turn</span>
        </div>
        <div class="wh40k-roll-body" style="display:block;padding:8px;">
          ${log.map(l => `<div style="font-size:0.82rem;color:#f2e4c0;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04);">${l}</div>`).join("")}
        </div>
      </div>`;

    await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
  }

  async _rollEvent() {
    const roll   = await new Roll("1d100").evaluate();
    const result = COLONY_EVENT_TABLE.find(e => roll.total >= e.min && roll.total <= e.max);
    if (!result) return;

    const severityColor = { minor: "#f2e4c0", major: "#cc8844", critical: "#dd3333" }[result.severity] ?? "#f2e4c0";

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh40k-roll-card">
          <div class="wh40k-roll-header">
            <span class="wh40k-roll-actor">${this.actor.name}</span>
            <span class="wh40k-roll-label">🎲 Colony Event — Roll ${roll.total}</span>
          </div>
          <div class="wh40k-roll-body" style="display:block;padding:10px;">
            <div style="font-family:'Cinzel Decorative',serif;font-size:0.95rem;color:${severityColor};margin-bottom:6px;">${result.name}</div>
            <div style="font-size:0.82rem;color:#c0a060;font-style:italic;margin-bottom:6px;">${result.description}</div>
            <div style="font-size:0.85rem;color:#f2e4c0;font-weight:600;">${result.effect}</div>
          </div>
        </div>`
    });
  }

  async _submitTithe() {
    const pf  = this.actor.system.profitFactor?.value ?? 0;
    const loyalty = this.actor.system.loyalty?.value ?? 50;
    const roll = await new Roll("1d100").evaluate();
    const target = loyalty + 10;
    const ok   = roll.total <= target;

    let consequence = ok
      ? `Tithe accepted. Profit Factor contribution noted. +5 Loyalty.`
      : `Tithe rejected as insufficient! -10 Loyalty. Administratum investigation likely.`;

    if (ok) await this.actor.update({ "system.loyalty.value": Math.min(100, loyalty + 5) });
    else    await this.actor.update({ "system.loyalty.value": Math.max(0,   loyalty - 10) });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh40k-roll-card">
          <div class="wh40k-roll-header">
            <span class="wh40k-roll-actor">${this.actor.name}</span>
            <span class="wh40k-roll-label">📜 Imperial Tithe</span>
          </div>
          <div class="wh40k-roll-body" style="display:block;padding:8px;">
            <div>Roll: <b style="color:#d4a840">${roll.total}</b> vs Loyalty ${target}: <span style="color:${ok ? '#44aa44' : '#dd3333'}">${ok ? 'Accepted' : 'Rejected'}</span></div>
            <div style="margin-top:4px;color:#f2e4c0;">${consequence}</div>
          </div>
        </div>`
    });
  }

  // ── Data Helpers ────────────────────────────────────────────

  async _addBuilding() {
    const buildings = foundry.utils.deepClone(this.actor.system.buildings || {});
    const key = "b" + Date.now();
    buildings[key] = { name: "New Building", icon: "🏛", type: "infrastructure", bonus: "", description: "", status: "constructing" };
    await this.actor.update({ "system.buildings": buildings });
  }

  async _addPresetBuilding(presetKey) {
    const preset = COLONY_BUILDING_PRESETS[presetKey];
    if (!preset) return;
    const buildings = foundry.utils.deepClone(this.actor.system.buildings || {});
    const key = "b" + Date.now();
    buildings[key] = { ...preset, status: "active" };
    await this.actor.update({ "system.buildings": buildings });
    ui.notifications.info(`${preset.name} added to colony.`);
  }

  async _deleteBuilding(key) {
    const buildings = foundry.utils.deepClone(this.actor.system.buildings || {});
    delete buildings[key];
    await this.actor.update({ "system.buildings": buildings });
  }

  async _addFaction() {
    const factions = foundry.utils.deepClone(this.actor.system.factions || {});
    const key = "f" + Date.now();
    factions[key] = { name: "New Faction", standing: "neutral", value: 0, notes: "" };
    await this.actor.update({ "system.factions": factions });
  }

  async _deleteFaction(key) {
    const factions = foundry.utils.deepClone(this.actor.system.factions || {});
    delete factions[key];
    await this.actor.update({ "system.factions": factions });
  }

  async _addEvent() {
    const events = foundry.utils.deepClone(this.actor.system.activeEvents || {});
    const key = "e" + Date.now();
    events[key] = { name: "New Event", severity: "minor", description: "", duration: "" };
    await this.actor.update({ "system.activeEvents": events });
  }

  async _deleteEvent(key) {
    const events = foundry.utils.deepClone(this.actor.system.activeEvents || {});
    delete events[key];
    await this.actor.update({ "system.activeEvents": events });
  }
}

// ═══════════════════════════════════════════════════════════════
//  NATO SYMBOL DRAWING UTILITY
//  Based on NATO APP-6 / MIL-STD-2525 symbology
// ═══════════════════════════════════════════════════════════════

const NATOSymbols = {

  // Affiliation frame colours
  COLORS: {
    imperium: { fill: "#aad4ff", stroke: "#003399", text: "#000033" },
    chaos:    { fill: "#ffaaaa", stroke: "#990000", text: "#330000" },
    eldar:    { fill: "#aaffaa", stroke: "#006600", text: "#003300" },
    ork:      { fill: "#ddee88", stroke: "#665500", text: "#332200" },
    tau:      { fill: "#aaddff", stroke: "#004466", text: "#002233" },
    tyranid:  { fill: "#ddaaff", stroke: "#440066", text: "#220033" },
    necron:   { fill: "#aaffdd", stroke: "#005544", text: "#002211" },
    neutral:  { fill: "#ffffff", stroke: "#666666", text: "#333333" }
  },

  // Draw a complete NATO symbol on a canvas context
  // cx, cy = centre; size = half-width
  draw(ctx, unit, cx, cy, size, selected) {
    const col = this.COLORS[unit.faction] || this.COLORS.neutral;
    const s   = size;

    ctx.save();
    ctx.translate(cx, cy);

    // Glow for selected
    if (selected) {
      ctx.shadowColor  = "#f5c842";
      ctx.shadowBlur   = 14;
    }

    // ── Draw affiliation frame ──────────────────────────────
    // Rectangle base for all ground units (NATO standard)
    ctx.fillStyle   = col.fill;
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth   = 2;

    ctx.beginPath();
    ctx.rect(-s, -s * 0.6, s * 2, s * 1.2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    // ── Draw unit type icon inside rectangle ─────────────────
    ctx.strokeStyle = col.stroke;
    ctx.fillStyle   = col.stroke;
    ctx.lineWidth   = 1.5;

    this._drawTypeIcon(ctx, unit.unitType, s, col);

    // ── Scale indicator (size echelon above rectangle) ───────
    this._drawEchelon(ctx, unit.scale, s, col.stroke);

    // ── Strength label below rectangle ───────────────────────
    if (unit.strength) {
      ctx.fillStyle = col.text;
      ctx.font      = `bold ${Math.max(8, s * 0.4)}px 'Cinzel', serif`;
      ctx.textAlign = "center";
      const pct = unit.strength.max > 0 ? unit.strength.value / unit.strength.max : 1;
      const strengthColor = pct > 0.6 ? col.stroke : pct > 0.3 ? "#cc8800" : "#cc2222";
      ctx.fillStyle = strengthColor;
      ctx.fillText(`${unit.strength.value}/${unit.strength.max}`, 0, s * 0.9);
    }

    // ── Routing/Pinned markers ───────────────────────────────
    if (unit.statusRouting) {
      ctx.fillStyle = "#cc2222";
      ctx.font = `${s * 0.5}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("↩", s * 0.8, -s * 0.5);
    }

    if (unit.statusEntrenched) {
      ctx.fillStyle = "#4488cc";
      ctx.font = `${s * 0.5}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("🛡", -s * 0.8, -s * 0.5);
    }

    ctx.restore();
  },

  _drawTypeIcon(ctx, unitType, s, col) {
    const w = s * 0.8;
    const h = s * 0.45;

    switch(unitType) {
      case "light_infantry":
      case "medium_infantry":
      case "heavy_infantry":
      case "mechanised":
      case "special_forces":
        // Infantry: X crossing the rectangle
        ctx.beginPath();
        ctx.moveTo(-w, -h); ctx.lineTo(w, h);
        ctx.moveTo(w, -h);  ctx.lineTo(-w, h);
        ctx.stroke();
        if (unitType === "mechanised") {
          // Oval below cross
          ctx.beginPath();
          ctx.ellipse(0, h * 0.3, w * 0.4, h * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case "light_armour":
      case "medium_armour":
      case "heavy_armour":
      case "super_heavy":
        // Armour: oval/ellipse
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.7, h * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (unitType === "super_heavy") {
          // Double oval
          ctx.beginPath();
          ctx.ellipse(0, 0, w * 0.45, h * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case "light_artillery":
      case "medium_artillery":
      case "heavy_artillery":
        // Artillery: circle/dot
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "air_defence":
        // Air defence: circle with upward line
        ctx.beginPath();
        ctx.arc(0, h * 0.1, h * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.3); ctx.lineTo(0, -h * 0.8);
        ctx.moveTo(-w * 0.2, -h * 0.6); ctx.lineTo(0, -h * 0.8); ctx.lineTo(w * 0.2, -h * 0.6);
        ctx.stroke();
        break;

      case "aircraft":
        // Aircraft: diagonal line
        ctx.beginPath();
        ctx.moveTo(-w * 0.7, h * 0.4); ctx.lineTo(w * 0.7, -h * 0.4);
        ctx.stroke();
        break;

      case "xenos":
        // Xenos: question mark style cross
        ctx.beginPath();
        ctx.moveTo(-w, 0); ctx.lineTo(w, 0);
        ctx.moveTo(0, -h); ctx.lineTo(0, h);
        ctx.stroke();
        break;

      default:
        // Default: simple X
        ctx.beginPath();
        ctx.moveTo(-w * 0.5, -h * 0.5); ctx.lineTo(w * 0.5, h * 0.5);
        ctx.moveTo(w * 0.5, -h * 0.5);  ctx.lineTo(-w * 0.5, h * 0.5);
        ctx.stroke();
    }
  },

  _drawEchelon(ctx, scale, s, color) {
    ctx.fillStyle   = color;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    const y = -s * 0.75;

    const echelons = {
      squad:    () => { /* Single dot */ ctx.beginPath(); ctx.arc(0, y, 2, 0, Math.PI*2); ctx.fill(); },
      platoon:  () => { /* Three dots */ [-6,0,6].forEach(x => { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill(); }); },
      company:  () => { /* Roman I */ ctx.beginPath(); ctx.moveTo(0, y-5); ctx.lineTo(0, y+5); ctx.stroke(); },
      regiment: () => { /* Roman II */ [-3,3].forEach(x => { ctx.beginPath(); ctx.moveTo(x, y-5); ctx.lineTo(x, y+5); ctx.stroke(); }); },
      division: () => { /* Roman X */ ctx.beginPath(); ctx.moveTo(-5,y-5); ctx.lineTo(5,y+5); ctx.moveTo(5,y-5); ctx.lineTo(-5,y+5); ctx.stroke(); },
      army:     () => { /* Roman XX */ [-6,0,6].forEach(() => {}); ctx.beginPath(); ctx.moveTo(-8,y-5); ctx.lineTo(-2,y+5); ctx.moveTo(-2,y-5); ctx.lineTo(-8,y+5); ctx.moveTo(2,y-5); ctx.lineTo(8,y+5); ctx.moveTo(8,y-5); ctx.lineTo(2,y+5); ctx.stroke(); }
    };

    if (echelons[scale]) echelons[scale]();
  }
};

// ═══════════════════════════════════════════════════════════════
//  PLANET VISUALISATION UTILITY
// ═══════════════════════════════════════════════════════════════

const PlanetVis = {

  PLANET_THEMES: {
    civilised:  { base: [60,80,120],   atmo: [100,140,200,0.5], clouds: true,  rings: false, ice: false,  lava: false  },
    hive:       { base: [80,70,60],    atmo: [120,100,80,0.4],  clouds: false, rings: false, ice: false,  lava: false  },
    forge:      { base: [80,60,40],    atmo: [180,100,40,0.5],  clouds: false, rings: false, ice: false,  lava: true   },
    agri:       { base: [50,100,60],   atmo: [80,160,100,0.4],  clouds: true,  rings: false, ice: false,  lava: false  },
    feral:      { base: [60,90,50],    atmo: [90,140,80,0.35],  clouds: true,  rings: false, ice: false,  lava: false  },
    frontier:   { base: [100,80,60],   atmo: [140,120,90,0.3],  clouds: true,  rings: false, ice: false,  lava: false  },
    death:      { base: [80,40,30],    atmo: [120,60,40,0.6],   clouds: false, rings: false, ice: false,  lava: true   },
    daemon:     { base: [100,20,20],   atmo: [160,20,20,0.7],   clouds: false, rings: false, ice: false,  lava: true   },
    xenos:      { base: [40,80,100],   atmo: [60,120,140,0.5],  clouds: true,  rings: true,  ice: false,  lava: false  },
    void:       { base: [40,50,70],    atmo: [60,80,120,0.3],   clouds: false, rings: true,  ice: false,  lava: false  },
  },

  draw(canvas, planetType, seed) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W   = canvas.width;
    const H   = canvas.height;
    const cx  = W / 2;
    const cy  = H / 2;
    const r   = Math.min(W, H) * 0.38;

    const theme = this.PLANET_THEMES[planetType] || this.PLANET_THEMES.civilised;
    const rng   = this._seededRng(seed || 42);

    // Clear
    ctx.fillStyle = "#05040a";
    ctx.fillRect(0, 0, W, H);

    // Background stars
    for (let i = 0; i < 120; i++) {
      const x = rng() * W, y = rng() * H;
      const a = 0.3 + rng() * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, rng() < 0.05 ? 1.2 : 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rings (behind planet)
    if (theme.rings) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.3);
      const [br, bg, bb] = theme.base;
      for (let i = 3; i >= 1; i--) {
        ctx.strokeStyle = `rgba(${br},${bg},${bb},${0.15 * i})`;
        ctx.lineWidth   = r * 0.12 * i;
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.3 + i * 0.2), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Planet base sphere
    const [br, bg, bb] = theme.base;
    const gradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    gradient.addColorStop(0,   `rgb(${Math.min(255, br + 80)},${Math.min(255, bg + 80)},${Math.min(255, bb + 80)})`);
    gradient.addColorStop(0.5, `rgb(${br},${bg},${bb})`);
    gradient.addColorStop(1,   `rgb(${Math.max(0, br - 60)},${Math.max(0, bg - 60)},${Math.max(0, bb - 60)})`);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = gradient;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Terrain patches
    for (let i = 0; i < 8; i++) {
      const tx   = cx + (rng() * 2 - 1) * r * 0.9;
      const ty   = cy + (rng() * 2 - 1) * r * 0.9;
      const tr   = r * (0.1 + rng() * 0.35);
      const tint = rng();
      let tc;
      if (theme.lava) {
        tc = `rgba(${200 + rng()*55},${50 + rng()*80},0,${0.3 + rng()*0.3})`;
      } else if (theme.ice) {
        tc = `rgba(220,240,255,${0.2 + rng()*0.3})`;
      } else {
        tc = `rgba(${br + (rng()-0.5)*60},${bg + (rng()-0.5)*60},${bb + (rng()-0.5)*60},${0.2 + rng()*0.25})`;
      }
      const tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr);
      tg.addColorStop(0, tc);
      tg.addColorStop(1, "transparent");
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cloud layer
    if (theme.clouds) {
      for (let i = 0; i < 5; i++) {
        const cx2 = cx + (rng() * 2 - 1) * r * 0.7;
        const cy2 = cy + (rng() * 2 - 1) * r * 0.7;
        const cr  = r * (0.15 + rng() * 0.3);
        const cg  = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cr);
        cg.addColorStop(0, `rgba(255,255,255,${0.25 + rng() * 0.2})`);
        cg.addColorStop(1, "transparent");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx2, cy2, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Lava cracks
    if (theme.lava) {
      for (let i = 0; i < 6; i++) {
        const lx = cx + (rng() * 2 - 1) * r * 0.8;
        const ly = cy + (rng() * 2 - 1) * r * 0.8;
        ctx.strokeStyle = `rgba(255,${100 + rng()*100},0,${0.4 + rng()*0.4})`;
        ctx.lineWidth   = 1 + rng() * 2;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        for (let j = 0; j < 3; j++) {
          ctx.lineTo(lx + (rng()-0.5)*r*0.3, ly + (rng()-0.5)*r*0.3);
        }
        ctx.stroke();
      }
    }

    ctx.restore();

    // Atmosphere glow
    const [ar, ag, ab, aa] = theme.atmo;
    const atmoGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.2);
    atmoGrad.addColorStop(0, `rgba(${ar},${ag},${ab},${aa})`);
    atmoGrad.addColorStop(1, "transparent");
    ctx.fillStyle = atmoGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Terminator shadow (night side)
    const shadowGrad = ctx.createRadialGradient(cx + r * 0.5, cy, 0, cx, cy, r);
    shadowGrad.addColorStop(0.4, "transparent");
    shadowGrad.addColorStop(1,   "rgba(0,0,0,0.7)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    // Specular highlight
    const specGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.35, cy - r * 0.35, r * 0.5);
    specGrad.addColorStop(0, "rgba(255,255,255,0.12)");
    specGrad.addColorStop(1, "transparent");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = specGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    // Moons
    const numMoons = Math.floor(rng() * 2);
    for (let i = 0; i < numMoons; i++) {
      const angle  = rng() * Math.PI * 2;
      const dist   = r * (1.5 + rng() * 0.5);
      const mx     = cx + Math.cos(angle) * dist;
      const my     = cy + Math.sin(angle) * dist;
      const mr     = r * (0.08 + rng() * 0.1);
      const moonG  = ctx.createRadialGradient(mx - mr*0.3, my - mr*0.3, mr*0.1, mx, my, mr);
      moonG.addColorStop(0, "#cccccc");
      moonG.addColorStop(1, "#444444");
      ctx.fillStyle = moonG;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _seededRng(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
  }
};

// ═══════════════════════════════════════════════════════════════
//  REGIMENT SHEET
// ═══════════════════════════════════════════════════════════════

// Quality stat lookup (BFK pg 126)
const QUALITY_STATS = {
  conscript: { bs: 20, ws: 20, t: 25, armour: 2 },
  trained:   { bs: 35, ws: 35, t: 30, armour: 4 },
  veteran:   { bs: 45, ws: 45, t: 35, armour: 5 },
  elite:     { bs: 55, ws: 55, t: 40, armour: 6 },
  legendary: { bs: 70, ws: 70, t: 45, armour: 8 }
};

class WH40KRegimentSheet extends WH40KBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wh40k", "sheet", "regiment"],
      template: "systems/wh40k-unified/templates/regiment-sheet.html",
      width: 780, height: 660,
      tabs: [{ navSelector: ".wh40k-tabs", contentSelector: ".wh40k-tab-content", initial: "stats" }],
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    const s    = data.system;
    data.strengthPct = s.strength?.max > 0 ? Math.round((s.strength.value / s.strength.max) * 100) : 0;
    data.moralePct   = s.morale?.max   > 0 ? Math.round((s.morale.value   / s.morale.max)   * 100) : 0;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Auto-fill stats when quality changes
    html.find('[name="system.quality"]').change(ev => {
      const q     = ev.currentTarget.value;
      const stats = QUALITY_STATS[q];
      if (!stats) return;
      this.actor.update({
        "system.ballisticSkill": stats.bs,
        "system.weaponSkill":    stats.ws,
        "system.toughness":      stats.t,
        "system.armour":         stats.armour
      });
    });

    // Combat actions
    html.find('[data-action="rgt-attack"]').click(()        => this._attack());
    html.find('[data-action="rgt-assault"]').click(()       => this._assault());
    html.find('[data-action="rgt-feint"]').click(()         => this._feint());
    html.find('[data-action="rgt-entrench"]').click(()      => this._entrench());
    html.find('[data-action="rgt-reinforce"]').click(()     => this._reinforce());
    html.find('[data-action="rgt-withdraw"]').click(()      => this._withdraw());
    html.find('[data-action="rgt-morale-check"]').click(()  => this._moraleCheck());
    html.find('[data-action="rgt-open-battle"]').click(()   => new WH40KGroundBattleApp().render(true));

    // Draw NATO symbol preview
    this._drawNATOPreview(html);
  }

  _drawNATOPreview(html) {
    const canvas = html.find("#rgt-nato-canvas")[0];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#141008";
    ctx.fillRect(0, 0, 200, 120);
    NATOSymbols.draw(ctx, this.actor.system, 100, 60, 28, false);
  }

  // ── BFK Ground Combat Actions ──────────────────────────────

  async _attack() {
    const sys = this.actor.system;
    const sk  = sys.ballisticSkill ?? 35;
    const res = await WH40KRoll.characteristic(this.actor, "⚔ Attack", sk);
    if (res.success) {
      const dmg = Math.ceil((sys.strength?.value ?? 100) * 0.1 * res.degrees);
      await this._chatMsg("⚔ Attack Result", `Hit! Inflicts <b style="color:#dd3333">${dmg} Strength damage</b> on target. (${res.degrees} DoS × 10% Strength)`);
    }
  }

  async _assault() {
    const sys = this.actor.system;
    const sk  = sys.weaponSkill ?? 35;
    const res = await WH40KRoll.characteristic(this.actor, "💥 Assault", sk);
    if (res.success) {
      // Armour units double Strength on assault (BFK rule)
      const isArmour = sys.unitType?.includes("armour") || sys.unitType?.includes("armoured");
      const mult     = isArmour ? 2 : 1;
      const dmg      = Math.ceil((sys.strength?.value ?? 100) * 0.15 * res.degrees * mult);
      const armourNote = isArmour ? " (Armoured: Strength doubled)" : "";
      await this._chatMsg("💥 Assault Result", `Close assault succeeds! <b style="color:#dd3333">${dmg} Strength damage</b>${armourNote}`);
    }
  }

  async _feint() {
    const sk  = this.actor.system.commanderSkill ?? 40;
    const res = await WH40KRoll.characteristic(this.actor, "🎭 Feint", sk);
    if (res.success) {
      await this._chatMsg("🎭 Feint", `Feint successful! Enemy suffers -${res.degrees * 10} to next defensive test.`);
    }
  }

  async _entrench() {
    await this.actor.update({ "system.statusEntrenched": true });
    await this._chatMsg("🛡 Entrench", "Unit has dug in. +20 to defensive tests until next move action.");
  }

  async _reinforce() {
    const sys  = this.actor.system;
    const rein = sys.reinforcements ?? 0;
    if (rein <= 0) { ui.notifications.warn("No reinforcements available!"); return; }
    const added = Math.min(rein, Math.ceil(sys.strength?.max * 0.1));
    await this.actor.update({
      "system.strength.value":   Math.min(sys.strength.value + added, sys.strength.max),
      "system.reinforcements":   rein - added
    });
    await this._chatMsg("🔄 Reinforcements", `${added} Strength restored from reinforcements. ${rein - added} remaining.`);
  }

  async _withdraw() {
    const sk  = this.actor.system.commanderSkill ?? 40;
    const res = await WH40KRoll.characteristic(this.actor, "↩ Strategic Withdrawal", sk);
    if (res.success) {
      await this._chatMsg("↩ Withdrawal", "Successfully disengaged. Unit may redeploy next round.");
    } else {
      const moraleLoss = res.degrees * 5;
      const newMorale  = Math.max(0, (this.actor.system.morale?.value ?? 100) - moraleLoss);
      await this.actor.update({ "system.morale.value": newMorale });
      await this._chatMsg("↩ Withdrawal Failed", `Withdrawal failed! Morale -${moraleLoss} (now ${newMorale}).`);
    }
  }

  async _moraleCheck() {
    const sys    = this.actor.system;
    const morale = sys.morale?.value ?? 100;
    const roll   = await new Roll("1d100").evaluate();
    const ok     = roll.total <= morale;

    if (!ok) {
      const rout = morale < 30;
      await this.actor.update({ "system.statusRouting": rout });
      const msg = rout
        ? `<b style="color:#dd3333">ROUTING!</b> Morale ${morale} critically low. Unit breaks and flees.`
        : `<b style="color:#cc8800">Morale Shaken!</b> Unit is Pinned. -10 to all actions next round.`;
      await this.actor.update({ "system.statusPinned": !rout });
      await this._chatMsg("💀 Morale Check", `Roll <b>${roll.total}</b> vs Morale ${morale}: FAILED. ${msg}`);
    } else {
      await this._chatMsg("💀 Morale Check", `Roll <b>${roll.total}</b> vs Morale ${morale}: <span style="color:#44aa44">Holds firm!</span>`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  GROUND BATTLE APPLICATION
// ═══════════════════════════════════════════════════════════════

class WH40KGroundBattleApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "ground-battle-app",
      title: "⚔ Ground Conflict — Tactical Display",
      template: "systems/wh40k-unified/templates/ground-battle.html",
      width: 1100, height: 660,
      resizable: true,
      classes: ["wh40k", "ground-battle"]
    });
  }

  constructor() {
    super();
    this.round    = 1;
    this.phase    = "Command";
    this.activeId = null;
    this.units    = [];
    this._refreshUnits();
  }

  _refreshUnits() {
    this.units = game.actors
      .filter(a => a.type === "regiment")
      .map(a => ({
        id:       a.id,
        name:     a.name,
        faction:  a.system.faction ?? "neutral",
        unitType: a.system.unitType ?? "medium_infantry",
        scale:    a.system.scale ?? "company",
        strength: a.system.strength,
        morale:   a.system.morale,
        statusEntrenched: a.system.statusEntrenched,
        statusRouting:    a.system.statusRouting,
        statusPinned:     a.system.statusPinned,
        x: a.getFlag("wh40k-unified", "mapX") ?? (0.1 + Math.random() * 0.8),
        y: a.getFlag("wh40k-unified", "mapY") ?? (0.1 + Math.random() * 0.8)
      }));
  }

  getData() { return { round: this.round }; }

  activateListeners(html) {
    super.activateListeners(html);

    // Populate unit selector
    const sel = html.find("#gb-unit-select");
    this.units.forEach(u => {
      const faction = u.faction.charAt(0).toUpperCase() + u.faction.slice(1);
      sel.append(`<option value="${u.id}">[${faction}] ${u.name}</option>`);
    });

    sel.change(ev => {
      this.activeId = ev.currentTarget.value || null;
      this._updateStatBlock(html);
      this._redrawMap(html);
    });

    html.find("#gb-next-round").click(() => {
      this.round++;
      const phases = ["Command", "Movement", "Shooting", "Assault", "Morale"];
      this.phase   = phases[(this.round - 1) % phases.length];
      html.find("#gb-round").text(this.round);
      html.find("#gb-phase-label").text(`Phase: ${this.phase}`);
      this._log(html, `<b>Round ${this.round}</b> — ${this.phase} Phase`);
      this._refreshUnits();
      this._updateStatBlock(html);
      this._redrawMap(html);
    });

    html.find("#gb-close").click(() => this.close());

    html.find(".vb-action").click(ev => this._handleAction(html, ev.currentTarget.dataset.action));

    html.find(".vb-die").click(ev => {
      const sides = parseInt(ev.currentTarget.dataset.sides);
      const roll  = Math.floor(Math.random() * sides) + 1;
      html.find("#gb-dice-result").text(roll);
      this._log(html, `Rolled <b>d${sides}: ${roll}</b>`);
    });

    this._drawMap(html);
    new ResizeObserver(() => this._redrawMap(html)).observe(html.find("#gb-map-wrap")[0]);
  }

  async _handleAction(html, action) {
    if (!this.activeId) { ui.notifications.warn("Select a unit first."); return; }
    const actor = game.actors.get(this.activeId);
    if (!actor) return;
    const sheet = new WH40KRegimentSheet(actor);

    const map = {
      "rgt-attack":       () => sheet._attack(),
      "rgt-assault":      () => sheet._assault(),
      "rgt-feint":        () => sheet._feint(),
      "rgt-entrench":     () => sheet._entrench(),
      "rgt-reinforce":    () => sheet._reinforce(),
      "rgt-withdraw":     () => sheet._withdraw(),
      "rgt-morale-check": () => sheet._moraleCheck()
    };

    if (map[action]) {
      await map[action]();
      this._refreshUnits();
      this._updateStatBlock(html);
      this._redrawMap(html);
    }
  }

  _updateStatBlock(html) {
    const block = html.find("#gb-stat-block");
    if (!this.activeId) { block.html('<div class="vb-stat-empty">Select a unit.</div>'); return; }
    const actor = game.actors.get(this.activeId);
    if (!actor) return;
    const s   = actor.system;
    const pct = (v, m) => m > 0 ? Math.round((v / m) * 100) : 0;

    block.html(`
      <div style="font-family:'Cinzel',serif;font-size:0.7rem;color:#d4a840;margin-bottom:4px;">${actor.name}</div>
      <div style="font-size:0.62rem;color:#c0a060;margin-bottom:5px;">${s.designation || ""} | ${s.quality || "trained"} | ${(s.unitType||"").replace("_"," ")}</div>
      <div style="font-size:0.65rem;color:#f2e4c0;margin-bottom:2px;">Strength: <b style="color:#44aa44">${s.strength?.value}/${s.strength?.max}</b></div>
      <div style="height:3px;background:rgba(255,255,255,0.05);margin-bottom:4px;">
        <div style="height:100%;width:${pct(s.strength?.value,s.strength?.max)}%;background:#44aa44"></div>
      </div>
      <div style="font-size:0.65rem;color:#f2e4c0;margin-bottom:2px;">Morale: <b style="color:#8844cc">${s.morale?.value}/${s.morale?.max}</b></div>
      <div style="height:3px;background:rgba(255,255,255,0.05);margin-bottom:6px;">
        <div style="height:100%;width:${pct(s.morale?.value,s.morale?.max)}%;background:#8844cc"></div>
      </div>
      <div style="font-size:0.62rem;color:#c0a060;line-height:1.7;">
        BS: <b style="color:#f2e4c0">${s.ballisticSkill}</b> &nbsp;
        WS: <b style="color:#f2e4c0">${s.weaponSkill}</b> &nbsp;
        T: <b style="color:#f2e4c0">${s.toughness}</b><br>
        Armour: <b style="color:#f2e4c0">${s.armour}</b> &nbsp;
        Speed: <b style="color:#f2e4c0">${s.speed} km/h</b>
      </div>
      ${s.statusEntrenched ? '<div style="color:#4488cc;font-size:0.62rem;margin-top:4px;">🛡 Entrenched</div>' : ""}
      ${s.statusRouting    ? '<div style="color:#dd3333;font-size:0.62rem;">🏃 ROUTING</div>'     : ""}
      ${s.statusPinned     ? '<div style="color:#cc8800;font-size:0.62rem;">📌 Pinned</div>'      : ""}
    `);
  }

  _drawMap(html) {
    const wrap   = html.find("#gb-map-wrap")[0];
    const canvas = html.find("#gb-canvas")[0];
    if (!canvas || !wrap) return;

    canvas.width  = wrap.clientWidth  || 600;
    canvas.height = wrap.clientHeight || 500;

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    // Background — terrain
    ctx.fillStyle = "#1a1a0a";
    ctx.fillRect(0, 0, W, H);

    // Terrain patches
    const terrainColors = ["#1a2a0a","#0a1a08","#0a150a","#151a08"];
    for (let i = 0; i < 12; i++) {
      const tx = Math.random() * W, ty = Math.random() * H;
      const tr = 30 + Math.random() * 80;
      const tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr);
      tg.addColorStop(0, terrainColors[Math.floor(Math.random() * terrainColors.length)] + "cc");
      tg.addColorStop(1, "transparent");
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
    }

    // Grid
    ctx.strokeStyle = "rgba(200,180,100,0.1)";
    ctx.lineWidth   = 0.5;
    const grid = 60;
    for (let x = 0; x < W; x += grid) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += grid) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Draw all units as NATO symbols
    this.units.forEach(unit => {
      const ux = unit.x * W;
      const uy = unit.y * H;
      NATOSymbols.draw(ctx, unit, ux, uy, 24, unit.id === this.activeId);
    });
  }

  _redrawMap(html) {
    const wrap = html.find("#gb-map-wrap")[0];
    const canvas = html.find("#gb-canvas")[0];
    if (!canvas || !wrap) return;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    this._drawMap(html);
  }

  _log(html, msg) {
    html.find("#gb-log").prepend(`<div class="vb-log-entry">${msg}</div>`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  REGISTER REGIMENT SHEET + EXPOSE GROUND BATTLE + PLANET VIS
// ═══════════════════════════════════════════════════════════════

Hooks.once("ready", () => {
  window.WH40K = window.WH40K || {};
  window.WH40K.openGroundBattle = () => new WH40KGroundBattleApp().render(true);
  window.WH40K.drawPlanet       = PlanetVis.draw.bind(PlanetVis);
});
