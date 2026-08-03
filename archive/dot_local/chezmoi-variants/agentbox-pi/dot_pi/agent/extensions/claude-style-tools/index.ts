import { ToolExecutionComponent, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import claudeStyleTools from "pi-claude-style-tools/extensions/index.ts";

// Owned by @jerryan/pi-hashline-edit; pi fails at startup if two extensions
// register the same tool name, so drop claude-style-tools' copies.
const HASHLINE_OWNED = new Set(["read", "edit", "grep"]);

// Hashline's grep renderResult prints up to 15 output lines even when
// collapsed. Match pi's built-in read renderer instead: render nothing
// unless expanded or errored, so grep collapses to its call line.
const QUIET_GREP_FLAG = Symbol.for("claude-style-tools-shim:quiet-grep");

function patchQuietGrepResult() {
	const proto = ToolExecutionComponent.prototype as any;
	if (proto[QUIET_GREP_FLAG]) return;
	const original = proto.getResultRenderer;
	proto.getResultRenderer = function (this: any) {
		const renderer = original.call(this);
		if (this?.toolName !== "grep" || typeof renderer !== "function") return renderer;
		return (result: unknown, options: { expanded?: boolean }, theme: unknown, context: any) => {
			if (options?.expanded || context?.isError) return renderer(result, options, theme, context);
			const component = (context?.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			component.setText("");
			return component;
		};
	};
	proto[QUIET_GREP_FLAG] = true;
}

export default function (pi: ExtensionAPI) {
	patchQuietGrepResult();
	const filtered = new Proxy(pi, {
		get(target, prop) {
			if (prop === "registerTool") {
				return (tool: { name?: string }, ...rest: unknown[]) => {
					if (typeof tool?.name === "string" && HASHLINE_OWNED.has(tool.name)) return;
					return (target.registerTool as (...args: unknown[]) => unknown)(tool, ...rest);
				};
			}
			const value = Reflect.get(target, prop, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	return claudeStyleTools(filtered);
}
