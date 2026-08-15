--[[
Add an accessible click-to-expand lightbox to images in HTML output.

Plain images open in a native dialog when clicked or keyboard-activated.
Images that are already links or buttons keep their original behavior. Add
.no-image-expand to an image or ancestor to opt out explicitly.
]]

local function raw_contains_image(raw)
  return raw.format:match("html")
    and raw.text:lower():match("<%s*img[%s/>]")
end

function Pandoc(doc)
  if not FORMAT:match("html") then
    return doc
  end

  local found_image = false

  doc:walk {
    Image = function()
      found_image = true
    end,

    RawInline = function(raw)
      if raw_contains_image(raw) then
        found_image = true
      end
    end,

    RawBlock = function(raw)
      if raw_contains_image(raw) then
        found_image = true
      end
    end
  }

  if not found_image then
    return doc
  end

  table.insert(doc.blocks, pandoc.RawBlock("html", [[
<script>
(() => {
  /* Preserve the established behavior of linked images and custom controls. */
  const images = [...document.querySelectorAll("img")].filter((image) =>
    !image.closest(
      "a, button, dialog, [role='button'], .no-image-expand"
    ) &&
    !image.hasAttribute("usemap") &&
    Boolean(image.currentSrc || image.getAttribute("src"))
  );

  if (images.length === 0) {
    return;
  }

  const dialog = document.createElement("dialog");
  dialog.className = "image-dialog";
  dialog.setAttribute("aria-label", "Expanded image");

  if (typeof dialog.showModal !== "function") {
    return;
  }

  const dialogClose = document.createElement("button");
  dialogClose.type = "button";
  dialogClose.className = "image-dialog-close";
  dialogClose.textContent = "Close";
  dialogClose.setAttribute("aria-label", "Close expanded image");

  const dialogViewport = document.createElement("div");
  dialogViewport.className = "image-dialog-viewport";

  const expandedImage = document.createElement("img");
  expandedImage.className = "image-dialog-image";
  expandedImage.alt = "";
  expandedImage.draggable = false;

  dialogViewport.append(expandedImage);
  dialog.append(dialogViewport, dialogClose);
  document.body.append(dialog);

  let activeImage = null;

  function imageLabel(image) {
    const caption = image.closest("figure")?.querySelector("figcaption");

    return caption?.textContent.trim() || image.alt.trim() || "Image";
  }

  function resetDialog(restoreFocus) {
    const source = activeImage;

    activeImage = null;
    expandedImage.removeAttribute("src");
    expandedImage.removeAttribute("title");
    expandedImage.alt = "";
    dialog.setAttribute("aria-label", "Expanded image");
    document.documentElement.classList.remove("image-dialog-open");

    if (source) {
      source.setAttribute("aria-expanded", "false");

      if (restoreFocus && source.isConnected) {
        source.focus({ preventScroll: true });
      }
    }
  }

  function openImage(image) {
    if (dialog.open || activeImage) {
      return;
    }

    const label = imageLabel(image);
    const source = image.currentSrc || image.src;

    activeImage = image;
    expandedImage.src = source;
    expandedImage.alt = image.alt;

    if (image.title) {
      expandedImage.title = image.title;
    }

    dialog.setAttribute(
      "aria-label",
      label === "Image" ? "Expanded image" : `Expanded image: ${label}`
    );
    image.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("image-dialog-open");

    try {
      dialog.showModal();
      dialogClose.focus({ preventScroll: true });
    } catch (error) {
      resetDialog(true);
      console.error("Failed to open expanded image:", error);
    }
  }

  for (const image of images) {
    const label = imageLabel(image);

    image.classList.add("image-expandable");
    image.setAttribute("role", "button");
    image.setAttribute("aria-haspopup", "dialog");
    image.setAttribute("aria-expanded", "false");
    image.setAttribute(
      "aria-label",
      label === "Image" ? "Expand image" : `Expand image: ${label}`
    );

    if (!image.hasAttribute("tabindex")) {
      image.tabIndex = 0;
    }

    image.addEventListener("click", () => openImage(image));
    image.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openImage(image);
    });
  }

  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => resetDialog(true));

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
})();
</script>
]]))

  return doc
end
