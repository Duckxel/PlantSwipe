# Easter Egg Hunt 2026

**Type:** Egg Hunt
**Dates:** April 5 - April 12, 2026
**Badge:** Easter Egg Hunter 2026 (`easter-2026`)
**Total Eggs:** 9 (1 About page + 8 plant pages)

---

## Setup

Run in order on your Supabase database:

```bash
# 1. Create/update the badge
psql $DATABASE_URL -f plant-swipe/badges/event_2026_easter.sql

# 2. Create/update the event + eggs
psql $DATABASE_URL -f plant-swipe/events/2026_EASTER/setup.sql
```

Or paste both files into the Supabase SQL Editor (badge first, then event).

Both scripts are **idempotent** — re-run after editing descriptions, dates, or plants. They will update existing data without creating duplicates.

The event starts in **admin-only mode** for testing. Toggle it public via Admin > Events when ready.

---

## Egg Locations

### 1. About Page (`/about`)
**EN:** Aphylia was born in Montpellier, inspired by the Aphyllante flower native to the region!
**FR:** Aphylia est nee a Montpellier, inspiree par l'Aphyllante, une fleur native de la region !

### 2. Primevere (Primrose)
**EN:** In Celtic folklore, the primrose is called the "fairy flower" — it was believed to open the doors to the supernatural world!
**FR:** Dans le folklore celtique, la primevere est appelee "fleur des fees" — on croyait qu'elle ouvrait les portes du monde surnaturel !

**Background:** The primrose symbolizes protection and luck. In Irish, Scottish, and Welsh folklore it's the fairy flower. In Germanic traditions, primroses were hung on doors and windows to ward off evil spirits.

### 3. Jonquille / Narcisse (Daffodil)
**EN:** In Greek mythology, the daffodil is linked to Narcissus, who fell in love with his own reflection in a river!
**FR:** Dans la mythologie grecque, la jonquille est liee au mythe de Narcisse, qui tomba amoureux de son propre reflet dans une riviere !

**Background:** Daffodils symbolize renewal and hope as among the first spring flowers. National flower of Wales, worn on St. David's Day.

### 4. Palmier (Palm Tree)
**EN:** Palm fossils date back over 100 million years! Palm branches were waved at Jesus' entry into Jerusalem — the origin of Palm Sunday.
**FR:** Des fossiles de palmier datent de plus de 100 millions d'annees ! Les rameaux de palmier furent agites a l'entree de Jesus a Jerusalem — l'origine du Dimanche des Rameaux.

**Background:** The palm tree is central to Palm Sunday, the Sunday before Easter marking the start of Holy Week. In the Bible, palm branches were waved as Jesus entered Jerusalem.

### 5. Olivier (Olive Tree)
**EN:** After the Great Flood, Noah's dove returned with an olive branch — the universal symbol of peace. Olive branches are still blessed every Palm Sunday!
**FR:** Apres le Deluge, la colombe de Noe rapporta une branche d'olivier — le symbole universel de paix. Les rameaux d'olivier sont encore benis chaque Dimanche des Rameaux !

**Background:** One of the first trees mentioned in the Bible. Present in the Garden of Gethsemane (Mount of Olives) where Jesus prayed.

### 6. Paquerette (Daisy)
**EN:** The daisy's French name "paquerette" literally comes from "Paques" (Easter)! It symbolizes purity, innocence, and the return of spring.
**FR:** Le nom "paquerette" vient directement de "Paques" ! Elle symbolise la purete, l'innocence et le retour du printemps.

**Background:** The white petals represent purity and innocence. In France, associated with the feast of Saint John. The name directly derives from Easter.

### 7. Ble germe (Sprouted Wheat)
**EN:** Ancient Romans sprouted wheat for spring festivals to honor Demeter and Persephone. This Mediterranean Easter tradition symbolizes rebirth and abundance!
**FR:** Les Romains faisaient germer du ble lors des fetes de printemps en l'honneur de Demeter et Persephone. Cette tradition mediterraneenne de Paques symbolise la renaissance et l'abondance !

**Background:** Mediterranean tradition of sprouting wheat before Easter. Dates back to ancient Egypt, Greece, and Rome. Symbolizes life reborn, fertility, and abundance.

### 8. Lys blanc (White Lily)
**EN:** In the Annunciation paintings, the angel Gabriel holds a white lily when announcing the birth of Jesus to Mary. The lily represents purity, resurrection, and eternal life!
**FR:** Dans les tableaux de l'Annonciation, l'ange Gabriel tient un lys blanc pour annoncer la naissance de Jesus a Marie. Le lys represente la purete, la resurrection et la vie eternelle !

**Background:** Strong connection to Easter and Christian art. Symbolic and theological significance rooted directly in the Bible. Associated with the Virgin Mary.

### 9. Buis (Boxwood)
**EN:** In regions where palm trees don't grow, boxwood branches are used instead on Palm Sunday! As an evergreen, boxwood has symbolized eternal life since ancient times.
**FR:** Dans les regions ou le palmier ne pousse pas, on utilise des branches de buis le Dimanche des Rameaux ! Plante a feuilles persistantes, le buis symbolise la vie eternelle depuis l'Antiquite.

**Background:** Used as a Palm Sunday substitute in northern regions. Older symbolism as an evergreen representing eternal life, home protection, and harvest luck.

---

## Position Seeds

Each egg's position on the page is determined by its `position_seed` value:

| # | Plant | Seed | Approx. Position |
|---|-------|------|-----------------|
| 1 | About | 42 | top: 54%, left: 61% |
| 2 | Primevere | 17 | top: 39%, left: 31% |
| 3 | Jonquille | 73 | top: 31%, left: 59% |
| 4 | Palmier | 8 | top: 76%, left: 19% |
| 5 | Olivier | 55 | top: 25%, left: 25% |
| 6 | Paquerette | 31 | top: 37%, left: 78% |
| 7 | Ble germe | 89 | top: 43%, left: 72% |
| 8 | Lys blanc | 64 | top: 48%, left: 57% |
| 9 | Buis | 22 | top: 74%, left: 46% |

Formula: `top = 20 + (seed * 7 % 60)`, `left = 10 + (seed * 13 % 75)`

Adjust seeds in `setup.sql` if an egg lands in an awkward spot.

---

## Deployment Workflow

1. **Deploy the code branch** (eggs are on About + PlantInfoPage)
2. **Run `setup.sql`** on the database
3. **Test as admin** — event starts in admin-only mode
4. **Go public** — Admin > Events > toggle off "Admin Only"
5. **Monitor** — Admin > Events shows participants, completions, %
6. **End** — Admin > Events > Deactivate (or let end date expire)
7. **Cleanup** — Admin > Events > Cleanup (removes items + progress, keeps badge awards)

---

## Files

| File | Purpose |
|------|---------|
| `setup.sql` | Idempotent SQL to create/update the event + eggs |
| `README.md` | This file — event documentation |
| `../../badges/event_2026_easter.sql` | Badge definition (run first) |
