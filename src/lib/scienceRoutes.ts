import type { Express, Request, Response } from "express";
import { MeasurementSchemaError, queryMeasurements, type MeasurementCache } from "./measurements";
import { fetchOmnipathUpstream } from "./omnipath";
import { CACHE_MISSING_SENTENCE, OMNIPATH_DATASET_ALLOWLIST } from "./settingsRegistry";

export function mountScienceRoutes(
  app: Express,
  cache: MeasurementCache | null,
  fetchImpl: typeof fetch = fetch
) {
  app.get("/api/contexts", (_req: Request, res: Response) => {
    if (!cache) {
      res.status(503).json({ error: CACHE_MISSING_SENTENCE });
      return;
    }
    res.json({ release: cache.release, contexts: cache.contexts });
  });

  app.get("/api/measurements", (req: Request, res: Response) => {
    if (!cache) {
      res.status(503).json({ error: CACHE_MISSING_SENTENCE });
      return;
    }
    const context = typeof req.query.context === "string" ? req.query.context : "";
    const genes = typeof req.query.genes === "string"
      ? req.query.genes.split(",").map(gene => gene.trim()).filter(Boolean)
      : [];
    if (!context) {
      res.status(400).json({ error: "context is required" });
      return;
    }
    try {
      res.json(queryMeasurements(cache, genes, context));
    } catch (error) {
      if (error instanceof MeasurementSchemaError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Failed to read measurements" });
    }
  });

  app.get("/api/omnipath", async (req: Request, res: Response) => {
    const partners = typeof req.query.partners === "string"
      ? req.query.partners.split(",").map(partner => partner.trim()).filter(Boolean)
      : [];
    if (partners.length === 0) {
      res.status(400).json({ error: "partners is required" });
      return;
    }
    if (!partners.every(partner => /^[A-Za-z0-9-]+$/.test(partner))) {
      res.status(400).json({ error: "partners must be gene symbols" });
      return;
    }
    const requested = typeof req.query.datasets === "string"
      ? req.query.datasets.split(",").map(name => name.trim()).filter(Boolean)
      : null;
    if (requested && requested.some(name => !OMNIPATH_DATASET_ALLOWLIST.includes(name as typeof OMNIPATH_DATASET_ALLOWLIST[number]))) {
      res.status(400).json({ error: "datasets must be a subset of the OmniPath allow-list" });
      return;
    }
    try {
      if (requested && requested.length === 0) {
        res.json({ datasets: [], interactions: [] });
        return;
      }
      res.json(await fetchOmnipathUpstream(partners, fetchImpl, requested ?? undefined));
    } catch (error) {
      const message = error instanceof Error ? error.message : "OmniPath request failed";
      res.status(502).json({ error: message });
    }
  });
}
