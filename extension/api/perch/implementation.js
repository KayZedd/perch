"use strict";

/* global ExtensionCommon, Services, Cc, Ci, Cu, ChromeUtils */
var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);
var { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);
var { MsgHdrToMimeMessage } = ChromeUtils.importESModule(
  "resource:///modules/gloda/MimeMessage.sys.mjs"
);

const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
  Ci.nsIStyleSheetService
);
// Findings (Betterbird 153, verified with screenshots):
//  - USER_SHEET and AUTHOR_SHEET registrations are ignored for chrome documents.
//  - moz-extension:// sheet URLs are ignored; data: URLs work.
//  - AGENT_SHEET works, but loses to author rules unless declarations are
//    !important. tools/build.mjs adds that and scopes every selector under
//    :root[lightweightthemes] so web/mail content is untouched.
const TYPE = sss.AGENT_SHEET;

const THREAD_DOC = "about:3pane";

this.perch = class extends ExtensionCommon.ExtensionAPI {
  #current = null;
  #want = { avatars: false, attachments: false };
  #observed = new Map(); // document -> { cleanups: [fn] }
  #topicObserver = null;
  #libs = {};

  // ---- stylesheet
  #unregister() {
    if (this.#current && sss.sheetRegistered(this.#current, TYPE)) {
      sss.unregisterSheet(this.#current, TYPE);
    }
    this.#current = null;
  }

  #register(css) {
    this.#unregister();
    const uri = Services.io.newURI(
      "data:text/css;charset=utf-8," + encodeURIComponent(css)
    );
    sss.loadAndRegisterSheet(uri, TYPE);
    this.#current = uri;
  }

  // ---- message list enhancements: sender initials and attachment preview
  #loadLib(source, name) {
    if (this.#libs[name] || !source) {
      return;
    }
    const sandbox = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal(), {
      wantGlobalProperties: [],
    });
    Cu.evalInSandbox(source, sandbox, "latest", `lib/${name}.js`, 1);
    this.#libs[name] = sandbox[name === "avatar" ? "PerchAvatar" : "PerchAttach"];
  }

  #decorateRows(tree) {
    const lib = this.#libs.avatar;
    for (const row of tree.querySelectorAll(".card-layout")) {
      const props = row.dataset.properties || "";
      const sender = row.querySelector(".sender");
      const container = row.querySelector(".card-container");
      let avatar = container?.querySelector(":scope > .perch-avatar");
      if (!sender || !container || /\bdummy\b/.test(props)) {
        avatar?.remove();
        continue;
      }
      const name = sender.textContent;
      if (!avatar) {
        avatar = row.ownerDocument.createElement("span");
        avatar.className = "perch-avatar";
        avatar.setAttribute("aria-hidden", "true");
        container.prepend(avatar);
      }
      if (avatar.dataset.name !== name) {
        avatar.dataset.name = name;
        avatar.textContent = lib.initials(name);
        avatar.style.setProperty("--h", String(lib.hue(name)));
      }
    }
  }

  // Attachment popover: hovering the paperclip of a row lists the files. Parsing happens only on
  // hover (after a short delay), never for every visible row.
  #attachHandlers(doc, win, tree) {
    const lib = this.#libs.attach;
    let pop = null;
    let timer = null;
    let token = 0;
    const hide = () => {
      win.clearTimeout(timer);
      token++;
      pop?.remove();
      pop = null;
    };
    const show = (icon, list) => {
      const { items, more } = lib.summarize(list);
      if (!items.length) {
        return;
      }
      pop = doc.createElement("div");
      pop.className = "perch-attach-pop";
      pop.setAttribute("role", "tooltip");
      for (const it of items) {
        const line = doc.createElement("div");
        const name = doc.createElement("span");
        name.textContent = it.name;
        const size = doc.createElement("small");
        size.textContent = it.size;
        line.append(name, size);
        pop.append(line);
      }
      if (more) {
        const m = doc.createElement("div");
        m.className = "perch-attach-more";
        m.textContent = `+${more} more`;
        pop.append(m);
      }
      doc.body.append(pop);
      const r = icon.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = `${Math.max(8, Math.min(r.right - w, win.innerWidth - w - 8))}px`;
      // Above the icon: the native tooltip for the paperclip opens below the pointer.
      const above = r.top - pop.offsetHeight - 6;
      pop.style.top = `${above >= 8 ? above : Math.min(r.bottom + 6, win.innerHeight - pop.offsetHeight - 8)}px`;
    };
    const onOver = e => {
      const icon = e.target.closest?.(".attachment-icon, .attachmentcol-column img");
      if (!icon || pop) {
        return;
      }
      const row = icon.closest(".card-layout, .table-layout");
      const mine = ++token;
      timer = win.setTimeout(() => {
        try {
          const dbView = win.gDBView ?? win.gViewWrapper?.dbView;
          const hdr = dbView?.getMsgHdrAt(row.index);
          if (!hdr) {
            return;
          }
          MsgHdrToMimeMessage(hdr, null, (_h, mime) => {
            if (mine === token && mime) {
              show(icon, mime.allUserAttachments);
            }
          }, true, { saneBodySize: true });
        } catch (err) {
          console.error("Perch attachment preview", err);
        }
      }, 250);
    };
    const onOut = e => {
      if (e.target.closest?.(".attachment-icon, .attachmentcol-column img")) {
        hide();
      }
    };
    tree.addEventListener("mouseover", onOver);
    tree.addEventListener("mouseout", onOut);
    tree.addEventListener("scroll", hide, true);
    return () => {
      hide();
      tree.removeEventListener("mouseover", onOver);
      tree.removeEventListener("mouseout", onOut);
      tree.removeEventListener("scroll", hide, true);
    };
  }

  #watch(doc) {
    if (this.#observed.has(doc) || doc.documentURI !== THREAD_DOC) {
      return;
    }
    const win = doc.defaultView;
    const tree = doc.getElementById("threadTree");
    if (!win || !tree) {
      return;
    }
    const entry = { cleanups: [] };
    if (this.#want.avatars && this.#libs.avatar) {
      let queued = false;
      const run = () => {
        queued = false;
        try {
          this.#decorateRows(tree);
        } catch (e) {
          console.error("Perch avatars", e);
        }
      };
      const observer = new win.MutationObserver(() => {
        if (!queued) {
          queued = true;
          win.requestAnimationFrame(run);
        }
      });
      observer.observe(tree, { childList: true, subtree: true, characterData: true });
      doc.documentElement.removeAttribute("perch-avatars");
      entry.cleanups.push(() => {
        observer.disconnect();
        doc.documentElement.setAttribute("perch-avatars", "off");
        for (const el of doc.querySelectorAll(".perch-avatar")) {
          el.remove();
        }
      });
      run();
    }
    if (this.#want.attachments && this.#libs.attach) {
      entry.cleanups.push(this.#attachHandlers(doc, win, tree));
    }
    this.#observed.set(doc, entry);
  }

  #unwatchAll() {
    for (const [, { cleanups }] of this.#observed) {
      for (const fn of cleanups) {
        try {
          fn();
        } catch {
          // document already gone
        }
      }
    }
    this.#observed.clear();
  }

  #existingThreadDocs() {
    const docs = [];
    for (const win of Services.wm.getEnumerator("mail:3pane")) {
      const tabmail = win.document.getElementById("tabmail");
      for (const info of tabmail?.tabInfo ?? []) {
        const doc = info.chromeBrowser?.contentDocument;
        if (doc?.documentURI === THREAD_DOC) {
          docs.push(doc);
        }
      }
    }
    return docs;
  }

  #setListFeatures({ avatars, attachments, avatarSource, attachSource }) {
    this.#want = { avatars: !!avatars, attachments: !!attachments };
    if (this.#want.avatars) {
      this.#loadLib(avatarSource, "avatar");
    }
    if (this.#want.attachments) {
      this.#loadLib(attachSource, "attach");
    }
    // Re-attach from scratch so each document matches the new switches.
    this.#unwatchAll();
    if (!this.#want.avatars && !this.#want.attachments) {
      if (this.#topicObserver) {
        Services.obs.removeObserver(this.#topicObserver, "chrome-document-loaded");
        this.#topicObserver = null;
      }
      return;
    }
    if (!this.#topicObserver) {
      this.#topicObserver = {
        observe: subject => {
          if (subject?.documentURI === THREAD_DOC) {
            this.#watch(subject);
          }
        },
      };
      Services.obs.addObserver(this.#topicObserver, "chrome-document-loaded");
    }
    for (const doc of this.#existingThreadDocs()) {
      this.#watch(doc);
    }
  }

  getAPI() {
    return {
      perch: {
        apply: async css => this.#register(css),
        clear: async () => this.#unregister(),
        setListFeatures: async options => this.#setListFeatures(options),
        getAccounts: async () =>
          MailServices.accounts.accounts
            .map(a => a.incomingServer)
            .filter(Boolean)
            .map(s => ({ key: s.key, name: s.prettyName, type: s.type })),
        // DEV-BEGIN
        devMode: async () =>
          Services.prefs.getStringPref("extensions.perch.devmode", ""),
        log: async line => dump("PERCH " + line + "\n"),
        // DEV-END
      },
    };
  }

  onShutdown() {
    this.#setListFeatures({});
    this.#unregister();
  }
};
