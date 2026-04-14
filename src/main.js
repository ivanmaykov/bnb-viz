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

const boxplotMetrics = {
  price: {
    label: 'Nightly price',
    chartType: 'boxplot',
    accessor: (d) => d.price,
    formatter: money,
  },
  estimated_occupancy_l365d: {
    label: 'Estimated booked days',
    chartType: 'bar',
    summaryKey: 'median_occupancy',
    formatter: (value) => `${oneDecimal(value)} nights`,
  },
  availability_365: {
    label: 'Average availability',
    chartType: 'bar',
    summaryKey: 'average_availability',
    formatter: (value) => `${oneDecimal(value)} days`,
  },
  multi_listing_share: {
    label: 'Multi-listing host share',
    chartType: 'bar',
    summaryKey: 'multi_listing_share',
    formatter: pct,
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
        This project examines Boston’s Airbnb market through the lens of price,
        demand, and neighborhood variation. Rather than treating listings as a
        single citywide market, it asks how local geography, seasonal shifts,
        and host behavior combine to shape very different conditions across the
        city. The result is a story about where pricing power is strongest,
        where activity looks more commercialized, and how those patterns do not
        always move together.
      </p>
    </div>
    <div class="hero-side">
      <div class="hero-image-tile">
        <img
          src="${import.meta.env.BASE_URL}hero-boston.webp"
          alt="Boston street scene with historic brick buildings and outdoor dining"
          class="hero-image"
        />
      </div>
      <aside class="project-tile">
        <p class="project-kicker">Course Project</p>
        <h3>DS4200 Final Project</h3>
        <p class="project-term">Spring 2026</p>
        <p class="project-authors">Ivan Maykov and Mohammed Ibrahim</p>
      </aside>
      <div class="hero-stats" id="hero-stats"></div>
    </div>
  </section>

  <section class="info-panel">
    <p class="section-kicker">Project introduction</p>
    <p>
      Airbnb is one of the clearest places where tourism, housing, and local
      business activity intersect. Boston is especially interesting because its
      neighborhoods serve very different roles: some are dense visitor hubs,
      some are residential, and some sit between those two extremes.
    </p>
    <p>
      That makes the city a useful setting for studying how price, demand, and
      commercialization vary across place. We wanted to understand not just
      where listings are expensive, but whether those prices align with demand,
      how they shift through the year, and whether the most expensive areas are
      also the most professionally operated.
    </p>
  </section>

  <section class="info-panel">
    <p class="section-kicker">Data</p>
    <p>
      This project uses Boston Airbnb data from Inside Airbnb dated 15 March
      2025. After preprocessing, the site draws on 3,706 listing records,
      25 neighborhood summaries, 3,882 monthly review observations, and 169
      monthly pricing observations.
    </p>
    <p>
      The listing-level data includes attributes such as listing ID, nightly
      price, room type, property type, neighborhood, latitude, longitude,
      estimated occupancy, availability, recent reviews, review score, and host
      listing count. The neighborhood-level data adds summary measures such as
      listing count, median price, median occupancy, average availability,
      entire-home share, and multi-listing host share.
    </p>
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
        Price has a real within-neighborhood distribution, but the other
        commercialization measures are better understood as summary rankings.
        Keeping only nightly price as a boxplot avoids overstating precision,
        while the bar views still make neighborhood differences easy to compare.
        This visualization was built with D3, using a listing-level boxplot for
        nightly price and summary bar charts for occupancy, availability, and
        multi-listing host share.
      </p>
    </div>
    <div class="card">
      <div class="controls-row">
        <label>
          Compare by
          <select id="rank-metric"></select>
        </label>
      </div>
      <div id="rank-chart" class="viz-frame viz-bars"></div>
    </div>
  </section>

  <section class="conclusion-section">
    <div class="conclusion-header">
      <p class="section-kicker">Conclusion</p>
      <h2>Summary and Findings</h2>
      <p class="conclusion-lede">
        Across the four visualizations, three consistent themes emerge about
        how Boston’s Airbnb market is structured and where pricing pressure is
        strongest.
      </p>
    </div>

    <div class="finding-grid">
      <article class="finding-card">
        <p class="finding-number">01</p>
        <h3>Price concentrates geographically</h3>
        <p>
          Boston’s Airbnb prices are not evenly distributed. Central and
          visitor-oriented neighborhoods support substantially higher nightly
          prices, while other areas show more inventory than pricing power.
          That means location remains one of the clearest drivers of market
          separation in the city.
        </p>
      </article>

      <article class="finding-card">
        <p class="finding-number">02</p>
        <h3>Higher prices do not guarantee stronger demand</h3>
        <p>
          The scatterplot shows that expensive listings are not automatically
          the most booked. Demand depends on room type, host scale, and recent
          review activity, so price appears to reflect a broader positioning
          strategy rather than a simple payoff from higher occupancy.
        </p>
      </article>

      <article class="finding-card">
        <p class="finding-number">03</p>
        <h3>Commercialization and prestige are not identical</h3>
        <p>
          Some neighborhoods are expensive because they are desirable to
          visitors, while others look more commercial because they have more
          multi-listing hosts or more consistently available inventory. The
          market therefore varies not just in price, but in how professionally
          listings are operated and scaled.
        </p>
      </article>
    </div>

    <div class="future-work-block">
      <h2>Future Work</h2>
      <p>
        One limitation of this analysis is that it focuses on a single Inside
        Airbnb snapshot dated 15 March 2025. A stronger next step would be to
        incorporate multiple snapshots across years so the project can measure
        how neighborhood pricing, host concentration, and seasonal behavior
        change over time rather than treating the market as static.
      </p>
      <p>
        Future work could also connect Airbnb activity to housing, tourism,
        university calendars, or event data to better explain why certain
        neighborhoods become more expensive or more commercialized than others.
        That would move the project from description toward causal explanation.
      </p>
    </div>
  </section>

  <footer class="site-footer">
    <p>
      Data sources: Inside Airbnb, dated 15 March 2025, insideairbnb.com.
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
      renderRankChart(listingPoints, neighborhoodSummary);
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
      label: 'Typical occupancy',
      value: d3.format(',')(
        Math.round(d3.median(listings, (d) => d.estimated_occupancy_l365d))
      ),
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
      theme: 'none',
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
      .domain(d3.extent(values))
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

function renderRankChart(listings, neighborhoodSummary) {
  const select = document.querySelector('#rank-metric');
  select.innerHTML = Object.entries(boxplotMetrics)
    .map(
      ([value, config]) => `<option value="${value}">${config.label}</option>`
    )
    .join('');

  const container = document.querySelector('#rank-chart');
  const width = container.clientWidth || 960;
  const margin = { top: 16, right: 48, bottom: 52, left: 250 };
  const rowHeight = 30;

  const svg = d3.select(container).append('svg');
  const root = svg.append('g');

  const barColor = '#cf5f28';
  const lineColor = '#9b3e10';
  const gridColor = '#d8d0c4';

  function clearChartLayers() {
    root.selectAll('.boxplot-row').remove();
    root.selectAll('.outlier-group').remove();
    root.selectAll('.bar-row').remove();
  }

  function renderBoxplot(metric, innerWidth) {
    const grouped = d3.group(
      listings.filter((d) => {
        const value = metric.accessor(d);
        return value !== null && !Number.isNaN(value);
      }),
      (d) => d.neighbourhood
    );

    const stats = Array.from(grouped, ([neighbourhood, rows]) => {
      const values = rows
        .map(metric.accessor)
        .filter((value) => value !== null && !Number.isNaN(value))
        .sort(d3.ascending);
      if (!values.length) {
        return null;
      }

      const q1 = d3.quantileSorted(values, 0.25);
      const median = d3.quantileSorted(values, 0.5);
      const q3 = d3.quantileSorted(values, 0.75);
      const lowerWhisker = d3.quantileSorted(values, 0.1);
      const upperWhisker = d3.quantileSorted(values, 0.9);
      const outliers = values.filter(
        (value) => value < lowerWhisker || value > upperWhisker
      );

      return {
        neighbourhood,
        q1,
        median,
        q3,
        min: lowerWhisker,
        max: upperWhisker,
        outliers,
      };
    })
      .filter(Boolean)
      .sort((a, b) => d3.descending(a.median, b.median))
      .slice(0, 15);

    const innerHeight = stats.length * rowHeight;
    svg.attr(
      'viewBox',
      `0 0 ${width} ${innerHeight + margin.top + margin.bottom + 20}`
    );
    root.attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(stats, (d) => d3.max([d.max, ...d.outliers])) ?? 0])
      .nice()
      .range([0, innerWidth]);

    const y = d3
      .scaleBand()
      .domain(stats.map((d) => d.neighbourhood))
      .range([0, innerHeight])
      .padding(0.28);

    root
      .selectAll('.boxplot-row')
      .data(stats, (d) => d.neighbourhood)
      .join((enter) => {
        const row = enter.append('g').attr('class', 'boxplot-row');
        row.append('line').attr('class', 'whisker-line');
        row.append('line').attr('class', 'whisker-cap whisker-cap-min');
        row.append('line').attr('class', 'whisker-cap whisker-cap-max');
        row.append('rect').attr('class', 'boxplot-box');
        row.append('line').attr('class', 'boxplot-median');
        row.append('text').attr('class', 'bar-label');
        return row;
      })
      .attr('transform', (d) => `translate(0,${y(d.neighbourhood)})`)
      .each(function applyRow(d) {
        const row = d3.select(this);
        const midY = y.bandwidth() / 2;
        const boxHeight = Math.max(14, y.bandwidth() * 0.62);
        const capHeight = Math.max(10, y.bandwidth() * 0.4);

        row
          .select('.whisker-line')
          .attr('x1', x(d.min))
          .attr('x2', x(d.max))
          .attr('y1', midY)
          .attr('y2', midY)
          .attr('stroke', lineColor)
          .attr('stroke-width', 2);
        row
          .select('.whisker-cap-min')
          .attr('x1', x(d.min))
          .attr('x2', x(d.min))
          .attr('y1', midY - capHeight / 2)
          .attr('y2', midY + capHeight / 2)
          .attr('stroke', lineColor)
          .attr('stroke-width', 2);
        row
          .select('.whisker-cap-max')
          .attr('x1', x(d.max))
          .attr('x2', x(d.max))
          .attr('y1', midY - capHeight / 2)
          .attr('y2', midY + capHeight / 2)
          .attr('stroke', lineColor)
          .attr('stroke-width', 2);
        row
          .select('.boxplot-box')
          .attr('x', x(d.q1))
          .attr('y', midY - boxHeight / 2)
          .attr('width', Math.max(2, x(d.q3) - x(d.q1)))
          .attr('height', boxHeight)
          .attr('rx', 0)
          .attr('fill', barColor);
        row
          .select('.boxplot-median')
          .attr('x1', x(d.median))
          .attr('x2', x(d.median))
          .attr('y1', midY - boxHeight / 2)
          .attr('y2', midY + boxHeight / 2)
          .attr('stroke', '#fff7ef')
          .attr('stroke-width', 3);
        row
          .select('.bar-label')
          .attr('x', -12)
          .attr('y', midY)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .text(d.neighbourhood);
      });

    root
      .selectAll('.outlier-group')
      .data(stats, (d) => d.neighbourhood)
      .join((enter) => enter.append('g').attr('class', 'outlier-group'))
      .attr('transform', (d) => `translate(0,${y(d.neighbourhood)})`)
      .each(function applyOutliers(d) {
        const group = d3.select(this);
        const midY = y.bandwidth() / 2;
        group
          .selectAll('.outlier-dot')
          .data(d.outliers)
          .join('circle')
          .attr('class', 'outlier-dot')
          .attr('cx', (value) => x(value))
          .attr('cy', midY)
          .attr('r', 3.2)
          .attr('fill', lineColor)
          .attr('opacity', 0.82);
      });

    return { innerHeight, x, label: metric.label };
  }

  function renderBars(metric, innerWidth) {
    const rows = neighborhoodSummary
      .filter(
        (d) =>
          d[metric.summaryKey] !== null && !Number.isNaN(d[metric.summaryKey])
      )
      .map((d) => ({
        neighbourhood: d.neighbourhood,
        value: d[metric.summaryKey],
      }))
      .sort((a, b) => d3.descending(a.value, b.value))
      .slice(0, 15);

    const innerHeight = rows.length * rowHeight;
    svg.attr(
      'viewBox',
      `0 0 ${width} ${innerHeight + margin.top + margin.bottom + 20}`
    );
    root.attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.value) ?? 0])
      .nice()
      .range([0, innerWidth]);

    const y = d3
      .scaleBand()
      .domain(rows.map((d) => d.neighbourhood))
      .range([0, innerHeight])
      .padding(0.22);

    root
      .selectAll('.bar-row')
      .data(rows, (d) => d.neighbourhood)
      .join((enter) => {
        const row = enter.append('g').attr('class', 'bar-row');
        row.append('rect').attr('class', 'metric-bar');
        row.append('text').attr('class', 'bar-label');
        row.append('text').attr('class', 'bar-value');
        return row;
      })
      .attr('transform', (d) => `translate(0,${y(d.neighbourhood)})`)
      .each(function applyRow(d) {
        const row = d3.select(this);
        const barHeight = y.bandwidth();
        const midY = barHeight / 2;
        const barEnd = x(d.value);
        const labelText = metric.formatter(d.value);
        const fitsOutside = barEnd <= innerWidth - 96;

        row
          .select('.metric-bar')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', barEnd)
          .attr('height', barHeight)
          .attr('fill', barColor);
        row
          .select('.bar-label')
          .attr('x', -12)
          .attr('y', midY)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .text(d.neighbourhood);
        row
          .select('.bar-value')
          .attr('x', fitsOutside ? barEnd + 8 : Math.max(8, barEnd - 8))
          .attr('y', midY)
          .attr('dy', '0.35em')
          .attr('text-anchor', fitsOutside ? 'start' : 'end')
          .text(labelText);
      });

    return { innerHeight, x, label: metric.label };
  }

  function update() {
    const metric = boxplotMetrics[select.value];
    const innerWidth = width - margin.left - margin.right;
    clearChartLayers();

    const chartState =
      metric.chartType === 'boxplot'
        ? renderBoxplot(metric, innerWidth)
        : renderBars(metric, innerWidth);

    root
      .selectAll('.boxplot-grid')
      .data(chartState.x.ticks(6))
      .join('line')
      .attr('class', 'boxplot-grid')
      .attr('x1', (d) => chartState.x(d))
      .attr('x2', (d) => chartState.x(d))
      .attr('y1', 0)
      .attr('y2', chartState.innerHeight)
      .attr('stroke', gridColor)
      .attr('stroke-width', 1);

    root
      .selectAll('.boxplot-axis')
      .data([null])
      .join('g')
      .attr('class', 'boxplot-axis')
      .attr('transform', `translate(0,${chartState.innerHeight})`)
      .call(d3.axisBottom(chartState.x).ticks(6));

    root
      .selectAll('.axis-title')
      .data([chartState.label])
      .join('text')
      .attr('class', 'axis-title')
      .attr('x', innerWidth / 2)
      .attr('y', chartState.innerHeight + 42)
      .attr('text-anchor', 'middle')
      .text((d) => d);
  }

  select.addEventListener('change', update);
  update();
}
