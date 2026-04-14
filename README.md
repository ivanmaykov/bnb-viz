# bnb-viz

Boston Airbnb story site built for DS4200 and deployed on GitHub Pages.

Live site: [https://ivanmaykov.github.io/bnb-viz/](https://ivanmaykov.github.io/bnb-viz/)

## Project overview

This project analyzes Boston's Airbnb market using Inside Airbnb data dated 15 March 2025. The site is a static, GitHub Pages-compatible single-page story that combines Python preprocessing, Altair/Vega-Lite charts, and D3 visualizations.

The current site includes:

- a D3 choropleth map of neighborhood pricing and supply
- an Altair scatterplot of nightly price versus estimated occupancy
- an Altair seasonality chart of reviews and pricing over time
- a D3 commercialization comparison that uses a boxplot for nightly price and summary bar charts for the other neighborhood metrics

## Live stack

- Frontend: Vite
- Custom visualizations: D3
- Declarative visualizations: Altair rendered with Vega-Embed
- Data processing: Python
- Deployment: GitHub Pages via GitHub Actions
- Quality checks: Prettier and ESLint

## Data

Primary source:

- Inside Airbnb, Boston snapshot dated `2025-03-15`

Processed frontend artifacts are generated under `public/data/` and currently include:

- `listing_points.json`
- `neighborhood_summary.json`
- `neighborhood_shapes.geojson`
- `reviews_monthly.json`
- `pricing_monthly.json`
- `altair_price_demand.json`
- `altair_seasonality.json`

Current processed dataset sizes:

- `3,706` listing records
- `25` neighborhood summaries
- `3,882` monthly review rows
- `169` monthly pricing rows

Important listing-level attributes include:

- `id`
- `name`
- `neighbourhood`
- `latitude`
- `longitude`
- `room_type`
- `property_type`
- `price`
- `availability_365`
- `number_of_reviews_ltm`
- `estimated_occupancy_l365d`
- `review_scores_rating`
- `calculated_host_listings_count`
- `host_is_superhost`

Important neighborhood-level summary attributes include:

- `listing_count`
- `median_price`
- `median_occupancy`
- `median_rating`
- `average_availability`
- `multi_listing_share`
- `entire_home_share`

## Pricing precedence

Pricing is treated as a required attribute in the preprocessing pipeline. The project uses the following precedence:

1. Official Inside Airbnb Boston `listings.csv.gz` nightly price
2. Derived calendar-based price medians from official `calendar.csv.gz`
3. No fallback to the blank local price columns

If usable price coverage is zero after enrichment, the data build fails.

## Repository structure

- `src/main.js`: page structure, D3 charts, and Vega-Embed chart mounting
- `src/styles.css`: site styling and layout
- `scripts/build_data.py`: Python preprocessing and Altair spec generation
- `public/data/`: processed JSON/GeoJSON artifacts used by the frontend
- `.github/workflows/ci.yml`: CI for formatting, linting, data prep, and build
- `.github/workflows/deploy-pages.yml`: Pages deployment workflow

## Local setup

1. Create the Python environment:

```bash
python3 -m venv .venv
```

2. Install Python dependencies:

```bash
./.venv/bin/pip install -r requirements.txt
```

3. Install Node dependencies:

```bash
npm install
```

4. Build processed data:

```bash
npm run data
```

If the official Boston pricing files are not already present in `data/raw/official/`, use:

```bash
npm run data:fetch
```

5. Start the local dev server:

```bash
npm run dev
```

6. Build the production site:

```bash
npm run build
```

7. Preview the production build locally:

```bash
npm run preview
```

## Available scripts

- `npm run dev`: start the Vite dev server
- `npm run build`: create the production build in `dist/`
- `npm run preview`: preview the production build locally
- `npm run data`: run the Python preprocessing pipeline using local official files
- `npm run data:fetch`: download official Inside Airbnb pricing files, then rebuild processed data
- `npm run lint`: run ESLint
- `npm run format`: run Prettier and rewrite files in place
- `npm run format:check`: check formatting without rewriting files

## CI and deployment

CI runs on pushes to `main` and `master`, and on pull requests. It performs:

- dependency installation
- Python environment setup
- data preparation with pricing enrichment
- `prettier --check`
- `eslint`
- production build

Deployment is handled separately by GitHub Actions through the Pages workflow, which builds the site and publishes the contents of `dist/`.

## Notes

- The site is fully static and does not require a backend.
- Altair charts are generated ahead of time in Python and rendered in the browser with Vega-Embed.
- The commercialization chart intentionally uses a mixed approach: nightly price stays a boxplot because there is listing-level distribution data, while the other comparison modes use neighborhood summary bars.
  
## Authors

- Mohamed Ibrahim  
- Ivan Maykov