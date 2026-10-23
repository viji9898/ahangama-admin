import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import MidigamaGoogleMap from "../components/MidigamaGoogleMap";
import "./Midigama.css";

type Place = {
  id: string;
  name: string;
  type: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
};

type MarketPayload = {
  generatedAt: string;
  accommodation: Place[];
  demandDrivers: Place[];
};

type Concept = {
  name: string;
  floorAreaSqFt: number;
  nightlyRateUsd: number;
  occupancy: number;
  constructionRateLkr: number;
  siteAndPoolLkr: number;
};

const SITE = { latitude: 5.966889, longitude: 80.391139 };
const LAND_PRICE_LKR = 13_000_000;
const USD_LKR = 320;
const ACQUISITION_RATE = 0.06;
const PROFESSIONAL_RATE = 0.1;
const CONTINGENCY_RATE = 0.1;
const OPERATING_MARGIN = 0.65;

const concepts: Concept[] = [
  {
    name: "1-bedroom pool villa",
    floorAreaSqFt: 760,
    nightlyRateUsd: 100,
    occupancy: 0.5,
    constructionRateLkr: 22_500,
    siteAndPoolLkr: 4_500_000,
  },
  {
    name: "2-bedroom pool villa",
    floorAreaSqFt: 1050,
    nightlyRateUsd: 135,
    occupancy: 0.52,
    constructionRateLkr: 23_500,
    siteAndPoolLkr: 5_500_000,
  },
];

const formatLkr = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const formatDistance = (meters: number | null) => {
  if (meters === null) return "Distance unavailable";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const calculateConcept = (concept: Concept) => {
  const acquisitionCosts = LAND_PRICE_LKR * ACQUISITION_RATE;
  const construction = concept.floorAreaSqFt * concept.constructionRateLkr;
  const directWorks = construction + concept.siteAndPoolLkr;
  const professionalFees = directWorks * PROFESSIONAL_RATE;
  const contingency = (directWorks + professionalFees) * CONTINGENCY_RATE;
  const totalInvestment =
    LAND_PRICE_LKR +
    acquisitionCosts +
    directWorks +
    professionalFees +
    contingency;
  const grossRevenue =
    concept.nightlyRateUsd * USD_LKR * 365 * concept.occupancy;
  const annualOperatingNet = grossRevenue * OPERATING_MARGIN;

  return {
    ...concept,
    construction,
    totalInvestment,
    annualOperatingNet,
    operatingYield: annualOperatingNet / totalInvestment,
    fiveYearCostRecovery: (annualOperatingNet * 5) / totalInvestment,
  };
};

function PlaceList({ places, emptyLabel }: { places: Place[]; emptyLabel: string }) {
  if (!places.length) return <p className="midigama-muted">{emptyLabel}</p>;

  return (
    <ol className="midigama-place-list">
      {places.slice(0, 8).map((place) => (
        <li key={place.id}>
          <div>
            <strong>{place.name}</strong>
            <span>{place.type} · {formatDistance(place.distanceMeters)}</span>
          </div>
          <div className="midigama-place-score">
            {place.rating === null ? "No rating" : `${place.rating.toFixed(1)} / 5`}
            {place.reviewCount === null ? "" : ` · ${place.reviewCount} reviews`}
            {place.mapsUrl ? (
              <a href={place.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Open ${place.name} in Google Maps`}>
                <ExportOutlined />
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function Midigama() {
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [marketError, setMarketError] = useState("");
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [radiusKm, setRadiusKm] = useState(3);

  const loadMarket = async () => {
    setLoadingMarket(true);
    setMarketError("");

    try {
      const response = await fetch("/.netlify/functions/api-midigama-market", {
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Failed (${response.status})`);
      setMarket(payload as MarketPayload);
    } catch (error) {
      setMarketError(String((error as Error)?.message || error));
    } finally {
      setLoadingMarket(false);
    }
  };

  useEffect(() => {
    void loadMarket();
  }, []);

  const scenarios = concepts.map(calculateConcept);
  const filteredAccommodation = useMemo(
    () => (market?.accommodation || []).filter((place) => (place.distanceMeters ?? Infinity) <= radiusKm * 1000),
    [market, radiusKm],
  );
  const filteredDrivers = useMemo(
    () => (market?.demandDrivers || []).filter((place) => (place.distanceMeters ?? Infinity) <= radiusKm * 1000),
    [market, radiusKm],
  );
  const mapPlaces = [
    ...filteredAccommodation.map((place) => ({
      ...place,
      category: "accommodation" as const,
    })),
    ...filteredDrivers.map((place) => ({
      ...place,
      category: "demand" as const,
    })),
  ];

  return (
    <div className="midigama-page">
      <header className="midigama-header">
        <Link to="/admin" className="midigama-back"><ArrowLeftOutlined /> Admin</Link>
        <span>Private investment memorandum · 23 October 2026</span>
      </header>

      <main>
        <section className="midigama-hero">
          <p className="midigama-kicker">Plot 8 · Midigama, Sri Lanka</p>
          <h1>Small villa feasibility</h1>
          <p className="midigama-deck">A preliminary buy-and-build assessment for a design-led short-term rental on a narrow 6.5-perch plot.</p>
          <div className="midigama-facts" aria-label="Project summary">
            <div><span>Land</span><strong>{formatLkr(LAND_PRICE_LKR)}</strong></div>
            <div><span>Site</span><strong>20.23 × 8.07 m</strong></div>
            <div><span>Road</span><strong>22 ft public</strong></div>
            <div><span>Hold</span><strong>5 years · cash</strong></div>
          </div>
        </section>

        <section className="midigama-section">
          <div className="midigama-section-label">01 · Executive view</div>
          <div className="midigama-prose">
            <p className="midigama-status">Conditional proceed</p>
            <h2>The land can support the idea. The width decides whether it supports the investment.</h2>
            <p>The strongest risk-adjusted concept is a compact ground-plus-one, two-bedroom pool villa. It makes better use of the fixed land cost than a one-bedroom product while preserving a small garden footprint. That recommendation is conditional: no purchase decision should be made until a measured architect’s test-fit demonstrates compliant setbacks, one usable parking bay, wastewater treatment, service access and a plunge pool without compromising guest privacy.</p>
            <div className="midigama-callout"><strong>Decision gate</strong><span>Obtain the test-fit, written planning confirmation and three comparable contractor quotations before committing the land deposit.</span></div>
          </div>
        </section>

        <section className="midigama-section">
          <div className="midigama-section-label">02 · Site envelope</div>
          <div className="midigama-prose">
            <h2>A long, narrow parcel with approximately 163.3 m² of land.</h2>
            <p>The surveyed dimensions imply about 6.46 perches, consistent with the marketed 6.5 perches. The 8.07 m edge meets the road. A provisional 65% coverage ceiling would permit up to 106 m² of footprint in arithmetic terms, but setbacks and access geometry, not coverage, are likely to be the binding constraints.</p>
            <div className="midigama-site-grid">
              <div className="midigama-plot" aria-label="Indicative plot diagram">
                <span className="midigama-plot-length">20.23 m</span>
                <div className="midigama-buildable"><span>Indicative<br />build zone</span></div>
                <div className="midigama-pool">Pool</div>
                <div className="midigama-parking">Parking</div>
                <span className="midigama-plot-width">8.07 m road frontage</span>
              </div>
              <dl className="midigama-assumptions">
                <div><dt>Dwelling</dt><dd>One villa</dd></div>
                <div><dt>Floors</dt><dd>Ground + first</dd></div>
                <div><dt>Height</dt><dd>Below 7 m target</dd></div>
                <div><dt>Parking</dt><dd>One on-site bay</dd></div>
                <div><dt>Pool</dt><dd>Compact plunge pool</dd></div>
                <div><dt>Utilities</dt><dd>Reported confirmed</dd></div>
              </dl>
            </div>
            <p className="midigama-note">Diagram is spatially indicative only. It is not a survey, planning drawing or architectural test-fit.</p>
          </div>
        </section>

        <section className="midigama-section">
          <div className="midigama-section-label">03 · Development economics</div>
          <div className="midigama-prose">
            <h2>The two-bedroom option improves land efficiency, but adds roughly {formatLkr(scenarios[1].totalInvestment - scenarios[0].totalInvestment)} of capital.</h2>
            <p>These are feasibility assumptions, not quotations. They use a 6% acquisition allowance, 10% professional fees, 10% contingency, LKR {USD_LKR} per USD and a 65% operating margin for a self-managed property. Five-year recovery excludes land resale, appreciation, tax and financing.</p>
            <div className="midigama-table-wrap">
              <table className="midigama-table">
                <thead><tr><th>Working assumption</th>{scenarios.map((scenario) => <th key={scenario.name}>{scenario.name}</th>)}</tr></thead>
                <tbody>
                  <tr><td>Gross floor area</td>{scenarios.map((scenario) => <td key={scenario.name}>{scenario.floorAreaSqFt.toLocaleString()} ft²</td>)}</tr>
                  <tr><td>Build rate</td>{scenarios.map((scenario) => <td key={scenario.name}>{formatLkr(scenario.constructionRateLkr)} / ft²</td>)}</tr>
                  <tr><td>Construction</td>{scenarios.map((scenario) => <td key={scenario.name}>{formatLkr(scenario.construction)}</td>)}</tr>
                  <tr><td>Pool + external works</td>{scenarios.map((scenario) => <td key={scenario.name}>{formatLkr(scenario.siteAndPoolLkr)}</td>)}</tr>
                  <tr className="midigama-table-total"><td>Total investment</td>{scenarios.map((scenario) => <td key={scenario.name}>{formatLkr(scenario.totalInvestment)}</td>)}</tr>
                  <tr><td>Nightly rate / occupancy</td>{scenarios.map((scenario) => <td key={scenario.name}>US${scenario.nightlyRateUsd} / {(scenario.occupancy * 100).toFixed(0)}%</td>)}</tr>
                  <tr><td>Annual operating net</td>{scenarios.map((scenario) => <td key={scenario.name}>{formatLkr(scenario.annualOperatingNet)}</td>)}</tr>
                  <tr><td>Unlevered operating yield</td>{scenarios.map((scenario) => <td key={scenario.name}>{(scenario.operatingYield * 100).toFixed(1)}%</td>)}</tr>
                  <tr><td>5-year cost recovery</td>{scenarios.map((scenario) => <td key={scenario.name}>{(scenario.fiveYearCostRecovery * 100).toFixed(0)}%</td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="midigama-warning">Construction rates, ADR and occupancy are placeholders for sensitivity testing. Replace them with QS quotations and observed comparable rates before relying on the yield.</div>
          </div>
        </section>

        <section className="midigama-section">
          <div className="midigama-section-label">04 · Local market evidence</div>
          <div className="midigama-prose">
            <div className="midigama-market-heading">
              <div><h2>Competition and demand around the exact site.</h2><p>Google Places is used for proximity, category, rating and review volume. It does not provide occupancy or historical room rates.</p></div>
              <div className="midigama-radius" aria-label="Market radius">
                {[1, 3, 5].map((radius) => <button key={radius} type="button" className={radiusKm === radius ? "is-active" : ""} onClick={() => setRadiusKm(radius)}>{radius} km</button>)}
              </div>
            </div>

            {marketError ? <div className="midigama-market-error"><span><strong>Live evidence unavailable.</strong> {marketError}</span><button type="button" onClick={() => void loadMarket()}><ReloadOutlined /> Retry</button></div> : null}

            <div className="midigama-market-summary">
              <div><strong>{loadingMarket ? "—" : filteredAccommodation.length}</strong><span>accommodation results</span></div>
              <div><strong>{loadingMarket ? "—" : filteredDrivers.length}</strong><span>demand drivers</span></div>
              <div><strong>{radiusKm} km</strong><span>selected radius</span></div>
            </div>

            <div className="midigama-map">
              <MidigamaGoogleMap
                site={SITE}
                places={mapPlaces}
                radiusKm={radiusKm}
              />
            </div>

            <div className="midigama-place-columns">
              <div><h3>Accommodation</h3><PlaceList places={filteredAccommodation} emptyLabel={loadingMarket ? "Loading nearby properties…" : "No results in this radius."} /></div>
              <div><h3>Demand drivers</h3><PlaceList places={filteredDrivers} emptyLabel={loadingMarket ? "Loading nearby places…" : "No results in this radius."} /></div>
            </div>
            {market?.generatedAt ? <p className="midigama-note">Places snapshot generated {new Date(market.generatedAt).toLocaleString()}.</p> : null}
          </div>
        </section>

        <section className="midigama-section">
          <div className="midigama-section-label">05 · Risks and next actions</div>
          <div className="midigama-prose">
            <h2>Resolve physical fit before refining the return.</h2>
            <div className="midigama-actions">
              <article><span>01</span><div><h3>Architect test-fit</h3><p>Survey-based plan showing setbacks, rooms, stairs, parking movement, pool, plant, refuse and wastewater.</p></div></article>
              <article><span>02</span><div><h3>Written planning check</h3><p>Confirm the 65% coverage assumption, height, floors, road reservation, tourism use and approval pathway with the relevant authority.</p></div></article>
              <article><span>03</span><div><h3>Ground and water review</h3><p>Verify soil, flood and drainage conditions, dry-season water reliability, wastewater solution and utility connection capacity.</p></div></article>
              <article><span>04</span><div><h3>Commercial validation</h3><p>Collect three build quotations and a dated sample of nightly rates from genuinely comparable one- and two-bedroom villas.</p></div></article>
              <article><span>05</span><div><h3>Offer conditions</h3><p>Make any purchase commitment subject to title, access, boundaries, approvals and satisfactory physical feasibility.</p></div></article>
            </div>
          </div>
        </section>

        <section className="midigama-conclusion">
          <EnvironmentOutlined />
          <div><p>Proposed site</p><h2>5°58'00.8&quot;N 80°23'28.1&quot;E</h2><a href="https://www.google.com/maps?q=5.966889,80.391139" target="_blank" rel="noreferrer">Open exact location <ExportOutlined /></a></div>
        </section>
      </main>
    </div>
  );
}