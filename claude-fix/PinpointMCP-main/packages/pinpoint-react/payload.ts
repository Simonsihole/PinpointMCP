// Pinpoint — context payload types + builders
// Matches the schema drafted in PRD §6.

export interface PinpointSource {
  file: string | null;
  line: number | null;
  confidence: "high" | "low" | "none";
}

export interface PinpointTarget {
  selector: string;
  tag: string;
  classes: string[];
  bounding_box: { x: number; y: number; width: number; height: number };
  computed_styles: Record<string, string>;
  dom_path: string[];
  source: PinpointSource;
}

export interface PinpointPayload {
  mode: "local" | "live";
  timestamp: string;
  page_url: string;
  instruction: string;
  target: PinpointTarget;
  screenshot_crop: string | null; // base64 PNG, no "data:" prefix
  surrounding_context: {
    parent_html_snippet: string;
    siblings_count: number;
  };
}

// Subset of computed styles worth capturing per element.
// Kept small on purpose — the screenshot crop is the ground truth for
// "what does it actually look like", these are just useful hints.
const STYLE_KEYS = [
  "background-color",
  "color",
  "font-size",
  "font-weight",
  "padding",
  "margin",
  "border",
  "border-radius",
  "display",
  "position",
  "width",
  "height",
] as const;

export function getComputedStyleSubset(el: Element): Record<string, string> {
  const cs = window.getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const key of STYLE_KEYS) {
    out[key] = cs.getPropertyValue(key);
  }
  return out;
}

/**
 * Best-effort CSS selector path for the element, e.g.
 * "div.card > button.btn-primary:nth-of-type(2)"
 * This is NOT guaranteed unique in pathological DOMs — it's a human/agent
 * readable hint, not a guaranteed-unique query selector.
 */
export function buildSelector(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;

  while (node && node.nodeType === 1 && depth < 6) {
    let part = node.tagName.toLowerCase();

    const cls = Array.from(node.classList).slice(0, 2).join(".");
    if (cls) part += `.${cls}`;

    const parent = node.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        (c) => c.tagName === node!.tagName
      );
      if (sameTagSiblings.length > 1) {
        const idx = sameTagSiblings.indexOf(node) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(part);
    node = node.parentElement;
    depth++;
  }

  return parts.join(" > ");
}

/** Ancestor chain from <html> down to the element, one string per level. */
export function buildDomPath(el: Element): string[] {
  const path: string[] = [];
  let node: Element | null = el;
  while (node) {
    let label = node.tagName.toLowerCase();
    if (node.id) label += `#${node.id}`;
    else if (node.classList.length) label += `.${Array.from(node.classList)[0]}`;
    path.unshift(label);
    node = node.parentElement;
  }
  return path;
}

/**
 * Source-file resolution — MVP stub.
 *
 * Real implementation (per PRD §4 Mode A) needs one of:
 *  - a Babel/SWC plugin that stamps `data-pinpoint-source="file:line"` on
 *    JSX elements at build time (most reliable, works in prod-like dev builds)
 *  - React DevTools' fiber tree walk to read `_debugSource` (dev-mode only,
 *    breaks on HOCs/portals/fragments — hence "confidence" field)
 *
 * For this vertical slice we just read a manually-authored
 * `data-pinpoint-source` attribute if present, so the payload shape and the
 * "confidence" signal are real even before the Babel plugin spike is done.
 */
export function resolveSource(el: Element): PinpointSource {
  const attr = el.getAttribute("data-pinpoint-source");
  if (!attr) return { file: null, line: null, confidence: "none" };

  const [file, lineStr] = attr.split(":");
  const line = Number(lineStr);
  return {
    file: file ?? null,
    line: Number.isFinite(line) ? line : null,
    confidence: "high",
  };
}

export function buildPayload(opts: {
  el: Element;
  instruction: string;
  screenshotCrop: string | null;
  mode?: "local" | "live";
}): PinpointPayload {
  const { el, instruction, screenshotCrop, mode = "local" } = opts;
  const rect = el.getBoundingClientRect();
  const parent = el.parentElement;

  return {
    mode,
    timestamp: new Date().toISOString(),
    page_url: window.location.href,
    instruction,
    target: {
      selector: buildSelector(el),
      tag: el.tagName.toLowerCase(),
      classes: Array.from(el.classList),
      bounding_box: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      computed_styles: getComputedStyleSubset(el),
      dom_path: buildDomPath(el),
      source: resolveSource(el),
    },
    screenshot_crop: screenshotCrop,
    surrounding_context: {
      parent_html_snippet: parent
        ? parent.outerHTML.slice(0, 400)
        : "",
      siblings_count: parent ? parent.children.length - 1 : 0,
    },
  };
}
