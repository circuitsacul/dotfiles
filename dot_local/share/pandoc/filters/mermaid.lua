--[[
Render ```mermaid code blocks in the browser, themed with Catppuccin.

Each diagram keeps its source alongside the rendered SVG (with a toggle
button), and falls back to the source when Mermaid is unavailable or the
diagram fails to parse.

The Catppuccin palette is NOT defined here: the script reads the --ctp-*
custom properties that compact.css sets (Latte in light mode, Mocha in
dark mode) and derives Mermaid theme variables from them, so diagrams
always match the document's active flavor.
]]

function Pandoc(doc)
  if not FORMAT:match("html") then
    return doc
  end

  local found_mermaid = false

  doc = doc:walk {
    CodeBlock = function(block)
      local is_mermaid = false

      for _, class in ipairs(block.classes) do
        if class == "mermaid" then
          is_mermaid = true
          break
        end
      end

      if not is_mermaid then
        return nil
      end

      found_mermaid = true

      return pandoc.Div({
        pandoc.Div(
          {},
          pandoc.Attr("", {"mermaid-render"})
        ),

        pandoc.Div({
          pandoc.CodeBlock(
            block.text,
            pandoc.Attr("", {"mermaid-source-code"})
          )
        }, pandoc.Attr("", {"mermaid-source"}))
      }, pandoc.Attr("", {"pandoc-mermaid"}))
    end
  }

  if not found_mermaid then
    return doc
  end

  table.insert(doc.blocks, pandoc.RawBlock("html", [[
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js"></script>

<script>
(() => {
  const containers = [...document.querySelectorAll(".pandoc-mermaid")];

  if (containers.length === 0) {
    return;
  }

  const dialog = document.createElement("dialog");
  dialog.className = "mermaid-dialog";
  dialog.setAttribute("aria-label", "Expanded Mermaid diagram");

  const dialogHeader = document.createElement("div");
  dialogHeader.className = "mermaid-dialog-header";

  const dialogTitle = document.createElement("span");
  dialogTitle.className = "mermaid-dialog-title";
  dialogTitle.textContent = "Expanded diagram";

  const dialogClose = document.createElement("button");
  dialogClose.type = "button";
  dialogClose.className = "mermaid-control mermaid-dialog-close";
  dialogClose.textContent = "Close";
  dialogClose.setAttribute("aria-label", "Close expanded diagram");

  const dialogViewport = document.createElement("div");
  dialogViewport.className = "mermaid-dialog-viewport";

  dialogHeader.append(dialogTitle, dialogClose);
  dialog.append(dialogHeader, dialogViewport);
  document.body.append(dialog);

  const supportsDialog = typeof dialog.showModal === "function";
  let expandedState = null;

  const states = containers.map((container, index) => {
    const source = container.querySelector(".mermaid-source");
    const code = source.querySelector("code");
    const render = container.querySelector(".mermaid-render");

    /* Progressive enhancement: source is visible until Mermaid succeeds. */
    render.hidden = true;

    const toolbar = document.createElement("div");
    toolbar.className = "mermaid-toolbar";

    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "mermaid-control mermaid-expand";
    expand.textContent = "Expand";
    expand.setAttribute("aria-haspopup", "dialog");
    expand.setAttribute("aria-label", `Expand diagram ${index + 1}`);
    expand.hidden = true;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mermaid-control mermaid-toggle";
    toggle.textContent = "Show code";
    toggle.hidden = true;

    toolbar.append(expand, toggle);
    container.prepend(toolbar);

    const state = {
      container,
      source,
      code,
      render,
      expand,
      toggle,
      index,
      view: "diagram",
      placeholder: null,
    };

    expand.addEventListener("click", () => openExpandedDiagram(state));

    toggle.addEventListener("click", () => {
      if (state.view === "diagram") {
        state.view = "code";

        source.hidden = false;
        render.hidden = true;
        expand.hidden = true;

        toggle.textContent = "Show diagram";
      } else {
        state.view = "diagram";

        source.hidden = true;
        render.hidden = false;
        expand.hidden = !supportsDialog;

        toggle.textContent = "Show code";
      }
    });

    return state;
  });

  /*
   * Move the live render rather than cloning it. Mermaid SVGs contain IDs
   * and can have event handlers installed by bindFunctions; moving preserves
   * both without leaving duplicate IDs in the document.
   */
  function openExpandedDiagram(state) {
    if (
      !supportsDialog ||
      expandedState ||
      state.view !== "diagram" ||
      state.render.hidden ||
      !state.render.querySelector("svg")
    ) {
      return;
    }

    const placeholder = document.createElement("div");
    const renderBox = state.render.getBoundingClientRect();

    placeholder.className = "mermaid-render-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.style.height = `${renderBox.height}px`;

    state.render.before(placeholder);
    state.placeholder = placeholder;
    expandedState = state;

    const title = containers.length === 1
      ? "Expanded diagram"
      : `Expanded diagram ${state.index + 1} of ${containers.length}`;

    dialogTitle.textContent = title;
    dialog.setAttribute("aria-label", title);
    dialogViewport.append(state.render);
    document.documentElement.classList.add("mermaid-dialog-open");

    try {
      dialog.showModal();
      dialogClose.focus({ preventScroll: true });
    } catch (error) {
      restoreExpandedDiagram();
      console.error("Failed to open expanded Mermaid diagram:", error);
    }
  }

  function restoreExpandedDiagram() {
    const state = expandedState;

    if (!state) {
      return;
    }

    if (state.placeholder?.isConnected) {
      state.placeholder.replaceWith(state.render);
    } else {
      state.source.before(state.render);
    }

    state.placeholder = null;
    expandedState = null;
    document.documentElement.classList.remove("mermaid-dialog-open");

    if (!state.expand.hidden) {
      state.expand.focus({ preventScroll: true });
    }
  }

  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", restoreExpandedDiagram);

  /* Treat only clicks outside the dialog's box as backdrop clicks. */
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) {
      return;
    }

    const box = dialog.getBoundingClientRect();
    const clickedBackdrop =
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom;

    if (clickedBackdrop) {
      dialog.close();
    }
  });

  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");

  /*
   * Build Mermaid "base" theme variables from the document's Catppuccin
   * palette (the --ctp-* custom properties in compact.css). Reading the
   * computed values means the browser's active color scheme picks the
   * flavor for us: Latte in light mode, Mocha in dark mode.
   *
   * Variable roles are from mermaid/src/themes/theme-base.js; explicit
   * values survive its derivation pass, and everything not set here is
   * derived from these seeds.
   */
  function catppuccinThemeVariables() {
    const rootStyles = getComputedStyle(document.documentElement);
    const c = {};

    for (const name of [
      "rosewater", "flamingo", "pink", "mauve", "red", "maroon", "peach",
      "yellow", "green", "teal", "sky", "sapphire", "blue", "lavender",
      "text", "subtext1", "subtext0", "overlay2", "overlay1", "overlay0",
      "surface2", "surface1", "surface0", "base", "mantle", "crust",
    ]) {
      const value = rootStyles.getPropertyValue("--ctp-" + name).trim();

      /* Palette missing or unusable: let the caller fall back. */
      if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
        return null;
      }

      c[name] = value;
    }

    /* Opaque blend: weight parts `x` over (1 - weight) parts `y`. */
    const mix = (x, y, weight) => {
      const channels = [1, 3, 5].map((offset) => {
        const a = parseInt(x.slice(offset, offset + 2), 16);
        const b = parseInt(y.slice(offset, offset + 2), 16);

        return Math.round(a * weight + b * (1 - weight))
          .toString(16)
          .padStart(2, "0");
      });

      return "#" + channels.join("");
    };

    /* Soft pastel wash of an accent over the page background. */
    const tint = (color) => mix(color, c.base, 0.3);

    /* Categorical palette for pies, timelines, mindmaps, branches, ... */
    const accents = [
      c.blue, c.peach, c.green, c.mauve, c.red, c.teal,
      c.yellow, c.pink, c.sapphire, c.flamingo, c.lavender, c.maroon,
    ];

    const series = (prefix, colors, first = 0) =>
      Object.fromEntries(
        colors.map((color, i) => [prefix + (first + i), color])
      );

    return {
      darkMode: colorScheme.matches,
      background: c.base,
      fontFamily: getComputedStyle(document.body).fontFamily,
      fontSize: "16px",

      /* Core seeds */
      primaryColor: c.surface0,
      primaryTextColor: c.text,
      primaryBorderColor: c.lavender,
      secondaryColor: c.surface1,
      secondaryTextColor: c.text,
      secondaryBorderColor: c.overlay0,
      tertiaryColor: c.mantle,
      tertiaryTextColor: c.text,
      tertiaryBorderColor: c.surface2,
      textColor: c.text,
      lineColor: c.overlay2,
      arrowheadColor: c.overlay2,
      errorBkgColor: tint(c.red),
      errorTextColor: c.text,

      /* Notes */
      noteBkgColor: tint(c.yellow),
      noteTextColor: c.text,
      noteBorderColor: c.yellow,

      /* Flowcharts */
      mainBkg: c.surface0,
      nodeTextColor: c.text,
      clusterBkg: c.mantle,
      clusterBorder: c.surface2,
      edgeLabelBackground: c.base,
      titleColor: c.text,

      /* Sequence diagrams */
      actorLineColor: c.overlay0,
      signalColor: c.overlay2,
      signalTextColor: c.text,
      activationBkgColor: c.surface1,
      activationBorderColor: c.overlay0,
      sequenceNumberColor: c.base,

      /* Pie charts */
      ...series("pie", accents, 1),
      pieOpacity: "1",
      pieStrokeColor: c.base,
      pieOuterStrokeColor: c.base,
      pieTitleTextColor: c.text,
      pieSectionTextColor: c.base,
      pieLegendTextColor: c.text,

      /* Timelines, mindmaps (color scale + labels drawn on it) */
      ...series("cScale", accents),
      scaleLabelColor: c.base,

      /* Git graphs */
      ...series("git", accents.slice(0, 8)),
      ...series("gitBranchLabel", Array(8).fill(c.base)),
      commitLabelColor: c.text,
      commitLabelBackground: c.surface1,
      tagLabelColor: c.text,
      tagLabelBackground: c.surface0,
      tagLabelBorder: c.blue,

      /* User journeys (section fills) */
      ...series("fillType", accents.slice(0, 8).map(tint)),

      /* Gantt charts */
      sectionBkgColor: c.mantle,
      sectionBkgColor2: c.mantle,
      altSectionBkgColor: c.base,
      excludeBkgColor: c.crust,
      gridColor: c.surface2,
      todayLineColor: c.red,
      vertLineColor: c.lavender,
      activeTaskBkgColor: tint(c.blue),
      activeTaskBorderColor: c.blue,
      doneTaskBkgColor: c.surface1,
      doneTaskBorderColor: c.overlay0,
      critBkgColor: mix(c.red, c.base, 0.45),
      critBorderColor: c.red,
      taskTextColor: c.text,
      taskTextOutsideColor: c.text,
      taskTextLightColor: c.text,
      taskTextDarkColor: c.text,
      taskTextClickableColor: c.blue,

      /* State diagrams */
      altBackground: c.mantle,

      /* Entity-relationship diagrams (attribute rows) */
      attributeBackgroundColorOdd: c.base,
      attributeBackgroundColorEven: c.mantle,
      rowOdd: c.base,
      rowEven: c.mantle,

      /* Quadrant charts */
      quadrantPointFill: c.blue,

      /* Requirement diagrams */
      relationLabelBackground: c.base,

      /* Architecture diagrams */
      archEdgeColor: c.overlay1,
      archEdgeArrowColor: c.overlay1,
      archGroupBorderColor: c.overlay0,

      /* XY charts (nested config is replaced wholesale: set every field) */
      xyChart: {
        backgroundColor: c.base,
        titleColor: c.text,
        dataLabelColor: c.text,
        legendTextColor: c.text,
        xAxisTitleColor: c.text,
        xAxisLabelColor: c.text,
        xAxisTickColor: c.overlay1,
        xAxisLineColor: c.overlay1,
        yAxisTitleColor: c.text,
        yAxisLabelColor: c.text,
        yAxisTickColor: c.overlay1,
        yAxisLineColor: c.overlay1,
        plotColorPalette: accents.slice(0, 10).join(","),
      },

      /* Event-modeling diagrams */
      emUiFill: c.surface0,
      emUiStroke: c.overlay0,
      emProcessorFill: tint(c.mauve),
      emProcessorStroke: c.mauve,
      emReadModelFill: tint(c.green),
      emReadModelStroke: c.green,
      emCommandFill: tint(c.blue),
      emCommandStroke: c.blue,
      emEventFill: tint(c.peach),
      emEventStroke: c.peach,
      emSwimlaneBackgroundOdd: c.mantle,
      emSwimlaneBackgroundStroke: c.surface0,

      /* Wardley maps */
      wardleyEvolutionColor: c.red,
    };
  }

  let generation = 0;
  let queue = Promise.resolve();

  async function renderAll() {
    ++generation;

    const themeVariables = catppuccinThemeVariables();

    /*
     * securityLevel "strict" (not "sandbox"): sandbox mode renders into
     * an iframe whose canvas the browser paints opaque white when the
     * embedding page's color scheme is dark (mermaid-js/mermaid#5034),
     * and it also breaks sizing and bindFunctions. strict still encodes
     * HTML in labels, which is plenty for self-authored documents.
     */
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",

      ...(themeVariables
        ? { theme: "base", themeVariables }
        : { theme: colorScheme.matches ? "dark" : "default" }),
    });

    for (const state of states) {
      try {
        const { svg, bindFunctions } = await mermaid.render(
          `pandoc-mermaid-${generation}-${state.index}`,
          state.code.textContent
        );

        state.render.innerHTML = svg;
        bindFunctions?.(state.render);

        state.toggle.hidden = false;

        if (state.view === "diagram") {
          state.source.hidden = true;
          state.render.hidden = false;
          state.expand.hidden = !supportsDialog;
          state.toggle.textContent = "Show code";
        } else {
          state.expand.hidden = true;
        }
      } catch (error) {
        console.error("Failed to render Mermaid diagram:", error);

        /* Graceful fallback to the original source. */
        state.view = "code";
        state.source.hidden = false;
        state.render.hidden = true;
        state.expand.hidden = true;
        state.toggle.hidden = true;

        if (expandedState === state) {
          dialog.close();
        }
      }
    }
  }

  /*
   * Serialize renders. In particular, don't reconfigure Mermaid for a
   * dark/light transition while an earlier render is still underway.
   */
  function queueRender() {
    queue = queue.then(renderAll, renderAll);
  }

  queueRender();

  colorScheme.addEventListener?.("change", queueRender);
})();
</script>
]]))

  return doc
end
