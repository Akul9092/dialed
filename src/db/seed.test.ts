import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { db } from "./db";
import { CABLE_ATTACHMENTS, ensureSeed } from "./seed";

describe("built-in cable attachments", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("seeds a fresh install with the full attachment list", async () => {
    await ensureSeed();
    const def = await db.equipmentFieldDefs.get("f-cable-attachment");
    assert.deepEqual(def!.options, CABLE_ATTACHMENTS);
    assert.ok(def!.options!.includes("Tricep strap"));
  });

  it("adds new attachments to an existing install without dropping stored options", async () => {
    await ensureSeed();
    await db.equipmentFieldDefs.update("f-cable-attachment", {
      options: ["Rope", "Straight bar", "V-bar", "D-handle", "Wrist cuff", "EZ bar", "Ankle strap", "Gym's odd handle"],
    });
    await ensureSeed();
    const opts = (await db.equipmentFieldDefs.get("f-cable-attachment"))!.options!;
    assert.deepEqual(opts, [...CABLE_ATTACHMENTS, "Gym's odd handle"]);
  });

  it("keeps attachment names unique", () => {
    const lower = CABLE_ATTACHMENTS.map((o) => o.toLowerCase());
    assert.equal(new Set(lower).size, lower.length);
  });
});
