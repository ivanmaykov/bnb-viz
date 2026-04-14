from __future__ import annotations

import csv
import gzip
import json
import math
import os
import re
import shutil
import urllib.request
from collections import defaultdict
from pathlib import Path
from statistics import median

import altair as alt

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA_DIR = ROOT / 'public' / 'data'
OFFICIAL_DIR = ROOT / 'data' / 'raw' / 'official'

OFFICIAL_FILES = {
    'listings.csv.gz': 'https://data.insideairbnb.com/united-states/ma/boston/2025-03-15/data/listings.csv.gz',
    'calendar.csv.gz': 'https://data.insideairbnb.com/united-states/ma/boston/2025-03-15/data/calendar.csv.gz',
}

TOP_NEIGHBORHOODS = 8
CHART_BACKGROUND = '#fff7ef'


def parse_money(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = re.sub(r'[^0-9.\-]', '', value)
    if cleaned in {'', '-', '.', '-.'}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_float(value: str | None) -> float | None:
    if value in (None, ''):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_int(value: str | None) -> int | None:
    if value in (None, ''):
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def round_or_none(value: float | None, digits: int = 2) -> float | None:
    return None if value is None or math.isnan(value) else round(value, digits)


def median_or_none(values: list[float]) -> float | None:
    return None if not values else round_or_none(median(values))


def month_key(date_str: str) -> str:
    return date_str[:7]


def ensure_official_files() -> None:
    OFFICIAL_DIR.mkdir(parents=True, exist_ok=True)
    should_fetch = os.getenv('FETCH_INSIDE_AIRBNB') == '1'

    for filename, url in OFFICIAL_FILES.items():
        destination = OFFICIAL_DIR / filename
        if destination.exists():
            continue
        if not should_fetch:
            raise SystemExit(
                f'Missing {destination}. Run `npm run data:fetch` or place the official file there.'
            )

        print(f'Downloading {filename} from {url}')
        with urllib.request.urlopen(url) as response, destination.open('wb') as output:
            shutil.copyfileobj(response, output)


def load_local_listings() -> tuple[list[dict], dict[str, dict]]:
    listings = []
    by_id = {}
    path = ROOT / 'listings.csv'
    with path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            listing_id = row['id']
            listing = {
                'id': listing_id,
                'name': row['name'],
                'neighbourhood': row['neighbourhood_cleansed'],
                'latitude': parse_float(row['latitude']),
                'longitude': parse_float(row['longitude']),
                'room_type': row['room_type'],
                'property_type': row['property_type'],
                'availability_365': parse_int(row['availability_365']),
                'number_of_reviews_ltm': parse_int(row['number_of_reviews_ltm']),
                'estimated_occupancy_l365d': parse_float(row['estimated_occupancy_l365d']),
                'review_scores_rating': parse_float(row['review_scores_rating']),
                'calculated_host_listings_count': parse_int(row['calculated_host_listings_count']),
                'host_is_superhost': row['host_is_superhost'] == 't',
            }
            listings.append(listing)
            by_id[listing_id] = listing
    return listings, by_id


def enrich_with_official_prices(local_by_id: dict[str, dict]) -> int:
    matched = 0
    path = OFFICIAL_DIR / 'listings.csv.gz'
    with gzip.open(path, 'rt', newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            listing = local_by_id.get(row['id'])
            if not listing:
                continue
            listing['price'] = parse_money(row.get('price'))
            matched += 1
    return matched


def enrich_reviews_monthly(local_by_id: dict[str, dict]) -> list[dict]:
    month_counts = defaultdict(int)
    path = ROOT / 'reviews.csv'
    with path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            listing = local_by_id.get(row['listing_id'])
            if not listing:
                continue
            month = month_key(row['date'])
            neighborhood = listing['neighbourhood']
            room_type = listing['room_type']
            month_counts[(month, 'all', 'All')] += 1
            month_counts[(month, 'room_type', room_type)] += 1
            month_counts[(month, 'neighbourhood', neighborhood)] += 1

    records = []
    for (month, segment_type, segment), review_count in sorted(month_counts.items()):
        records.append(
            {
                'month': month,
                'segment_type': segment_type,
                'segment': segment,
                'review_count': review_count,
            }
        )
    return records


def build_pricing_monthly(
    local_by_id: dict[str, dict], top_neighborhoods: set[str]
) -> tuple[list[dict], dict[str, float]]:
    aggregates = defaultdict(list)
    listing_prices = defaultdict(list)
    path = OFFICIAL_DIR / 'calendar.csv.gz'
    with gzip.open(path, 'rt', newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            listing = local_by_id.get(row['listing_id'])
            if not listing:
                continue
            if row.get('available') != 't':
                continue
            price = parse_money(row.get('price') or row.get('adjusted_price'))
            if price is None:
                continue
            month = month_key(row['date'])
            room_type = listing['room_type']
            neighborhood = listing['neighbourhood']
            listing_prices[row['listing_id']].append(price)
            aggregates[(month, 'all', 'All')].append(price)
            aggregates[(month, 'room_type', room_type)].append(price)
            if neighborhood in top_neighborhoods:
                aggregates[(month, 'neighbourhood', neighborhood)].append(price)

    records = []
    for (month, segment_type, segment), prices in sorted(aggregates.items()):
        records.append(
            {
                'month': month,
                'segment_type': segment_type,
                'segment': segment,
                'median_price': round_or_none(median(prices)),
                'mean_price': round_or_none(sum(prices) / len(prices)),
                'sample_size': len(prices),
            }
        )
    listing_price_medians = {
        listing_id: round_or_none(median(prices))
        for listing_id, prices in listing_prices.items()
    }
    return records, listing_price_medians


def build_neighborhood_summary(listings: list[dict]) -> list[dict]:
    grouped = defaultdict(list)
    for listing in listings:
        grouped[listing['neighbourhood']].append(listing)

    summary = []
    for neighborhood, rows in grouped.items():
        prices = [row['price'] for row in rows if row.get('price') is not None]
        occupancies = [
            row['estimated_occupancy_l365d']
            for row in rows
            if row.get('estimated_occupancy_l365d') is not None
        ]
        ratings = [row['review_scores_rating'] for row in rows if row.get('review_scores_rating') is not None]
        availability = [row['availability_365'] for row in rows if row.get('availability_365') is not None]
        summary.append(
            {
                'neighbourhood': neighborhood,
                'listing_count': len(rows),
                'median_price': median_or_none(prices),
                'median_occupancy': median_or_none(occupancies),
                'median_rating': median_or_none(ratings),
                'average_availability': round_or_none(sum(availability) / len(availability))
                if availability
                else None,
                'multi_listing_share': round_or_none(
                    sum(1 for row in rows if (row.get('calculated_host_listings_count') or 0) > 1) / len(rows),
                    4,
                ),
                'entire_home_share': round_or_none(
                    sum(1 for row in rows if row['room_type'] == 'Entire home/apt') / len(rows),
                    4,
                ),
            }
        )
    return sorted(summary, key=lambda row: row['listing_count'], reverse=True)


def build_listing_points(listings: list[dict]) -> list[dict]:
    points = []
    for listing in listings:
        points.append(
            {
                'id': listing['id'],
                'name': listing['name'],
                'neighbourhood': listing['neighbourhood'],
                'latitude': listing['latitude'],
                'longitude': listing['longitude'],
                'room_type': listing['room_type'],
                'property_type': listing['property_type'],
                'price': round_or_none(listing.get('price')),
                'availability_365': listing.get('availability_365'),
                'number_of_reviews_ltm': listing.get('number_of_reviews_ltm'),
                'estimated_occupancy_l365d': round_or_none(listing.get('estimated_occupancy_l365d')),
                'review_scores_rating': round_or_none(listing.get('review_scores_rating')),
                'calculated_host_listings_count': listing.get('calculated_host_listings_count'),
                'host_is_superhost': listing.get('host_is_superhost', False),
            }
        )
    return points


def build_neighborhood_shapes(summary_by_neighborhood: dict[str, dict]) -> dict:
    path = ROOT / 'neighbourhoods.geojson'
    data = json.loads(path.read_text(encoding='utf-8'))
    for feature in data['features']:
        neighborhood = feature['properties']['neighbourhood']
        feature['properties'].update(summary_by_neighborhood.get(neighborhood, {}))
    return data


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding='utf-8')


def build_price_demand_spec(listing_points: list[dict]) -> dict:
    brush = alt.selection_interval(encodings=['x', 'y'])
    room_type = alt.selection_point(fields=['room_type'], bind='legend')
    data = alt.Data(url='data/listing_points.json')

    scatter = (
        alt.Chart(data)
        .transform_filter('datum.price != null && datum.estimated_occupancy_l365d != null')
        .mark_circle(opacity=0.72, stroke='white', strokeWidth=0.3)
        .encode(
            x=alt.X('price:Q', title='Nightly price ($)', scale=alt.Scale(zero=False)),
            y=alt.Y(
                'estimated_occupancy_l365d:Q',
                title='Estimated booked days (last 365)',
                scale=alt.Scale(zero=False),
            ),
            color=alt.condition(
                room_type,
                alt.Color(
                    'room_type:N',
                    title='Room type',
                    legend=alt.Legend(
                        orient='bottom',
                        direction='horizontal',
                        columns=4,
                        titleLimit=180,
                        labelLimit=180,
                    ),
                ),
                alt.value('#d8b59a'),
            ),
            size=alt.Size(
                'number_of_reviews_ltm:Q',
                title='12-mo reviews',
                legend=alt.Legend(
                    orient='bottom',
                    direction='horizontal',
                    titleLimit=140,
                    labelLimit=120,
                ),
            ),
            tooltip=[
                alt.Tooltip('name:N', title='Listing'),
                alt.Tooltip('neighbourhood:N', title='Neighborhood'),
                alt.Tooltip('room_type:N', title='Room type'),
                alt.Tooltip('price:Q', title='Nightly price', format='$,.0f'),
                alt.Tooltip(
                    'estimated_occupancy_l365d:Q',
                    title='Estimated occupancy',
                    format='.1f',
                ),
                alt.Tooltip('calculated_host_listings_count:Q', title='Host listings'),
            ],
        )
        .properties(width=600, height=380)
        .add_params(brush, room_type)
    )

    bars = (
        alt.Chart(data)
        .transform_filter('datum.price != null && datum.estimated_occupancy_l365d != null')
        .transform_filter(room_type)
        .transform_filter(brush)
        .transform_aggregate(selected_count='count()', groupby=['neighbourhood'])
        .transform_window(rank='rank(selected_count)', sort=[alt.SortField('selected_count', order='descending')])
        .transform_filter('datum.rank <= 10')
        .mark_bar(color='#cf5f28', cornerRadiusEnd=3)
        .encode(
            x=alt.X('selected_count:Q', title='Selected listings'),
            y=alt.Y('neighbourhood:N', sort='-x', title='Neighborhood'),
            tooltip=[
                alt.Tooltip('neighbourhood:N', title='Neighborhood'),
                alt.Tooltip('selected_count:Q', title='Selected listings'),
            ],
        )
        .properties(width=600, height=225)
    )

    spec = (
        alt.vconcat(scatter, bars, spacing=18)
        .resolve_scale(size='independent')
        .configure_view(stroke=None, fill=CHART_BACKGROUND)
        .configure_axis(
            labelFontSize=14,
            titleFontSize=16,
            gridColor='#d8d0c4',
        )
        .configure_legend(
            labelFontSize=13,
            titleFontSize=15,
            symbolSize=130,
        )
    )
    spec_dict = spec.to_dict()
    spec_dict['background'] = CHART_BACKGROUND
    return spec_dict


def build_seasonality_spec(reviews_monthly: list[dict], pricing_monthly: list[dict], top_neighborhoods: set[str]) -> dict:
    valid_months = {
        row['month']
        for row in pricing_monthly
        if row['median_price'] is not None
    }
    price_lookup = {
        (row['month'], row['segment_type'], row['segment']): row['median_price']
        for row in pricing_monthly
        if row['median_price'] is not None
    }

    rows = []
    for review in reviews_monthly:
        if review['month'] not in valid_months:
            continue
        key = (review['month'], review['segment_type'], review['segment'])
        median_price_value = price_lookup.get(key)
        if review['segment_type'] == 'neighbourhood' and review['segment'] not in top_neighborhoods:
            continue
        rows.append(
            {
                'month': review['month'],
                'segment_type': review['segment_type'],
                'segment': review['segment'],
                'review_count': review['review_count'],
                'median_price': median_price_value,
            }
        )

    segment_options = ['All', 'Entire home/apt', 'Private room', 'Hotel room']
    neighborhood_options = ['All', *sorted(top_neighborhoods)]

    room_param = alt.param(
        name='roomFilter',
        bind=alt.binding_select(options=segment_options, name='Room type '),
        value='All',
    )
    neighborhood_param = alt.param(
        name='neighborhoodFilter',
        bind=alt.binding_select(options=neighborhood_options, name='Neighborhood '),
        value='All',
    )

    base = (
        alt.Chart(alt.Data(values=rows))
        .transform_calculate(
            active_series="""
              neighborhoodFilter !== 'All'
                ? datum.segment_type === 'neighbourhood' && datum.segment === neighborhoodFilter
                : roomFilter !== 'All'
                  ? datum.segment_type === 'room_type' && datum.segment === roomFilter
                  : datum.segment_type === 'all'
            """,
            month_date="toDate(datum.month + '-01')",
        )
        .transform_filter('datum.active_series')
        .add_params(room_param, neighborhood_param)
    )

    review_line = (
        base
        .mark_line(color='#2e728f', point=True)
        .encode(
            x=alt.X('month_date:T', title='Month'),
            y=alt.Y('review_count:Q', title='Monthly reviews'),
            tooltip=[
                alt.Tooltip('month:N', title='Month'),
                alt.Tooltip('segment:N', title='Series'),
                alt.Tooltip('review_count:Q', title='Reviews'),
            ],
        )
        .properties(width=630, height=210, title='Reviews by month')
    )

    price_line = (
        base.transform_filter("datum.median_price != null")
        .mark_line(color='#cf5f28', point=True)
        .encode(
            x=alt.X('month_date:T', title='Month'),
            y=alt.Y('median_price:Q', title='Median available nightly price'),
            tooltip=[
                alt.Tooltip('month:N', title='Month'),
                alt.Tooltip('segment:N', title='Series'),
                alt.Tooltip('median_price:Q', title='Median price', format='$,.0f'),
            ],
        )
        .properties(width=630, height=210, title='Median price by month')
    )

    spec = (
        alt.vconcat(review_line, price_line, spacing=20)
        .configure_view(stroke=None, fill=CHART_BACKGROUND)
        .configure_axis(
            labelFontSize=14,
            titleFontSize=15,
            gridColor='#d8d0c4',
        )
        .configure_legend(
            labelFontSize=14,
            titleFontSize=15,
        )
    )
    spec_dict = spec.to_dict()
    spec_dict['background'] = CHART_BACKGROUND
    return spec_dict


def main() -> None:
    alt.data_transformers.disable_max_rows()
    ensure_official_files()
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    listings, local_by_id = load_local_listings()
    matched_count = enrich_with_official_prices(local_by_id)
    neighborhood_summary = build_neighborhood_summary(listings)
    summary_by_neighborhood = {
        row['neighbourhood']: row for row in neighborhood_summary
    }
    top_neighborhoods = {
        row['neighbourhood'] for row in neighborhood_summary[:TOP_NEIGHBORHOODS]
    }
    reviews_monthly = enrich_reviews_monthly(local_by_id)
    pricing_monthly, calendar_listing_medians = build_pricing_monthly(
        local_by_id, top_neighborhoods
    )
    for listing in listings:
        if listing.get('price') is None:
            listing['price'] = calendar_listing_medians.get(listing['id'])

    listing_points = build_listing_points(listings)
    price_coverage = sum(1 for listing in listing_points if listing['price'] is not None)
    if price_coverage == 0:
        raise SystemExit('No price coverage found after official price enrichment.')

    neighborhood_summary = build_neighborhood_summary(listings)
    summary_by_neighborhood = {
        row['neighbourhood']: row for row in neighborhood_summary
    }
    neighborhood_shapes = build_neighborhood_shapes(summary_by_neighborhood)
    scatter_spec = build_price_demand_spec(listing_points)
    seasonality_spec = build_seasonality_spec(
        reviews_monthly, pricing_monthly, top_neighborhoods
    )

    write_json(PUBLIC_DATA_DIR / 'listing_points.json', listing_points)
    write_json(PUBLIC_DATA_DIR / 'neighborhood_summary.json', neighborhood_summary)
    write_json(PUBLIC_DATA_DIR / 'reviews_monthly.json', reviews_monthly)
    write_json(PUBLIC_DATA_DIR / 'pricing_monthly.json', pricing_monthly)
    write_json(PUBLIC_DATA_DIR / 'neighborhood_shapes.geojson', neighborhood_shapes)
    write_json(PUBLIC_DATA_DIR / 'altair_price_demand.json', scatter_spec)
    write_json(PUBLIC_DATA_DIR / 'altair_seasonality.json', seasonality_spec)

    print(
        json.dumps(
            {
                'matched_official_rows': matched_count,
                'listing_points': len(listing_points),
                'price_coverage': price_coverage,
                'neighborhoods': len(neighborhood_summary),
            },
            indent=2,
        )
    )


if __name__ == '__main__':
    main()
