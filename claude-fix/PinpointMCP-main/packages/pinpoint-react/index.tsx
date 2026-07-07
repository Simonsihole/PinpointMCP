// "use client" is injected by tsup's `banner` config at build time (see
// tsup.config.ts) so it survives bundling and lands at the very top of the
// compiled output, which is what Next.js's App Router actually checks for.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { buildPayload, type PinpointPayload } from "./payload";

type Mode = "idle" | "hovering" | "locked";

const IGNORE_SELECTOR = "[data-pinpoint-ignore]";

function Bracket({
  top,
  bottom,
  left,
  right,
  color,
}: {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  color: string;
}) {
  const size = 12;
  const border = `2.5px solid ${color}`;
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        top: top ? -2.5 : undefined,
        bottom: bottom ? -2.5 : undefined,
        left: left ? -2.5 : undefined,
        right: right ? -2.5 : undefined,
        borderTop: top ? border : "none",
        borderBottom: bottom ? border : "none",
        borderLeft: left ? border : "none",
        borderRight: right ? border : "none",
        borderRadius: (top && left) ? '4px 0 0 0' : (top && right) ? '0 4px 0 0' : (bottom && left) ? '0 0 0 4px' : '0 0 4px 0',
      }}
    />
  );
}

export default function PinpointSelector() {
  const [mode, setMode] = useState<Mode>("idle");
  const [hoverEl, setHoverEl] = useState<Element | null>(null);
  const [lockedEl, setLockedEl] = useState<Element | null>(null);
  const [instruction, setInstruction] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  // Value itself is never read — incrementing it just forces a re-render so
  // `rect` (computed fresh every render below) picks up the element's latest
  // position after scroll/resize/DOM mutation.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rectVersion, setRectVersion] = useState(0);
  
  // Batch state
  const [batch, setBatch] = useState<PinpointPayload[]>([]);
  
  // Toggle button dragging
  const [togglePos, setTogglePos] = useState({ x: 0, y: 0 });
  const [isDraggingToggle, setIsDraggingToggle] = useState(false);
  const dragToggleRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const initializedTogglePos = useRef(false);

  // Floating panel dragging
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const initializedPos = useRef(false);

  const activeRef = useRef(mode);
  useLayoutEffect(() => {
    activeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (!initializedPos.current && typeof window !== "undefined") {
      setPos({ x: window.innerWidth - 380, y: window.innerHeight - 300 });
      initializedPos.current = true;
    }
    if (!initializedTogglePos.current && typeof window !== "undefined") {
      setTogglePos({ x: window.innerWidth - 200, y: window.innerHeight - 60 });
      initializedTogglePos.current = true;
    }
  }, []);

  // Prevent UI from going off-screen during window resizes
  useEffect(() => {
    function handleResize() {
      if (typeof window !== "undefined") {
        setPos(p => ({
          x: Math.min(Math.max(0, p.x), window.innerWidth - 350),
          y: Math.min(Math.max(0, p.y), window.innerHeight - 300)
        }));
        setTogglePos(p => ({
          x: Math.min(Math.max(0, p.x), window.innerWidth - 180),
          y: Math.min(Math.max(0, p.y), window.innerHeight - 60)
        }));
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Drag handlers for command center
  useEffect(() => {
    if (!isDragging) return;
    function onMove(e: MouseEvent) {
      setPos({
        x: Math.min(Math.max(0, dragRef.current.initialX + (e.clientX - dragRef.current.startX)), window.innerWidth - 350),
        y: Math.min(Math.max(0, dragRef.current.initialY + (e.clientY - dragRef.current.startY)), window.innerHeight - 300)
      });
    }
    function onUp() { setIsDragging(false); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDragging]);

  // Drag handlers for toggle button
  useEffect(() => {
    if (!isDraggingToggle) return;
    function onMove(e: MouseEvent) {
      setTogglePos({
        x: Math.min(Math.max(0, dragToggleRef.current.initialX + (e.clientX - dragToggleRef.current.startX)), window.innerWidth - 180),
        y: Math.min(Math.max(0, dragToggleRef.current.initialY + (e.clientY - dragToggleRef.current.startY)), window.innerHeight - 60)
      });
    }
    function onUp() { setIsDraggingToggle(false); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDraggingToggle]);

  // --- toggle selection mode: Alt+P ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setMode((m) => {
          if (m === "idle") return "hovering";
          setLockedEl(null);
          setHoverEl(null);
          return "idle";
        });
      }
      if (e.key === "Escape" && activeRef.current !== "idle") {
        setMode("idle");
        setLockedEl(null);
        setHoverEl(null);
      }
      // parent/child navigation while locked
      if (activeRef.current === "locked") {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setLockedEl((cur) => cur?.parentElement ?? cur);
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setLockedEl((cur) => cur?.firstElementChild ?? cur);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- hover tracking ---
  useEffect(() => {
    if (mode !== "hovering") return;

    function getTarget(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest(IGNORE_SELECTOR)) return null;
      const interactive = el.closest('button, a, input, select, textarea, [role="button"], [role="link"], [tabindex="0"]');
      return interactive || el;
    }

    function onMove(e: MouseEvent) {
      const el = getTarget(e);
      if (!el) return;
      setHoverEl(el);
    }
    function onClick(e: MouseEvent) {
      const el = getTarget(e);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      setLockedEl(el);
      setMode("locked");
    }
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [mode]);

  useEffect(() => {
    if (mode === "idle") return;
    const bump = () => setRectVersion((v) => v + 1);
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    return () => {
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "idle") {
      const bump = () => setRectVersion((v) => v + 1);
      const id = window.setInterval(bump, 200);
      return () => window.clearInterval(id);
    }
  }, [mode]);

  const cancel = useCallback(() => {
    setMode("idle");
    setLockedEl(null);
    setHoverEl(null);
    setInstruction("");
  }, []);

  const addToBatch = useCallback(async () => {
    if (!lockedEl || !instruction.trim()) return;

    let screenshotCrop: string | null = null;
    try {
      const canvas = await html2canvas(lockedEl as HTMLElement, { backgroundColor: null, logging: false, scale: 1 });
      screenshotCrop = canvas.toDataURL("image/png").split(",")[1] ?? null;
    } catch {
      screenshotCrop = null;
    }

    const payload = buildPayload({ el: lockedEl, instruction: instruction.trim(), screenshotCrop, mode: "local" });
    setBatch(b => [...b, payload]);
    
    // Auto-return to hovering mode to easily select the next element
    setInstruction("");
    setLockedEl(null);
    setHoverEl(null);
    setMode("hovering");
  }, [lockedEl, instruction]);

  const sendBatch = useCallback(async () => {
    if (batch.length === 0) return;

    try {
      const res = await fetch("http://localhost:31337/payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setToast(`Sent ${batch.length} instructions to MCP ✓`);
      setBatch([]);
    } catch {
      setToast("Failed to connect to MCP (Is it running?)");
    }
    setTimeout(() => setToast(null), 2500);
  }, [batch]);

  const displayEl = mode === "locked" ? lockedEl : hoverEl;
  const rect = displayEl?.getBoundingClientRect();

  const isPanelVisible = mode === "locked" || batch.length > 0;

  return (
    <div data-pinpoint-ignore>
      {mode === "hovering" && (
        <style dangerouslySetInnerHTML={{
          __html: `*:not([data-pinpoint-ignore], [data-pinpoint-ignore] *) { cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>') 12 12, crosshair !important; }`
        }} />
      )}

      {/* Toggle button */}
      <button
        data-pinpoint-ignore
        onMouseDown={(e) => {
          dragToggleRef.current = { startX: e.clientX, startY: e.clientY, initialX: togglePos.x, initialY: togglePos.y };
          setIsDraggingToggle(true);
        }}
        onClick={(e) => {
          // Don't trigger click if we just dragged
          if (Math.abs(e.clientX - dragToggleRef.current.startX) > 3 || Math.abs(e.clientY - dragToggleRef.current.startY) > 3) return;
          if (mode === "idle") setMode("hovering");
          else cancel();
        }}
        style={{
          position: "fixed", top: togglePos.y, left: togglePos.x, zIndex: 999999,
          padding: "12px 20px", borderRadius: 999,
          border: mode === "idle" ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(248,113,113,0.3)",
          background: "rgba(9,9,11,0.85)",
          backdropFilter: "blur(12px)", 
          color: mode === "idle" ? "white" : "#f87171", 
          fontSize: 14, fontWeight: 500, cursor: "grab",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)", transition: "all 0.2s ease"
        }}
        title="Drag to move, click to toggle (Alt+P)"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, opacity: 0.5 }}>
            <div style={{ width: 4, height: 4, background: "white", borderRadius: 2 }} />
            <div style={{ width: 4, height: 4, background: "white", borderRadius: 2 }} />
            <div style={{ width: 4, height: 4, background: "white", borderRadius: 2 }} />
          </div>
          {mode === "idle" ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                <path d="M12 2v4M12 18v4M4 12H2m20 0h-2"></path>
                <circle cx="12" cy="12" r="4"></circle>
              </svg>
              Select target
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              ✕ Cancel selection
            </span>
          )}
        </div>
      </button>

      {/* Target highlight */}
      {rect && mode !== "idle" && (
        <div
          data-pinpoint-ignore
          style={{
            position: "fixed", top: rect.top - 4, left: rect.left - 4,
            width: rect.width + 8, height: rect.height + 8,
            pointerEvents: "none", zIndex: 999998, transition: "all 80ms"
          }}
        >
          {mode === "hovering" && displayEl && (
            <div style={{
              position: "absolute", top: -28, left: 0, background: "rgba(9,9,11,0.95)",
              border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontSize: 11,
              padding: "4px 10px", borderRadius: 6, fontFamily: "monospace", whiteSpace: "nowrap"
            }}>
              <span style={{color: "#3b82f6"}}>&lt;</span>{displayEl.tagName.toLowerCase()}<span style={{color: "#3b82f6"}}>&gt;</span>
            </div>
          )}
          <Bracket top left color={mode === "locked" ? "#f87171" : "#60a5fa"} />
          <Bracket top right color={mode === "locked" ? "#f87171" : "#60a5fa"} />
          <Bracket bottom left color={mode === "locked" ? "#f87171" : "#60a5fa"} />
          <Bracket bottom right color={mode === "locked" ? "#f87171" : "#60a5fa"} />
          <div style={{
            width: "100%", height: "100%", borderRadius: 4,
            background: mode === "locked" ? "rgba(220,38,38,0.08)" : "rgba(59,130,246,0.1)",
            boxShadow: mode === "locked" ? "inset 0 0 0 1px rgba(220,38,38,0.2)" : "inset 0 0 0 1px rgba(59,130,246,0.2)"
          }}/>
        </div>
      )}

      {/* Draggable Command Center */}
      {isPanelVisible && (
        <div
          data-pinpoint-ignore
          style={{
            position: "fixed", top: pos.y, left: pos.x, width: 340, zIndex: 999999,
            background: "rgba(9,9,11,0.85)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
            boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
            display: "flex", flexDirection: "column", fontFamily: "inherit"
          }}
        >
          {/* Drag Handle */}
          <div
            onMouseDown={(e) => {
              dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: pos.x, initialY: pos.y };
              setIsDragging(true);
            }}
            style={{
              padding: "10px", cursor: "grab", display: "flex", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.05)"
            }}
          >
            <div style={{ width: 32, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 4 }} />
          </div>

          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* Active Selection Input */}
            {mode === "locked" && lockedEl && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#a1a1aa", display: "flex", justifyContent: "space-between" }}>
                  <span>Target: <strong>{lockedEl.tagName.toLowerCase()}</strong></span>
                  <span><kbd style={{background:"rgba(255,255,255,0.1)", padding:"2px 4px", borderRadius:4}}>↑↓</kbd> walk</span>
                </div>
                <textarea
                  autoFocus
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addToBatch(); }
                  }}
                  placeholder="What should I do with this element?"
                  rows={2}
                  style={{
                    width: "100%", resize: "none", fontSize: 14, background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 8, padding: 10,
                    outline: "none"
                  }}
                />
                <button
                  onClick={addToBatch}
                  disabled={!instruction.trim()}
                  style={{
                    background: instruction.trim() ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                    color: "#fff", border: "1px solid rgba(255,255,255,0.1)", padding: "8px", borderRadius: 8,
                    fontWeight: 500, cursor: instruction.trim() ? "pointer" : "not-allowed", 
                    opacity: instruction.trim() ? 1 : 0.5, transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => { if (instruction.trim()) e.currentTarget.style.background = "rgba(255,255,255,0.25)"; }}
                  onMouseLeave={(e) => { if (instruction.trim()) e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
                >
                  Add
                </button>
              </div>
            )}

            {/* Batch Summary */}
            {batch.length > 0 && (
              <div style={{ background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 500, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{batch.length} Pending Instruction{batch.length !== 1 ? 's' : ''}</span>
                  <button 
                    onClick={() => {
                      setBatch([]);
                      if (mode === "idle") setMode("hovering");
                    }}
                    style={{ background: "transparent", border: "none", color: "#f87171", fontSize: 11, cursor: "pointer", padding: "2px 4px", borderRadius: 4 }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.1)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    Clear all
                  </button>
                </div>
                <div style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
                  {batch.map((b, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#a1a1aa", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "6px 8px", borderRadius: 6 }}>
                      <div style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                        <span style={{ color: "#6366f1", flexShrink: 0 }}>•</span>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.instruction}</span>
                      </div>
                      <button 
                        onClick={() => setBatch(curr => curr.filter((_, idx) => idx !== i))}
                        style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#a1a1aa"; e.currentTarget.style.background = "transparent"; }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={sendBatch}
                  style={{
                    width: "100%", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff",
                    border: "none", padding: "10px", borderRadius: 8, fontWeight: 600, marginTop: 12, cursor: "pointer",
                    transition: "filter 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
                >
                  {batch.length === 1 ? "Send Instruction" : `Send Batch (${batch.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div
          data-pinpoint-ignore
          style={{
            position: "fixed", bottom: 80, right: 24, zIndex: 999999, background: "rgba(9,9,11,0.9)",
            border: "1px solid rgba(255,255,255,0.1)", color: "white", padding: "12px 20px",
            borderRadius: 999, fontSize: 14, fontWeight: 500
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
