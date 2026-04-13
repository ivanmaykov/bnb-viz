# bnb-viz

Boston Airbnb story site built for GitHub Pages with four visualizations:

- a D3 choropleth map of neighborhood price and supply
- an Altair scatterplot of price versus occupancy
- an Altair seasonal chart of reviews and pricing
- a D3 ranked comparison of neighborhood commercialization

## Local setup

1. Create the Python environment: `python3 -m venv .venv`
2. Install Python dependencies: `./.venv/bin/pip install -r requirements.txt`
3. Install Node dependencies: `npm install`
4. Build processed data:
   - `npm run data` if `data/raw/official/listings.csv.gz` and `data/raw/official/calendar.csv.gz` already exist
   - `npm run data:fetch` to download the official Boston pricing files from Inside Airbnb first
5. Start the app with `npm run dev`

## Pricing precedence

The preprocessing step treats pricing as required and uses this precedence:

1. Official Inside Airbnb Boston `listings.csv.gz` nightly price
2. Derived monthly calendar pricing from official `calendar.csv.gz`
3. No fallback to the blank local price columns

If price coverage is zero after enrichment, the build fails.

The current pricing source is the official Boston detailed snapshot from
`2025-03-15`, because the later `2025-12-27` Boston files mirror the repo’s
blank `price` fields.
