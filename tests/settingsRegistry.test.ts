import assert from "node:assert/strict";
import test from "node:test";
import {
  GROUP_ORDER,
  SETTINGS,
  defaultPreferences,
  edgeWidth,
  operatorReadout,
  settingsByGroup,
  validatePreferences,
  type Setting,
} from "../src/lib/settingsRegistry.ts";

test("settings have unique ids and preference keys match stored defaults", () => {
  const ids = SETTINGS.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  const defaults = defaultPreferences();
  for (const item of SETTINGS) {
    if (!item.storage.includes("user preference")) continue;
    assert.ok(item.preferenceKey, `${item.id} stores a user preference`);
    assert.deepEqual(defaults[item.preferenceKey], item.default);
  }
  assert.equal(defaults.context, "pan-cancer");
  assert.deepEqual(settingsByGroup().map(section => section.group), [...GROUP_ORDER]);
});

test("a new descriptor appears in its group without a panel edit", () => {
  const extra: Setting = {
    id: "display.example",
    label: "Example",
    group: "Display",
    kind: "display",
    default: "#112233",
    storage: ["code default"],
    commit: "readonly",
    effect: "nothing",
    legend: false,
    export: false,
    editable: false,
    control: "none",
  };
  const grouped = settingsByGroup([...SETTINGS, extra]);
  const display = grouped.find(section => section.group === "Display");
  assert.ok(display?.settings.some(item => item.id === "display.example"));
});

test("preference validation rejects unknown keys and invalid scores", () => {
  const unknown = validatePreferences({ ...defaultPreferences(), notASetting: 1 });
  assert.equal(unknown.ok, false);
  const score = validatePreferences({ ...defaultPreferences(), stringRequiredScore: 7000 });
  assert.equal(score.ok, false);
  const commaDomain = validatePreferences({ ...defaultPreferences(), chronosDomain: "-2, -0.5, 0, 0.5" });
  assert.equal(commaDomain.ok, true);
  const badRange = validatePreferences({ ...defaultPreferences(), chronosRange: ["red", "#fb7185", "#64748b", "#38bdf8"] });
  assert.equal(badRange.ok, false);
  const badHub = validatePreferences({ ...defaultPreferences(), hubColors: { ...defaultPreferences().hubColors, fill: "#e11d48" } });
  assert.equal(badHub.ok, false);
});

test("operator readout reports secret presence without the secret", () => {
  const readout = operatorReadout({
    env: { JWT_SECRET: "local-review-secret", HOST: "127.0.0.1", PORT: "3471" },
    cacheLoaded: false,
    cacheRelease: null,
  });
  assert.equal(readout.jwtSecret, "present");
  assert.equal(JSON.stringify(readout).includes("local-review-secret"), false);
  assert.equal(readout.geminiApiKey, "unused");
  assert.equal(edgeWidth(null), 0.6);
});
