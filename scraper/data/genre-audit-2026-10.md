# DJ genre audit – 2026-10 (B1 Genres & tags)

Source of truth for DJ `genre` in `scraper/data/artists_all.json`. Every DJ is one of the 16 canonical styles (contract §1); no `Electronic`, `Pop`, `Pop Electronic / Crossover`, `UNKNOWN` or legacy labels remain.

## Method

1. **Mechanical (legacy labels):** the old genre label mapped to a canonical style; where a subgenre refines it (e.g. `House` + `Tech House`, `Techno` + `Hard Techno`, `Big Room / Festival EDM` + `Big Room House`), the subgenre wins (see `SUBGENRE` in `scraper/genres.js`).
2. **Individual (generic labels):** every DJ labelled `Electronic` (136), `Pop Electronic / Crossover` (33), `Pop` (1) or `UNKNOWN` (4) was classified by web research (Resident Advisor bios, Beatport, Discogs, Wikipedia, DJ Mag, Insomniac, Frontstage, Refuge Worldwide, etc.), with a confidence level. Founder rules applied directly: Diplo→Bass, Marshmello→Bass, Galantis→Big Room, Joel Corry→House, Gabry Ponte→Big Room, Purple Disco Machine→House, Fred again..→House, Anyma→Melodic Techno.
3. **Sanity pass:** the top 200 DJs by ranking were reviewed by hand; Solomun, Deadmau5 and Black Coffee were corrected.
4. **Tags:** normalised to the vibe whitelist (`melodic, dark, hard, underground, mainstream, vocal, atmospheric, experimental, classic, disco, emotional, psychedelic, latin, afro`). `commercial` → `mainstream`; `club`, `festival`, `dj`, `discovered`, `progressive` (a genre, not a vibe) and `UNKNOWN` are dropped. A DJ with both `underground` and `mainstream` loses both.

Confidence is recorded per row in the reason column (`web high/medium/LOW`, `founder rule`, `judgment call`). **LOW** rows are best-effort and worth a manual check before the founder review.

## Summary

- DJs: 1102
- Genre changed: 578
- Tags only changed: 400

## Genre changes

| # | DJ | Old genre | New genre | Reason |
|---|---|---|---|---|
| 1 | David Guetta | Pop Electronic / Crossover | House | manual: web high (NRJ: house, electro house; French house producer); tags normalised |
| 2 | Martin Garrix | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 3 | Dimitri Vegas & Like Mike | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 4 | Timmy Trumpet | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 5 | FISHER | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 6 | Afrojack | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 7 | Anyma | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 8 | Vintage Culture | House | Deep House | mechanical: House / Deep House -> Deep House |
| 9 | Peggy Gou | House | Deep House | mechanical: House / Deep House -> Deep House |
| 10 | Steve Aoki | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 11 | Hardwell | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 12 | Calvin Harris | Pop Electronic / Crossover | House | manual: web LOW (dance-pop / EDM / disco-house roots) judgment call; tags normalised |
| 13 | Black Coffee | Indie Dance / Leftfield | Afro House | manual: sanity fix: afro house is the usual label for her/his sets (was Deep House) |
| 14 | W&W | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 15 | Keinemusik | Indie Dance / Leftfield | Deep House | mechanical: Indie Dance / Leftfield / Organic House -> Deep House |
| 16 | Tiësto | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 17 | KSHMR | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 18 | Alan Walker | Pop Electronic / Crossover | Progressive | manual: judgment call (melodic progressive house); web low: house/electro |
| 19 | Jamie Jones | House | Tech House | mechanical: House / Tech House -> Tech House |
| 20 | R3hab | Pop Electronic / Crossover | Big Room | manual: web medium (DJ Mag: big room house, EDM pop); tags normalised |
| 21 | Nicky Romero | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 22 | Claptone | House | Deep House | mechanical: House / Deep House -> Deep House |
| 23 | Skrillex | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 24 | Vini Vici | Trance | Psytrance | mechanical: Trance / Psytrance -> Psytrance; tags normalised |
| 25 | Fred Again.. | Indie Dance / Leftfield | House | manual: founder rule (Fred again.. -> House); legacy Electronica subgenre |
| 26 | Swedish House Mafia | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 27 | Joel Corry | Pop Electronic / Crossover | House | manual: founder rule + web high (DJ Mag: house, tech-house); tags normalised |
| 28 | Indira Paganotto | Trance | Psytrance | mechanical: Trance / Psytrance -> Psytrance |
| 29 | Eric Prydz | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 30 | DJ Snake | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass; tags normalised |
| 31 | Dom Dolla | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 32 | Marshmello | Pop Electronic / Crossover | Bass | manual: founder rule + web medium (Wikipedia: dubstep, future bass, trap) |
| 33 | The Martinez Brothers | House | Tech House | mechanical: House / Tech House -> Tech House |
| 34 | Zedd | Pop Electronic / Crossover | Big Room | manual: web medium (primarily electro house, progressive, complextro) |
| 35 | Bassjackers | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 36 | John Summit | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 37 | Quintino | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 38 | Michael Bibi | House | Tech House | mechanical: House / Tech House -> Tech House |
| 39 | Korolova | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 40 | Alesso | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 41 | James Hype | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 42 | Maddix | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno; tags normalised |
| 43 | HUGEL | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 44 | Solomun | Indie Dance / Leftfield | Deep House | manual: sanity fix: legacy Indie Dance label; deep/melodic house sound |
| 45 | Mochakk | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 46 | Nora En Pure | House | Deep House | mechanical: House / Deep House -> Deep House |
| 47 | Sara Landry | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 48 | Nervo | Pop Electronic / Crossover | Big Room | manual: web high (DJ Mag: big room) |
| 49 | Sub Zero Project | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardstyle -> Hardstyle |
| 50 | Kölsch | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 51 | Lucas & Steve | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 52 | Nico Moreno | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 53 | GORDO | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 54 | PAWSA | House | Tech House | mechanical: House / Tech House -> Tech House |
| 55 | The Chainsmokers | Pop Electronic / Crossover | Bass | manual: web LOW (DJ Mag 2016: trap, future bass, dubstep; now EDM-pop) |
| 56 | Liu | Bass Music | Bass | mechanical: Bass Music / Future Bass -> Bass |
| 57 | ARTBAT | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno; tags normalised |
| 58 | KAAZE | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 59 | Miss Monique | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 60 | Burak Yeter | Pop Electronic / Crossover | House | manual: web high (DJ Mag 2024: house); tags normalised |
| 61 | Mau P | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 62 | Le Twins | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 63 | Marnik | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 64 | Chris Stussy | House | Deep House | mechanical: House / Deep House -> Deep House |
| 65 | Deadmau5 | Indie Dance / Leftfield | Progressive | manual: sanity fix: legacy Indie Dance/Electronica; progressive house/techno |
| 66 | WUKONG | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass |
| 67 | Fedde Le Grand | House | Big Room | mechanical: House / Electro House -> Big Room; tags normalised |
| 68 | Plastik Funk | House | Big Room | mechanical: House / Electro House -> Big Room; tags normalised |
| 69 | DubVision | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 70 | B Jones | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 71 | Cuebrick | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 72 | Mariana Bo | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 73 | MEDUZA | House | Deep House | mechanical: House / Deep House -> Deep House |
| 74 | Fantasm | Hard Dance | Hardstyle | mechanical: Hard Dance / Rawstyle -> Hardstyle |
| 75 | VINAI | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 76 | Chris Lake | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 77 | Faustix | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass |
| 78 | Honey Dijon | House | Deep House | mechanical: House / Deep House -> Deep House |
| 79 | Nils Van Zandt | Pop Electronic / Crossover | Big Room | manual: web medium (DJ Mag: mainstage EDM anthems); tags normalised |
| 80 | Topic | Pop Electronic / Crossover | House | manual: web LOW (house-style beats, dance-pop) |
| 81 | ANOTR | House | Deep House | mechanical: House / Deep House -> Deep House |
| 82 | Tujamo | House | Big Room | mechanical: House / Electro House -> Big Room; tags normalised |
| 83 | Kura | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 84 | Klangkuenstler | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 85 | Tungevaag | Pop Electronic / Crossover | Big Room | manual: web medium (uplifting festival EDM / electro house); tags normalised |
| 86 | ZHANGYE | UNKNOWN | Progressive | manual: web LOW (2026 press: modern progressive house); tags normalised |
| 87 | 22Bullets | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 88 | Mathame | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 89 | Danny Avila | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno; tags normalised |
| 90 | Azyr | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 91 | Argy | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 92 | Julian Jordan | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 93 | Holy Priest | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 94 | Marco Carola | House | Tech House | mechanical: House / Tech House -> Tech House |
| 95 | Rezz | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 96 | Chase & Status | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Drum & Bass -> Drum & Bass |
| 97 | Dennis Cruz | House | Tech House | mechanical: House / Tech House -> Tech House |
| 98 | DJ Bliss | UNKNOWN | House | manual: web medium (Mixmag: global house with Emirati soul); tags normalised |
| 99 | Brennan Heart | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardstyle -> Hardstyle |
| 100 | Naeleck | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass |
| 101 | Alan Shirahama | Pop Electronic / Crossover | House | manual: web LOW (bass house per review; bass house mapped to House); tags normalised |
| 102 | Hot Since 82 | House | Deep House | mechanical: House / Deep House -> Deep House |
| 103 | Fatboy Slim | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Big Beat -> Drum & Bass |
| 104 | Wade | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 105 | Oguz | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 106 | Sonny Fodera | House | Deep House | mechanical: House / Deep House -> Deep House; tags normalised |
| 107 | Blasterjaxx | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 108 | Diego Miranda | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 109 | Jax Jones | Pop Electronic / Crossover | House | manual: web high (AllMusic: uplifting house) |
| 110 | Jonas Blue | Pop Electronic / Crossover | House | manual: web LOW (tropical house, dance pop) |
| 111 | Sammy Virji | Bass Music | House | mechanical: Bass Music / UK Garage -> House |
| 112 | KAKA | House | Big Room | mechanical: House / Electro House -> Big Room |
| 113 | Miss K8 | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardcore -> Hardstyle |
| 114 | AVA CROWN | UNKNOWN | House | manual: LOW confidence default: no DJ found under this name; tags normalised |
| 115 | Josh Baker | House | Tech House | mechanical: House / Tech House -> Tech House |
| 116 | Illenium | Bass Music | Bass | mechanical: Bass Music / Melodic Dubstep -> Bass |
| 117 | Green Velvet | House | Tech House | mechanical: House / Tech House -> Tech House |
| 118 | Blond:ish | Indie Dance / Leftfield | Deep House | mechanical: Indie Dance / Leftfield / Organic House -> Deep House |
| 119 | Kettama | House | Bass | mechanical: House / Breakbeat -> Bass |
| 120 | Luca Testa | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 121 | Aryue | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 122 | Max Styler | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 123 | GENESI | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 124 | BLR | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 125 | CASSIMM | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 126 | Massano | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 127 | KREAM | House | Deep House | mechanical: House / Deep House -> Deep House |
| 128 | Chris Lorenzo | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 129 | CamelPhat | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 130 | Skytech | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 131 | Crusy | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 132 | James Hurr | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 133 | Morten | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room Techno -> Big Room; tags normalised |
| 134 | WHO | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 135 | Tony Romera | House | Big Room | mechanical: House / Electro House -> Big Room; tags normalised |
| 136 | Sidepiece | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 137 | HNTR | House | Tech House | mechanical: House / Tech House -> Tech House |
| 138 | Th;en | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 139 | Low Steppa | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 140 | Cassian | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 141 | Adam Port | Indie Dance / Leftfield | Deep House | mechanical: Indie Dance / Leftfield / Organic House -> Deep House |
| 142 | Martin Ikin | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 143 | Ruback | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 144 | David Penn | House | Deep House | mechanical: House / Deep House -> Deep House |
| 145 | Marie Vaunt | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 146 | Gabry Ponte | Pop Electronic / Crossover | Big Room | manual: founder rule (Gabry Ponte -> Big Room) |
| 147 | Westend | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 148 | Chapter & Verse | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 149 | Innellea | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 150 | Gai Barone | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 151 | Cloonee | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 152 | Gorgon City | House | Deep House | mechanical: House / Deep House -> Deep House |
| 153 | Greg (BR) | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 154 | CID | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 155 | Dont Blink | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 156 | Biscuits | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 157 | Guy J | Indie Dance / Leftfield | Progressive | mechanical: Indie Dance / Leftfield / Progressive House -> Progressive |
| 158 | Goom Gum | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 159 | San Pacho | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 160 | Rafael Cerato | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 161 | Samm (BE) | Indie Dance / Leftfield | Deep House | mechanical: Indie Dance / Leftfield / Organic House -> Deep House |
| 162 | Marsh | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 163 | Joshwa | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 164 | Mark Knight | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 165 | Wh0 | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 166 | Piero Pirupa | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 167 | Kryder | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 168 | Pickle | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 169 | Marco Lys | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 170 | OFFAIAH | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 171 | Dillon Francis | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass; tags normalised |
| 172 | Biscits | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 173 | Andruss | House | Tech House | mechanical: House / Tech House -> Tech House |
| 174 | GOODBOYS | Pop Electronic / Crossover | House | manual: web high (Wikipedia: English house duo) |
| 175 | Kevin de Vries | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 176 | OMNOM | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 177 | Truth x Lies | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 178 | Thomas Newson | House | Big Room | mechanical: House / Electro House -> Big Room; tags normalised |
| 179 | Silver Panda | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 180 | Space Motion | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 181 | Riordan | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 182 | Sick Individuals | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 183 | Pink Panda | Pop Electronic / Crossover | Tech House | manual: web medium (DJ Mag: house, tech-house); tags normalised |
| 184 | Rave Republic | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 185 | Angerfist | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardcore -> Hardstyle |
| 186 | Acraze | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 187 | Ummet Ozcan | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 188 | Beauz | Pop Electronic / Crossover | Hard Techno | manual: web medium (2023-26 bios: hard techno, psy blend) |
| 189 | Deorro | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 190 | Ofenbach | Pop Electronic / Crossover | House | manual: web medium (DJ Mag: dance-pop/house; festt house, deep house) |
| 191 | Jay Hardway | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 192 | Le Shuuk | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room |
| 193 | Tale Of Us | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 194 | Lizzy Wang | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 195 | MATTN | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 196 | Will Sparks | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room Techno -> Big Room |
| 197 | Tom & Collins | House | Deep House | mechanical: House / Deep House -> Deep House |
| 198 | Bicep | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Electronica -> Indie Dance |
| 199 | Lane 8 | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 200 | MK | House | Deep House | mechanical: House / Deep House -> Deep House; tags normalised |
| 201 | Moji | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 202 | Diplo | Pop Electronic / Crossover | Bass | manual: founder rule + web LOW (trap, moombahton, dubstep, Miami bass); tags normalised |
| 203 | Maya Jane Coles | House | Deep House | mechanical: House / Deep House -> Deep House |
| 204 | Carta | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 205 | Andy C | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Drum & Bass -> Drum & Bass |
| 206 | Patrick Topping | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 207 | Vessbroz | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 208 | Sunnery James & Ryan Marciano | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 209 | Porter Robinson | Pop Electronic / Crossover | Electro | manual: web medium (DJ Mag 2016: electro; electro-house origins) |
| 210 | Alison Wonderland | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass |
| 211 | Yellow Claw | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass |
| 212 | Maceo Plex | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 213 | Major League Djz | House | Deep House | mechanical: House / Deep House -> Deep House |
| 214 | Galantis | Pop Electronic / Crossover | Big Room | manual: web LOW (electro house, progressive, dance pop) judgment call |
| 215 | Bhaskar | House | Bass | mechanical: House / Brazilian Bass -> Bass; tags normalised |
| 216 | Mr Pig | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 217 | Gian Varela | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 218 | Breathe Carolina | Pop Electronic / Crossover | House | manual: web medium (DJ Mag: house, future house) |
| 219 | Firebeatz | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 220 | Paul Kalkbrenner | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 221 | Joris Voorn | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 222 | Zomboy | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 223 | Disclosure | House | Deep House | mechanical: House / Deep House -> Deep House |
| 224 | Agents of Time | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 225 | Matisse & Sadko | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 226 | Sasha | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 227 | Eli & Fur | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 228 | Chris Avantgarde | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 229 | Plastic Funk | House | Big Room | mechanical: House / Electro House -> Big Room; tags normalised |
| 230 | Fatima Hajji | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 231 | Aaron Hibell | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 232 | Mind Against | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 233 | Yotto | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 234 | Yves V | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 235 | Andrea Oliva | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 236 | BTSM | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 237 | Eptic | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 238 | Space Laces | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 239 | Sofi Tukker | Pop Electronic / Crossover | House | manual: web high (Wikipedia / Insomniac: house) |
| 240 | Madeon | Pop Electronic / Crossover | Indie Dance | manual: web medium (electropop/nu-disco album, closest category) |
| 241 | Juicy M | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 242 | Hamdi | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 243 | Dzeko | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 244 | Carlita | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Indie Dance -> Indie Dance |
| 245 | Da Tweekaz | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardstyle -> Hardstyle |
| 246 | Sevenn | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 247 | Leandro Da Silva | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 248 | Daddy's Groove | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 249 | The Blessed Madonna | House | Deep House | mechanical: House / Deep House -> Deep House |
| 250 | Florian Picasso | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 251 | ASCO | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 252 | Deniz Koyu | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Festival Progressive -> Big Room; tags normalised |
| 253 | Andrea Casta | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM / Big Room House -> Big Room; tags normalised |
| 254 | Jayda G | House | Deep House | mechanical: House / Deep House -> Deep House |
| 255 | Solardo | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 256 | Seth Troxler | House | Tech House | mechanical: House / Tech House -> Tech House |
| 257 | Rebekah | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 258 | Eats Everything | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 259 | Kerri Chandler | House | Deep House | mechanical: House / Deep House -> Deep House |
| 260 | Sub Focus | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Drum & Bass -> Drum & Bass |
| 261 | Loco Dice | House | Tech House | mechanical: House / Tech House -> Tech House |
| 262 | John Digweed | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 263 | Chris Liebing | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 264 | Skream | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 265 | Dax J | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 266 | Claude VonStroke | House | Tech House | mechanical: House / Tech House -> Tech House |
| 267 | Paul Woolford | House | Deep House | mechanical: House / Deep House -> Deep House |
| 268 | Dennis Ferrer | House | Deep House | mechanical: House / Deep House -> Deep House |
| 269 | Sam Divine | House | Deep House | mechanical: House / Deep House -> Deep House |
| 270 | Radio Slave | House | Deep House | mechanical: House / Deep House -> Deep House |
| 271 | SPFDJ | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 272 | Dixon | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Indie Dance -> Indie Dance |
| 273 | Midland | House | Deep House | mechanical: House / Deep House -> Deep House |
| 274 | VTSS | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 275 | Cristoph | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 276 | Denis Sulta | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 277 | SHERELLE | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Jungle -> Drum & Bass |
| 278 | Octo Octa | House | Deep House | mechanical: House / Deep House -> Deep House |
| 279 | Chelina Manuhutu | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 280 | DJ Koze | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Electronica -> Indie Dance |
| 281 | Ben Sims | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 282 | Dave Clarke | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 283 | Kobosil | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 284 | DJ Rush | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 285 | Matador | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 286 | Stephan Bodzin | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 287 | Raxon | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 288 | Konstantin Sibold | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 289 | Kasia | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 290 | Alfred Heinrichs | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 291 | Alignment | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 292 | Andres Campo | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 293 | Rüfüs Du Sol | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Electronica -> Indie Dance |
| 294 | Nic Fanciulli | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 295 | Eelke Kleijn | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 296 | Joeski | House | Tech House | mechanical: House / Tech House -> Tech House |
| 297 | Stan Christ | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 298 | Karah | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 299 | A*S*Y*S | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 300 | Cloudy | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 301 | 6EJOU | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 302 | Basswell | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 303 | Zorza | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 304 | Charlie Sparks | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 305 | DYEN | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 306 | FKA.M4A | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 307 | LAMMER | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 308 | Lee Ann Roberts | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 309 | Parfait | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 310 | Yasmin Gardezi | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 311 | Brina Knauss | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 312 | John Newman | Pop Electronic / Crossover | House | manual: web LOW (singer; house DJ per one review) |
| 313 | Adrian Mills | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 314 | BIIA | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 315 | Alex Farell | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 316 | Steve Angello | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 317 | Adriatique | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 318 | Gryffin | Pop Electronic / Crossover | House | manual: web high (Wikipedia: melodic house, future bass) |
| 319 | Netsky | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Liquid DnB -> Drum & Bass |
| 320 | MPH | Bass Music | House | mechanical: Bass Music / UK Garage -> House |
| 321 | Mita Gami | Indie Dance / Leftfield | Deep House | mechanical: Indie Dance / Leftfield / Organic House -> Deep House |
| 322 | Adam Ten | Indie Dance / Leftfield | Deep House | mechanical: Indie Dance / Leftfield / Organic House -> Deep House |
| 323 | AHEE | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 324 | Alex Chapman | UNKNOWN | Indie Dance | manual: web LOW (dance-pop songwriter/DJ, ambiguous); tags normalised |
| 325 | Andromedik | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Liquid DnB -> Drum & Bass |
| 326 | AniMe | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardcore -> Hardstyle |
| 327 | Patrick Mason | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 328 | Coone | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardstyle -> Hardstyle |
| 329 | Avalon Emerson | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Indie Dance -> Indie Dance |
| 330 | ISOxo | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass |
| 331 | Verraco | Bass Music | Bass | mechanical: Bass Music / Experimental Bass -> Bass |
| 332 | Sicaria | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass |
| 333 | ¥ØUSUKE ¥UK1MATSU | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardcore -> Hardstyle |
| 334 | Oppidan | Bass Music | House | mechanical: Bass Music / UK Garage -> House |
| 335 | Eris Drew | House | Deep House | mechanical: House / Deep House -> Deep House |
| 336 | Ben Böhmer | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 337 | Malugi | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 338 | Rudimental | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Drum & Bass -> Drum & Bass |
| 339 | Knock2 | Bass Music | Bass | mechanical: Bass Music / Trap -> Bass |
| 340 | Overmono | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Electronica -> Indie Dance |
| 341 | Rossi. | House | Tech House | mechanical: House / Tech House -> Tech House |
| 342 | Franky Rizardo | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 343 | Chloé Caillet | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 344 | Vendex | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 345 | Rooler | Hard Dance | Hardstyle | mechanical: Hard Dance / Rawstyle -> Hardstyle |
| 346 | Kanine | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Drum & Bass -> Drum & Bass |
| 347 | Tame Impala | Pop Electronic / Crossover | Indie Dance | manual: not an electronic DJ act (psych-pop band); closest style |
| 348 | DJ HEARTSTRING | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 349 | Luciano | House | Tech House | mechanical: House / Tech House -> Tech House |
| 350 | Phuture Noize | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardstyle -> Hardstyle |
| 351 | DEEZL | Hard Dance | Hardstyle | mechanical: Hard Dance / Rawstyle -> Hardstyle |
| 352 | Odymel | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 353 | SVDDEN DEATH | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 354 | Rebelion | Hard Dance | Hardstyle | mechanical: Hard Dance / Rawstyle -> Hardstyle |
| 355 | Adrián Mills | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 356 | HEDEX | Drum & Bass / Breaks | Drum & Bass | mechanical: Drum & Bass / Breaks / Drum & Bass -> Drum & Bass |
| 357 | East End Dubs | House | Tech House | mechanical: House / Tech House -> Tech House |
| 358 | Chlär | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 359 | D-Block & S-te-Fan | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardstyle -> Hardstyle |
| 360 | Funk Tribu | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 361 | Héctor Oaks | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 362 | Pastis & Buenri | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardcore -> Hardstyle |
| 363 | Prospa | House | Bass | mechanical: House / Breakbeat -> Bass; tags normalised |
| 364 | Interplanetary Criminal | Bass Music | House | mechanical: Bass Music / UK Garage -> House |
| 365 | Vertile | Hard Dance | Hardstyle | mechanical: Hard Dance / Hardstyle -> Hardstyle |
| 366 | Novah | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 367 | Sebastian Ingrosso | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 368 | Axwell | House | Progressive | mechanical: House / Progressive House -> Progressive; tags normalised |
| 369 | Sante Sansone | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 370 | Yvvan Back | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 371 | Trace | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 372 | Rebuke | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno; tags normalised |
| 373 | &ME | House | Deep House | mechanical: House / Deep House -> Deep House |
| 374 | Rampa | House | Deep House | mechanical: House / Deep House -> Deep House |
| 375 | Super Flu | House | Deep House | mechanical: House / Deep House -> Deep House |
| 376 | Loofy | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 377 | A.M.C | Bass Music | Drum & Bass | mechanical: Bass Music / Drum & Bass -> Drum & Bass |
| 378 | Delta Heavy | Bass Music | Drum & Bass | mechanical: Bass Music / Drum & Bass -> Drum & Bass; tags normalised |
| 379 | Simula | Bass Music | Drum & Bass | mechanical: Bass Music / Drum & Bass -> Drum & Bass |
| 380 | Serum | Bass Music | Drum & Bass | mechanical: Bass Music / Drum & Bass -> Drum & Bass |
| 381 | Circadian | Bass Music | Drum & Bass | mechanical: Bass Music / Drum & Bass -> Drum & Bass |
| 382 | Mozey | Bass Music | Drum & Bass | mechanical: Bass Music / Drum & Bass -> Drum & Bass |
| 383 | Amplify | Bass Music | Drum & Bass | mechanical: Bass Music / Drum & Bass -> Drum & Bass |
| 384 | Vakabular | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 385 | Maze 28 | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 386 | Kamilo Sanclemente | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 387 | Dosem | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 388 | Quivver | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 389 | Paul Thomas | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 390 | Michael A | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 391 | Bondarev | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 392 | Antdot | House | Afro House | mechanical: House / Afro House -> Afro House |
| 393 | MoBlack | House | Afro House | mechanical: House / Afro House -> Afro House |
| 394 | Francis Mercier | House | Afro House | mechanical: House / Afro House -> Afro House |
| 395 | Stryv | House | Afro House | mechanical: House / Afro House -> Afro House |
| 396 | Caiiro | House | Afro House | mechanical: House / Afro House -> Afro House |
| 397 | Maz (BR) | House | Afro House | mechanical: House / Afro House -> Afro House |
| 398 | Hannah Laing | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 399 | VNSSA | House | Tech House | mechanical: House / Tech House -> Tech House; tags normalised |
| 400 | Shimza | House | Afro House | mechanical: House / Afro House -> Afro House |
| 401 | Yulia Niko | Indie Dance / Leftfield | Deep House | mechanical: Indie Dance / Leftfield / Organic House -> Deep House |
| 402 | Zerb | House | Deep House | mechanical: House / Deep House -> Deep House; tags normalised |
| 403 | WHIPPED CREAM | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass; tags normalised |
| 404 | Nostalgix | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass; tags normalised |
| 405 | Rivo | House | Deep House | mechanical: House / Deep House -> Deep House |
| 406 | Ayybo | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 407 | Da Capo | House | Afro House | mechanical: House / Afro House -> Afro House |
| 408 | Mila Journee | Indie Dance / Leftfield | Deep House | mechanical: Indie Dance / Leftfield / Organic House -> Deep House |
| 409 | Lauren Mia | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 410 | Jay De Lys | House | Melodic Techno | manual: legacy subgenre Melodic House -> Melodic Techno (contract §1); tags normalised |
| 411 | ALLEYCVT | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass; tags normalised |
| 412 | Beltran | Techno | Melodic Techno | mechanical: Techno / Melodic Techno -> Melodic Techno |
| 413 | Jessica Audiffred | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass; tags normalised |
| 414 | Tape B | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass; tags normalised |
| 415 | Linney | Pop Electronic / Crossover | Progressive | manual: web LOW (ambiguous: progressive/melodic per one artist); tags normalised |
| 416 | Azzecca | House | Progressive | mechanical: House / Progressive House -> Progressive |
| 417 | Bonobo | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Electronica -> Indie Dance |
| 418 | Four Tet | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Electronica -> Indie Dance |
| 419 | A-Trak | House | Big Room | mechanical: House / Electro House -> Big Room; tags normalised |
| 420 | Elderbrook | Pop Electronic / Crossover | House | manual: web LOW (Wikipedia electronic/garage; festt house); tags normalised |
| 421 | DJ Diesel | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass; tags normalised |
| 422 | Amber Broos | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 423 | Subtronics | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass; tags normalised |
| 424 | Duke Dumont | House | Deep House | mechanical: House / Deep House -> Deep House; tags normalised |
| 425 | Pete Tong | House | Deep House | mechanical: House / Deep House -> Deep House; tags normalised |
| 426 | The Magician | Indie Dance / Leftfield | Indie Dance | mechanical: Indie Dance / Leftfield / Indie Dance -> Indie Dance; tags normalised |
| 427 | MARTA | Techno | Tech House | mechanical: Techno / Tech House -> Tech House; tags normalised |
| 428 | H! DUDE | Techno | Hard Techno | mechanical: Techno / Hard Techno -> Hard Techno |
| 429 | Ninajirachi | Pop Electronic / Crossover | Electro | manual: web medium (Techno Airlines: electro house; self-described girl EDM) |
| 430 | LYNY | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 431 | Nitepunk | Bass Music | Bass | mechanical: Bass Music / Dubstep -> Bass |
| 432 | Vanco | House | Afro House | mechanical: House / Afro House -> Afro House |
| 433 | The xx | Pop | Indie Dance | manual: web LOW (indie electronic band; Jamie xx DJ sets are bass); tags normalised |
| 434 | &friends | Electronic | Deep House | manual: web medium (festapp listing; profiles deep house); tags normalised |
| 435 | A For Alpha | Electronic | House | manual: web medium (MusicTech: 90s-inspired house); tags normalised |
| 436 | A.D.H.S. | Electronic | Techno | manual: web high (RA; Beatport techno top 10, Drumcode); tags normalised |
| 437 | Across Boundaries | Electronic | House | manual: web medium (Soundcharts: house / tech house); tags normalised |
| 438 | ADMNTi | Electronic | Tech House | manual: LOW confidence (ADE: house/tech-house); tags normalised |
| 439 | Agustin Giri | Electronic | Melodic Techno | manual: LOW confidence: sources conflict; tags normalised |
| 440 | ALEXANDER M | Electronic | Tech House | manual: LOW confidence: ambiguous name; tags normalised |
| 441 | Aline Rocha | Electronic | House | manual: web high (RA: house, disco/soulful); tags normalised |
| 442 | Always Late | Electronic | House | manual: LOW confidence default: not found; tags normalised |
| 443 | ALY | Electronic | Melodic Techno | manual: LOW confidence: closest match ALAY; tags normalised |
| 444 | AMAYAH | Electronic | Trance | manual: LOW confidence: loose match; tags normalised |
| 445 | AMPRS&ND | Electronic | Tech House | manual: web medium (Frontstage: tech/bass house); tags normalised |
| 446 | ANDY DEDE | Electronic | Afro House | manual: web high (RA: Afro House); tags normalised |
| 447 | Annie Lew | Electronic | Techno | manual: web medium (RA event bio: techno residency); tags normalised |
| 448 | Art Of Fighters | Hardcore | Hardstyle | mechanical: Hardcore -> Hardstyle; tags normalised |
| 449 | B.Love | Electronic | House | manual: web medium (Beatport review: deep house, electro); tags normalised |
| 450 | Bambis | Electronic | Drum & Bass | manual: LOW confidence: genre-blending (Bambii); tags normalised |
| 451 | Bella Backe | Electronic | House | manual: web medium (house, disco, afro); tags normalised |
| 452 | Bella Renee | Electronic | Drum & Bass | manual: web medium (EDM Identity: DnB/bass); tags normalised |
| 453 | Ben Balance | Electronic | House | manual: LOW confidence default: not found; tags normalised |
| 454 | Benji King | Electronic | House | manual: LOW confidence default: not found; tags normalised |
| 455 | Bondarük | Electronic | Tech House | manual: LOW confidence: closest Bondar; tags normalised |
| 456 | Boss Priester | Electronic | House | manual: web medium (minimal/house/techno, underground house); tags normalised |
| 457 | Captain Wallop | Electronic | House | manual: web medium (UK garage blended with house; single source); tags normalised |
| 458 | Casepeat | Electronic | Trance | manual: web high (bio: trance, progressive trance); tags normalised |
| 459 | Cassy | Electronic | Techno | manual: web high (AllMusic: minimal techno; Insomniac); tags normalised |
| 460 | Cristobal Pesce | Electronic | Psytrance | manual: web medium (Insomniac: psytrance, techno); tags normalised |
| 461 | Daisybelle | Electronic | Deep House | manual: web medium (Frontstage, Balearic deep house); tags normalised |
| 462 | DEEPFAKE | Electronic | Tech House | manual: LOW confidence: ambiguous name; tags normalised |
| 463 | DJ Bin | Electronic | Trance | manual: LOW confidence: Tokyo trance parties; tags normalised |
| 464 | DJ Habibeats | Electronic | Afro House | manual: LOW confidence: Bandsintown lists Afro House; tags normalised |
| 465 | DJ Mell G | Electronic | Electro | manual: web high (DJ Mag: champions electro); tags normalised |
| 466 | DJ Split | Electronic | House | manual: web high (Bandcamp/RA: Chicago house); tags normalised |
| 467 | Don't F**k with Disco | Electronic | House | manual: web medium (disco, funk, soulful house); tags normalised |
| 468 | Doudou MD | Electronic | House | manual: web medium (house and techno; deep house); tags normalised |
| 469 | Dual Damage | Electronic | Hardstyle | manual: web verified high (Insomniac, Techno Airlines: raw hardstyle); tags normalised |
| 470 | E-Boo | Electronic | House | manual: LOW confidence default: no reliable profile found; tags normalised |
| 471 | Edele Andaya | Electronic | Trance | manual: web verified high (Frontstage: main passion always Trance); tags normalised |
| 472 | Elina | Electronic | Techno | manual: LOW confidence: ambiguous name, groove techno profile; tags normalised |
| 473 | Elisa Bee | Electronic | Techno | manual: web verified high (Refuge Worldwide, Traxsource Techno); tags normalised |
| 474 | Ella Knight | Electronic | House | manual: web verified high (RA: soulful house, garage, disco); tags normalised |
| 475 | Ely Oaks | Electronic | Tech House | manual: web medium (Techno Airlines: tech house, techno); tags normalised |
| 476 | Emily Nash | Electronic | Tech House | manual: web medium (Skiddle interview: dance/tech-house); tags normalised |
| 477 | Enrica Falqui | Electronic | Techno | manual: web medium (Set79 bio: techno with house, electro); tags normalised |
| 478 | Enzo is Burning | Electronic | Tech House | manual: web medium (Earth agency: minimal tech-house); tags normalised |
| 479 | Fahlberg | Electronic | Melodic Techno | manual: web medium (self-described Nordic melodic; event listings); tags normalised |
| 480 | Finnebassen | Electronic | Deep House | manual: web medium (Viberate: deep house); tags normalised |
| 481 | Fish56Octagon | Electronic | House | manual: LOW confidence: described as genre-spanning, House most cited; tags normalised |
| 482 | Frank Storm | Electronic | House | manual: web medium (Xceed: house / tech house); tags normalised |
| 483 | George Mensah | Electronic | House | manual: web high (Beatport House); tags normalised |
| 484 | Gramatik | Bass Music | Bass | mechanical: Bass Music -> Bass; tags normalised |
| 485 | Gravagerz | Electronic | House | manual: web medium (Last.fm: house, UK garage, dubstep); tags normalised |
| 486 | Hamish & Toby | Electronic | House | manual: web high (RA bio: golden-era house, tech house); tags normalised |
| 487 | Hidde van Wee | Electronic | House | manual: web medium (Frontstage: deep/tech house, house DJ); tags normalised |
| 488 | II FACES | Electronic | Deep House | manual: web medium (Soundcharts: deep house); tags normalised |
| 489 | Isaac Carter | Electronic | Deep House | manual: web medium (Rinse: vocal deep house); tags normalised |
| 490 | ISAbella | Electronic | House | manual: web medium (Montreux: house, techno); tags normalised |
| 491 | j:me | Electronic | Tech House | manual: LOW confidence: ambiguous name, UK tech house profile; tags normalised |
| 492 | Jake Rollinson | Electronic | House | manual: LOW confidence default: no profile found; tags normalised |
| 493 | James Lavelle | Electronic | Indie Dance | manual: LOW confidence: Mo' Wax / UNKLE, leftfield; tags normalised |
| 494 | Jeremy Olander | Progressive House | Progressive | mechanical: Progressive House -> Progressive; tags normalised |
| 495 | Joe Rolét | Electronic | Techno | manual: web medium (Rinse: minimal grooves, techno/house label); tags normalised |
| 496 | JOMMY | Electronic | House | manual: LOW confidence: Tokyo house/techno party, no genre stated; tags normalised |
| 497 | Jordan Brando | Electronic | House | manual: web medium (Set79: minimal house, house, techno); tags normalised |
| 498 | Jude Lenihan | Electronic | Techno | manual: LOW confidence default: no genre found; tags normalised |
| 499 | Julian Anthony | Electronic | House | manual: web medium (Frontstage: deep house, house); tags normalised |
| 500 | Julian Mesa | Electronic | Techno | manual: web medium (RA: underground house and techno, Beatport Techno); tags normalised |
| 501 | Julya Karma | Electronic | House | manual: web medium (Frontstage: house, house/techno scene); tags normalised |
| 502 | Just Jam | Electronic | Bass | manual: LOW confidence: grime-rooted collective, closest bass category; tags normalised |
| 503 | jWave | Electronic | House | manual: web medium (Soundcharts: house, deep house, electro); tags normalised |
| 504 | JXXXO | Electronic | Big Room | manual: LOW confidence: EDM-adjacent guess, no genre stated; tags normalised |
| 505 | Katy Rough | Electronic | House | manual: LOW confidence default: not found; tags normalised |
| 506 | Kellie Allen | Electronic | Deep House | manual: web high (Traxsource: deep and soulful house); tags normalised |
| 507 | Kilopatrah Jones | Electronic | House | manual: web medium (RA: diva house); tags normalised |
| 508 | Koki Byrd | Electronic | House | manual: LOW confidence default: not found; tags normalised |
| 509 | Kollektiv Ost | Electronic | Tech House | manual: web medium (goout: tech house; mixed profiles); tags normalised |
| 510 | KYRUH | Electronic | Techno | manual: web high (DJ Mag: techno); tags normalised |
| 511 | Lady Dammage | Electronic | Hard Techno | manual: web medium (hardcore techno, Darkside Unleashed); tags normalised |
| 512 | Laidlaw | Electronic | House | manual: web medium (DGTL: house and garage); tags normalised |
| 513 | Laure Croft | Electronic | Techno | manual: web high (Set79, Partyflock: techno); tags normalised |
| 514 | Leena Punks | Electronic | Progressive | manual: web medium (Frontstage: melodic progressive house); tags normalised |
| 515 | LIEKS | Electronic | Techno | manual: LOW confidence: no clear primary genre; tags normalised |
| 516 | Loukeman | Electronic | Indie Dance | manual: web medium (Billboard: alternative house, indie dance); tags normalised |
| 517 | Lucas Alexander | Electronic | Tech House | manual: web medium (DJ Mag, Traxsource: tech house); tags normalised |
| 518 | Luke Alexander | Electronic | Big Room | manual: LOW confidence: big room / progressive / tech house blend; tags normalised |
| 519 | MADVILLA | Electronic | Deep House | manual: web medium (Bandcamp: ghetto deep); tags normalised |
| 520 | Mareena | Electronic | Techno | manual: web high (Refuge, Tresor: dub techno); tags normalised |
| 521 | Matt Proxy | Electronic | House | manual: LOW confidence: no DJ found, soul/funk/disco house; tags normalised |
| 522 | Melody RA+RE | Electronic | House | manual: LOW confidence default: no profile found; tags normalised |
| 523 | Micah Baxter | Electronic | Tech House | manual: web medium (Beatportal: minimal tech house); tags normalised |
| 524 | MiNNA | Electronic | House | manual: web medium (disco, old school house, vocal dance); tags normalised |
| 525 | Miss I | Electronic | House | manual: LOW confidence default: not found; tags normalised |
| 526 | Mrs Magoo | Electronic | Drum & Bass | manual: web high (RA bio: rolling DnB, junglist); tags normalised |
| 527 | Ms. Mada | Electronic | House | manual: web medium (Insomniac: house; Frontstage: house/tech house); tags normalised |
| 528 | Mungo's Hi Fi | Bass Music | Bass | mechanical: Bass Music -> Bass; tags normalised |
| 529 | Murphy's Law | Electronic | House | manual: web medium (Insomniac: house, tech house); tags normalised |
| 530 | NAMIMI SENSEI | Electronic | Techno | manual: LOW confidence: no genre stated, venue inference; tags normalised |
| 531 | Natalia Roth | Electronic | Techno | manual: web medium (Insomniac: Techno; minimal techno/house bio); tags normalised |
| 532 | NATHASSIA | Electronic | Big Room | manual: LOW confidence: mainstage EDM / bass house / electro house sets; tags normalised |
| 533 | Nick Warren | Progressive House | Progressive | mechanical: Progressive House -> Progressive; tags normalised |
| 534 | no_ip | Electronic | Indie Dance | manual: web medium (Mood: polished indie dance); tags normalised |
| 535 | nocapz. | Electronic | Tech House | manual: web medium (When We Dip: tech house, minimal, Afro); tags normalised |
| 536 | O.BEE | Electronic | House | manual: web medium (Insomniac: house, minimal/deep techno); tags normalised |
| 537 | OJ Willis | Electronic | House | manual: LOW confidence: closest OJ Wilson, soul/funk/house; tags normalised |
| 538 | PACH | Electronic | Tech House | manual: web medium (Rinse: minimal, early tech house); tags normalised |
| 539 | Paisley Jensen | Electronic | House | manual: web medium (SoundCloud: 90s house, disco, Chicago); tags normalised |
| 540 | Paranoid London | Acid House | House | mechanical: Acid House -> House; tags normalised |
| 541 | PARISI | Electronic | House | manual: LOW confidence: Italian duo, pop/house listings; tags normalised |
| 542 | Phill de Janeiro | Electronic | House | manual: web high (RA bio: house and disco); tags normalised |
| 543 | PHILOU | Electronic | Afro House | manual: web medium (Armada: afrotech, amapiano, tech-house; ambiguous); tags normalised |
| 544 | Protokseed | Electronic | Hard Techno | manual: web medium (Beatport: hard dance/hardcore; French tekno); tags normalised |
| 545 | Purple Rabbit | Electronic | House | manual: LOW confidence default: not found; tags normalised |
| 546 | R Squared | Electronic | Tech House | manual: web high (Qobuz: tech house); tags normalised |
| 547 | R8YZ | Electronic | House | manual: LOW confidence default: not found; tags normalised |
| 548 | RaeCola | Electronic | Tech House | manual: web medium (Insomniac: house; ghetto tech house reviews); tags normalised |
| 549 | Ranger Trucco | Electronic | House | manual: web medium (Bandsintown: minimal house, tech house); tags normalised |
| 550 | Reeshy | Electronic | House | manual: web high (RA: UK house, garage); tags normalised |
| 551 | Reflex Blue | Electronic | Tech House | manual: web medium (sub-heavy UK tech house); tags normalised |
| 552 | Ren Yokoi | Electronic | Techno | manual: LOW confidence: event tags techno and house; tags normalised |
| 553 | Romane Santarelli | Electronic | Melodic Techno | manual: web medium (Shotgun: melodic techno); tags normalised |
| 554 | Rose Kourts | Electronic | House | manual: web medium (Refuge: house and techno); tags normalised |
| 555 | RTK Tarantino | Electronic | House | manual: web medium (RA: garage and house influences); tags normalised |
| 556 | RYOHEI | Electronic | House | manual: LOW confidence: Tokyo house/techno, ambiguous name; tags normalised |
| 557 | Saffron Stone | Electronic | Tech House | manual: web high (Frontstage, Xceed: tech house); tags normalised |
| 558 | Saint Ludo | Electronic | Bass | manual: web medium (UK bass, grime, garage, jungle); tags normalised |
| 559 | SALIMATA | Electronic | Indie Dance | manual: LOW confidence: not an electronic DJ (singer), closest style; tags normalised |
| 560 | Samantha Loveridge | Electronic | Afro House | manual: web medium (When We Dip: Afro House); tags normalised |
| 561 | San Holo | Bass Music | Bass | mechanical: Bass Music -> Bass; tags normalised |
| 562 | Sander van Doorn | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM -> Big Room; tags normalised |
| 563 | Scarlett O'Malley | Electronic | House | manual: web high (Refuge: deep house, house, tech house); tags normalised |
| 564 | Scotty Boy | Electronic | House | manual: web medium (Frontstage: house, deep/jackin house); tags normalised |
| 565 | Sebastian Morxx | Electronic | Techno | manual: LOW confidence default: genre not found; tags normalised |
| 566 | Shakèd | Electronic | House | manual: LOW confidence: drifting house, minimal house; tags normalised |
| 567 | Showtek | Big Room / Festival EDM | Big Room | mechanical: Big Room / Festival EDM -> Big Room; tags normalised |
| 568 | Sim0ne | Electronic | Hardstyle | manual: web medium (hard house, happy hardcore mapped to hardcore family; trance alt); tags normalised |
| 569 | Soraere Brocken | Electronic | Hard Techno | manual: LOW confidence: not confirmed (SORAÄ?); tags normalised |
| 570 | Soul Mass Transit System | Electronic | Bass | manual: LOW confidence: UK garage / bassline, mapped to Bass; tags normalised |
| 571 | The Brothers Grim | Electronic | Hard Techno | manual: LOW confidence: Bristol techno act; tags normalised |
| 572 | The Ghost | Electronic | Hardstyle | manual: LOW confidence: Belgian DJ Ghost, hard dance/hardstyle; tags normalised |
| 573 | Tomas Station | Electronic | House | manual: web medium (Insomniac: house, deep/minimal); tags normalised |
| 574 | Unai Trotti | Electronic | Techno | manual: web medium (Set79: driving techno); tags normalised |
| 575 | VON DI | Electronic | Bass | manual: web medium (Viberate: trap/future bass, bass-driven); tags normalised |
| 576 | Vortek's | Electronic | Hard Techno | manual: web medium (hard techno scene profile); tags normalised |
| 577 | Winson Ngoh | Electronic | Hard Techno | manual: web high (WINSON: hard techno); tags normalised |
| 578 | Z@p | Electronic | Techno | manual: web medium (RA: house and techno DJ); tags normalised |

## Tag-only changes

| DJ | Old tags | New tags |
|---|---|---|
| Alok | commercial, mainstream | mainstream |
| Armin Van Buuren | melodic, festival | melodic |
| Don Diablo | festival, commercial | mainstream |
| Lost Frequencies | melodic, commercial | melodic, mainstream |
| Oliver Heldens | club |  |
| Mike Williams | festival |  |
| Dubdogz | commercial | mainstream |
| Cat Dealers | commercial | mainstream |
| Odd Mob | club |  |
| Matroda | club |  |
| Script | UNKNOWN |  |
| Öwnboss | festival |  |
| Hills | UNKNOWN |  |
| D.O.D | festival |  |
| Marten Hørger | club |  |
| Mairee | club |  |
| Tom Enzy | festival |  |
| Marten Horger | club |  |
| MaRLo | festival |  |
| Technasia | club |  |
| Bella Claxton | UNKNOWN |  |
| Tchami x Malaa | club |  |
| Airrica | UNKNOWN |  |
| Zoe Gitter | UNKNOWN |  |
| Yanamaste | UNKNOWN |  |
| HI-LO | hard, club | hard |
| Niels Van Gogh | festival |  |
| Aly & Fila | melodic, festival | melodic |
| LP Giobbi | club, festival |  |
| Taiki Nulight | club, underground | underground |
| Salute | club, underground | underground |
| Laura Van Dam | melodic, festival | melodic |
| Disco Lines | club, festival |  |
| GUDFELLA | club, festival |  |
| Danny Howard | discovered |  |
| Onlynumbers | discovered |  |
| Ben Sterling | discovered |  |
| KUKO | discovered |  |
| Restricted | discovered |  |
| Serafina | discovered |  |
| Max Dean | discovered |  |
| Pendulum | discovered |  |
| Sidney Charles | discovered |  |
| Silva Bumpa | discovered |  |
| Traumer | discovered |  |
| Winson | discovered |  |
| Fumi | discovered |  |
| Marsolo | discovered |  |
| Nikolina | discovered |  |
| Clara Cuvé | discovered |  |
| Ewan McVicar | discovered |  |
| Faster Horses | discovered |  |
| Jamback | discovered |  |
| Shanti Celeste | discovered |  |
| Trym | discovered |  |
| ÜBERKIKZ | discovered |  |
| Vladimir Cauchemar | discovered |  |
| Arielle Free | discovered |  |
| Enzo Siragusa | discovered |  |
| Folamour | discovered |  |
| GRiZ | discovered |  |
| Hybrid Minds | discovered |  |
| Kirollus | discovered |  |
| KLOFAMA | discovered |  |
| Kyle Starkey | discovered |  |
| Luke Dean | discovered |  |
| Luuk van Dijk | discovered |  |
| Mall Grab | discovered |  |
| Oklou | discovered |  |
| ØTTA | discovered |  |
| Partiboi69 | discovered |  |
| Somewhen | discovered |  |
| Vieze Asbak | discovered |  |
| Ben UFO | discovered |  |
| Culture Shock | discovered |  |
| DeVault | discovered |  |
| DJ Gigola | discovered |  |
| horsegiirL | discovered |  |
| Jackie Hollander | discovered |  |
| Johannes Schuster | discovered |  |
| Koven | discovered |  |
| Kruelty | discovered |  |
| L.P. Rhythm | discovered |  |
| Local Dub | discovered |  |
| Major Lazer | discovered |  |
| Mar-t | discovered |  |
| Mischluft | discovered |  |
| Mosimann | discovered |  |
| NEGITIV | discovered |  |
| Obskür | discovered |  |
| Omar+ | discovered |  |
| Paramida | discovered |  |
| Rouge | discovered |  |
| SOSA | discovered |  |
| Tini Gessler | discovered |  |
| X CLUB. | discovered |  |
| Armand van Helden | discovered |  |
| Bad Boombox | discovered |  |
| Benwal | discovered |  |
| BIIANCO | discovered |  |
| Billy Gillies | discovered |  |
| Black Sun Empire | discovered |  |
| Black Tiger Sex Machine | discovered |  |
| Boys Noize | discovered |  |
| Camo & Krooked | discovered |  |
| Christian AB | discovered |  |
| davyboi | discovered |  |
| Elli Acula | discovered |  |
| Francesco Del Garda | discovered |  |
| Freddy K | discovered |  |
| Future 666 | discovered |  |
| IDEMI | discovered |  |
| Jimi Jules | discovered |  |
| Julian Fijma | discovered |  |
| Kepler | discovered |  |
| Locklead | discovered |  |
| Locky | discovered |  |
| Peach | discovered |  |
| Pegassi | discovered |  |
| PRADA2000 | discovered |  |
| Prunk | discovered |  |
| Robbie Doherty | discovered |  |
| Sam Alfred | discovered |  |
| Sarah Story | discovered |  |
| Setaoc Mass | discovered |  |
| Seven Lions | discovered |  |
| Special Request | discovered |  |
| Tempza | discovered |  |
| The Rocketman | discovered |  |
| Underworld | discovered |  |
| ¥ØU$UK€ ¥UK1MAT$U | discovered |  |
| Adam Sellouk | discovered |  |
| Amè | discovered |  |
| Anetha | discovered |  |
| BASHKKA | discovered |  |
| blk. | discovered |  |
| CAAL | discovered |  |
| Call Super | discovered |  |
| CARISTA | discovered |  |
| Carl Craig | discovered |  |
| CESAR ALMENA | discovered |  |
| Chasewest | discovered |  |
| Damian Lazarus | discovered |  |
| Dart | discovered |  |
| Deer Jade | discovered |  |
| Dennis Quin | discovered |  |
| DJ Cringey | discovered |  |
| DJ Tennis | discovered |  |
| DXNBY | discovered |  |
| Dyed Soundorom | discovered |  |
| Ellia Jaya | discovered |  |
| Elliot Schooling | discovered |  |
| Floating Points | discovered |  |
| Frost Children | discovered |  |
| Grace Dahl | discovered |  |
| Horse Meat Disco | discovered |  |
| Ilario Alicante | discovered |  |
| Joss Dean | discovered |  |
| Juicy Romance | discovered |  |
| Karretero | discovered |  |
| KimberlaID | discovered |  |
| KiNK | discovered |  |
| Kolter | discovered |  |
| Liam Palmer | discovered |  |
| M-High | discovered |  |
| Manda Moor | discovered |  |
| Mason Collective | discovered |  |
| Mauro Picotto | discovered |  |
| MCR-T | discovered |  |
| Morgan Seatree | discovered |  |
| Nicolas Julian | discovered |  |
| Olive F | discovered |  |
| Om Unit | discovered |  |
| OMRI. | discovered |  |
| Oskar med k | discovered |  |
| Paige Tomlinson | discovered |  |
| Palms Trax | discovered |  |
| PETERBLUE | discovered |  |
| PLK | discovered |  |
| Pola & Bryson | discovered |  |
| Priku | discovered |  |
| Raresh | discovered |  |
| Ryan Elliott | discovered |  |
| S.P.Y | discovered |  |
| Saidah | discovered |  |
| Sally C | discovered |  |
| Salomé | discovered |  |
| Saoirse | discovered |  |
| Shy FX | discovered |  |
| Sigma | discovered |  |
| Silvie Loto | discovered |  |
| Syreeta | discovered |  |
| Temudo | discovered |  |
| Toman | discovered |  |
| Tonn Piper | discovered |  |
| Toximami | discovered |  |
| TSHA | discovered |  |
| Walker & Royce | discovered |  |
| 19:26 | discovered |  |
| 4am Kru | discovered |  |
| A Little Sound | discovered |  |
| A.N.I. | discovered |  |
| Alex Wann | discovered |  |
| Alisha | discovered |  |
| Alycia Bezgo | discovered |  |
| Arapu | discovered |  |
| Basslayerz | discovered |  |
| BAUGRUPPE90 | discovered |  |
| Blasha & Allatt | discovered |  |
| Brutalismus 3000 | discovered |  |
| bullet tooth | discovered |  |
| Butch | discovered |  |
| Cam Stockman | discovered |  |
| Cara Elizabeth | discovered |  |
| Club Angel | discovered |  |
| Dabin | discovered |  |
| Daria Kolosova | discovered |  |
| David Löhlein | discovered |  |
| Demi Riquisimo | discovered |  |
| DJ Fuckoff | discovered |  |
| DJ Hell | discovered |  |
| DJ Minx | discovered |  |
| DJ Nobu | discovered |  |
| Dombresky | discovered |  |
| Dr Banana | discovered |  |
| Eksman | discovered |  |
| Eliza Rose | discovered |  |
| Emilija | discovered |  |
| Empire of the Sun | discovered |  |
| Excision | discovered |  |
| Fenrick | discovered |  |
| Fireground | discovered |  |
| Flight Facilities | discovered |  |
| Flosstradamus | discovered |  |
| Flowdan | discovered |  |
| Fred V | discovered |  |
| Fumiya Tanaka | discovered |  |
| Gaskin | discovered |  |
| Germano Ventura | discovered |  |
| Groove Armada | discovered |  |
| HALO | discovered |  |
| Helena Hauff | discovered |  |
| Helena Lauwaert | discovered |  |
| Hvob | discovered |  |
| In Verruf | discovered |  |
| Jen Cardini | discovered |  |
| Jody Wisternoff | discovered |  |
| Kander | discovered |  |
| Kaskade | discovered |  |
| Katnada | discovered |  |
| Kelly Lee Owens | discovered |  |
| Kidoo | discovered |  |
| KIM SWIM | discovered |  |
| KinAhau | discovered |  |
| Kokeshi | discovered |  |
| Layla Benitez | discovered |  |
| Lilya Mandre | discovered |  |
| Lou Nour | discovered |  |
| Luca Donzelli | discovered |  |
| Marco Strous | discovered |  |
| Marie-Julie | discovered |  |
| Marlie | discovered |  |
| Miguel Nery | discovered |  |
| Mish | discovered |  |
| Moby | discovered |  |
| Monolink | discovered |  |
| Monrroe | discovered |  |
| Moodymann | discovered |  |
| Nia Archives | discovered |  |
| Notion | discovered |  |
| Nuke | discovered |  |
| Paraçek | discovered |  |
| Paul Oakenfold | discovered |  |
| Pawlowski | discovered |  |
| Petit Biscuit | discovered |  |
| Philippa Pacho | discovered |  |
| Schak | discovered |  |
| SHDW | discovered |  |
| Shonky | discovered |  |
| SIKOTI | discovered |  |
| Skepta | discovered |  |
| SLVL | discovered |  |
| Sonja Moonear | discovered |  |
| SP:MC | discovered |  |
| Svetec | discovered |  |
| Swimming Paul | discovered |  |
| Technimatic | discovered |  |
| Tiga | discovered |  |
| Todd Terry | discovered |  |
| Tommy phillips | discovered |  |
| TroyBoi | discovered |  |
| Ueberrest | discovered |  |
| Ultrabeat | discovered |  |
| Wilkinson | discovered |  |
| WUKI | discovered |  |
| Adam F | discovered |  |
| Alec Falconer | discovered |  |
| Alexis Raphael | discovered |  |
| Alley Kay | discovered |  |
| Amy Wiles | discovered |  |
| Anabel Englund | discovered |  |
| Anane | discovered |  |
| Anna Reusch | discovered |  |
| ANNĒ | discovered |  |
| Annie Errez | discovered |  |
| Anthea | discovered |  |
| Anthony Attalla | discovered |  |
| Apollonia | discovered |  |
| Archie Hamilton | discovered |  |
| Bass Modulators | discovered |  |
| Bedouin | discovered |  |
| Bruno Martini | discovered |  |
| Burnski | discovered |  |
| Catz 'N Dogz | discovered |  |
| Chez Damier | discovered |  |
| Dan Shake | discovered |  |
| Dana Ruh | discovered |  |
| Daniel Avery | discovered |  |
| Darius Syrossian | discovered |  |
| David Morales | discovered |  |
| De La Swing | discovered |  |
| Deeper Purpose | discovered |  |
| Dimension | discovered |  |
| Dimibo | discovered |  |
| DJ Godfather | discovered |  |
| DJ Pete | discovered |  |
| Dr Dubplate | discovered |  |
| Dungeon Meat | discovered |  |
| Dusky | discovered |  |
| Egyptian Lover | discovered |  |
| Eskuche | discovered |  |
| Faithless | discovered |  |
| Feder | discovered |  |
| Ferreck Dawn | discovered |  |
| Franco Cinelli | discovered |  |
| Gareth Emery | discovered |  |
| Garrett David | discovered |  |
| Girls Don't Sync | discovered |  |
| Graham Gold | discovered |  |
| Harry Romero | discovered |  |
| Harry Shotta | discovered |  |
| Hayden James | discovered |  |
| Heidi Lawden | discovered |  |
| HoneyLuv | discovered |  |
| Infinity Ink | discovered |  |
| Joachim Pastor | discovered |  |
| Jon Rundell | discovered |  |
| Lee Foss | discovered |  |
| Licaxxx | discovered |  |
| Lil' Louis | discovered |  |
| Louie Vega | discovered |  |
| Magda | discovered |  |
| Makèz | discovered |  |
| Markantonio | discovered |  |
| Markus Schulz | discovered |  |
| Marten Lou | discovered |  |
| Mathew Jonson | discovered |  |
| Maxinne | discovered |  |
| Mella Dee | discovered |  |
| Melvo Baptiste | discovered |  |
| Michael Gray | discovered |  |
| Michel de Hey | discovered |  |
| Moxie | discovered |  |
| Nastia Reigel | discovered |  |
| Natasha Diggs | discovered |  |
| Nick Curly | discovered |  |
| Nørbak | discovered |  |
| O'Flynn | discovered |  |
| Onur Özer | discovered |  |
| Osamu M | discovered |  |
| Parrish Smith | discovered |  |
| Piem | discovered |  |
| Pretty Pink | discovered |  |
| Red Axes | discovered |  |
| Rene Wise | discovered |  |
| Rich NXT | discovered |  |
| Richard Fearless | discovered |  |
| Risa Taniguchi | discovered |  |
| Riva Starr | discovered |  |
| Roberto Capuano | discovered |  |
| Robin Schulz | discovered |  |
| Rossko | discovered |  |
| Sammy Porter | discovered |  |
| Samuel Deep | discovered |  |
| Sandy Rivera | discovered |  |
| Scooter | discovered |  |
| Seb Zito | discovered |  |
| Shermanology | discovered |  |
| Stuart Patterson | discovered |  |
| Sweely | discovered |  |
| Terry Farley | discovered |  |
| The Shapeshifters | discovered |  |
| tINI | discovered |  |
| Tristan da Cunha | discovered |  |
| Tritonal | discovered |  |
| Veronica Vasicka | discovered |  |
| Voigtmann | discovered |  |
| WhoMadeWho | discovered |  |
| XDB | discovered |  |
| ZHU | discovered |  |
