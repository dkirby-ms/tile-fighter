import type { BrowserAppState } from "./state.js";

function getRootElement() {
  const doc = globalThis.document;
  return doc ? doc.getElementById("app") : null;
}

export type BrowserRenderHandlers = {
  onPlaceTile: () => void | Promise<void>;
  onSelectCell: (cellX: number, cellY: number) => void;
};

export function renderBrowserAppState(state: BrowserAppState): void {
  const root = getRootElement();
  if (!root) {
    return;
  }

  root.innerHTML = `<section>
    <h1>Tile Fighter Browser Loop</h1>
    <p><strong>Stage:</strong> ${state.status}</p>
    <p><strong>Status:</strong> ${escapeHtml(state.message)}</p>
    ${state.guidance ? `<p><strong>Guidance:</strong> ${escapeHtml(state.guidance)}</p>` : ""}
    <p><strong>Auth:</strong> ${state.tokenReady ? "token-ready" : "pending"}</p>
    <p><strong>Bootstrap:</strong> ${state.bootstrapReady ? "ok" : "pending"}</p>
    <p><strong>Room:</strong> ${state.roomJoined ? `${escapeHtml(state.roomId)} (${escapeHtml(state.roomSessionId ?? "unknown")})` : "pending"}</p>
    <p><strong>Selected Cell:</strong> ${state.selectedCellX},${state.selectedCellY}</p>
    ${state.lastAppliedSequenceId ? `<p><strong>Last Delta:</strong> ${escapeHtml(state.lastAppliedSequenceId)}</p>` : ""}
    ${state.placeFeedback ? `<p><strong>Placement:</strong> ${escapeHtml(state.placeFeedback)}</p>` : ""}
    <div>
      <label for="tile-cell-x">Cell X</label>
      <input id="tile-cell-x" type="number" value="${state.selectedCellX}" />
      <label for="tile-cell-y">Cell Y</label>
      <input id="tile-cell-y" type="number" value="${state.selectedCellY}" />
      <button id="place-tile" type="button" ${state.status === "ready" ? "" : "disabled"}>Place Tile</button>
    </div>
    <h2>Tiles (${Object.keys(state.tiles).length})</h2>
    <ul>${renderTiles(state)}</ul>
  </section>`;
}

export function bindBrowserRenderHandlers(handlers: BrowserRenderHandlers): void {
  const doc = globalThis.document;
  if (!doc) {
    return;
  }

  const xInput = doc.getElementById("tile-cell-x");
  const yInput = doc.getElementById("tile-cell-y");
  const placeButton = doc.getElementById("place-tile");

  const handleSelectionChange = () => {
    if (
      !xInput ||
      !yInput ||
      !(xInput instanceof globalThis.HTMLInputElement) ||
      !(yInput instanceof globalThis.HTMLInputElement)
    ) {
      return;
    }

    const nextCellX = Number.parseInt(xInput.value, 10) || 0;
    const nextCellY = Number.parseInt(yInput.value, 10) || 0;
    handlers.onSelectCell(nextCellX, nextCellY);
  };

  xInput?.addEventListener("change", handleSelectionChange);
  yInput?.addEventListener("change", handleSelectionChange);

  placeButton?.addEventListener("click", () => {
    void handlers.onPlaceTile();
  });
}

function renderTiles(state: BrowserAppState): string {
  const rows = Object.values(state.tiles)
    .sort((left, right) => {
      if (left.cellX !== right.cellX) {
        return left.cellX - right.cellX;
      }
      return left.cellY - right.cellY;
    })
    .map(
      (tile) =>
        `<li>(${tile.cellX},${tile.cellY}) ${escapeHtml(tile.shape)} ${escapeHtml(tile.color)} by ${escapeHtml(tile.ownerId)} v${tile.version}</li>`
    );

  return rows.join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
