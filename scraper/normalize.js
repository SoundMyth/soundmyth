/**
 * SoundMyth – shared event normalization for the scrapers.
 * Mirrors the frontend (index.html) so the DB is clean at the source:
 *  - canonCity: fold city aliases / local-script names into one recognizable name
 *  - cleanVenue: drop a garbage venue that just repeats the event name (Bandsintown)
 *  - looksLikeBareArtist: a single-act listing with no real venue (not a festival)
 *  - cleanEvent: apply the above in-place before upsert
 */

// Keys written in their natural form; lowercased at init to match canonCity().
export const CITY_ALIAS_RAW = {
  'Eivissa':'Ibiza','Sant Jordi De Ses Salines':'Ibiza','Sant Josep de sa Talaia':'Ibiza',
  'Sant Antoni de Portmany':'Ibiza','Santa Eulària des Riu':'Ibiza',
  'София':'Sofia','İstanbul':'Istanbul','Beşiktaş':'Istanbul','Beyoğlu':'Istanbul',
  'București':'Bucharest','Rīga':'Riga','Chișinău':'Chisinau','Bakı':'Baku',
  'Hlavní Město Praha':'Prague','Staré Město':'Prague','Brno-město':'Brno',
  'Wrocław':'Wroclaw','Gdańsk':'Gdansk','Łódź':'Lodz','Poznań':'Poznan','Płock':'Plock',
  'Białystok':'Bialystok','Międzyzdroje':'Miedzyzdroje','Łaziska Górne':'Laziska Gorne',
  'Włoszakowice':'Wloszakowice','Iłowa':'Ilowa',
  'Târgu Mureș':'Targu Mures','Bonțida':'Bontida','Costinești':'Costinesti',
  'Nevşehir Merkez':'Nevsehir','Çeşme':'Cesme',
  'Trenčín':'Trencin','Trenčín District':'Trencin','Velešín':'Velesin','Týn Nad Bečvou':'Tyn nad Becvou',
  'Horní Soběšovice':'Horni Sobesovice','Kaluža':'Kaluza','Liepāja':'Liepaja','Tjentište':'Tjentiste',
  'Città Metropolitana Di Messina':'Messina','Zrće Beach':'Novalja',
  'Παραλία Paradise':'Mykonos','Μύκονος':'Mykonos','Κάβος':'Kavos','Λαγανάς':'Laganas',
  '福岡市':'Fukuoka','大阪府':'Osaka','京都市':'Kyoto','横浜市':'Yokohama','名古屋市':'Nagoya',
  '札幌市':'Sapporo','仙台市':'Sendai','岡山市':'Okayama','宇都宮市':'Utsunomiya','渋谷区':'Tokyo','群馬県':'Gunma',
  'Dubai International Financial Centre':'Dubai',
  'Aeropuerto Internacional De La Ciudad De México':'Mexico City',
  'Masākin Maḩaţţat Kahrabā’ Sharq Al Qāhirah':'Cairo',
  'BELVOIR CASTLE Leicestershire':'Leicestershire'
};

const CITY_ALIAS = {};
for (const k in CITY_ALIAS_RAW) CITY_ALIAS[k.replace(/\s+/g,' ').trim().toLowerCase()] = CITY_ALIAS_RAW[k];

export function canonCity(c) {
  const t = (c || '').replace(/\s+/g,' ').trim();
  return CITY_ALIAS[t.toLowerCase()] || t;
}

export function cleanVenue(venue, name) {
  const v = (venue || '').trim();
  return (v && v === (name || '').trim()) ? '' : v;
}

/** A single-act listing whose "venue" only repeats the title — not a real festival/venue event. */
export function looksLikeBareArtist(ev) {
  return !cleanVenue(ev.venue, ev.name) && (!ev.djs || ev.djs.length <= 1);
}

/** Normalize an event row in place, just before upsert. */
export function cleanEvent(e) {
  e.city  = canonCity(e.city);
  e.venue = cleanVenue(e.venue, e.name);
  return e;
}
