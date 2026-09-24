import { modernHandler } from "./_lib/modernHandler.mjs";
import { createPartnerStatsHandler } from "./daily-partner-stats.mjs";

export default modernHandler(createPartnerStatsHandler([365], ["ribs"]));