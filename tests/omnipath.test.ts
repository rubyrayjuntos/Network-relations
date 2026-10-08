import assert from "node:assert/strict";
import test from "node:test";
import { fetchOmnipathUpstream, filterOmnipathRows } from "../src/lib/omnipath.ts";

test("OmniPath rows keep only partners and map stimulation and inhibition", () => {
  const interactions = filterOmnipathRows([
    { source_genesymbol: "KRAS", target_genesymbol: "RAF1", is_stimulation: true, is_inhibition: false },
    { source_genesymbol: "TP53", target_genesymbol: "MDM2", consensus_inhibition: true },
    { source_genesymbol: "EGFR", target_genesymbol: "KRAS", is_stimulation: true, is_inhibition: true },
  ], ["kras", "RAF1", "EGFR"]);
  assert.equal(interactions.length, 2);
  assert.deepEqual(interactions[0], {
    source: "KRAS",
    target: "RAF1",
    is_stimulation: true,
    is_inhibition: false,
  });
  assert.equal(interactions[1].is_stimulation, true);
  assert.equal(interactions[1].is_inhibition, true);
});

test("the proxy calls OmniPath upstream and does not invent interactions on failure", async () => {
  const calls: string[] = [];
  const result = await fetchOmnipathUpstream(["KRAS", "RAF1"], (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify([
      { source_genesymbol: "KRAS", target_genesymbol: "RAF1", is_stimulation: true, is_inhibition: false },
      { source_genesymbol: "AKT1", target_genesymbol: "MTOR", is_stimulation: true, is_inhibition: false },
    ]), { status: 200 });
  }) as typeof fetch);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/omnipathdb\.org\/interactions\?/);
  assert.match(calls[0], /datasets=omnipath%2Cpathwayextra%2Ckinaseextra%2Cligrecextra/);
  assert.deepEqual(result.interactions, [{
    source: "KRAS",
    target: "RAF1",
    is_stimulation: true,
    is_inhibition: false,
  }]);

  await assert.rejects(
    () => fetchOmnipathUpstream(["KRAS"], (async () => new Response("no", { status: 502 })) as typeof fetch),
    /OmniPath upstream failed \(502\)/
  );
});

test("the browser client calls the server proxy, not omnipathdb.org", async () => {
  const { readFile } = await import("node:fs/promises");
  const { setting } = await import("../src/lib/settingsRegistry.ts");
  const client = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  assert.equal(client.includes("omnipathdb.org"), false);
  assert.match(client, /source\.omnipath\.proxyPath/);
  assert.equal(setting("source.omnipath.proxyPath").default, "/api/omnipath");
});
