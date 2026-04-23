// ISO 3166-1 alpha-3 to alpha-2 mapping

// ISO alpha-2 → FIPS 10-4 (only entries where they differ)
// GDELT / CORE5 uses FIPS codes, not ISO codes
const ISO2_TO_FIPS = {
  AD: 'AN', // Andorra
  AG: 'AC', // Antigua and Barbuda
  AT: 'AU', // Austria
  AU: 'AS', // Australia
  AZ: 'AJ', // Azerbaijan
  BA: 'BK', // Bosnia and Herzegovina
  BD: 'BG', // Bangladesh
  BF: 'UV', // Burkina Faso
  BG: 'BU', // Bulgaria
  BH: 'BA', // Bahrain
  BI: 'BY', // Burundi
  BJ: 'BN', // Benin
  BN: 'BX', // Brunei
  BO: 'BL', // Bolivia
  BS: 'BF', // Bahamas
  BW: 'BC', // Botswana
  BY: 'BO', // Belarus
  BZ: 'BH', // Belize
  CD: 'CG', // Congo (DRC)
  CF: 'CT', // Central African Republic
  CG: 'CF', // Congo (Brazzaville)
  CH: 'SZ', // Switzerland
  CL: 'CI', // Chile
  CN: 'CH', // China
  DE: 'GM', // Germany
  DK: 'DA', // Denmark
  DM: 'DO', // Dominica
  DO: 'DR', // Dominican Republic
  DZ: 'AG', // Algeria
  EE: 'EN', // Estonia
  ES: 'SP', // Spain
  GA: 'GB', // Gabon
  GB: 'UK', // United Kingdom
  GD: 'GJ', // Grenada
  GE: 'GG', // Georgia
  GM: 'GA', // Gambia
  GN: 'GV', // Guinea
  GQ: 'EK', // Equatorial Guinea
  GW: 'PU', // Guinea-Bissau
  HN: 'HO', // Honduras
  HT: 'HA', // Haiti
  IE: 'EI', // Ireland
  IL: 'IS', // Israel
  IQ: 'IZ', // Iraq
  IS: 'IC', // Iceland
  JP: 'JA', // Japan
  KH: 'CB', // Cambodia
  KI: 'KR', // Kiribati
  KM: 'CN', // Comoros
  KN: 'SC', // Saint Kitts and Nevis
  KP: 'KN', // North Korea
  KR: 'KS', // South Korea
  KW: 'KU', // Kuwait
  LB: 'LE', // Lebanon
  LC: 'ST', // Saint Lucia
  LI: 'LS', // Liechtenstein
  LK: 'CE', // Sri Lanka
  LR: 'LI', // Liberia
  LS: 'LT', // Lesotho
  LT: 'LH', // Lithuania
  LV: 'LG', // Latvia
  MA: 'MO', // Morocco
  MC: 'MN', // Monaco
  ME: 'MJ', // Montenegro
  MG: 'MA', // Madagascar
  MH: 'RM', // Marshall Islands
  MM: 'BM', // Myanmar
  MN: 'MG', // Mongolia
  MU: 'MP', // Mauritius
  MW: 'MI', // Malawi
  NA: 'NM', // Namibia
  NE: 'NG', // Niger
  NG: 'NI', // Nigeria
  NI: 'NU', // Nicaragua
  OM: 'MU', // Oman
  PA: 'PM', // Panama
  PG: 'PP', // Papua New Guinea
  PS: 'WE', // Palestine
  PT: 'PO', // Portugal
  PW: 'PS', // Palau
  PY: 'PA', // Paraguay
  RS: 'RI', // Serbia
  RU: 'RS', // Russia
  SB: 'BP', // Solomon Islands
  SC: 'SE', // Seychelles
  SD: 'SU', // Sudan
  SE: 'SW', // Sweden
  SG: 'SN', // Singapore
  SK: 'LO', // Slovakia
  SN: 'SG', // Senegal
  SR: 'NS', // Suriname
  SS: 'OD', // South Sudan
  ST: 'TP', // São Tomé and Príncipe
  SV: 'ES', // El Salvador
  SZ: 'WZ', // Eswatini
  TD: 'CD', // Chad
  TG: 'TO', // Togo
  TJ: 'TI', // Tajikistan
  TL: 'TT', // Timor-Leste
  TM: 'TK', // Turkmenistan
  TN: 'TS', // Tunisia
  TO: 'TN', // Tonga
  TR: 'TU', // Turkey
  TT: 'TD', // Trinidad and Tobago
  UA: 'UP', // Ukraine
  VA: 'VT', // Vatican City
  VN: 'VM', // Vietnam
  VU: 'NH', // Vanuatu
  YE: 'YM', // Yemen
  ZA: 'SF', // South Africa
  ZM: 'ZA', // Zambia
  ZW: 'ZI', // Zimbabwe
};

export const toFIPS = (iso2) => {
  const upper = iso2?.toUpperCase();
  return ISO2_TO_FIPS[upper] ?? upper;
};

const ALPHA3_TO_ALPHA2 = {
  AFG: 'AF', ALB: 'AL', DZA: 'DZ', AND: 'AD', AGO: 'AO', ARG: 'AR',
  ARM: 'AM', AUS: 'AU', AUT: 'AT', AZE: 'AZ', BHS: 'BS', BHR: 'BH',
  BGD: 'BD', BLR: 'BY', BEL: 'BE', BLZ: 'BZ', BEN: 'BJ', BTN: 'BT',
  BOL: 'BO', BIH: 'BA', BWA: 'BW', BRA: 'BR', BRN: 'BN', BGR: 'BG',
  BFA: 'BF', BDI: 'BI', CPV: 'CV', KHM: 'KH', CMR: 'CM', CAN: 'CA',
  CAF: 'CF', TCD: 'TD', CHL: 'CL', CHN: 'CN', COL: 'CO', COM: 'KM',
  COD: 'CD', COG: 'CG', CRI: 'CR', CIV: 'CI', HRV: 'HR', CUB: 'CU',
  CYP: 'CY', CZE: 'CZ', DNK: 'DK', DJI: 'DJ', DOM: 'DO', ECU: 'EC',
  EGY: 'EG', SLV: 'SV', GNQ: 'GQ', ERI: 'ER', EST: 'EE', SWZ: 'SZ',
  ETH: 'ET', FJI: 'FJ', FIN: 'FI', FRA: 'FR', GAB: 'GA', GMB: 'GM',
  GEO: 'GE', DEU: 'DE', GHA: 'GH', GRC: 'GR', GTM: 'GT', GIN: 'GN',
  GNB: 'GW', GUY: 'GY', HTI: 'HT', HND: 'HN', HUN: 'HU', ISL: 'IS',
  IND: 'IN', IDN: 'ID', IRN: 'IR', IRQ: 'IQ', IRL: 'IE',
  ITA: 'IT', JAM: 'JM', JPN: 'JP', JOR: 'JO', KAZ: 'KZ', KEN: 'KE',
  PRK: 'KP', KOR: 'KR', KWT: 'KW', KGZ: 'KG', LAO: 'LA', LVA: 'LV',
  LBN: 'LB', LSO: 'LS', LBR: 'LR', LBY: 'LY', LIE: 'LI', LTU: 'LT',
  LUX: 'LU', MDG: 'MG', MWI: 'MW', MYS: 'MY', MDV: 'MV', MLI: 'ML',
  MLT: 'MT', MRT: 'MR', MUS: 'MU', MEX: 'MX', MDA: 'MD', MNG: 'MN',
  MNE: 'ME', MAR: 'MA', MOZ: 'MZ', MMR: 'MM', NAM: 'NA', NPL: 'NP',
  NLD: 'NL', NZL: 'NZ', NIC: 'NI', NER: 'NE', NGA: 'NG', MKD: 'MK',
  NOR: 'NO', OMN: 'OM', PAK: 'PK', PAN: 'PA', PNG: 'PG', PRY: 'PY',
  PER: 'PE', PHL: 'PH', POL: 'PL', PRT: 'PT', QAT: 'QA', ROU: 'RO',
  RUS: 'RU', RWA: 'RW', SAU: 'SA', SEN: 'SN', SRB: 'RS', SLE: 'SL',
  SGP: 'SG', SVK: 'SK', SVN: 'SI', SOM: 'SO', ZAF: 'ZA', SSD: 'SS',
  ESP: 'ES', LKA: 'LK', SDN: 'SD', SUR: 'SR', SWE: 'SE', CHE: 'CH',
  SYR: 'SY', TWN: 'TW', TJK: 'TJ', TZA: 'TZ', THA: 'TH', TLS: 'TL',
  TGO: 'TG', TTO: 'TT', TUN: 'TN', TUR: 'TR', TKM: 'TM', UGA: 'UG',
  UKR: 'UA', ARE: 'AE', GBR: 'GB', USA: 'US', URY: 'UY', UZB: 'UZ',
  VEN: 'VE', VNM: 'VN', YEM: 'YE', ZMB: 'ZM', ZWE: 'ZW',
};

const ALPHA2_SET = new Set(Object.values(ALPHA3_TO_ALPHA2));

export const toAlpha2 = (input) => {
  const upper = input?.toUpperCase();
  if (!upper) throw new Error(`Unsupported or unknown country code: ${input}`);
  if (upper.length === 2) {
    if (!ALPHA2_SET.has(upper)) throw new Error(`Unsupported or unknown country code: ${input}`);
    return upper;
  }
  const code = ALPHA3_TO_ALPHA2[upper];
  if (!code) throw new Error(`Unsupported or unknown country code: ${input}`);
  return code;
};