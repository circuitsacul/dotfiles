"""Run with: python3 -m unittest discover -s .llm/tests -v (Python 3.11+, chezmoi)."""
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[2]
GRAM = ROOT / "dot_config/gram"
HELPER = ROOT / "bin/executable_gram-tool"


def chezmoi(*args, data=None, text=None):
    return subprocess.check_output(
        ["chezmoi", "--config", "/dev/null", "--config-format", "toml",
         "--source", str(ROOT), "--override-data", json.dumps(data or {}), *args],
        input=text, text=True,
    )


def render(name):
    return chezmoi("execute-template", text=(GRAM / name).read_text())


def yaml_data(text):
    return json.loads(chezmoi("execute-template", "{{ .raw | fromYaml | toJson }}", data={"raw": text}))


def jsonc(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise AssertionError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    # Preserve quoted strings, including // in paths, while stripping comments.
    text = re.sub(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*[\s\S]*?\*/',
                  lambda m: m[0] if m[0].startswith('"') else '', path.read_text())
    return json.loads(text, object_pairs_hook=unique)


class ConfigTests(unittest.TestCase):
    def test_keymap_and_tasks(self):
        keymap = jsonc(GRAM / "keymap.jsonc")
        settings = jsonc(GRAM / "settings.jsonc")
        tasks = jsonc(GRAM / "tasks.jsonc")
        self.assertTrue(settings["helix_mode"])
        self.assertEqual(settings["base_keymap"], "Minimal")
        labels = {task["label"] for task in tasks}
        self.assertEqual(len(labels), len(tasks))
        self.assertEqual({task["label"]: task["reveal_target"] for task in tasks},
                         {"Gram: yazi": "dock", "Gram: lazygit": "center"})
        for task in tasks:
            self.assertTrue(task["allow_concurrent_runs"])
            self.assertFalse(task["use_new_terminal"])
            self.assertEqual(task["save"], "none")
            self.assertNotIn("$GRAM_", task["command"])
        for group in keymap:
            for action in group["bindings"].values():
                if isinstance(action, list) and action[0] == "task::Spawn":
                    self.assertIn(action[1]["task_name"], labels)
        modal = next(g["bindings"] for g in keymap if "space w n" in g["bindings"])
        for key in ("n", "e", "i", "o", "s", "v", "q", "z", "="):
            self.assertEqual(modal[f"space w {key}"], modal[f"ctrl-w {key}"])
        self.assertEqual(modal["space w s"], "pane::SplitDown")
        self.assertEqual(modal["space w v"], "pane::SplitRight")
        # No global plain letters/Space to eat queries, terminal input or text.
        for group in keymap:
            if not group.get("context") or group.get("context") == "!Terminal":
                self.assertTrue(all(key.startswith(("ctrl-", "cmd-", "alt-")) for key in group["bindings"]))
        self.assertNotIn("agent::", (GRAM / "keymap.jsonc").read_text())

    def test_dispatch_regressions(self):
        keymap = jsonc(GRAM / "keymap.jsonc")
        for panel in ("ProjectPanel", "OutlinePanel", "GitPanel"):
            group = next(g for g in keymap if g.get("context", "").startswith(panel))
            # These panels carry menu even when no popup is open.
            self.assertNotIn("!menu", group["context"])
            self.assertIn("q", group["bindings"])
        disabled = {key for g in keymap for key, action in g["bindings"].items() if action is None}
        for key in ("space", "z ^", "z +", "shift-z shift-q", "shift-z shift-z",
                    "ctrl-w ctrl-o", "ctrl-w a", "ctrl-w ctrl-a"):
            self.assertIn(key, disabled)
        terminal = next(g["bindings"] for g in keymap if g.get("context") == "Terminal")
        # ActivatePane is intercepted inside TerminalPanel; use its native toggle.
        self.assertEqual(terminal["ctrl-alt-f"], "terminal_panel::ToggleFocus")
        modal = next(g["bindings"] for g in keymap if "space /" in g["bindings"])
        self.assertEqual(modal["space /"], "project_search::ToggleFocus")

    def test_nonmodal_pane_navigation_and_dismissal(self):
        keymap = jsonc(GRAM / "keymap.jsonc")
        global_keys = next(g["bindings"] for g in keymap if not g.get("context"))
        modal = next(g["bindings"] for g in keymap if "space w n" in g["bindings"])
        for key in "neio":
            self.assertEqual(global_keys[f"alt-shift-{key}"], modal[f"space w {key}"])
            self.assertEqual(global_keys[f"alt-shift-{key}"], global_keys[f"ctrl-alt-{key}"])
        project = next(g["bindings"] for g in keymap if g.get("context") == "ProjectPanel && not_editing")
        git = next(g["bindings"] for g in keymap if g.get("context", "").startswith("GitPanel"))
        self.assertEqual(project["q"], "project_panel::Toggle")
        self.assertEqual(git["q"], "git_panel::Close")
        # Preserve native Escape handling, including canceling rename/commit edits.
        self.assertNotIn("escape", project)
        self.assertNotIn("escape", git)
        for context in ("OutlinePanel && not_editing", "OutlinePanel > Editor"):
            group = next(g for g in keymap if g.get("context") == context)
            self.assertEqual(group["bindings"]["escape"], "outline_panel::Toggle")
        search = next(g for g in keymap if g.get("context", "").startswith("ProjectSearchBar"))
        self.assertIn("ProjectSearchBar > Editor", search["context"])
        self.assertEqual(search["bindings"], {"ctrl-q": "pane::CloseActiveItem"})
        git_close = next(g for g in keymap if g.get("context") == "GitPanel || (GitPanel > Editor)")
        self.assertEqual(git_close["bindings"], {"ctrl-q": "git_panel::Close"})

    def test_global_alt_navigation(self):
        keymap = jsonc(GRAM / "keymap.jsonc")
        global_keys = next(g["bindings"] for g in keymap if not g.get("context"))
        modal = next(g["bindings"] for g in keymap if "space w n" in g["bindings"])
        terminal = next(g["bindings"] for g in keymap if g.get("context") == "Terminal")
        for key, direction, alias in (("n", "Previous", "["), ("o", "Next", "]")):
            self.assertEqual(global_keys[f"alt-{key}"], f"pane::Activate{direction}Item")
            self.assertEqual(global_keys[f"alt-{key}"], modal[f"shift-{key}"])
            self.assertEqual(global_keys[f"alt-{key}"], terminal[f"ctrl-alt-{alias}"])
        navigation = {"alt-n", "alt-o", *(f"alt-shift-{key}" for key in "neio")}
        for key in navigation:
            # Catch later overrides/nulls, even with a different modifier order
            # or in another context-free group. Define each chord exactly once.
            occurrences = [(g.get("context"), binding) for g in keymap for binding in g["bindings"]
                           if sorted(binding.split("-")) == sorted(key.split("-"))]
            self.assertEqual(occurrences, [(None, key)])
        for group in keymap:
            for key in "neio":
                self.assertNotIn(f"cmd-{key}", group["bindings"])
                self.assertNotIn(f"cmd-shift-{key}", group["bindings"])
        # Ctrl-W stays with the shell/TUI; don't turn it into a global prefix.
        for bindings in (global_keys, terminal):
            self.assertFalse(any(key.startswith("ctrl-w") for key in bindings))

    def test_global_bottom_dock_toggle(self):
        keymap = jsonc(GRAM / "keymap.jsonc")
        # One context-free binding works in editors, inputs and terminals;
        # no later override should turn visibility toggling into focus toggling.
        bindings = [(g.get("context"), g["bindings"]["ctrl-t"])
                    for g in keymap if "ctrl-t" in g["bindings"]]
        self.assertEqual(bindings, [(None, "workspace::ToggleBottomDock")])

    def test_terminal_shell_creation(self):
        keymap = jsonc(GRAM / "keymap.jsonc")
        terminal = next(g["bindings"] for g in keymap if g.get("context") == "Terminal")
        self.assertEqual(terminal["cmd-t"], "workspace::NewTerminal")
        # Cmd-T creates shells; Ctrl-T uses the global visibility toggle.
        self.assertNotIn("ctrl-t", terminal)
        self.assertEqual([g["context"] for g in keymap if "cmd-t" in g["bindings"]], ["Terminal"])
        modal = next(g["bindings"] for g in keymap if "space t" in g["bindings"])
        self.assertEqual(modal["space t"], "terminal_panel::ToggleFocus")

    def test_derived_lazygit(self):
        base = yaml_data((ROOT / "dot_config/lazygit/config.yml").read_text())
        derived = yaml_data(render("lazygit.yml.tmpl"))
        self.assertEqual(base["keybinding"], derived["keybinding"])
        self.assertEqual(base["git"], derived["git"])
        self.assertEqual(derived["customCommands"], [c for c in base["customCommands"]
                         if not c["command"].startswith("~/bin/yhx-switch-")])
        self.assertNotIn("yhx-switch", json.dumps(derived))
        self.assertIn("--wait", derived["os"]["editAtLineAndWait"])
        self.assertNotIn("--wait", derived["os"]["edit"])

    def test_derived_yazi(self):
        base = tomllib.loads((ROOT / "dot_config/yazi/keymap.toml").read_text())
        derived = tomllib.loads(render("yazi/keymap.toml.tmpl"))
        bindings = {k["on"]: k["run"] for k in derived["mgr"]["prepend_keymap"]}
        original = {k["on"]: k["run"] for k in base["mgr"]["prepend_keymap"]}
        for key in "neio":
            self.assertEqual(bindings[key], original[key])
        self.assertEqual(bindings["E"], "quit")
        for key in ("<Enter>", "<S-Enter>", "O"):
            self.assertEqual(bindings[key], "open")
        self.assertNotIn("yhx-switch", json.dumps(derived))

    def test_chezmoi_profiles(self):
        for profile, platform, included in [("home", "linux", True), ("work", "darwin", True),
                                             ("agentbox-test", "linux", False)]:
            managed = chezmoi("managed", data={"profile": profile, "platform": platform}).splitlines()
            self.assertEqual(".config/gram/settings.jsonc" in managed, included)
            self.assertEqual("bin/gram-tool" in managed, included)
            self.assertFalse(any(p == ".llm" or p.startswith(".llm/") for p in managed))


STUB = '''#!/usr/bin/env python3
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
with open(os.environ["CALL_LOG"], "a") as log:
    log.write(json.dumps({"name": name, "args": sys.argv[1:], "cwd": os.getcwd(),
                          "env": {k: os.environ.get(k) for k in
                                  ["YAZI_CONFIG_HOME", "EDITOR", "VISUAL", "GIT_EDITOR", "GIT_SEQUENCE_EDITOR"]}}) + "\\n")
if name == "yazi":
    pathlib.Path(sys.argv[2]).write_text(os.environ.get("CHOICE", ""))
sys.exit(int(os.environ.get(name.upper() + "_EXIT", "0")))
'''


class HelperTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="gram-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.home = self.root / "home with ' quote"
        self.bin = self.home / "bin"
        self.bin.mkdir(parents=True)
        self.project = self.root / 'project $(not-a-command)'
        self.project.mkdir()
        config_root = ".config" if os.uname().sysname == "Darwin" else "config"
        self.config = self.home / config_root / "gram"
        (self.config / "yazi").mkdir(parents=True)
        (self.config / "yazi/keymap.toml").write_text(render("yazi/keymap.toml.tmpl"))
        (self.config / "lazygit.yml").write_text(render("lazygit.yml.tmpl"))
        for name in ("gram", "yazi", "lazygit"):
            path = self.bin / name
            path.write_text(STUB)
            path.chmod(0o755)
        (self.bin / "gram-tool").write_bytes(HELPER.read_bytes())
        (self.bin / "gram-tool").chmod(0o755)
        self.log = self.root / "calls.jsonl"
        self.env = dict(os.environ, HOME=str(self.home), XDG_CONFIG_HOME=str(self.config.parent),
                        PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
                        GRAM_WORKTREE_ROOT=str(self.project), CALL_LOG=str(self.log), TMPDIR=str(self.root))
        self.env.pop("GRAM_FILE", None)
        self.env.pop("YAZI_CONFIG_HOME", None)

    def run_helper(self, *args, **env):
        return subprocess.run(["bash", str(HELPER), *args], env=dict(self.env, **env),
                              cwd=self.project, capture_output=True, text=True, timeout=10)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_open_literal_paths_and_line(self):
        names = ["with space.txt", "a'b.txt", '$(touch INJECTED).txt', "-leading.txt"]
        result = self.run_helper("open", "--line=12", "--", *names)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls()[0]["args"], ["--", *[str(self.project / n) + ":12:1" for n in names]])
        self.assertFalse((self.project / "INJECTED").exists())

    def test_wait_and_validation(self):
        self.assertEqual(self.run_helper("open", "--wait", "--", "file").returncode, 0)
        self.assertEqual(self.calls()[0]["args"], ["--wait", "--", str(self.project / "file")])
        for args in [("open",), ("open", "--line=0", "file"), ("open", "--line=abc", "file"),
                     ("open", "--", "."), ("open", "--", ""), ("bad-mode",), ("yazi", "extra")]:
            self.assertEqual(self.run_helper(*args).returncode, 2)

    def test_yazi_choose_many_and_cleanup(self):
        names = [str(self.project / "a 'quoted' file"), str(self.project / "$(touch INJECTED)")]
        result = self.run_helper("yazi", GRAM_FILE=names[0], CHOICE="\n".join([str(self.project), *names]))
        self.assertEqual(result.returncode, 0, result.stderr)
        yazi, gram = self.calls()
        self.assertEqual(yazi["args"][2:], ["--", names[0]])
        self.assertEqual(yazi["env"]["YAZI_CONFIG_HOME"], str(self.config / "yazi"))
        self.assertEqual(gram["args"], ["--", *names])
        self.assertFalse(Path(yazi["args"][1]).exists())
        self.assertFalse((self.project / "INJECTED").exists())

    def test_yazi_cancel_fallback_and_failure(self):
        self.assertEqual(self.run_helper("yazi").returncode, 0)
        self.assertEqual(self.calls()[0]["args"][-1], str(self.project))
        self.assertEqual(len(self.calls()), 1)
        self.assertEqual(self.run_helper("yazi", YAZI_EXIT="7", CHOICE="ignored").returncode, 7)
        self.assertEqual(len(self.calls()), 2)
        self.assertFalse(list(self.root.glob("gram-yazi.*")))

    def test_lazygit_config_and_waiting_editor(self):
        result = self.run_helper("lazygit")
        self.assertEqual(result.returncode, 0, result.stderr)
        call = self.calls()[0]
        self.assertEqual(call["cwd"], str(self.project))
        self.assertEqual(call["args"], [f"--use-config-file={self.config / 'lazygit.yml'}"])
        editors = call["env"]
        for key in ("EDITOR", "VISUAL", "GIT_EDITOR", "GIT_SEQUENCE_EDITOR"):
            self.assertIn("--wait", editors[key])
        subprocess.run(["bash", "-c", editors["GIT_EDITOR"] + " " + shlex.quote("commit ' message")],
                       env=self.env, cwd=self.project, check=True, timeout=10)
        self.assertEqual(self.calls()[-1]["args"], ["--wait", "--", str(self.project / "commit ' message")])

    def test_lazygit_editor_placeholder_quoting(self):
        config = yaml_data((self.config / "lazygit.yml").read_text())
        command = config["os"]["editAtLine"].replace("{{line}}", "23").replace("{{filename}}", shlex.quote("$() ' file"))
        subprocess.run(["bash", "-c", command], env=self.env, cwd=self.project, check=True, timeout=10)
        self.assertEqual(self.calls()[-1]["args"], ["--", str(self.project / "$() ' file") + ":23:1"])
        directory = str(self.project / "worktree ' $()")
        command = config["os"]["openDirInEditor"].replace("{{dir}}", shlex.quote(directory))
        subprocess.run(["bash", "-c", command], env=self.env, cwd=self.project, check=True, timeout=10)
        self.assertEqual(self.calls()[-1]["args"], ["--", directory])

    def test_cli_failure_propagates(self):
        self.assertEqual(self.run_helper("open", "file", GRAM_EXIT="9").returncode, 9)


if __name__ == "__main__":
    unittest.main()
