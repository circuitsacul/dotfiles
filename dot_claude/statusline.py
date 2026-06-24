#!/usr/bin/env python3
"""Claude Code statusline.

Shows: model[effort] | context% | per-channel tokens (last/session-total) | cost

Last-request token counts come from `context_window.current_usage` on stdin.
Session totals are summed straight from the transcript JSONL (the source of
truth) rather than a counter file, so re-renders never double-count.
Cost is the real `cost.total_cost_usd` reported by the harness.
"""
import json
import sys
import time

# ---- ANSI colors -----------------------------------------------------------
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"
RED = "\033[31m"
ORANGE = "\033[38;5;208m"

SEP = f" {DIM}|{RESET} "


def humanize(n):
    """Compact token count: 942, 2.6k, 33k, 1.2M."""
    try:
        n = int(n)
    except (TypeError, ValueError):
        return "0"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 100_000:
        return f"{n / 1000:.0f}k"
    if n >= 1000:
        return f"{n / 1000:.1f}k"
    return str(n)


def fmt_eta(resets_at):
    """Compact countdown to a unix reset timestamp: 4h31m, 6d2h, now."""
    try:
        secs = int(resets_at) - int(time.time())
    except (TypeError, ValueError):
        return ""
    if secs <= 0:
        return "now"
    d, rem = divmod(secs, 86400)
    h, rem = divmod(rem, 3600)
    m, _ = divmod(rem, 60)
    if d:
        return f"{d}d{h}h"
    if h:
        return f"{h}h{m}m"
    return f"{m}m"


def transcript_totals(path):
    """Sum usage across all assistant messages in the transcript."""
    totals = {"in": 0, "cw": 0, "cr": 0, "out": 0}
    if not path:
        return totals
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                if '"usage"' not in line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = rec.get("message")
                usage = msg.get("usage") if isinstance(msg, dict) else None
                if not isinstance(usage, dict):
                    continue
                totals["in"] += usage.get("input_tokens", 0) or 0
                totals["cw"] += usage.get("cache_creation_input_tokens", 0) or 0
                totals["cr"] += usage.get("cache_read_input_tokens", 0) or 0
                totals["out"] += usage.get("output_tokens", 0) or 0
    except OSError:
        pass
    return totals


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        print("statusline: bad input")
        return

    # --- model[effort] ------------------------------------------------------
    model_id = (data.get("model") or {}).get("id") or "?"
    if model_id.startswith("claude-"):
        model_id = model_id[len("claude-"):]
    effort = (data.get("effort") or {}).get("level")
    model_str = f"{BOLD}{CYAN}{model_id}{RESET}"
    if effort:
        model_str += f"{DIM}{CYAN}[{effort}]{RESET}"

    # --- context % ----------------------------------------------------------
    cw = data.get("context_window") or {}
    pct = cw.get("used_percentage")
    if pct is None:
        ctx_str = f"{DIM}ctx -{RESET}"
    else:
        pct_i = int(round(pct))
        color = RED if pct_i >= 80 else YELLOW if pct_i >= 50 else GREEN
        ctx_str = f"{color}ctx {pct_i}%{RESET}"

    # --- tokens: last / session-total --------------------------------------
    last = cw.get("current_usage") or {}
    last_in = last.get("input_tokens", 0) or 0
    last_cw = last.get("cache_creation_input_tokens", 0) or 0
    last_cr = last.get("cache_read_input_tokens", 0) or 0
    last_out = last.get("output_tokens", 0) or 0

    tot = transcript_totals(data.get("transcript_path"))

    def chan(color, label, lv, tv):
        return (f"{color}{label}{RESET}:{humanize(lv)}"
                f"{DIM}/{humanize(tv)}{RESET}")

    tok_str = " ".join([
        chan(BLUE, "in", last_in, tot["in"]),
        chan(MAGENTA, "cw", last_cw, tot["cw"]),
        chan(ORANGE, "cr", last_cr, tot["cr"]),
        chan(GREEN, "out", last_out, tot["out"]),
    ])

    # --- cost ---------------------------------------------------------------
    cost = (data.get("cost") or {}).get("total_cost_usd", 0) or 0
    if cost < 0.01:
        cost_str = f"{BOLD}{YELLOW}${cost:.4f}{RESET}"
    elif cost < 1:
        cost_str = f"{BOLD}{YELLOW}${cost:.3f}{RESET}"
    else:
        cost_str = f"{BOLD}{YELLOW}${cost:.2f}{RESET}"

    # --- rolling-window plan limits ----------------------------------------
    limits = data.get("rate_limits") or {}

    def window(label, key):
        w = limits.get(key)
        if not isinstance(w, dict):
            return None
        pct = w.get("used_percentage")
        if pct is None:
            return None
        pct_i = int(round(pct))
        color = RED if pct_i >= 80 else YELLOW if pct_i >= 50 else GREEN
        eta = fmt_eta(w.get("resets_at"))
        out = f"{DIM}{label}{RESET} {color}{pct_i}%{RESET}"
        if eta:
            out += f" {DIM}↻{eta}{RESET}"
        return out

    lim_parts = [p for p in (window("5h:", "five_hour"),
                             window("7d:", "seven_day")) if p]

    segments = [model_str, ctx_str, tok_str, cost_str]
    if lim_parts:
        segments.append(f" {BOLD}{CYAN}•{RESET} ".join(lim_parts))

    print(SEP.join(segments))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # never let the statusline crash the TUI
        print(f"statusline error: {exc}")
