import { execFile } from "node:child_process";
import { join } from "node:path";
import type { HunkExtensionAPI } from "hunkdiff/extension";

export default function (hunk: HunkExtensionAPI) {
  hunk.registerCommand({ id: "editor", title: "Switch to Helix (keep position)" }, (ctx) => {
    if (process.env.YHX_HUNK !== "1" || !process.env.TMUX || !process.env.HOME) {
      ctx.notify("Launch through yhx-switch hunk to switch to Helix.", "warning");
      return;
    }
    // No shell, inherited terminal input, or filename: only focus the editor window.
    execFile(join(process.env.HOME, "bin/yhx-switch"), ["edit"], (error) => {
      if (error) ctx.notify(`Could not switch to Helix: ${error.message}`, "warning");
    });
  });
}
