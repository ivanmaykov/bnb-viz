import * as d3 from 'd3';
import './styles.css';

const dataBase = `${import.meta.env.BASE_URL}data/`;
const money = d3.format('$,.0f');
const pct = d3.format('.0%');
const oneDecimal = d3.format('.1f');

const metrics = {
  median_price: {
    label: 'Median nightly price',
    value: (d) => d.median_price,
    formatter: money,
  },
  listing_count: {
    label: 'Listing count',
    value: (d) => d.listing_count,
    formatter: d3.format(','),
  },
  median_occupancy: {
    label: 'Median booked nights',
    value: (d) => d.median_occupancy,
    formatter: (value) => `${oneDecimal(value)} nights`,
  },
  median_rating: {
    label: 'Median rating',
    value: (d) => d.median_rating,
    formatter: (value) => oneDecimal(value),
  },
};

const rankMetrics = {
  median_price: {
    label: 'Median nightly price',
    value: (d) => d.median_price,
    formatter: money,
  },
  entire_home_share: {
    label: 'Entire-home share',
    value: (d) => d.entire_home_share,
    formatter: pct,
  },
  multi_listing_share: {
    label: 'Multi-listing host share',
    value: (d) => d.multi_listing_share,
    formatter: pct,
  },
  average_availability: {
    label: 'Average availability',
    value: (d) => d.average_availability,
    formatter: (value) => `${oneDecimal(value)} days`,
  },
  listing_count: {
    label: 'Listing count',
    value: (d) => d.listing_count,
    formatter: d3.format(','),
  },
};

const app = document.querySelector('#app');

const page = document.createElement('main');
page.className = 'page-shell';
page.innerHTML = `
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Boston Airbnb Story</p>
      <h1>Price, pressure, and place in Boston’s Airbnb market</h1>
      <p class="lede">
        This site combines Inside Airbnb’s Boston summary files with official
        detailed pricing data from 15 March 2025 to show where listings are
        expensive, how price tracks demand, when the market heats up, and which
        neighborhoods look most commercialized.
      </p>
    </div>
    <div class="hero-side">
      <aside class="project-tile">
        <p class="project-kicker">Course Project</p>
        <h3>DS4200 Final Project</h3>
        <p class="project-term">Spring 2026</p>
        <p class="project-authors">Ivan Maykov and Mohammed Ibrahim</p>
      </aside>
      <div class="hero-stats" id="hero-stats"></div>
    </div>
  </section>

  <section class="story-block">
    <div class="story-intro">
      <p class="section-kicker">1. Spatial pattern</p>
      <h2>Nightly prices cluster unevenly across Boston.</h2>
      <p>
        Boston’s Airbnb market is not evenly distributed. Higher median prices
        tend to cluster in central, visitor-friendly neighborhoods, while other
        areas show more supply than pricing power. This visualization was built
        with D3 as an interactive choropleth map, with D3 also handling the
        tooltip, color scale, and room-type filtering controls.
      </p>
    </div>
    <div class="card">
      <div class="controls-row">
        <label>
          Metric
          <select id="map-metric"></select>
        </label>
        <label>
          Room type
          <select id="map-room-type"></select>
        </label>
      </div>
      <div id="map-chart" class="viz-frame viz-map"></div>
    </div>
  </section>

  <section class="story-block altair-block">
    <div class="story-intro">
      <p class="section-kicker">2. Market tradeoffs</p>
      <h2>Higher prices do not guarantee higher occupancy.</h2>
      <p>
        Expensive listings are not automatically the most heavily booked, and
        the relationship changes once you separate private rooms from entire
        homes. The real pattern is a tradeoff between pricing, host scale, and
        recent demand rather than a simple upward slope. This visualization was
        built with Altair and rendered on the site through Vega-Embed, with
        brushing and linked neighborhood summaries generated from the Altair
        spec.
      </p>
    </div>
    <div class="card">
      <div id="altair-scatter" class="viz-frame viz-altair"></div>
    </div>
  </section>

  <section class="story-block altair-block">
    <div class="story-intro">
      <p class="section-kicker">3. Seasonality</p>
      <h2>Demand and price move together through the year.</h2>
      <p>
        Reviews and asking prices both move seasonally, but not always with the
        same intensity. Looking at the two together makes it easier to see when
        hosts appear to price ahead of demand versus reacting to it after the
        fact. This visualization was built with Altair and rendered through
        Vega-Embed, with Python generating the seasonal price-and-review spec
        from the processed monthly data.
      </p>
    </div>
    <div class="card">
      <div id="altair-seasonal" class="viz-frame viz-altair"></div>
    </div>
  </section>

  <section class="story-block">
    <div class="story-intro">
      <p class="section-kicker">4. Commercialization</p>
      <h2>Expensive neighborhoods are not always the most commercialized.</h2>
      <p>
        Some neighborhoods are expensive because they attract strong travel
        demand, while others look more commercial because they have more
        entire-home inventory and more multi-listing hosts. Ranking those
        measures side by side separates prestige from professionalization. This
        visualization was built with D3 as a sortable horizontal bar chart, with
        D3 controlling the scale updates, bar rendering, and metric switching.
      </p>
    </div>
    <div class="card">
      <div class="controls-row">
        <label>
          Rank by
          <select id="rank-metric"></select>
        </label>
      </div>
      <div id="rank-chart" class="viz-frame viz-bars"></div>
    </div>
  </section>

  <footer class="site-footer">
    <p>
      Data sources: local Inside Airbnb Boston summary files in this repo, plus
      official detailed Boston pricing files from Inside Airbnb dated 15 March
      2025.
    </p>
  </footer>
`;
app.append(page);

const tooltip = d3
  .select('body')
  .append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

const roomTypeOptions = [
  'All',
  'Entire home/apt',
  'Private room',
  'Hotel room',
  'Shared room',
];

Promise.all([
  d3.json(`${dataBase}listing_points.json`),
  d3.json(`${dataBase}neighborhood_summary.json`),
  d3.json(`${dataBase}neighborhood_shapes.geojson`),
  d3.json(`${dataBase}altair_price_demand.json`),
  d3.json(`${dataBase}altair_seasonality.json`),
])
  .then(
    ([
      listingPoints,
      neighborhoodSummary,
      neighborhoodShapes,
      scatterSpec,
      seasonalitySpec,
    ]) => {
      renderHeroStats(listingPoints, neighborhoodSummary);
      renderMap(listingPoints, neighborhoodShapes);
      renderRankChart(neighborhoodSummary);
      renderAltairChart('#altair-scatter', scatterSpec);
      renderAltairChart('#altair-seasonal', seasonalitySpec);
    }
  )
  .catch((error) => {
    console.error(error);
    app.innerHTML = `<main class="page-shell"><p class="error-state">Failed to load site data. Run <code>npm run data</code> first.</p></main>`;
  });

function renderHeroStats(listings, neighborhoods) {
  const stats = [
    {
      label: 'Listings with price',
      value: d3.format(',')(listings.filter((d) => d.price !== null).length),
    },
    {
      label: 'Median nightly price',
      value: money(d3.median(listings, (d) => d.price)),
    },
    {
      label: 'Neighborhoods',
      value: d3.format(',')(neighborhoods.length),
    },
    {
      label: 'Median occupancy',
      value: `${oneDecimal(d3.median(listings, (d) => d.estimated_occupancy_l365d))} nights`,
    },
  ];

  document.querySelector('#hero-stats').innerHTML = stats
    .map(
      (stat) => `
        <div class="stat-tile">
          <span class="stat-value">${stat.value}</span>
          <span class="stat-label">${stat.label}</span>
        </div>
      `
    )
    .join('');
}

async function renderAltairChart(selector, spec) {
  const container = document.querySelector(selector);
  if (!container) {
    return;
  }

  try {
    const { default: embed } = await import('vega-embed');
    await embed(selector, spec, {
      actions: false,
      renderer: 'svg',
    });
  } catch (error) {
    console.error('Altair chart failed to render', error);
    container.innerHTML =
      '<p class="error-state">This Altair chart failed to load. Check the browser console for the runtime error.</p>';
  }
}

function renderMap(listings, geojson) {
  const metricSelect = document.querySelector('#map-metric');
  const roomTypeSelect = document.querySelector('#map-room-type');

  metricSelect.innerHTML = Object.entries(metrics)
    .map(
      ([value, config]) => `<option value="${value}">${config.label}</option>`
    )
    .join('');
  roomTypeSelect.innerHTML = roomTypeOptions
    .map((value) => `<option value="${value}">${value}</option>`)
    .join('');

  const container = document.querySelector('#map-chart');
  const width = container.clientWidth || 960;
  const height = Math.max(540, Math.round(width * 0.62));
  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Boston neighborhood choropleth map');

  const projection = d3.geoMercator().fitSize([width, height], geojson);
  const path = d3.geoPath(projection);
  const group = svg.append('g');

  const features = geojson.features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      neighbourhood: feature.properties.neighbourhood,
    },
  }));

  function computeSummary(roomType) {
    const filtered =
      roomType === 'All'
        ? listings
        : listings.filter((listing) => listing.room_type === roomType);

    const grouped = d3.group(filtered, (d) => d.neighbourhood);
    return new Map(
      Array.from(grouped, ([neighbourhood, rows]) => {
        const priceValues = rows
          .map((d) => d.price)
          .filter((value) => value !== null);
        const occupancyValues = rows
          .map((d) => d.estimated_occupancy_l365d)
          .filter((value) => value !== null);
        const ratingValues = rows
          .map((d) => d.review_scores_rating)
          .filter((value) => value !== null);

        return [
          neighbourhood,
          {
            neighbourhood,
            listing_count: rows.length,
            median_price: priceValues.length ? d3.median(priceValues) : null,
            median_occupancy: occupancyValues.length
              ? d3.median(occupancyValues)
              : null,
            median_rating: ratingValues.length ? d3.median(ratingValues) : null,
            multi_listing_share: rows.length
              ? rows.filter((row) => row.calculated_host_listings_count > 1)
                  .length / rows.length
              : 0,
          },
        ];
      })
    );
  }

  function update() {
    const metricKey = metricSelect.value;
    const roomType = roomTypeSelect.value;
    const metric = metrics[metricKey];
    const summary = computeSummary(roomType);
    const values = Array.from(summary.values())
      .map((d) => metric.value(d))
      .filter((value) => value !== null && !Number.isNaN(value));

    const color = d3
      .scaleSequential()
      .domain(d3.extent(values).reverse())
      .interpolator(d3.interpolateYlOrRd);

    group
      .selectAll('path')
      .data(features)
      .join('path')
      .attr('d', path)
      .attr('class', 'neighborhood-shape')
      .attr('fill', (feature) => {
        const data = summary.get(feature.properties.neighbourhood);
        const value = data ? metric.value(data) : null;
        return value === null || Number.isNaN(value) ? '#e7ddcf' : color(value);
      })
      .on('mouseenter', function handleEnter(event, feature) {
        const data = summary.get(feature.properties.neighbourhood);
        d3.select(this).attr('stroke-width', 2.2);
        tooltip
          .style('opacity', 1)
          .html(
            `
            <strong>${feature.properties.neighbourhood}</strong>
            <span>${metric.label}: ${
              data && metric.value(data) !== null
                ? metric.formatter(metric.value(data))
                : 'N/A'
            }</span>
            <span>Listings: ${data ? d3.format(',')(data.listing_count) : '0'}</span>
            <span>Median occupancy: ${
              data && data.median_occupancy !== null
                ? `${oneDecimal(data.median_occupancy)} nights`
                : 'N/A'
            }</span>
            <span>Median rating: ${
              data && data.median_rating !== null
                ? oneDecimal(data.median_rating)
                : 'N/A'
            }</span>
            <span>Multi-listing host share: ${
              data ? pct(data.multi_listing_share) : 'N/A'
            }</span>
          `
          )
          .style('left', `${event.pageX + 14}px`)
          .style('top', `${event.pageY - 20}px`);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 14}px`)
          .style('top', `${event.pageY - 20}px`);
      })
      .on('mouseleave', function handleLeave() {
        d3.select(this).attr('stroke-width', 1);
        tooltip.style('opacity', 0);
      });
  }

  metricSelect.addEventListener('change', update);
  roomTypeSelect.addEventListener('change', update);
  update();
}

function renderRankChart(summary) {
  const select = document.querySelector('#rank-metric');
  select.innerHTML = Object.entries(rankMetrics)
    .map(
      ([value, config]) => `<option value="${value}">${config.label}</option>`
    )
    .join('');

  const container = document.querySelector('#rank-chart');
  const width = container.clientWidth || 960;
  const margin = { top: 16, right: 16, bottom: 28, left: 170 };
  const innerWidth = width - margin.left - margin.right;
  const barHeight = 26;

  const svg = d3.select(container).append('svg');
  const root = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  function update() {
    const metric = rankMetrics[select.value];
    const sorted = [...summary]
      .filter((d) => metric.value(d) !== null && !Number.isNaN(metric.value(d)))
      .sort((a, b) => d3.descending(metric.value(a), metric.value(b)))
      .slice(0, 15);

    const innerHeight = sorted.length * barHeight;
    svg.attr(
      'viewBox',
      `0 0 ${width} ${innerHeight + margin.top + margin.bottom + 20}`
    );

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(sorted, (d) => metric.value(d))])
      .nice()
      .range([0, innerWidth]);

    const y = d3
      .scaleBand()
      .domain(sorted.map((d) => d.neighbourhood))
      .range([0, innerHeight])
      .padding(0.16);

    root
      .selectAll('.bar-row')
      .data(sorted, (d) => d.neighbourhood)
      .join((enter) => {
        const row = enter.append('g').attr('class', 'bar-row');
        row.append('rect').attr('class', 'bar');
        row.append('text').attr('class', 'bar-label');
        row.append('text').attr('class', 'bar-value');
        return row;
      })
      .attr('transform', (d) => `translate(0,${y(d.neighbourhood)})`)
      .each(function applyRow(d) {
        const row = d3.select(this);
        row
          .select('.bar')
          .attr('height', y.bandwidth())
          .attr('width', x(metric.value(d)))
          .attr('rx', 10)
          .attr('fill', '#cf5f28');
        row
          .select('.bar-label')
          .attr('x', -12)
          .attr('y', y.bandwidth() / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .text(d.neighbourhood);
        row
          .select('.bar-value')
          .attr('x', x(metric.value(d)) + 10)
          .attr('y', y.bandwidth() / 2)
          .attr('dy', '0.35em')
          .text(metric.formatter(metric.value(d)));
      });

    root
      .selectAll('.axis-title')
      .data([metric.label])
      .join('text')
      .attr('class', 'axis-title')
      .attr('x', 0)
      .attr('y', innerHeight + 24)
      .text((d) => d);
  }

  select.addEventListener('change', update);
  update();
}
