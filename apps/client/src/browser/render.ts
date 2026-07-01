import type { BrowserAppState } from "./state.js";
import { computeViewportTileBounds } from "./state.js";

function getRootElement() {
  const doc = globalThis.document;
  return doc ? doc.getElementById("app") : null;
}

export type BrowserRenderHandlers = {
  onPlaceTile: () => void | Promise<void>;
  onSelectCell: (cellX: number, cellY: number) => void;
  onTogglePalette: () => void;
  onNextOnboardingStep: () => void;
  onSkipOnboarding: () => void;
  onSelectShape: (shape: string) => void;
  onSelectColor: (color: string) => void;
  onToggleHighContrast: () => void;
  onToggleReducedMotion: () => void;
  onKeyboardMove: (deltaCellX: number, deltaCellY: number) => void;
  onKeyboardPlace: () => void | Promise<void>;
  onHoverCell: (cellX: number, cellY: number) => void;
  onClearPreview: () => void;
  onPanBy: (deltaCellX: number, deltaCellY: number) => void;
  onZoomBy: (deltaZoom: number) => void;
  onZoomReset: () => void;
  getViewport: () => BrowserAppState["viewport"];
};

export interface BrowserRenderOutcome {
  visibleTileCount: number;
  visibleBondCount: number;
  culledTileCount: number;
}

type SvgBoardLike = {
  tagName: string;
  addEventListener: (type: string, listener: (event: { clientX: number; clientY: number; deltaY: number; key: string; preventDefault: () => void }) => void) => void;
  getBoundingClientRect: () => {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  viewBox: {
    baseVal: {
      width: number;
      height: number;
    };
  };
};

const SHAPES = ["square", "diamond", "hex"] as const;
const COLORS = ["orange", "blue", "red", "teal", "violet", "lime"] as const;

export function renderBrowserAppState(state: BrowserAppState): BrowserRenderOutcome {
  const root = getRootElement();
  if (!root) {
    return {
      visibleTileCount: 0,
      visibleBondCount: 0,
      culledTileCount: 0
    };
  }

  const renderSurface = buildRenderSurface(state);

  root.innerHTML = `<style>
    :root {
      color-scheme: light;
      --bg: ${state.accessibility.highContrastEnabled ? "#0c0f13" : "#f2efe9"};
      --panel: ${state.accessibility.highContrastEnabled ? "#111722" : "#fffdf9"};
      --ink: ${state.accessibility.highContrastEnabled ? "#f8fcff" : "#1f242c"};
      --muted: ${state.accessibility.highContrastEnabled ? "#8ea3b4" : "#526272"};
      --accent: ${state.accessibility.highContrastEnabled ? "#ffeb3b" : "#ed7b22"};
    }
    #app {
      font-family: "Space Grotesk", "Segoe UI", sans-serif;
      background: radial-gradient(circle at top right, #e8f0ff 0%, var(--bg) 60%);
      color: var(--ink);
      min-height: 100vh;
      padding: 18px;
      box-sizing: border-box;
    }
    .tf-layout {
      display: grid;
      grid-template-columns: 320px minmax(460px, 1fr);
      gap: 16px;
      align-items: start;
    }
    .tf-panel {
      background: var(--panel);
      border: 1px solid #d8e2ec;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 10px 24px rgba(12, 20, 38, 0.08);
    }
    .tf-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .tf-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .tf-chip {
      border: 1px solid #ced7e1;
      border-radius: 999px;
      padding: 4px 10px;
      background: #ffffff;
      color: var(--ink);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .tf-chip.is-active { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(237,123,34,0.16); }
    .tf-chip:focus-visible {
      outline: 3px solid ${state.accessibility.highContrastEnabled ? "#ffeb3b" : "#1d4ed8"};
      outline-offset: 2px;
    }
    .tf-onboarding {
      border: 1px dashed #9bb1c8;
      border-radius: 10px;
      padding: 10px;
      margin-top: 8px;
      background: rgba(255,255,255,0.7);
    }
    .tf-canvas-wrap {
      background: linear-gradient(180deg, #0f172a 0%, #121b2e 100%);
      border-radius: 14px;
      border: 1px solid #26334b;
      overflow: hidden;
    }
    .tf-canvas-meta {
      display: flex;
      justify-content: space-between;
      padding: 10px 12px;
      font-size: 12px;
      color: #c7d7ef;
      border-bottom: 1px solid #26334b;
    }
    #tile-board {
      display: block;
      width: 100%;
      max-width: 980px;
      height: min(70vh, 660px);
      cursor: crosshair;
      background: repeating-linear-gradient(
        0deg,
        rgba(255,255,255,0.03) 0px,
        rgba(255,255,255,0.03) 1px,
        rgba(255,255,255,0.00) 1px,
        rgba(255,255,255,0.00) 32px
      );
    }
    @media (max-width: 1100px) {
      .tf-layout { grid-template-columns: 1fr; }
    }
  </style>
  <section class="tf-layout">
    <aside class="tf-panel">
    <h1>Tile Fighter Browser Loop</h1>
    <p><strong>Stage:</strong> ${state.status}</p>
    <p><strong>Status:</strong> ${escapeHtml(state.message)}</p>
    ${state.guidance ? `<p><strong>Guidance:</strong> ${escapeHtml(state.guidance)}</p>` : ""}
    <p><strong>Auth:</strong> ${state.tokenReady ? "token-ready" : "pending"}</p>
    <p><strong>Bootstrap:</strong> ${state.bootstrapReady ? "ok" : "pending"}</p>
    <p><strong>Room:</strong> ${state.roomJoined ? `${escapeHtml(state.roomId)} (${escapeHtml(state.roomSessionId ?? "unknown")})` : "pending"}</p>
    <p><strong>Selected Cell:</strong> ${state.selectedCellX},${state.selectedCellY}</p>
    <p><strong>Viewport:</strong> x ${state.viewport.panX.toFixed(1)} y ${state.viewport.panY.toFixed(1)} z ${state.viewport.zoom.toFixed(2)}</p>
    <p><strong>Render:</strong> ${renderSurface.visibleTileCount} visible / ${renderSurface.culledTileCount} culled tiles</p>
    ${state.preview ? `<p><strong>Preview:</strong> ${state.preview.cellX},${state.preview.cellY} ${state.preview.blocked ? "blocked" : "ready"}</p>` : ""}
    ${state.lastAppliedSequenceId ? `<p><strong>Last Delta:</strong> ${escapeHtml(state.lastAppliedSequenceId)}</p>` : ""}
    ${state.placeFeedback ? `<p><strong>Placement:</strong> ${escapeHtml(state.placeFeedback)}</p>` : ""}
    ${!state.onboarding.completed ? `<section class="tf-onboarding">
      <p><strong>Onboarding:</strong> Step ${state.onboarding.activeStep} of 3</p>
      <p>${state.onboarding.activeStep === 1
        ? "Open the palette and pick your tile style."
        : state.onboarding.activeStep === 2
          ? "Hover a nearby cell to preview placement."
          : "Place your first tile to finish onboarding."}</p>
      <div class="tf-row">
        <button id="onboarding-next" class="tf-chip" type="button">Next Step</button>
        <button id="onboarding-skip" class="tf-chip" type="button">Skip Tutorial</button>
      </div>
    </section>` : ""}
    <div class="tf-row">
      <button id="toggle-palette" class="tf-chip ${state.paletteOpen ? "is-active" : ""}" type="button">Palette</button>
      <button id="toggle-high-contrast" class="tf-chip ${state.accessibility.highContrastEnabled ? "is-active" : ""}" type="button">High Contrast</button>
      <button id="toggle-reduced-motion" class="tf-chip ${state.accessibility.reducedMotionEnabled ? "is-active" : ""}" type="button">Reduced Motion</button>
      <button id="place-tile" class="tf-chip" type="button" ${state.status === "ready" ? "" : "disabled"}>Place Here</button>
      <button id="pan-left" class="tf-chip" type="button">Pan Left</button>
      <button id="pan-right" class="tf-chip" type="button">Pan Right</button>
      <button id="pan-up" class="tf-chip" type="button">Pan Up</button>
      <button id="pan-down" class="tf-chip" type="button">Pan Down</button>
      <button id="zoom-in" class="tf-chip" type="button">Zoom +</button>
      <button id="zoom-out" class="tf-chip" type="button">Zoom -</button>
      <button id="zoom-reset" class="tf-chip" type="button">Zoom Reset</button>
    </div>
    ${state.paletteOpen ? `<section>
      <p class="tf-label">Shape</p>
      <div class="tf-row">
        ${SHAPES.map((shape) => `<button class="tf-chip ${state.palette.shape === shape ? "is-active" : ""}" type="button" data-shape="${shape}">${shape}</button>`).join("")}
      </div>
      <p class="tf-label">Color</p>
      <div class="tf-row">
        ${COLORS.map((color) => `<button class="tf-chip ${state.palette.color === color ? "is-active" : ""}" type="button" data-color="${color}">${color}</button>`).join("")}
      </div>
    </section>` : ""}
    </aside>
    <section class="tf-canvas-wrap">
      <div class="tf-canvas-meta">
        <span>Room ${escapeHtml(state.roomId)}</span>
        <span>Bonds ${renderSurface.visibleBondCount}</span>
      </div>
      <svg id="tile-board" tabindex="0" role="application" aria-label="Tile board" viewBox="0 0 ${state.viewport.canvasWidth} ${state.viewport.canvasHeight}" preserveAspectRatio="xMidYMid meet">
        ${renderSurface.bondsMarkup}
        ${renderSurface.tilesMarkup}
        ${renderSurface.previewMarkup}
      </svg>
    </section>
  </section>`;

  return {
    visibleTileCount: renderSurface.visibleTileCount,
    visibleBondCount: renderSurface.visibleBondCount,
    culledTileCount: renderSurface.culledTileCount
  };
}

export function bindBrowserRenderHandlers(handlers: BrowserRenderHandlers): void {
  const doc = globalThis.document;
  if (!doc) {
    return;
  }

  const board = doc.getElementById("tile-board");
  const paletteToggle = doc.getElementById("toggle-palette");
  const onboardingNext = doc.getElementById("onboarding-next");
  const onboardingSkip = doc.getElementById("onboarding-skip");
  const toggleHighContrast = doc.getElementById("toggle-high-contrast");
  const toggleReducedMotion = doc.getElementById("toggle-reduced-motion");
  const placeButton = doc.getElementById("place-tile");
  const panLeft = doc.getElementById("pan-left");
  const panRight = doc.getElementById("pan-right");
  const panUp = doc.getElementById("pan-up");
  const panDown = doc.getElementById("pan-down");
  const zoomIn = doc.getElementById("zoom-in");
  const zoomOut = doc.getElementById("zoom-out");
  const zoomReset = doc.getElementById("zoom-reset");

  paletteToggle?.addEventListener("click", () => {
    handlers.onTogglePalette();
  });

  onboardingNext?.addEventListener("click", () => {
    handlers.onNextOnboardingStep();
  });

  onboardingSkip?.addEventListener("click", () => {
    handlers.onSkipOnboarding();
  });

  toggleHighContrast?.addEventListener("click", () => {
    handlers.onToggleHighContrast();
  });

  toggleReducedMotion?.addEventListener("click", () => {
    handlers.onToggleReducedMotion();
  });

  panLeft?.addEventListener("click", () => handlers.onPanBy(-2, 0));
  panRight?.addEventListener("click", () => handlers.onPanBy(2, 0));
  panUp?.addEventListener("click", () => handlers.onPanBy(0, -2));
  panDown?.addEventListener("click", () => handlers.onPanBy(0, 2));
  zoomIn?.addEventListener("click", () => handlers.onZoomBy(0.1));
  zoomOut?.addEventListener("click", () => handlers.onZoomBy(-0.1));
  zoomReset?.addEventListener("click", () => handlers.onZoomReset());

  for (const shapeButton of doc.querySelectorAll("button[data-shape]")) {
    shapeButton.addEventListener("click", () => {
      const value = shapeButton.getAttribute("data-shape");
      if (value) {
        handlers.onSelectShape(value);
      }
    });
  }

  for (const colorButton of doc.querySelectorAll("button[data-color]")) {
    colorButton.addEventListener("click", () => {
      const value = colorButton.getAttribute("data-color");
      if (value) {
        handlers.onSelectColor(value);
      }
    });
  }

  if (board && (board as { tagName?: string }).tagName?.toLowerCase() === "svg") {
    const svgBoard = board as unknown as SvgBoardLike;
    board.addEventListener("mousemove", (event) => {
      const cell = getCellFromPointer(svgBoard, event.clientX, event.clientY, handlers.getViewport());
      handlers.onHoverCell(cell.cellX, cell.cellY);
      handlers.onSelectCell(cell.cellX, cell.cellY);
    });

    board.addEventListener("mouseleave", () => {
      handlers.onClearPreview();
    });

    board.addEventListener("click", (event) => {
      const cell = getCellFromPointer(svgBoard, event.clientX, event.clientY, handlers.getViewport());
      handlers.onSelectCell(cell.cellX, cell.cellY);
      void handlers.onPlaceTile();
    });

    board.addEventListener("wheel", (event) => {
      event.preventDefault();
      handlers.onZoomBy(event.deltaY < 0 ? 0.1 : -0.1);
    });

    board.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlers.onKeyboardMove(-1, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handlers.onKeyboardMove(1, 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        handlers.onKeyboardMove(0, -1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        handlers.onKeyboardMove(0, 1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void handlers.onKeyboardPlace();
      }
    });
  }

  placeButton?.addEventListener("click", () => {
    void handlers.onPlaceTile();
  });
}

function buildRenderSurface(state: BrowserAppState): {
  visibleTileCount: number;
  visibleBondCount: number;
  culledTileCount: number;
  tilesMarkup: string;
  bondsMarkup: string;
  previewMarkup: string;
} {
  const { canvasWidth, canvasHeight, panX, panY, zoom } = state.viewport;
  const tileSize = Math.max(20, Math.round(56 * zoom));
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const bounds = computeViewportTileBounds(state);

  const visibleTiles = Object.values(state.tiles)
    .filter((tile) =>
      tile.cellX >= bounds.minCellX &&
      tile.cellX <= bounds.maxCellX &&
      tile.cellY >= bounds.minCellY &&
      tile.cellY <= bounds.maxCellY
    )
    .sort((left, right) => {
      if (left.cellY !== right.cellY) {
        return left.cellY - right.cellY;
      }
      return left.cellX - right.cellX;
    });

  const visibleBondValues = Object.values(state.bonds).filter((bond) =>
    bond.fromCellX >= bounds.minCellX &&
    bond.fromCellX <= bounds.maxCellX &&
    bond.fromCellY >= bounds.minCellY &&
    bond.fromCellY <= bounds.maxCellY &&
    bond.toCellX >= bounds.minCellX &&
    bond.toCellX <= bounds.maxCellX &&
    bond.toCellY >= bounds.minCellY &&
    bond.toCellY <= bounds.maxCellY
  );

  const tilesMarkup = visibleTiles
    .map((tile) => {
      const screenX = centerX + (tile.cellX * tileSize - panX);
      const screenY = centerY + (tile.cellY * tileSize - panY);
      const stroke = state.accessibility.highContrastEnabled ? "#f4f6fa" : "#f8fbff";
      const opacity = tile.optimistic ? 0.42 : 0.92;
      const highlight = tile.optimistic ? "2,4" : "0";

      return `<rect x="${screenX - tileSize / 2}" y="${screenY - tileSize / 2}" width="${tileSize}" height="${tileSize}" fill="${escapeHtml(tile.color)}" stroke="${stroke}" stroke-width="2" fill-opacity="${opacity}" stroke-dasharray="${highlight}" rx="${Math.max(4, Math.round(8 * zoom))}" />`;
    })
    .join("");

  const bondsMarkup = visibleBondValues
    .map((bond) => {
      const fromX = centerX + (bond.fromCellX * tileSize - panX);
      const fromY = centerY + (bond.fromCellY * tileSize - panY);
      const toX = centerX + (bond.toCellX * tileSize - panX);
      const toY = centerY + (bond.toCellY * tileSize - panY);
      const bondStrokeWidth = Math.max(2, zoom * 3.2);
      const glowOpacity = state.accessibility.reducedMotionEnabled ? 0.75 : 0.95;
      const dash =
        bond.bondType === "glow_chain"
          ? "0"
          : bond.bondType === "blend_gradient"
            ? "10,5"
            : "3,5";

      return `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${escapeHtml(bond.color)}" stroke-width="${bondStrokeWidth}" stroke-linecap="round" stroke-opacity="${glowOpacity}" stroke-dasharray="${dash}" />`;
    })
    .join("");

  const previewMarkup = state.preview
    ? (() => {
        const previewX = centerX + (state.preview.cellX * tileSize - panX);
        const previewY = centerY + (state.preview.cellY * tileSize - panY);
        const stroke = state.preview.blocked ? "#ef4444" : "#22c55e";
        const fill = state.preview.blocked ? "rgba(239,68,68,0.28)" : "rgba(34,197,94,0.24)";
        return `<rect x="${previewX - tileSize / 2}" y="${previewY - tileSize / 2}" width="${tileSize}" height="${tileSize}" fill="${fill}" stroke="${stroke}" stroke-width="2" rx="${Math.max(4, Math.round(8 * zoom))}" />`;
      })()
    : "";

  return {
    visibleTileCount: visibleTiles.length,
    visibleBondCount: visibleBondValues.length,
    culledTileCount: Math.max(0, Object.keys(state.tiles).length - visibleTiles.length),
    tilesMarkup,
    bondsMarkup,
    previewMarkup
  };
}

function getCellFromPointer(
  board: SvgBoardLike,
  clientX: number,
  clientY: number,
  viewport: BrowserAppState["viewport"]
): {
  cellX: number;
  cellY: number;
} {
  const rect = board.getBoundingClientRect();
  const viewBox = board.viewBox.baseVal;
  const pixelX = ((clientX - rect.left) / rect.width) * viewBox.width;
  const pixelY = ((clientY - rect.top) / rect.height) * viewBox.height;
  const tileSize = Math.max(20, Math.round(56 * viewport.zoom));
  const worldX = pixelX - viewBox.width / 2 + viewport.panX;
  const worldY = pixelY - viewBox.height / 2 + viewport.panY;
  const cellX = Math.round(worldX / tileSize);
  const cellY = Math.round(worldY / tileSize);
  return { cellX, cellY };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
