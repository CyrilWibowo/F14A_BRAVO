import { fetchWeatherApi } from "openmeteo";
import { CAPITALS } from "./capitals.js";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const PROGRESS_FILE = "scraper_progress.json";
const OUTPUT_FILE = "raw_data.json";
const DAILY_CAP = 75;
const HOURLY_CAP = 35;
const DELAY_MS = 18_000;

// Load progress (set of already-fetched country codes)
let progress = new Set();
if (fs.existsSync(PROGRESS_FILE)) {
	progress = new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")));
	console.log(`Resuming — ${progress.size} capitals already fetched, ${CAPITALS.length - progress.size} remaining`);
}

// Load existing data
let results = [];
if (fs.existsSync(OUTPUT_FILE)) {
	try {
		results = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
		console.log(`Loaded ${results.length} existing records from ${OUTPUT_FILE}`);
	} catch {
		console.log(`Warning: ${OUTPUT_FILE} was invalid JSON, starting fresh`);
	}
}

const remaining = CAPITALS.filter(c => !progress.has(c.countryCode));
const batch = remaining.slice(0, DAILY_CAP);

console.log(`Fetching ${batch.length} capitals this run (daily cap: ${DAILY_CAP})`);

let hourlyCount = 0;
let hourStart = Date.now();

for (let i = 0; i < batch.length; i++) {
	// If we've hit the hourly cap, wait for the hour to reset
	if (hourlyCount >= HOURLY_CAP) {
		const elapsed = Date.now() - hourStart;
		const waitMs = 3_600_000 - elapsed + 5_000;
		if (waitMs > 0) {
			console.log(`\n  Hourly cap reached (${HOURLY_CAP}). Waiting ${Math.ceil(waitMs / 60_000)} min for reset...`);
			await sleep(waitMs);
		}
		hourlyCount = 0;
		hourStart = Date.now();
	}

	const { country, countryCode, capital, lat, lon } = batch[i];
	console.log(`[${i + 1}/${batch.length}] ${capital} (${countryCode})`);

	const params = {
		latitude: lat,
		longitude: lon,
		start_date: "2016-01-01",
		end_date: "2026-01-01",
		daily: ["precipitation_sum", "wind_speed_10m_max", "daylight_duration", "temperature_2m_mean", "relative_humidity_2m_mean"],
	};
	const url = "https://archive-api.open-meteo.com/v1/archive";

	let responses;
	try {
		responses = await fetchWeatherApi(url, params);
	} catch (e) {
		console.log(`Error fetching ${capital}: ${e.message}`);
		console.log("Stopping to avoid further rate limit issues.");
		break;
	}

	const response = responses[0];
	const daily = response.daily();

	const timeStart = Number(daily.time());
	const timeEnd = Number(daily.timeEnd());
	const interval = daily.interval();
	const count = (timeEnd - timeStart) / interval;

	const record = {
		country,
		country_code: countryCode,
		capital,
		latitude: lat,
		longitude: lon,
		daily: {
			time: Array.from(
				{ length: count },
				(_, j) => {
					const d = new Date((timeStart + j * interval) * 1000);
					return d.toISOString().split("T")[0];
				}
			),
			precipitation_sum: Array.from(daily.variables(0).valuesArray()),
			wind_speed_10m_max: Array.from(daily.variables(1).valuesArray()),
			daylight_duration: Array.from(daily.variables(2).valuesArray()),
			temperature_2m_mean: Array.from(daily.variables(3).valuesArray()),
			relative_humidity_2m_mean: Array.from(daily.variables(4).valuesArray()),
		}
	};

	results.push(record);
	progress.add(countryCode);
	hourlyCount++;

	// Save after every fetch so no data is lost if the script stops
	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
	fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...progress]));

	console.log(`  ✓ Saved (${progress.size}/${CAPITALS.length} total) [${hourlyCount}/${HOURLY_CAP} this hour]`);

	if (i < batch.length - 1 && hourlyCount < HOURLY_CAP) {
		await sleep(DELAY_MS);
	}
}

console.log(`\nDone. ${progress.size}/${CAPITALS.length} capitals fetched so far.`);
if (progress.size < CAPITALS.length) {
	console.log(`Run this script again to fetch the next batch.`);
}