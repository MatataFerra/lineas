import "server-only";
import { z } from "zod";
import data from "@/data/rincones.json";
import { bridges, RinconSchema, summarize, type Rincon, type RinconSummary } from "./rincon";

// Se valida al cargar: un JSON mal curado rompe el build, no la página.
export const RINCONES: Rincon[] = z.array(RinconSchema).parse(data);

export function rinconBySlug(slug: string): Rincon | undefined {
  return RINCONES.find((r) => r.slug === slug);
}

export function rinconSummaries(): RinconSummary[] {
  return RINCONES.map(summarize);
}

export function rinconBridges(r: Rincon) {
  return bridges(r, RINCONES);
}
