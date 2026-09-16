import { storage, exportProgress, previewImport, KEYS, readJSON } from "./progress.mjs";
let mounted = false;
export function mountProgressTools(){
  if (mounted) return;
  mounted = true;
  const entry = document.getElementById("learning-entry");
  if (!entry) return;
  const style = document.createElement("style");
  style.textContent = `#learning-entry{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font:13px/1.5 system-ui}#learning-entry a,#learning-entry button{color:#f5e6bd;background:#192b40;border:1px solid #697688;border-radius:6px;padding:6px 10px;text-decoration:none;cursor:pointer}#learning-entry [data-save-status]{color:#e2e8f0;font-size:12px}#progress-dialog{box-sizing:border-box;width:min(560px,94vw);max-height:90vh;overflow:auto;background:#142033;color:#eef2f7;border:1px solid #d4af6a;border-radius:12px;padding:24px;font:16px/1.6 system-ui}#progress-dialog::backdrop{background:#000a}#progress-dialog h2{font:26px Georgia,serif;margin:0 0 12px}#progress-dialog p{margin:12px 0}#progress-dialog button,#progress-dialog input{font:inherit;margin:6px 8px 6px 0;max-width:100%}#progress-dialog button{background:#eee2c6;color:#152238;padding:8px 12px;border:1px solid #ac925a;border-radius:6px;cursor:pointer}#progress-dialog button:disabled{opacity:.6;cursor:default}#progress-dialog button:focus-visible,#learning-entry a:focus-visible,#learning-entry button:focus-visible{outline:3px solid #70cfff;outline-offset:3px}`;
  document.head.append(style);
  const header = document.getElementById("topbar");
  if (header && typeof ResizeObserver !== "undefined") new ResizeObserver(() => { document.documentElement.style.setProperty("--header-height", header.offsetHeight + "px"); }).observe(header);
  const link = entry.querySelector("a[data-continue]");
  if (link && (readJSON(storage, KEYS.resume, null) || Object.keys(readJSON(storage, KEYS.study, {})).length)) link.textContent = "Continue learning";
  const button = document.createElement("button"); button.type = "button"; button.textContent = "Progress & backup"; entry.append(button);
  const status = document.createElement("span"); status.dataset.saveStatus = ""; status.setAttribute("role", "status"); entry.append(status);
  const dialog = document.createElement("dialog"); dialog.id = "progress-dialog"; dialog.setAttribute("aria-labelledby", "progress-heading");
  dialog.innerHTML = `<h2 id="progress-heading">Your progress</h2><p data-detail></p><p>Progress belongs to this browser. Course seals are self-reported; lesson mastery records passed checks and any required problem set. Keep a backup before clearing browser data or changing devices.</p><button type="button" data-export>Export backup</button><button type="button" data-retry>Retry saving</button><p><label for="progress-file">Import a Pembroke JSON backup</label><br><input id="progress-file" type="file" accept="application/json,.json"></p><p data-preview role="status"></p><button type="button" data-import hidden>Replace progress with this backup</button><button type="button" data-close>Close</button>`;
  document.body.append(dialog);
  function showStatus(){
    const s = storage.status();
    const message = s.conflict ? "Progress changed in another tab. Export any unsaved work, then reload before continuing." : s.recoveryFailed ? "Progress recovery needed — export a backup and retry saving." : s.unsaved || s.unavailable
      ? "Not saved to this browser — export a backup or retry saving." : s.lastSaved
        ? "Saved in this browser at " + new Date(s.lastSaved).toLocaleTimeString() : "Progress stays in this browser.";
    status.textContent = s.conflict ? "Reload to continue saving" : s.unsaved || s.unavailable ? "Progress not saved" : s.lastSaved ? "Saved " + new Date(s.lastSaved).toLocaleTimeString() : "";
    dialog.querySelector("[data-detail]").textContent = message;
  }
  window.addEventListener("pembroke-save", showStatus); showStatus();
  button.onclick = () => { showStatus(); dialog.showModal(); };
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.querySelector("[data-retry]").onclick = () => storage.retry();
  dialog.querySelector("[data-export]").onclick = () => {
    const blob = new Blob([JSON.stringify(exportProgress(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "pembroke-progress-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  let preview = null, selection = 0;
  const summary = dialog.querySelector("[data-preview]"), apply = dialog.querySelector("[data-import]");
  dialog.querySelector("input").onchange = async e => {
    const revision = ++selection;
    preview = null; apply.hidden = true;
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("Choose a JSON backup smaller than 2 MB.");
      const next = previewImport(await file.text());
      if (revision !== selection) return;
      preview = next;
      summary.textContent = `${preview.mastered} mastered lessons and ${preview.seals} self-reported course seals. This replaces progress in this browser. Export your current backup first.${preview.repairs.length ? " Invalid or obsolete fields will be repaired in: " + preview.repairs.join(", ") + "." : ""}`;
      apply.hidden = false;
    } catch (error){ if (revision === selection) summary.textContent = error.message; }
  };
  apply.onclick = () => {
    if (!preview) return;
    try { storage.importRecords(preview.records); location.reload(); }
    catch (error){ summary.textContent = error.message; showStatus(); }
  };
  // A second tab must not silently continue writing an older copy after import or grading.
  window.addEventListener("storage", e => {
    if (!Object.values(KEYS).includes(e.key)) return;
    status.textContent = "Progress changed in another tab. Reload before continuing.";
    window.dispatchEvent(new Event("pembroke-external-progress"));
  });
}
mountProgressTools();
