import fs from "fs";

const INDICATORS = {
	homicide_rate: "VC.IHR.PSRC.P5",
	internet_users: "IT.NET.USER.ZS",
	sanitation: "SH.STA.SMSS.ZS",
	suicide_rate: "SH.STA.SUIC.P5",
};

const BASE_URL = "https://api.worldbank.org/v2/country/all/indicator";
const OUTPUT_FILE = "qol_data.json";

// Fetch ISO3 → ISO2 mapping
console.log("Fetching country code mapping...");
const countryRes = await fetch("https://api.worldbank.org/v2/country/all?format=json&per_page=300");
const countryJson = await countryRes.json();
const iso3to2 = {};
for (const c of countryJson[1]) {
	iso3to2[c.id] = c.iso2Code;
}
console.log(`  Mapped ${Object.keys(iso3to2).length} country codes\n`);

const results = {};

for (const [key, code] of Object.entries(INDICATORS)) {
	// mrv=5 gets last 5 years, per_page=1500 covers all countries × 5 years
	const url = `${BASE_URL}/${code}?format=json&mrv=5&per_page=1500`;
	console.log(`Fetching ${key} (${code})...`);

	const res = await fetch(url);
	const json = await res.json();
	const data = json[1];

	if (!data) {
		console.log(`  Warning: no data returned for ${key}`);
		continue;
	}

	// Keep only the most recent non-null value per country
	let count = 0;
	for (const entry of data) {
		const iso3 = entry.countryiso3code;
		const iso2 = iso3to2[iso3];
		if (!iso2 || entry.value === null) continue;

		if (!results[iso2]) {
			results[iso2] = {};
		}
		// Only store if we don't have a value yet (data comes newest-first)
		if (results[iso2][key] === undefined) {
			results[iso2][key] = entry.value;
			count++;
		}
	}
	console.log(`  Got data for ${count} countries`);
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
console.log(`\nSaved to ${OUTPUT_FILE} (${Object.keys(results).length} countries)`);