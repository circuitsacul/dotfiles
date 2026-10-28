import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type {
  ExtensionCommandContext,
  ExtensionReviewSelection,
  HunkExtensionAPI,
} from "hunkdiff/extension";

/** True when this Hunk runs in a yhx review window (set by `yhx-switch hunk`). */
function inYhx() {
  return process.env.YHX_HUNK === "1" && !!process.env.TMUX && !!process.env.HOME;
}

/** Run `yhx-switch edit ARGS...`: no shell, and no inherited terminal input. */
function yhxEdit(ctx: ExtensionCommandContext, args: string[]) {
  execFile(join(process.env.HOME!, "bin/yhx-switch"), ["edit", ...args], (error) => {
    if (error) ctx.notify(`Could not switch to Helix: ${error.message}`, "warning");
  });
}

/**
 * Map an old-side line to the new-side line a reader expects, using the file's unified patch.
 *
 * Mirrors Hunk's private `deletionLineToFileLine` (ui/lib/openInEditor.ts in Hunk 0.24.1):
 * context lines map one-to-one, and a deleted line lands on its replacement, clamped to the
 * last line the change block adds. Returns null when no hunk covers the line.
 */
function oldLineToNewLine(patch: string, oldLine: number): number | null {
  const lines = patch.split("\n");
  let i = 0;
  while (i < lines.length) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(lines[i++]);
    if (!header) continue;
    let oldCursor = Number(header[1]);
    // A zero-count side names the line before the change, so step past it.
    let newCursor = Number(header[2]) + (header[3] === "0" ? 1 : 0);

    while (i < lines.length && !lines[i].startsWith("@@")) {
      const kind = lines[i][0];
      if (kind === " ") {
        if (oldCursor === oldLine) return newCursor;
        oldCursor++;
        newCursor++;
        i++;
      } else if (kind === "-" || kind === "+") {
        let deletions = 0;
        let additions = 0;
        for (; i < lines.length && /^[-+\\]/.test(lines[i]); i++) {
          if (lines[i][0] === "-") deletions++;
          else if (lines[i][0] === "+") additions++;
        }
        if (oldLine >= oldCursor && oldLine < oldCursor + deletions) {
          return newCursor + Math.min(oldLine - oldCursor, Math.max(additions - 1, 0));
        }
        oldCursor += deletions;
        newCursor += additions;
      } else {
        i++; // "\ No newline at end of file", or the patch's trailing blank line
      }
    }
  }
  return null;
}

/** The on-disk line for the selection: current line if any, else the selected hunk's start. */
function selectedLine(selection: ExtensionReviewSelection): number {
  const { file, currentLine, hunkIndex } = selection;
  if (!file) return 1;
  if (currentLine?.side === "new") return currentLine.line;
  if (currentLine?.side === "old") {
    const line = oldLineToNewLine(file.patch, currentLine.line);
    if (line !== null) return Math.max(1, line);
  }
  const hunk = file.hunks?.find((h) => h.index === hunkIndex);
  return Math.max(1, hunk?.newRange?.[0] ?? 1);
}

export default function (hunk: HunkExtensionAPI) {
  // VCS reviews name their repo root here; Hunk resolves their file paths against it.
  let sourceLabel = "";
  hunk.on("changeset_loaded", ({ changeset }) => {
    sourceLabel = changeset.sourceLabel;
  });

  hunk.registerCommand({ id: "edit", title: "Open the selected file in Helix" }, (ctx) => {
    if (!inYhx()) {
      if (!ctx.commands.execute("hunk.review.editSelectedFile")) {
        ctx.notify("Cannot open an editor right now.", "warning");
      }
      return;
    }
    const { file } = ctx.selection;
    if (!file) {
      ctx.notify("No file selected.", "warning");
      return;
    }
    // Other inputs (patches, file compares) label themselves and resolve against the cwd.
    const base =
      isAbsolute(sourceLabel) && existsSync(sourceLabel) && statSync(sourceLabel).isDirectory()
        ? sourceLabel
        : ctx.cwd;
    const path = resolve(base, file.path);
    if (file.changeType === "deleted" || !existsSync(path)) {
      ctx.notify(`Cannot edit ${file.path}: file does not exist on disk.`, "warning");
      return;
    }
    yhxEdit(ctx, [`--line=${selectedLine(ctx.selection)}`, path]);
  });

  hunk.registerCommand({ id: "editor", title: "Switch to Helix (keep position)" }, (ctx) => {
    if (!inYhx()) {
      ctx.notify("Launch through yhx-switch hunk to switch to Helix.", "warning");
      return;
    }
    // No filename: only focus the editor window.
    yhxEdit(ctx, []);
  });
}
