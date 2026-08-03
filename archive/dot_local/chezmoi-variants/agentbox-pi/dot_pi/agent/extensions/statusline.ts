/**
 * Claude Code-style statusline for pi.
 *
 * Port of archive/dot_claude/statusline.py:
 *   model[thinking] | context% | per-channel tokens (last/session-total) | cost | quota
 *
 * This extension installs a custom footer with ctx.ui.setFooter(), so it replaces
 * pi's built-in footer and ignores other status entries from ctx.ui.setStatus().
 * It also reasserts the footer periodically so one-shot footer/statusline
 * extensions loaded earlier/later do not win permanently.
 *
 * Quota support is intentionally self-contained, but follows the provider/API
 * shapes used by @mjfuertesf/pi-quota-status:
 *   - openai-codex: ChatGPT backend quota API
 *   - anthropic / claude-bridge: Claude web usage API with HAR-extracted auth,
 *     falling back to the Claude Code OAuth token (~/.claude/.credentials.json)
 *     against api.anthropic.com/api/oauth/usage
 *   - opencode-go: opencode.ai dashboard scrape
 *
 * Quota results are shared across sessions through ~/.pi/agent/statusline_cache.json,
 * guarded by a per-provider lock file: one active session refreshes (every 60s) and
 * everyone else just reads. Stale data (>5m old) is greyed out rather than hidden.
 */

import { readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { calculateCost, getModel } from "@earendil-works/pi-ai/compat";
import type { Api, AssistantMessage, Model, Usage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

// ---- Claude Code-ish ANSI colors -----------------------------------------
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const RED = "\x1b[31m";
const ORANGE = "\x1b[38;5;208m";
const SEP = ` ${DIM}|${RESET} `;

const STATUSLINE_KEY = "claude-style-statusline";
const QUOTA_CACHE_PATH = join(homedir(), ".pi", "agent", "statusline_cache.json");
const QUOTA_REFRESH_MS = 60_000;
const QUOTA_FAILURE_BACKOFF_MS = 15_000;
const QUOTA_LOCK_STALE_MS = 30_000;
const QUOTA_DIM_AFTER_MS = 5 * 60_000;
const ACTIVITY_WINDOW_MS = 2 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;

interface TokenTotals {
	in: number;
	cw: number;
	cr: number;
	out: number;
	cost: number;
}

interface QuotaWindow {
	remainingPct: number;
	resetAt: string | null;
}

interface ScopedQuotaWindow extends QuotaWindow {
	label: string;
}

interface QuotaData {
	status: "ok" | "partial";
	fiveHour: QuotaWindow | null;
	weekly: QuotaWindow | null;
	scoped?: ScopedQuotaWindow | null;
}

type QuotaResult = QuotaData | { status: "unknown"; retryAfterMs?: number } | { status: "unsupported" };

interface QuotaCacheEntry {
	fetchedAt?: number;
	nextAttemptAt?: number;
	result?: QuotaData;
}

function humanize(value: unknown): string {
	const n = Number(value) || 0;
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 100_000) return `${Math.round(n / 1_000)}k`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return `${Math.trunc(n)}`;
}

function formatCost(cost: number): string {
	if (cost < 0.01) return `$${cost.toFixed(4)}`;
	if (cost < 1) return `$${cost.toFixed(3)}`;
	return `$${cost.toFixed(2)}`;
}

function compactModelId(id: string | undefined): string {
	if (!id) return "?";
	return id.startsWith("claude-") ? id.slice("claude-".length) : id;
}

function zeroUsage(): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function isAssistantMessage(message: unknown): message is AssistantMessage {
	return typeof message === "object" && message !== null && (message as { role?: unknown }).role === "assistant";
}

function latestAssistantUsage(ctx: ExtensionContext): Usage {
	const branch = ctx.sessionManager.getBranch();
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "message" && isAssistantMessage(entry.message)) {
			return entry.message.usage;
		}
	}
	return zeroUsage();
}

// getModel's builtin-catalog typing wants a literal model id and claims a
// non-nullable return; at runtime unknown ids yield undefined.
const lookupAnthropicModel = getModel as (provider: "anthropic", modelId: string) => Model<Api> | undefined;

// claude-bridge registers its models with zeroed cost rates (subscription = $0
// out of pocket), so re-price zero-cost claude messages with pi-ai's anthropic
// API rates to show the API-equivalent spend, like openai-codex does.
function messageCost(message: AssistantMessage): number {
	const reported = message.usage.cost?.total || 0;
	if (reported > 0) return reported;
	const model = lookupAnthropicModel("anthropic", message.model);
	if (!model) return 0;
	const usage: Usage = { ...message.usage, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
	return calculateCost(model, usage).total;
}

function sessionTotals(ctx: ExtensionContext): TokenTotals {
	const totals: TokenTotals = { in: 0, cw: 0, cr: 0, out: 0, cost: 0 };
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type !== "message" || !isAssistantMessage(entry.message)) continue;
		const usage = entry.message.usage;
		totals.in += usage.input || 0;
		totals.cw += usage.cacheWrite || 0;
		totals.cr += usage.cacheRead || 0;
		totals.out += usage.output || 0;
		totals.cost += messageCost(entry.message);
	}
	return totals;
}

function fmtEta(resetAt: string | null): string {
	if (!resetAt) return "";
	const resetMs = Date.parse(resetAt);
	if (!Number.isFinite(resetMs)) return "";
	let secs = Math.max(0, Math.floor((resetMs - Date.now()) / 1000));
	if (secs <= 0) return "now";
	const d = Math.floor(secs / 86_400);
	secs %= 86_400;
	const h = Math.floor(secs / 3_600);
	secs %= 3_600;
	const m = Math.floor(secs / 60);
	if (d) return `${d}d${h}h`;
	if (h) return `${h}h${m}m`;
	return `${m}m`;
}

function authPath(): string {
	return join(homedir(), ".pi", "agent", "auth.json");
}

function readAuthJson(): Record<string, unknown> | undefined {
	try {
		return JSON.parse(readFileSync(authPath(), "utf8")) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

function readObject(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readQuotaStatusProviderConfig(providerKey: string): Record<string, unknown> | undefined {
	const auth = readAuthJson();
	const quotaStatus = readObject(auth?.["quota-status"]);
	return readObject(quotaStatus?.[providerKey]);
}

async function fetchJson(url: string, init: RequestInit, meta?: { retryAfterMs?: number }): Promise<unknown | undefined> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, { ...init, signal: controller.signal });
		if (!response.ok) {
			if (meta && response.status === 429) {
				const retryAfter = Number(response.headers.get("retry-after"));
				if (Number.isFinite(retryAfter) && retryAfter > 0) meta.retryAfterMs = retryAfter * 1000;
			}
			return undefined;
		}
		return await response.json();
	} catch {
		return undefined;
	} finally {
		clearTimeout(timer);
	}
}

function remainingFromUsed(used: unknown): number | undefined {
	if (typeof used !== "number" || !Number.isFinite(used)) return undefined;
	return Math.max(0, Math.min(100, 100 - used));
}

// ---- openai-codex quota ---------------------------------------------------
interface OpenAIUsageWindow {
	used_percent?: number;
	reset_at?: number;
	reset_after_seconds?: number;
}

function readOpenAICodexAuth(): { access: string; accountId: string } | undefined {
	const raw = readObject(readAuthJson()?.["openai-codex"]);
	const access = typeof raw?.access === "string" ? raw.access : undefined;
	const accountId = typeof raw?.accountId === "string" ? raw.accountId : undefined;
	return access && accountId ? { access, accountId } : undefined;
}

function normalizeOpenAIWindow(raw: unknown, nowMs: number): QuotaWindow | null {
	const win = readObject(raw) as OpenAIUsageWindow | undefined;
	const remainingPct = remainingFromUsed(win?.used_percent);
	if (remainingPct === undefined) return null;
	let resetAt: string | null = null;
	if (typeof win?.reset_at === "number") resetAt = new Date(win.reset_at * 1000).toISOString();
	else if (typeof win?.reset_after_seconds === "number") {
		resetAt = new Date(nowMs + Math.max(0, win.reset_after_seconds * 1000)).toISOString();
	}
	return { remainingPct, resetAt };
}

async function fetchOpenAICodexQuota(): Promise<QuotaResult> {
	const auth = readOpenAICodexAuth();
	if (!auth) return { status: "unknown" };

	const headers = {
		Authorization: `Bearer ${auth.access}`,
		"chatgpt-account-id": auth.accountId,
		originator: "pi",
		"User-Agent": "pi",
	};

	for (const url of [
		"https://chatgpt.com/backend-api/wham/usage",
		"https://chatgpt.com/backend-api/codex/usage",
	]) {
		const data = readObject(await fetchJson(url, { headers }));
		const rateLimit = readObject(data?.rate_limit);
		const nowMs = Date.now();
		const fiveHour = normalizeOpenAIWindow(rateLimit?.primary_window, nowMs);
		const weekly = normalizeOpenAIWindow(rateLimit?.secondary_window, nowMs);
		if (!fiveHour && !weekly) continue;
		return { status: fiveHour && weekly ? "ok" : "partial", fiveHour, weekly };
	}

	return { status: "unknown" };
}

// ---- anthropic / claude-bridge quota -------------------------------------
function readAnthropicApiConfig():
	| { organizationUuid: string; authCookie: string; headers?: Record<string, string> }
	| undefined {
	const raw = readQuotaStatusProviderConfig("anthropic-subscription");
	const organizationUuid = typeof raw?.organizationUuid === "string" ? raw.organizationUuid : undefined;
	const authCookie = typeof raw?.authCookie === "string" ? raw.authCookie : undefined;
	if (!organizationUuid || !authCookie) return undefined;

	const headersRaw = readObject(raw?.headers);
	const headers = headersRaw
		? Object.fromEntries(Object.entries(headersRaw).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
		: undefined;
	return { organizationUuid, authCookie, ...(headers ? { headers } : {}) };
}

function normalizeClaudeWindow(raw: unknown): QuotaWindow | null {
	const win = readObject(raw);
	const remainingPct = remainingFromUsed(win?.utilization);
	if (remainingPct === undefined) return null;
	const resetAt = win?.resets_at === null ? null : typeof win?.resets_at === "string" ? win.resets_at : null;
	return { remainingPct, resetAt };
}

function normalizeScopedClaudeWindow(limits: unknown): ScopedQuotaWindow | null {
	if (!Array.isArray(limits)) return null;
	for (const raw of limits) {
		const limit = readObject(raw);
		if (limit?.kind !== "weekly_scoped") continue;
		const remainingPct = remainingFromUsed(limit.percent);
		if (remainingPct === undefined) continue;
		const model = readObject(readObject(limit.scope)?.model);
		const label = typeof model?.display_name === "string" ? model.display_name.toLowerCase() : "model";
		const resetAt = typeof limit.resets_at === "string" ? limit.resets_at : null;
		return { label, remainingPct, resetAt };
	}
	return null;
}

function parseClaudeUsage(data: Record<string, unknown> | undefined): QuotaResult {
	const fiveHour = normalizeClaudeWindow(data?.five_hour);
	const weekly = normalizeClaudeWindow(data?.seven_day);
	if (!fiveHour && !weekly) return { status: "unknown" };
	return {
		status: fiveHour && weekly ? "ok" : "partial",
		fiveHour,
		weekly,
		scoped: normalizeScopedClaudeWindow(data?.limits),
	};
}

function readClaudeCodeOAuthToken(): string | undefined {
	try {
		const raw = JSON.parse(readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf8")) as unknown;
		const token = readObject(readObject(raw)?.claudeAiOauth)?.accessToken;
		return typeof token === "string" ? token : undefined;
	} catch {
		return undefined;
	}
}

async function fetchClaudeCookieQuota(): Promise<QuotaResult> {
	const config = readAnthropicApiConfig();
	if (!config) return { status: "unknown" };

	const data = readObject(
		await fetchJson(`https://claude.ai/api/organizations/${config.organizationUuid}/usage`, {
			headers: {
				accept: "application/json",
				referer: "https://claude.ai/settings/usage",
				"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0",
				...(config.headers ?? {}),
				cookie: config.authCookie,
			},
		}),
	);
	return parseClaudeUsage(data);
}

async function fetchClaudeOAuthQuota(): Promise<QuotaResult> {
	const token = readClaudeCodeOAuthToken();
	if (!token) return { status: "unknown" };

	const meta: { retryAfterMs?: number } = {};
	const data = readObject(
		await fetchJson(
			"https://api.anthropic.com/api/oauth/usage",
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"anthropic-beta": "oauth-2025-04-20",
					"Content-Type": "application/json",
					"User-Agent": "claude-cli/2.0.0 (external)",
				},
			},
			meta,
		),
	);
	const result = parseClaudeUsage(data);
	if (result.status === "unknown" && meta.retryAfterMs) return { status: "unknown", retryAfterMs: meta.retryAfterMs };
	return result;
}

async function fetchAnthropicQuota(): Promise<QuotaResult> {
	const viaCookie = await fetchClaudeCookieQuota();
	if (viaCookie.status !== "unknown") return viaCookie;
	return fetchClaudeOAuthQuota();
}

// ---- opencode-go quota ----------------------------------------------------
function normalizeOpenCodeGoWindow(win: { usagePercent: number; resetInSec: number } | null): QuotaWindow | null {
	if (!win) return null;
	return {
		remainingPct: Math.max(0, Math.min(100, 100 - win.usagePercent)),
		resetAt: new Date(Date.now() + Math.max(0, win.resetInSec * 1000)).toISOString(),
	};
}

function parseOpenCodeGoWindow(html: string, name: string): { usagePercent: number; resetInSec: number } | null {
	const num = String.raw`(-?\d+(?:\.\d+)?)`;
	const regexes = [
		new RegExp(String.raw`${name}:\$R\[\d+\]=\{[^}]*usagePercent:${num}[^}]*resetInSec:${num}[^}]*\}`),
		new RegExp(String.raw`${name}:\$R\[\d+\]=\{[^}]*resetInSec:${num}[^}]*usagePercent:${num}[^}]*\}`),
	];
	for (const regex of regexes) {
		const match = regex.exec(html);
		if (!match) continue;
		const first = Number(match[1]);
		const second = Number(match[2]);
		if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
		return regex === regexes[0]
			? { usagePercent: first, resetInSec: second }
			: { usagePercent: second, resetInSec: first };
	}
	return null;
}

async function fetchOpenCodeGoQuota(): Promise<QuotaResult> {
	const raw = readQuotaStatusProviderConfig("opencode-go");
	const workspaceId = typeof raw?.workspaceId === "string" ? raw.workspaceId : undefined;
	const authCookie = typeof raw?.authCookie === "string" ? raw.authCookie : undefined;
	if (!workspaceId || !authCookie) return { status: "unknown" };

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(`https://opencode.ai/workspace/${workspaceId}/go`, {
			headers: { Cookie: `auth=${authCookie}`, "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0" },
			signal: controller.signal,
		});
		if (!response.ok || new URL(response.url).pathname !== `/workspace/${workspaceId}/go`) return { status: "unknown" };
		const html = await response.text();
		const fiveHour = normalizeOpenCodeGoWindow(parseOpenCodeGoWindow(html, "rollingUsage"));
		const weekly = normalizeOpenCodeGoWindow(parseOpenCodeGoWindow(html, "weeklyUsage"));
		if (!fiveHour && !weekly) return { status: "unknown" };
		return { status: fiveHour && weekly ? "ok" : "partial", fiveHour, weekly };
	} catch {
		return { status: "unknown" };
	} finally {
		clearTimeout(timer);
	}
}

// anthropic and claude-bridge share one subscription, hence one cache entry.
function quotaKey(provider: string | undefined): string | undefined {
	if (provider === "anthropic" || provider === "claude-bridge") return "anthropic";
	if (provider === "openai-codex" || provider === "opencode-go") return provider;
	return undefined;
}

async function fetchQuota(provider: string | undefined): Promise<QuotaResult> {
	if (provider === "openai-codex") return fetchOpenAICodexQuota();
	if (provider === "opencode-go") return fetchOpenCodeGoQuota();
	if (provider === "anthropic" || provider === "claude-bridge") return fetchAnthropicQuota();
	return { status: "unsupported" };
}

function readQuotaCacheFile(): Record<string, unknown> {
	try {
		return readObject(JSON.parse(readFileSync(QUOTA_CACHE_PATH, "utf8"))) ?? {};
	} catch {
		return {};
	}
}

function readQuotaEntry(key: string): QuotaCacheEntry | undefined {
	const raw = readObject(readObject(readQuotaCacheFile().quota)?.[key]);
	if (!raw) return undefined;
	const result = readObject(raw.result);
	return {
		fetchedAt: typeof raw.fetchedAt === "number" ? raw.fetchedAt : undefined,
		nextAttemptAt: typeof raw.nextAttemptAt === "number" ? raw.nextAttemptAt : undefined,
		result: result?.status === "ok" || result?.status === "partial" ? (result as unknown as QuotaData) : undefined,
	};
}

function writeQuotaEntry(key: string, entry: QuotaCacheEntry): void {
	try {
		const cache = readQuotaCacheFile();
		const quota = readObject(cache.quota) ?? {};
		const tmp = `${QUOTA_CACHE_PATH}.${process.pid}.tmp`;
		writeFileSync(tmp, JSON.stringify({ ...cache, updatedAt: Date.now(), quota: { ...quota, [key]: entry } }));
		renameSync(tmp, QUOTA_CACHE_PATH);
	} catch {
		// best-effort cache; a lost write just means another refresh later
	}
}

function quotaLockPath(key: string): string {
	return `${QUOTA_CACHE_PATH}.${key}.lock`;
}

function tryAcquireQuotaLock(key: string): boolean {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			writeFileSync(quotaLockPath(key), String(process.pid), { flag: "wx" });
			return true;
		} catch {
			try {
				if (Date.now() - statSync(quotaLockPath(key)).mtimeMs < QUOTA_LOCK_STALE_MS) return false;
				unlinkSync(quotaLockPath(key)); // stale lock from a dead or slept process
			} catch {
				return false;
			}
		}
	}
	return false;
}

function releaseQuotaLock(key: string): void {
	try {
		unlinkSync(quotaLockPath(key));
	} catch {
		// already stolen as stale
	}
}

function formatQuotaWindow(label: string, win: QuotaWindow | null, stale: boolean): string {
	if (!win) return `${DIM}${label} ??${RESET}`;
	const pct = Math.round(win.remainingPct);
	const eta = fmtEta(win.resetAt);
	if (stale) return `${DIM}${label} ${pct}%${eta ? ` ↻${eta}` : ""}${RESET}`;
	const color = pct <= 20 ? RED : pct <= 50 ? YELLOW : GREEN;
	return `${DIM}${label}${RESET} ${color}${pct}%${RESET}${eta ? ` ${DIM}↻${eta}${RESET}` : ""}`;
}

function formatQuota(entry: QuotaCacheEntry | undefined, provider: string | undefined, modelId: string | undefined): string | undefined {
	if (!quotaKey(provider)) return undefined;
	const result = entry?.result;
	if (!result) return `${DIM}sub unknown${RESET}`;
	const stale = Date.now() - (entry?.fetchedAt ?? 0) > QUOTA_DIM_AFTER_MS;
	const windows = [formatQuotaWindow("5h:", result.fiveHour, stale), formatQuotaWindow("7d:", result.weekly, stale)];
	if (result.scoped && modelId?.toLowerCase().includes(result.scoped.label)) {
		windows.push(formatQuotaWindow(`${result.scoped.label} 7d:`, result.scoped, stale));
	}
	return windows.join(stale ? ` ${DIM}•${RESET} ` : ` ${BOLD}${CYAN}•${RESET} `);
}

function buildStatus(ctx: ExtensionContext, pi: ExtensionAPI, quotaEntry: QuotaCacheEntry | undefined): string {
	const modelId = compactModelId(ctx.model?.id);
	const thinking = pi.getThinkingLevel();
	let model = `${BOLD}${CYAN}${modelId}${RESET}`;
	if (thinking && thinking !== "off") model += `${DIM}${CYAN}[${thinking}]${RESET}`;

	const context = ctx.getContextUsage();
	let ctxText = `${DIM}ctx -${RESET}`;
	if (context?.percent !== null && context?.percent !== undefined) {
		const pct = Math.round(context.percent);
		const color = pct >= 80 ? RED : pct >= 50 ? YELLOW : GREEN;
		ctxText = `${color}ctx ${pct}%${RESET}`;
	}

	const last = latestAssistantUsage(ctx);
	const total = sessionTotals(ctx);
	const chan = (color: string, label: string, lastValue: number, totalValue: number) =>
		`${color}${label}${RESET}:${humanize(lastValue)}${DIM}/${humanize(totalValue)}${RESET}`;

	const tokens = [
		chan(BLUE, "in", last.input || 0, total.in),
		chan(MAGENTA, "cw", last.cacheWrite || 0, total.cw),
		chan(ORANGE, "cr", last.cacheRead || 0, total.cr),
		chan(GREEN, "out", last.output || 0, total.out),
	].join(" ");

	const cost = `${BOLD}${YELLOW}${formatCost(total.cost)}${RESET}`;
	const quota = formatQuota(quotaEntry, ctx.model?.provider, ctx.model?.id);
	return [model, ctxText, tokens, cost, quota].filter(Boolean).join(SEP);
}

export default function (pi: ExtensionAPI) {
	let currentCtx: ExtensionContext | undefined;
	let quotaEntry: QuotaCacheEntry | undefined;
	let refreshInFlight = false;
	let interval: ReturnType<typeof setInterval> | undefined;
	let requestRender: (() => void) | undefined;
	let lastActivityAt = Date.now();
	let agentRunning = false;

	const installFooter = (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;
		currentCtx = ctx;
		ctx.ui.setStatus(STATUSLINE_KEY, undefined);
		ctx.ui.setFooter((tui) => {
			requestRender = () => tui.requestRender();
			return {
				render(width: number): string[] {
					const line = currentCtx ? buildStatus(currentCtx, pi, quotaEntry) : "";
					return [truncateToWidth(line, width, `${DIM}...${RESET}`)];
				},
				invalidate() {},
				dispose() {
					// If another extension temporarily replaces the footer, our interval/event
					// handlers will call setFooter() again.
					requestRender = undefined;
				},
			};
		});
		requestRender?.();
	};

	const isActive = () => agentRunning || Date.now() - lastActivityAt < ACTIVITY_WINDOW_MS;
	const markActivity = () => {
		lastActivityAt = Date.now();
	};

	// One refresher machine-wide: whoever wins the lock fetches and writes the
	// shared cache; every other session just reads it on their next tick.
	const refreshQuota = async (ctx: ExtensionContext, force = false) => {
		const provider = ctx.model?.provider;
		const key = quotaKey(provider);
		if (!key || refreshInFlight) return;
		if (!tryAcquireQuotaLock(key)) return;
		refreshInFlight = true;
		try {
			const entry = readQuotaEntry(key);
			if (!force && Date.now() < (entry?.nextAttemptAt ?? 0)) return;
			const result = await fetchQuota(provider);
			const now = Date.now();
			if (result.status === "ok" || result.status === "partial") {
				writeQuotaEntry(key, { fetchedAt: now, nextAttemptAt: now + QUOTA_REFRESH_MS, result });
			} else {
				// Keep the last good result; just push the shared next-attempt time out.
				const retryAfterMs = result.status === "unknown" ? (result.retryAfterMs ?? 0) : 0;
				writeQuotaEntry(key, { ...entry, nextAttemptAt: now + Math.max(QUOTA_FAILURE_BACKOFF_MS, retryAfterMs) });
			}
		} finally {
			refreshInFlight = false;
			releaseQuotaLock(key);
			const currentKey = quotaKey(currentCtx?.model?.provider);
			quotaEntry = currentKey ? readQuotaEntry(currentKey) : undefined;
			if (currentCtx?.hasUI) installFooter(currentCtx);
		}
	};

	const tick = (ctx: ExtensionContext) => {
		currentCtx = ctx;
		const key = quotaKey(ctx.model?.provider);
		quotaEntry = key ? readQuotaEntry(key) : undefined;
		if (ctx.hasUI) installFooter(ctx);
		if (key && isActive() && Date.now() >= (quotaEntry?.nextAttemptAt ?? 0)) void refreshQuota(ctx);
	};

	pi.on("session_start", async (_event, ctx) => {
		if (interval) clearInterval(interval);
		currentCtx = ctx;
		quotaEntry = undefined;
		markActivity();
		if (!ctx.hasUI) return;

		// Reassert once immediately and once after startup handlers have drained, so
		// custom footer/statusline extensions loaded around us do not take precedence.
		tick(ctx);
		setTimeout(() => currentCtx?.hasUI && tick(currentCtx), 0);
		setTimeout(() => currentCtx?.hasUI && tick(currentCtx), 250);
		interval = setInterval(() => currentCtx?.hasUI && tick(currentCtx), 1000);
	});

	pi.on("input", async () => markActivity());
	pi.on("agent_start", async (_event, ctx) => {
		agentRunning = true;
		markActivity();
		tick(ctx);
	});
	pi.on("agent_end", async (_event, ctx) => {
		agentRunning = false;
		markActivity();
		tick(ctx);
	});
	pi.on("model_select", async (_event, ctx) => {
		markActivity();
		tick(ctx);
	});
	pi.on("thinking_level_select", async (_event, ctx) => {
		markActivity();
		tick(ctx);
	});
	pi.on("turn_end", async (_event, ctx) => {
		markActivity();
		tick(ctx);
	});
	pi.on("session_compact", async (_event, ctx) => tick(ctx));

	pi.on("session_shutdown", async (_event, ctx) => {
		if (interval) clearInterval(interval);
		interval = undefined;
		agentRunning = false;
		requestRender = undefined;
		currentCtx = undefined;
		quotaEntry = undefined;
		if (ctx.hasUI) ctx.ui.setFooter(undefined);
	});

	pi.registerCommand("statusline", {
		description: "Refresh/reassert the Claude-style custom footer statusline",
		handler: async (_args, ctx) => {
			currentCtx = ctx;
			markActivity();
			tick(ctx);
			await refreshQuota(ctx, true);
		},
	});
}
