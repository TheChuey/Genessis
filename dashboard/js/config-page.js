// ==========================================
// js/config-page.js - THE CONSOLIDATED SETTINGS PAGE (config.html)
// ==========================================
// Boots /static/config.html: the ONE place for every configuration.
//   App-level      -> ui/config-form.js  (defaults, paths, versioning, RAG)
//   Appearance     -> ui/appearance.js
//   Per-agent      -> ui/agent-editor.js (metadata + agent.md + tests)
//   Shared tests   -> inline manager (global tests that run for every agent)
//   Models         -> read-only snapshot from /api/models
// ==========================================

import { getModels, getAgents, getTools, loadAppSettingsWithMeta, saveAppSettings } from "./api/api.js";
import { buildConfigForm } from "./ui/config-form.js";
import { applyAppearance, renderAppearance } from "./ui/appearance.js";
import { renderAgentEditors } from "./ui/agent-editor.js";
import { renderHeaderNav } from "./ui/header-nav.js";

let settings = {};
let agents = [];
let models = [];
let tools = [];

async function boot() {
    window.__cfgBoot = true;

    // Header: shared app nav, this page = Settings.
    const navSlot = document.getElementById("page-nav");
    if (navSlot) {
        navSlot.replaceChildren(renderHeaderNav("config"));
    }

    const mount = document.getElementById("config-section");
    const statusEl = el("div", "status-message");
    mount.appendChild(el("h2", "config-section-heading", "App defaults"));

    // Load the page's data one piece at a time. A single failing call
    // (e.g. a server that predates the new /api/tools endpoint) must NOT
    // blank the page - the inputs below always render and any failure is
    // surfaced in a banner at the top instead.
    const failures = [];
    const safeLoad = async (label, fn) => {
        try {
            return await fn();
        } catch (error) {
            failures.push(label + " \u2014 " + (error.message || error));
            return null;
        }
    };

    const [loadedAgents, loadedModels, loadedTools, loadedMeta] = await Promise.all([
        safeLoad("agents", () => getAgents()),
        safeLoad("models", () => getModels()),
        safeLoad("tools", () => getTools()),
        safeLoad("settings", () => loadAppSettingsWithMeta()),
    ]);

    agents = loadedAgents || [];
    models = loadedModels || [];
    tools = loadedTools || [];
    let restartNeeded = false;
    if (loadedMeta) {
        settings = loadedMeta.settings || {};
        restartNeeded = Boolean(loadedMeta.restartNeeded);
    }

    if (failures.length) {
        renderFailureBanner(failures);
    }

    if (settings && typeof settings === "object") {
        applyAppearance(settings);
    }

    if (restartNeeded) {
        const notice = el("div", "status-message warn");
        notice.textContent = "Path settings changed - restart the server for the new folders to take effect.";
        mount.appendChild(notice);
    }

    // ---- App-level form (default agent/model, paths, versioning, RAG) ----
    const form = buildConfigForm({ agents, models, settings });
    mount.appendChild(form.root);

    wireDefaultAgentLink(form.root, agents);

    const actions = el("div", "section-actions");
    const save = el("button", "btn btn-primary", "Save settings");
    save.type = "button";
    actions.appendChild(save);
    mount.appendChild(actions);
    mount.appendChild(statusEl);

    save.addEventListener("click", async () => {
        const payload = form.values();
        save.disabled = true;
        try {
            settings = await saveAppSettings(payload);
            statusEl.textContent = "Settings saved.";
            statusEl.className = "status-message ok";
        } catch (error) {
            statusEl.textContent = error.message;
            statusEl.className = "status-message error";
        } finally {
            save.disabled = false;
        }
    });

    // ---- Appearance ----
    const appearanceMount = document.getElementById("appearance-section");
    renderAppearance({
        mountEl: appearanceMount,
        settings,
        onSave: (updated) => {
            settings = updated || settings;
        },
    });

    // ---- Agents (one consolidated card each) ----
    const agentsMount = document.getElementById("agents-section");
    await renderAgentEditors({
        mountEl: agentsMount,
        agents,
        models,
        toolIds: tools,
    });

    // ---- Shared tests (global pool, run for every agent) ----
    renderSharedTests(document.getElementById("shared-tests-section"));

    // ---- Models (read-only) ----
    renderModels(document.getElementById("models-section"), models);
}

function renderFailureBanner(failures) {
    const holder = document.getElementById("boot-failed");
    if (!holder) return;
    holder.hidden = false;
    holder.replaceChildren();

    const box = el("div", "status-message error");
    box.appendChild(el("strong", "", "Some settings could not be loaded:"));
    const list = el("ul");
    list.style.cssText = "margin:6px 0 0 18px;padding:0;";
    failures.forEach((f) => list.appendChild(el("li", "", f)));
    box.appendChild(list);
    box.appendChild(el("p", "",
        "If the server was just updated, restart it (python server.py) and hard-refresh this page (Ctrl+F5)."));
    holder.appendChild(box);
}

function wireDefaultAgentLink(formRoot, agents) {
    const select = formRoot.querySelector("#default-agent-select");
    const linkWrap = el("span", "jump-link");
    formRoot.appendChild(linkWrap);

    const update = () => {
        const id = select?.value;
        linkWrap.replaceChildren();
        if (!id) return;
        // Fake a .btn look without re-implementing: reuse the anchor style.
        if (!agents.some((a) => String(a.id) === String(id))) {
            linkWrap.textContent = "(unknown agent)";
            return;
        }
        const a = document.createElement("a");
        a.href = "#agent-" + encodeURIComponent(id);
        a.className = "btn btn-secondary btn-small";
        a.textContent = "edit \u2192";
        a.title = "Jump to that agent's card below";
        a.addEventListener("click", () => {
            document.getElementById("agent-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        linkWrap.appendChild(a);
    };
    select?.addEventListener("change", update);
    update();
}

// ----------------------------------------------------------------
// Shared tests (app_settings.chatTests.tests without an agentId) -
// these run for EVERY agent. Scoped tests now live in each agent's
// own agent.json and are managed from that agent's card.
// ----------------------------------------------------------------

function renderSharedTests(mount) {
    if (!mount) return;
    mount.appendChild(el("h2", "config-section-heading", "Shared tests"));

    const shared = (settings.chatTests && Array.isArray(settings.chatTests.tests))
        ? settings.chatTests.tests.filter((t) => t && !t.agentId)
        : [];

    const intro = el("p", "config-note",
        "Tests without an agent run for EVERY agent. Use them for common sanity checks. " +
        (shared.length
            ? "Agent-specific tests live on each agent's card above."
            : "None saved. Agent-specific tests live on each agent's card above.")
    );
    mount.appendChild(intro);

    const list = el("div", "agent-test-list");
    mount.appendChild(list);

    if (!shared.length) {
        list.appendChild(el("p", "config-note", "No shared tests."));
        return;
    }

    shared.forEach((test) => {
        const row = el("div", "test-row");
        row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--color-border,#e1e5e8);font-size:13px;";

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = test.enabled !== false;
        toggle.addEventListener("change", async () => {
            test.enabled = toggle.checked;
            await persistShared();
        });
        row.appendChild(toggle);

        const name = el("span", "", test.name || test.id);
        name.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        name.title = test.name || test.id;
        row.appendChild(name);

        const steps = Array.isArray(test.steps) ? test.steps.length
            : String(test.input || "").split(/\r?\n/).filter(Boolean).length;
        const badge = el("span", "badge", steps + " step" + (steps !== 1 ? "s" : ""));
        badge.style.cssText = "font-size:10px;";
        row.appendChild(badge);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-small";
        del.textContent = "x";
        del.title = "Delete this shared test";
        del.style.cssText = "padding:2px 7px;font-size:11px;color:var(--color-danger,#b91c1c);border-color:var(--color-danger,#b91c1c);";
        del.addEventListener("click", async () => {
            const idx = (settings.chatTests.tests || []).findIndex((t) => t.id === test.id);
            if (idx >= 0) {
                settings.chatTests.tests.splice(idx, 1);
                await persistShared();
                renderSharedTests(mount);
            }
        });
        row.appendChild(del);

        list.appendChild(row);
    });

    async function persistShared() {
        const payload = {
            chatTests: {
                enabled: (settings.chatTests || {}).enabled !== false,
                tests: settings.chatTests.tests || [],
            },
        };
        try {
            settings = await saveAppSettings(payload);
        } catch (_) { /* the page re-renders with stored truth on reload */ }
    }
}

// ----------------------------------------------------------------
// Models (read-only snapshot)
// ----------------------------------------------------------------

function renderModels(mount, models) {
    if (!mount || !models || !models.length) return;
    mount.appendChild(el("h2", "config-section-heading", "Models"));

    const intro = el("p", "config-note",
        "Installed Ollama models (snapshot, re-scanned at server startup - edit via config/models.json or Ollama)."
    );
    mount.appendChild(intro);

    const grid = el("div", "cfg-models-grid");
    models.forEach((m) => {
        const card = el("div", "cfg-model-card");
        card.appendChild(el("div", "name", m.name));
        card.appendChild(el("div", "id", "id: " + m.id + " - source: " + (m.source || "ollama")));
        grid.appendChild(card);
    });
    mount.appendChild(grid);
}

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

boot();