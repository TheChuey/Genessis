// ==========================================
// js/app.js - ENTRY POINT (the only script index.html loads)
// ==========================================
// BOOT:
//   1. Render the AI agent card grid (ui/agents.js)
//   2. Build ONE persistent floating chat widget (classes/chat-window.js
//      in flyout mode) that sits in the corner of the screen. It targets
//      the first agent by default and can switch agents via the dropdown
//      in its header. Clicking an agent card also switches + expands it.
//      The ChatWindow ONLY renders; all AI/session/persist logic lives here.
//   (All configuration/settings now live on /static/config.html.)

import { renderAgents } from "./ui/agents.js";
import { applyAppearance } from "./ui/appearance.js";
import { renderHeaderNav } from "./ui/header-nav.js";
import { ChatSession } from "./classes/ChatSession.js";
import { ChatFactory } from "./classes/chat-window.js";
import { renderMarkdown } from "./ui/markdown.js";
import { renderInterfaceIndicator } from "./ui/interface-indicator.js";
import * as api from "./api/api.js";

// ---- app-level state ----
let settings = {};            // cached app settings (chatSavePath, defaults)
let agents = [];              // the list of discovered agents
let widget = null;            // the single persistent ChatWindow (flyout)
let activeAgentId = null;     // which agent the widget is currently talking to

// One ChatSession per agent so history survives switching agents in the
// single widget. Sending routes through the currently active session.
const agentSessions = new Map(); // agentId -> ChatSession

// Auto-"say hi" feature (experimental, may be removed).
const AUTO_HI_TEXT = "hi";     // message injected into a brand-new chat
const AUTO_HI_DEFAULT = true;  // default state of the auto-hi toggle

// ---- boot ----
async function boot() {
    // 0. Cache server settings and apply the stored appearance (font + size)
    //    to THIS page right away - chat.html applies its own copy on load.
    try {
        settings = await api.loadAppSettings();
    } catch (_) {
        settings = {};
    }
    applyAppearance(settings);

    // 0b. Header: shared nav + the editable H1/tagline from about/about.json.
    const navSlot = document.getElementById("app-nav");
    if (navSlot) {
        navSlot.replaceChildren(renderHeaderNav("dashboard"));
    }
    try {
        const about = await api.getAbout();
        setPageTitle(about.title, about.subtitle);
    } catch (_) {
        /* keep the hardcoded defaults */
    }

    // 0c. Interface pill: "N update modules" in the header
    renderInterfaceIndicator({
        container: document.querySelector(".app-header-row"),
        onMesh: true,
    });

    // 0d. Wire "New Project" button trigger
    wireNewProjectButton();

    // 1. Render agent cards (returns the full agent list).
    agents = await renderAgents({
        containerId: "agent-cards",
        statusId: "agent-status-area",
        onSelect: onAgentSelected,
    });

    // 2. Create the persistent corner widget for the first agent (if any).
    if (agents.length > 0) {
        buildWidget();
    }
}

/** Update the header H1 + tagline */
function setPageTitle(title, subtitle) {
    const titleEl = document.getElementById("app-title");
    const taglineEl = document.getElementById("app-tagline");
    if (titleEl && title && title.trim()) {
        titleEl.textContent = title.trim();
    }
    if (taglineEl && subtitle && subtitle.trim()) {
        taglineEl.textContent = subtitle.trim();
    }
    const cleanSub = (subtitle && subtitle.trim()) ? " \u2014 " + subtitle.trim() : "";
    document.title = ((title && title.trim()) ? title.trim() : "") + cleanSub;
}

/** Wire the "New Project" header button to prompt and call API */
function wireNewProjectButton() {
    const btnNewProject = document.getElementById("btn-new-project");
    if (!btnNewProject) return;

    btnNewProject.addEventListener("click", async () => {
        const projectName = window.prompt("Enter new project name:", "MyNewProject");
        if (!projectName || !projectName.trim()) return;

        btnNewProject.disabled = true;
        const origText = btnNewProject.textContent;
        btnNewProject.textContent = "Creating...";

        try {
            const currentSettings = await api.loadAppSettings();
            const basePath = currentSettings.defaultProjectsPath || "C:\\Projects";
            const cleanBase = basePath.replace(/[\\/]+$/, "");
            const targetDir = `${cleanBase}\\${projectName.trim()}`;

            const res = await api.createProject({
                projectName: projectName.trim(),
                targetDir: targetDir,
            });

            if (res.status === "success") {
                alert(`Project '${res.project_name}' created successfully at:\n${res.path}`);
            } else {
                alert(`Error creating project: ${res.message || "Unknown error"}`);
            }
        } catch (err) {
            alert(`Failed to create project: ${err.message}`);
        } finally {
            btnNewProject.disabled = false;
            btnNewProject.textContent = origText;
        }
    });
}

/** Create the single persistent flyout widget + wire its agent switcher. */
function buildWidget() {
    const defaultAgent = agents[0];
    const config = buildAgentConfig(defaultAgent);
    config.layout.flyout = true;

    widget = ChatFactory.create(config);

    // Feed the switcher with all selectable agents.
    widget.setAgents(agents);

    // Present the default agent (fresh session, no auto-hi on startup).
    selectSession(defaultAgent, false);

    // Route sends to the active session.
    widget.onSend((text) => {
        const session = activeSession();
        if (session) {
            handleSend(session, widget, text);
        }
    });

    widget.onAction("saveChat", () => {
        const session = activeSession();
        if (session) {
            handleSaveAction(session, widget);
        }
    });
    widget.onAction("clearChat", () => {
        const session = activeSession();
        if (session) {
            handleClearAction(session, widget);
        }
    });

    // Switcher in the widget header changes the active agent.
    widget.onSwitchAgent((agentId) => {
        const agent = agents.find((a) => String(a.id) === String(agentId));
        if (agent) {
            switchToAgent(agent, false);
        }
    });
}

/** The ChatSession for the agent currently shown in the widget. */
function activeSession() {
    return activeAgentId ? agentSessions.get(activeAgentId) : null;
}

// ---- agent card click -> switch + expand the widget ----
function onAgentSelected(agent) {
    if (!widget) {
        return;
    }
    switchToAgent(agent);
    if (!widget.isOpen) {
        widget.open();
    }
}

/** (Re)point the widget at an agent, keeping its per-agent session. */
function switchToAgent(agent, autoHi = true) {
    if (!widget) {
        return;
    }
    widget.setActiveAgent(agent.id);
    selectSession(agent, autoHi);
}

/**
 * Ensure a ChatSession exists for the agent and load it into the widget.
 */
function selectSession(agent, autoHi = false) {
    let session = agentSessions.get(agent.id);
    const created = !session;
    if (!session) {
        session = new ChatSession({
            agentId: agent.id,
            agentName: agent.name,
            model: settings.defaultModel || "",
        });
        agentSessions.set(agent.id, session);
    }
    activeAgentId = agent.id;

    if (created && autoHi && widget && widget.isOpen && widget.getPanelValues().autoHi === true) {
        widget.setInputValue(AUTO_HI_TEXT);
        widget._input?.focus();
    }
    return created;
}

/**
 * The entity config that drives the chat window for one AI agent.
 */
function buildAgentConfig(agent) {
    const commitOnSave =
        settings.rag && typeof settings.rag.commitOnSave === "boolean"
            ? settings.rag.commitOnSave
            : false;
    return {
        id: agent.id,
        type: "agent",
        name: agent.name,
        title: agent.name,
        description: agent.description || "AI agent",
        layout: { rightPanel: true, resizable: true, collapsible: true, panelWidth: 300 },
        renderMarkdown,
        headerToggle: {
            name: "ragCommit",
            label: "Save to memory",
            value: commitOnSave,
        },
        sections: [
            {
                title: "Agent Information",
                fields: [
                    { type: "text", label: "Status", value: "Ready" },
                    { type: "text", label: "Category", value: agent.mode || "General" },
                ],
            },
            {
                title: "Chat",
                fields: [
                    {
                        type: "input",
                        name: "chatTitle",
                        label: "Chat title",
                        placeholder: "Name this chat...",
                        value: "",
                    },
                ],
            },
            {
                title: "Actions",
                fields: [
                    { type: "button", label: "Save chat", action: "saveChat" },
                    { type: "button", label: "Clear chat", action: "clearChat" },
                ],
            },
            {
                title: "Behavior",
                fields: [
                    {
                        type: "toggle",
                        name: "autoHi",
                        label: '"Say hi" on a new chat',
                        value: AUTO_HI_DEFAULT,
                    },
                ],
            },
        ],
    };
}

// ---- send flow ----
async function handleSend(session, chat, text) {
    session.addUserMessage(text);
    chat.setWaiting(true);

    try {
        const panelValues = widget.getPanelValues();
        const userTitle = String(panelValues.chatTitle || "").trim();

        const result = await api.sendChat({
            message: text,
            agentId: session.agentId,
            model: session.model,
            history: session.getApiHistory(),
            sessionId: session.sessionId || "",
            title: userTitle,
            newChat: !session.sessionId,
            rag: Boolean(panelValues.ragCommit),
        });

        session.addAssistantMessage(result.reply);
        chat.addAssistantMessage(result.reply, session.agentName);
        session.setSessionId(result.session_id, result.title);
        chat.setSaveStatus(
            session.sessionId ? "Chat tracked on the server." : "Chat saved.",
            "ok"
        );
    } catch (error) {
        chat.addSystemMessage(`Sorry - that failed. ${error.message}`);
        chat.setSaveStatus(`Send failed: ${error.message}`, "error");
    } finally {
        chat.setWaiting(false);
    }
}

// ---- save handlers ----
async function handleSaveAction(session, chat) {
    if (!session || !session.sessionId) {
        chat.setSaveStatus("No active chat to save yet.", "error");
        return;
    }

    try {
        const panelValues = widget.getPanelValues();
        let title = String(panelValues.chatTitle || "").trim();

        if (!title) {
            const subject = window.prompt(
                "Name this chat:",
                session.title !== "New chat" ? session.title : ""
            );
            if (subject !== null && subject.trim()) {
                title = subject.trim();
            }
        }

        const result = await api.endChat({
            title,
            rag: Boolean(widget.getPanelValues().ragCommit),
        });
        chat.setSaveStatus(
            result.saved
                ? `Saved: ${result.file} (v${result.version})`
                : `Save failed: ${result.error || "no active chat"}`,
            result.saved ? "ok" : "error"
        );
    } catch (error) {
        chat.setSaveStatus(`Save failed: ${error.message}`, "error");
    }
}

function handleClearAction(session, chat) {
    session.newChat();
    chat.clearMessages();
    chat.setSaveStatus("Chat cleared.", "ok");
}

// ---- go ----
boot();
