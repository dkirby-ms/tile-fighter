import { describe, expect, it } from "vitest";
import {
  createPlacementCommandId,
  isValidPlacementCommandId,
  sanitizePlacementSubmitInput
} from "../../src/creator/placement-input.js";

describe("placement-input sanitization", () => {
  it("accepts valid input and generates commandId when absent", () => {
    const result = sanitizePlacementSubmitInput(
      {
        regionId: "arena-1",
        cellX: 10,
        cellY: 15,
        offsetX: 0.25,
        offsetY: -0.5,
        shape: "square",
        color: "red",
        stylePayload: {
          opacity: 0.6,
          tags: ["accent", "preview"]
        }
      },
      {
        allowedShapes: ["square", "triangle"],
        allowedColors: ["red", "blue"],
        createCommandId: () => "cmd_valid_12345678"
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.command.commandId).toBe("cmd_valid_12345678");
    expect(result.command.shape).toBe("square");
    expect(result.command.color).toBe("red");
  });

  it("rejects invalid shape/color/cell/offset/style", () => {
    const result = sanitizePlacementSubmitInput(
      {
        commandId: "bad id",
        regionId: "",
        cellX: 10.3,
        cellY: Number.NaN,
        offsetX: 4,
        offsetY: Number.POSITIVE_INFINITY,
        shape: "hex",
        color: "purple",
        stylePayload: {
          nested: {
            a: {
              b: {
                c: {
                  d: true
                }
              }
            }
          }
        }
      },
      {
        allowedShapes: ["square"],
        allowedColors: ["red"],
        maxStyleDepth: 3
      }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    const issueCodes = new Set(result.issues.map((issue) => issue.code));
    expect(issueCodes.has("invalid-command-id")).toBe(true);
    expect(issueCodes.has("invalid-region-id")).toBe(true);
    expect(issueCodes.has("invalid-shape")).toBe(true);
    expect(issueCodes.has("invalid-color")).toBe(true);
    expect(issueCodes.has("invalid-cell")).toBe(true);
    expect(issueCodes.has("invalid-offset")).toBe(true);
    expect(issueCodes.has("invalid-style-payload")).toBe(true);
  });

  it("validates and generates bounded command identities", () => {
    const generated = createPlacementCommandId(1_000_000, "abcdef123456");
    expect(isValidPlacementCommandId(generated)).toBe(true);
    expect(isValidPlacementCommandId("short")).toBe(false);
    expect(isValidPlacementCommandId("not.valid.with.dots")).toBe(false);
  });
});
