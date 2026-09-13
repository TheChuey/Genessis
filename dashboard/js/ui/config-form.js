// ==========================================
// ui/config-form.js - CONFIG FORM BUILDER
// ==========================================

export function buildConfigForm({ agents = [], models = [], settings = {} }) {

    const root = document.createElement("div");
    root.className = "panel";

    // ---- Default Agent ----
    root.appendChild(fieldSelect("default-agent-select", "Default agent", [
        { value: "", label: "(server default)" },
        ...agents.map((a) => ({ value: a.id, label: `${a.name} (${a.id})` })),
    ], settings.defaultAgentId || ""));

    // ---- Default Model ----
    root.appendChild(fieldSelect("default-model-select", "Default model", [
        { value: "", label: "(server default)" },
        ...models.map((m) => ({ value: m.id, label: m.name })),
    ], settings.defaultModel || ""));

    // ---- Chat Save Path ----
    const pathField = document.createElement("label");
    pathField.className = "field";

    const pathLabel = document.createElement("span");
    pathLabel.textContent = "Chat save path";

    const pathInput = document.createElement("input");
    pathInput.type = "text";
    pathInput.id = "chat-save-path";
    pathInput.placeholder = "e.g. data/chatlog/agent-text-records or absolute folder";
    pathInput.value = settings.chatSavePath || "";

    pathField.appendChild(pathLabel);
    pathField.appendChild(pathInput);
    root.appendChild(pathField);

    const pathNote = document.createElement("p");
    pathNote.className = "config-note";
    pathNote.textContent = "Where saved chat transcripts (.txt files) are written. This is SEPARATE from the Data folder. Blank = a chatlog sub-folder inside the Data folder.";
    root.appendChild(pathNote);

    // ---- Data Folder Path ----
    root.appendChild(fieldTextInput(
        "data-dir-path",
        "Data folder",
        "Base data folder: chat records, history, exports, transcripts, and RAG store. Apply changes after server restart.",
        settings.dataDir || "data"
    ));

    // ---- RAG Database Path ----
    root.appendChild(fieldTextInput(
        "rag-db-path",
        "RAG database path",
        "Folder for the RAG memory store (chroma.sqlite3). Blank = data folder\\rag_db.",
        settings.ragDbPath || ""
    ));

    // ---- Project Manager: Default Project Location ----
    root.appendChild(fieldTextInput(
        "default-projects-path",
        "Default Projects Location",
        "Base directory where new standalone projects will be created on disk.",
        settings.defaultProjectsPath || "C:\\Projects"
    ));

    // ---- Chat Versioning Toggle ----
    const versionField = document.createElement("label");
    versionField.className = "field field-toggle";

    const versionLabel = document.createElement("span");
    versionLabel.textContent = "Disable chat versioning";

    const versionToggle = document.createElement("input");
    versionToggle.type = "checkbox";
    versionToggle.id = "disable-versioning";
    versionToggle.checked = Boolean(settings.disableVersioning);

    const versionSwitch = document.createElement("span");
    versionSwitch.className = "field-switch";

    versionField.appendChild(versionLabel);
    versionField.appendChild(versionToggle);
    versionField.appendChild(versionSwitch);
    root.appendChild(versionField);

    const versionNote = document.createElement("p");
    versionNote.className = "config-note";
    versionNote.textContent = "On: re-saving a chat overwrites <title>.txt. Off (default): re-saving writes the next version (<title>-2.txt).";
    root.appendChild(versionNote);

    // ---- RAG Memory Defaults ----
    const ragHeading = document.createElement("h3");
    ragHeading.className = "config-section-heading";
    ragHeading.textContent = "RAG memory";
    root.appendChild(ragHeading);

    root.appendChild(fieldToggle(
        "rag-commit-save",
        "Commit saved chats to memory by default",
        "Default state of the \"Save to memory\" toggle in the chat.",
        settings.rag && settings.rag.commitOnSave
    ));

    root.appendChild(fieldToggle(
        "rag-auto-ingest",
        "Auto-load transcripts when the memory store is empty",
        "On: the first search ingests every saved transcript automatically.",
        !settings.rag || settings.rag.autoIngest !== false
    ));

    root.appendChild(buildRagStoreManager());

    return {
        root,
        values() {
            return {
                defaultAgentId: getValue("default-agent-select"),
                defaultModel: getValue("default-model-select"),
                chatSavePath: getValue("chat-save-path"),
                dataDir: getValue("data-dir-path"),
                ragDbPath: getValue("rag-db-path"),
                defaultProjectsPath: getValue("default-projects-path"),
                disableVersioning: getChecked("disable-versioning"),
                rag: {
                    commitOnSave: getChecked("rag-commit-save"),
                    autoIngest: getChecked("rag-auto-ingest"),
                },
            };
        },
    };
}

function buildRagStoreManager() {

    const wrap = document.createElement("div");
    wrap.className = "rag-store-manager";

    const info = document.createElement("p");
    info.className = "config-note";
    info.id = "rag-store-info";
    info.textContent = "RAG store: loading...";
    wrap.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "section-actions";

    const purge = document.createElement("button");
    purge.type = "button";
    purge.className = "btn";
    purge.textContent = "Forget everything";
    purge.title = "Delete the RAG store so it starts empty.";

    const rebuild = document.createElement("button");
    rebuild.type = "button";
    rebuild.className = "btn";
    rebuild.textContent = "Rebuild memory";
    rebuild.title = "Re-index every saved transcript into the RAG store.";

    actions.appendChild(purge);
    actions.appendChild(rebuild);
    wrap.appendChild(actions);

    async function refresh() {
        try {
            const { ragStatus } = await import("../api/api.js");
            const st = await ragStatus();
            const status = st.status || st;
            info.textContent = `RAG store: ${status.path} — ${status.chunks} segment(s) indexed.`;
        } catch (error) {
            info.textContent = `RAG store: ${error.message}`;
        }
    }

    purge.addEventListener("click", async () => {
        if (!window.confirm("Are you sure you want to clear the RAG memory?")) return;
        const { resetRag } = await import("../api/api.js");
        await resetRag();
        await refresh();
    });

    rebuild.addEventListener("click", async () => {
        const { rebuildRag } = await import("../api/api.js");
        await rebuildRag();
        await refresh();
    });

    refresh();
    return wrap;
}

function fieldTextInput(id, label, note, value) {

    const wrap = document.createElement("div");
    const field = document.createElement("label");
    field.className = "field";

    const span = document.createElement("span");
    span.textContent = label;

    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.value = value || "";

    field.appendChild(span);
    field.appendChild(input);
    wrap.appendChild(field);

    if (note) {
        const p = document.createElement("p");
        p.className = "config-note";
        p.textContent = note;
        wrap.appendChild(p);
    }

    return wrap;
}

function fieldToggle(id, label, note, value) {

    const wrap = document.createElement("div");
    const field = document.createElement("label");
    field.className = "field field-toggle";

    const span = document.createElement("span");
    span.textContent = label;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = Boolean(value);

    const switchEl = document.createElement("span");
    switchEl.className = "field-switch";

    field.appendChild(span);
    field.appendChild(input);
    field.appendChild(switchEl);
    wrap.appendChild(field);

    if (note) {
        const p = document.createElement("p");
        p.className = "config-note";
        p.textContent = note;
        wrap.appendChild(p);
    }

    return wrap;
}

function fieldSelect(id, label, options, value) {

    const field = document.createElement("label");
    field.className = "field";

    const span = document.createElement("span");
    span.textContent = label;
    field.appendChild(span);

    const select = document.createElement("select");
    select.id = id;

    options.forEach((opt) => {
        const o = new Option(opt.label, opt.value);
        if (opt.value === value) {
            o.selected = true;
        }
        select.appendChild(o);
    });

    field.appendChild(select);
    return field;
}

function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function getChecked(id) {
    const el = document.getElementById(id);
    return el ? Boolean(el.checked) : false;
}
