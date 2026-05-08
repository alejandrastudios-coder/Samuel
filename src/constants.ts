export const TEAMS = [
  "MEX México", "RSA South Africa", "KOR Korea Republic", "CZE Czechia", "CAN Canada", "BIH Bosnia-Herzegovina", "QAT Qatar", "SUI Switzerland",
  "BRA Brazil", "MAR Morocco", "HAI Haiti", "SCO Scotland", "USA USA", "PAR Paraguay", "AUS Australia", "TUR Türkiye",
  "GER Germany", "CUW Curaçao", "CIV Côte d’Ivoire", "ECU Ecuador", "NED Netherlands", "JPN Japan", "SWE Sweden", "TUN Tunisia",
  "BEL Belgium", "EGY Egypt", "IRN IR Iran", "NZL New Zealand", "ESP Spain", "CPV Cabo Verde", "KSA Saudi Arabia", "URU Uruguay",
  "FRA France", "SEN Senegal", "IRQ Iraq", "NOR Norway", "ARG Argentina", "ALG Algeria", "AUT Austria", "JOR Jordan",
  "POR Portugal", "COD Congo DR", "UZB Uzbekistan", "COL Colombia", "ENG England", "CRO Croatia", "GHA Ghana", "PAN Panama"
];

export const FWC_COUNT = 19;
export const COCA_COLA_COUNT = 12;
export const STICKERS_PER_TEAM = 20;

export const normalizeStickerId = (id: string) => {
  if (!id) return id;
  
  // If it's a team-index format, map it to the current team name
  if (id.startsWith('team-')) {
    const parts = id.split('-');
    const index = parseInt(parts[1]);
    if (!isNaN(index) && TEAMS[index]) {
      return `${TEAMS[index]}-${parts[2]}`;
    }
  }

  // If it's already a name-num format
  // Check if it has an old name or a new name with 3 letters
  // We can try to extract the number at the end
  const lastDash = id.lastIndexOf('-');
  if (lastDash === -1) return id;
  
  const namePart = id.substring(0, lastDash);
  const numPart = id.substring(lastDash + 1);

  // Try to find if this namePart corresponds to any team (ignoring accents and the 3-letter prefix)
  const clean = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^[a-z]{3}\s+/, "");
  const targetClean = clean(namePart);

  for (const team of TEAMS) {
    if (clean(team) === targetClean) {
      return `${team}-${numPart}`;
    }
  }

  return id;
};

export const FLAGS: Record<string, string> = {
  "MEX México": "https://flagcdn.com/mx.svg",
  "RSA South Africa": "https://flagcdn.com/za.svg",
  "KOR Korea Republic": "https://flagcdn.com/kr.svg",
  "CZE Czechia": "https://flagcdn.com/cz.svg",
  "CAN Canada": "https://flagcdn.com/ca.svg",
  "BIH Bosnia-Herzegovina": "https://flagcdn.com/ba.svg",
  "QAT Qatar": "https://flagcdn.com/qa.svg",
  "SUI Switzerland": "https://flagcdn.com/ch.svg",
  "BRA Brazil": "https://flagcdn.com/br.svg",
  "MAR Morocco": "https://flagcdn.com/ma.svg",
  "HAI Haiti": "https://flagcdn.com/ht.svg",
  "SCO Scotland": "https://flagcdn.com/gb-sct.svg",
  "USA USA": "https://flagcdn.com/us.svg",
  "PAR Paraguay": "https://flagcdn.com/py.svg",
  "AUS Australia": "https://flagcdn.com/au.svg",
  "TUR Türkiye": "https://flagcdn.com/tr.svg",
  "GER Germany": "https://flagcdn.com/de.svg",
  "CUW Curaçao": "https://flagcdn.com/cw.svg",
  "CIV Côte d’Ivoire": "https://flagcdn.com/ci.svg",
  "ECU Ecuador": "https://flagcdn.com/ec.svg",
  "NED Netherlands": "https://flagcdn.com/nl.svg",
  "JPN Japan": "https://flagcdn.com/jp.svg",
  "SWE Sweden": "https://flagcdn.com/se.svg",
  "TUN Tunisia": "https://flagcdn.com/tn.svg",
  "BEL Belgium": "https://flagcdn.com/be.svg",
  "EGY Egypt": "https://flagcdn.com/eg.svg",
  "IRN IR Iran": "https://flagcdn.com/ir.svg",
  "NZL New Zealand": "https://flagcdn.com/nz.svg",
  "ESP Spain": "https://flagcdn.com/es.svg",
  "CPV Cabo Verde": "https://flagcdn.com/cv.svg",
  "KSA Saudi Arabia": "https://flagcdn.com/sa.svg",
  "URU Uruguay": "https://flagcdn.com/uy.svg",
  "FRA France": "https://flagcdn.com/fr.svg",
  "SEN Senegal": "https://flagcdn.com/sn.svg",
  "IRQ Iraq": "https://flagcdn.com/iq.svg",
  "NOR Norway": "https://flagcdn.com/no.svg",
  "ARG Argentina": "https://flagcdn.com/ar.svg",
  "ALG Algeria": "https://flagcdn.com/dz.svg",
  "AUT Austria": "https://flagcdn.com/at.svg",
  "JOR Jordan": "https://flagcdn.com/jo.svg",
  "POR Portugal": "https://flagcdn.com/pt.svg",
  "COD Congo DR": "https://flagcdn.com/cd.svg",
  "UZB Uzbekistan": "https://flagcdn.com/uz.svg",
  "COL Colombia": "https://flagcdn.com/co.svg",
  "ENG England": "https://flagcdn.com/gb-eng.svg",
  "CRO Croatia": "https://flagcdn.com/hr.svg",
  "GHA Ghana": "https://flagcdn.com/gh.svg",
  "PAN Panama": "https://flagcdn.com/pa.svg"
};
