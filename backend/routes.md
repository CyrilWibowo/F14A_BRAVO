# API Routes

Base URL: `http://localhost:5005`

---

## POST /process

Ingest and process climate data for a location. Normalises raw daily data (removes outliers, handles missing values), computes overall scores, seasonal breakdowns, and monthly averages, then stores the result in the database.

**Body**
```json
{
  "country": "string",
  "country_code": "string",
  "capital": "string (optional)",
  "latitude": "number",
  "longitude": "number",
  "daily": {
    "time": ["YYYY-MM-DD"],
    "temperature_2m_mean": [number],
    "relative_humidity_2m_mean": [number],
    "precipitation_sum": [number],
    "wind_speed_10m_max": [number],
    "uv_index_max": [number]
  }
}
```

**Response**
```json
{
  "country_code": "AUS",
  "liveability": 72.4,
  "comfort_index": 68.1,
  "uv_risk": "very_high",
  "uv_index_mean": 9.2,
  "temperature_mean": 21.3,
  "humidity_mean": 54.0,
  "precipitation_mean": 2.1,
  "wind_speed_mean": 14.5
}
```

---

## GET /score

Get the stored scores for a single country.

**Query params**
- `country_code` (required) — ISO 3-letter code e.g. `AUS`

**Response**
```json
{
  "country_code": "AUS",
  "country": "Australia",
  "capital": "Canberra",
  "latitude": -25.3,
  "longitude": 133.8,
  "processed_at": "2025-01-01T00:00:00.000Z",
  "liveability": 72.4,
  "comfort_index": 68.1,
  "uv_risk": "very_high",
  "uv_index_mean": 9.2,
  "temperature_mean": 21.3,
  "humidity_mean": 54.0,
  "precipitation_mean": 2.1,
  "wind_speed_mean": 14.5
}
```

---

## GET /score/ranking

Get all countries sorted by liveability score. Optionally filter by score range or geographic bounding box.

**Query params** (all optional)
- `min_score` — minimum liveability score
- `max_score` — maximum liveability score
- `min_lat`, `max_lat`, `min_lon`, `max_lon` — geographic bounding box (all four required together)

**Response**
```json
{
  "results": [
    {
      "country_code": "AUS",
      "country": "Australia",
      "capital": "Canberra",
      "latitude": -25.3,
      "longitude": 133.8,
      "liveability": 72.4,
      "comfort_index": 68.1,
      "uv_risk": "very_high",
      "uv_index_mean": 9.2,
      "temperature_mean": 21.3,
      "humidity_mean": 54.0,
      "precipitation_mean": 2.1,
      "wind_speed_mean": 14.5
    }
  ]
}
```

---

## GET /score/compare

Compare scores for up to 20 countries, returned sorted by liveability descending. Countries not found return an error field instead of scores.

**Query params**
- `codes` (required) — comma-separated country codes e.g. `AUS,NZL,CAN`

**Response**
```json
{
  "results": [
    {
      "country_code": "NZL",
      "country": "New Zealand",
      "capital": "Wellington",
      "liveability": 78.1,
      "comfort_index": 74.3,
      ...
    },
    {
      "country_code": "BAD",
      "error": "No data found"
    }
  ]
}
```

---

## GET /score/seasonal

Get per-season score breakdowns for a country. Hemisphere is derived from latitude (northern/southern). Seasons with insufficient data return `null`.

**Query params**
- `country_code` (required)

**Response**
```json
{
  "country_code": "AUS",
  "country": "Australia",
  "capital": "Canberra",
  "seasonal": {
    "spring": { "liveability": 80.1, "comfort_index": 75.0, "temperature_mean": 18.2, ... },
    "summer": { "liveability": 55.3, ... },
    "autumn": { "liveability": 78.9, ... },
    "winter": { "liveability": 70.2, ... }
  }
}
```

---

## GET /score/monthly

Get monthly average climate values for a country (Jan–Dec).

**Query params**
- `country_code` (required)

**Response**
```json
{
  "country_code": "AUS",
  "country": "Australia",
  "capital": "Canberra",
  "monthly": [
    { "month": "Jan", "temp": 25.1, "humidity": 48.3, "precipitation": 3.2, "wind": 16.1, "uv": 10.4 },
    { "month": "Feb", "temp": 24.8, ... },
    ...
  ]
}
```
