import fs from "fs";

const qol = JSON.parse(fs.readFileSync("qol_data.json", "utf-8"));
const rawText = fs.readFileSync("../../raw_data.json", "utf-8").replace(/^\uFEFF/, "");
const raw = JSON.parse(rawText);
const codes = raw.map(r => r.country_code);

let full = 0, partial = 0, missing = 0;
const gaps = [];

for (const code of codes) {
	const d = qol[code];
	if (!d) {
		missing++;
		gaps.push(`${code} (no data)`);
		continue;
	}
	const nullKeys = Object.entries(d)
		.filter(([_k, v]) => v === null || v === undefined)
		.map(([k]) => k);
	if (nullKeys.length === 0) {
		full++;
	} else {
		partial++;
		gaps.push(`${code} missing: ${nullKeys.join(", ")}`);
	}
}

console.log(`Full QoL data: ${full}/${codes.length}`);
console.log(`Partial: ${partial}`);
console.log(`Missing entirely: ${missing}`);
if (gaps.length) {
	console.log("\nGaps:");
	gaps.forEach(g => console.log("  " + g));
}