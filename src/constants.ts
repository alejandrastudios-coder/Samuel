export const TEAMS = [
  "MEX México", "RSA South Africa", "KOR Korea Republic", "CZE Czechia", "CAN Canada", "BIH Bosnia-Herzegovina", "QAT Qatar", "SUI Switzerland",
  "BRA Brazil", "MAR Morocco", "HAI Haiti", "SCO Scotland", "USA USA", "PAR Paraguay", "AUS Australia", "TUR Türkiye",
  "GER Germany", "CUW Curaçao", "CIV Côte d’Ivoire", "ECU Ecuador", "NED Netherlands", "JPN Japan", "SWE Sweden", "TUN Tunisia",
  "BEL Belgium", "EGY Egypt", "IRN IR Iran", "NZL New Zealand", "ESP Spain", "CPV Cabo Verde", "KSA Saudi Arabia", "URU Uruguay",
  "FRA France", "SEN Senegal", "IRQ Iraq", "NOR Norway", "ARG Argentina", "ALG Algeria", "AUT Austria", "JOR Jordan",
  "POR Portugal", "COD Congo DR", "UZB Uzbekistan", "COL Colombia", "ENG England", "CRO Croatia", "GHA Ghana", "PAN Panama"
];

export const FWC_COUNT = 20;
export const COCA_COLA_COUNT = 12;
export const STICKERS_PER_TEAM = 20;

export const getStickerNumbers = (team: string): string[] => {
  const cleanTeam = team.toLowerCase().trim();
  if (cleanTeam === 'fwc' || cleanTeam === 'ufw') {
    return ['00', ...Array.from({ length: 19 }, (_, i) => (i + 1).toString())];
  }
  if (cleanTeam === 'cc' || cleanTeam === 'coca-cola' || cleanTeam === 'extra') {
    return Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  }
  return Array.from({ length: 20 }, (_, i) => (i + 1).toString());
};

export const RARITIES = [
  { id: 'cualquier', name: 'Cualquier color', label: 'Predeterminado', color: 'bg-gradient-to-tr from-zinc-500 via-zinc-200 to-zinc-500', text: 'text-zinc-900', border: 'border-zinc-400' },
  { id: 'blanco', name: 'Blanco', label: 'Común', color: 'bg-white', text: 'text-zinc-900', border: 'border-zinc-200' },
  { id: 'azul', name: 'Azul', label: 'Raro', color: 'bg-blue-500', text: 'text-white', border: 'border-blue-400' },
  { id: 'morado', name: 'Morado', label: 'Épico', color: 'bg-purple-600', text: 'text-white', border: 'border-purple-400' },
  { id: 'verde', name: 'Verde', label: 'Leyenda', color: 'bg-green-500', text: 'text-white', border: 'border-green-400' },
  { id: 'negro', name: 'Negro', label: 'Uno en el mundo', color: 'bg-zinc-950', text: 'text-white', border: 'border-zinc-800' }
];

export const normalizeStickerId = (id: string): string => {
  if (!id) return id;
  
  let normalized = id.trim();
  if (normalized.startsWith('UFW')) normalized = normalized.replace('UFW', 'FWC');
  if (normalized.startsWith('COCA-COLA')) normalized = normalized.replace('COCA-COLA', 'CC');
  if (normalized.startsWith('extra-')) normalized = normalized.replace('extra-', 'CC-');

  // If it's a team-index format, map it to the current team name
  if (normalized.startsWith('team-')) {
    const parts = normalized.split('-');
    const index = parseInt(parts[1]);
    if (!isNaN(index) && TEAMS[index]) {
      normalized = `${TEAMS[index]}-${parts[2]}`;
    }
  }

  // Find the separator (usually '-' or ' ')
  let lastDash = normalized.lastIndexOf('-');
  if (lastDash === -1) {
    const lastSpace = normalized.lastIndexOf(' ');
    if (lastSpace !== -1) {
      const namePart = normalized.substring(0, lastSpace).trim();
      const numPart = normalized.substring(lastSpace + 1).trim();
      if (!isNaN(parseInt(numPart)) || numPart === '00') {
        normalized = `${namePart}-${numPart}`;
      }
    }
  }

  const updatedDash = normalized.lastIndexOf('-');
  if (updatedDash === -1) return normalized;
  
  let namePart = normalized.substring(0, updatedDash).trim();
  let numPart = normalized.substring(updatedDash + 1).trim();

  // Strip leading zeros unless it is exactly '00'
  if (numPart !== '00') {
    const parsedNum = parseInt(numPart);
    if (!isNaN(parsedNum)) {
      numPart = parsedNum.toString();
    }
  }

  // 1. Check if namePart matches a team's 3-letter prefix (e.g. "KOR", "MEX", "CIV")
  const prefixKey = namePart.toUpperCase();
  const matchedPreset = TEAMS.find(t => t.startsWith(prefixKey + " "));
  if (matchedPreset) {
    return `${matchedPreset}-${numPart}`;
  }

  // 2. Clean normalizer helper and compare names
  const clean = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const targetClean = clean(namePart);
  const targetCleanNoPrefix = targetClean.replace(/^[a-z]{3}\s+/, "");

  for (const team of TEAMS) {
    const teamClean = clean(team);
    const teamCleanNoPrefix = teamClean.replace(/^[a-z]{3}\s+/, "");
    
    if (teamClean === targetClean || 
        teamCleanNoPrefix === targetClean || 
        teamCleanNoPrefix === targetCleanNoPrefix) {
      return `${team}-${numPart}`;
    }
  }

  // 3. Fallbacks for specials FWC and CC (Coca-Cola)
  if (prefixKey === 'FWC' || targetClean === 'ufw') {
    return `FWC-${numPart}`;
  }
  if (prefixKey === 'CC' || targetClean === 'coca-cola' || targetClean === 'extra') {
    return `CC-${numPart}`;
  }

  return `${namePart}-${numPart}`;
};

export const getValidStickerIds = (): string[] => {
  const ids: string[] = [];
  TEAMS.forEach(team => {
    getStickerNumbers(team).forEach(num => {
      ids.push(normalizeStickerId(`${team}-${num}`));
    });
  });
  getStickerNumbers('FWC').forEach(num => {
    ids.push(normalizeStickerId(`FWC-${num}`));
  });
  getStickerNumbers('CC').forEach(num => {
    ids.push(normalizeStickerId(`CC-${num}`));
  });
  return ids;
};

export const ALL_COUNTRIES = [
  'Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda', 'Arabia Saudita', 'Argelia', 'Argentina', 'Armenia',
  'Australia', 'Austria', 'Azerbaiyán', 'Bahamas', 'Bangladés', 'Barbados', 'Baréin', 'Bélgica', 'Belice', 'Benín', 'Bielorrusia',
  'Birmania', 'Bolivia', 'Bosnia y Herzegovina', 'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Bután',
  'Cabo Verde', 'Camboya', 'Camerún', 'Canadá', 'Catar', 'Chad', 'Chile', 'China', 'Chipre', 'Ciudad del Vaticano', 'Colombia',
  'Comoras', 'Corea del Norte', 'Corea del Sur', 'Costa de Marfil', 'Costa Rica', 'Croacia', 'Cuba', 'Dinamarca', 'Dominica',
  'Ecuador', 'Egipto', 'El Salvador', 'Emiratos Árabes Unidos', 'Eritrea', 'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos',
  'Estonia', 'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia', 'Georgia', 'Ghana', 'Granada', 'Grecia',
  'Guatemala', 'Guyana', 'Guinea', 'Guinea ecuatorial', 'Guinea-Bisáu', 'Haití', 'Honduras', 'Hungría', 'India', 'Indonesia',
  'Irak', 'Irán', 'Irlanda', 'Islandia', 'Islas Marshall', 'Islas Salomón', 'Israel', 'Italia', 'Jamaica', 'Japón', 'Jordania',
  'Kazajistán', 'Kenia', 'Kirguistán', 'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letonia', 'Líbano', 'Liberia', 'Libia', 'Liechtenstein',
  'Lituania', 'Luxemburgo', 'Macedonia del Norte', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas', 'Malí', 'Malta', 'Marruecos',
  'Mauricio', 'Mauritania', 'México', 'Micronesia', 'Moldavia', 'Mónaco', 'Mongolia', 'Montenegro', 'Mozambique', 'Namibia',
  'Nauru', 'Nepal', 'Nicaragua', 'Níger', 'Nigeria', 'Noruega', 'Nueva Zelanda', 'Omán', 'Países Bajos', 'Pakistán', 'Palaos',
  'Panamá', 'Papúa Nueva Guinea', 'Paraguay', 'Perú', 'Polonia', 'Portugal', 'Reino Unido', 'República Centroafricana', 'República Checa',
  'República del Congo', 'República Democrática del Congo', 'República Dominicana', 'República Sudafricana', 'Ruanda', 'Rumanía',
  'Rusia', 'Samoa', 'San Cristóbal y Nieves', 'San Marino', 'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur', 'Siria', 'Somalia', 'Sri Lanka', 'Suazilandia', 'Sudán',
  'Sudán del Sur', 'Suecia', 'Suiza', 'Surinam', 'Tailandia', 'Tanzania', 'Tayikistán', 'Timor Oriental', 'Togo', 'Tonga',
  'Trinidad y Tobago', 'Túnez', 'Turkmenistán', 'Turquía', 'Tuvalu', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu',
  'Venezuela', 'Vietnam', 'Yemen', 'Yibuti', 'Zambia', 'Zimbabue'
];

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
