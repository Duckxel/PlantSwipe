# Missing Fields Analysis: Specification vs More Info Page Display

## Fields NOT Displayed on More Info Page

### ❌ IDENTITY Section

| Field | Status | Notes |
|-------|--------|-------|
| **Promotion Month** | ❌ MISSING | Specified as "Month the plant should be promoted" - not shown anywhere |

### ❌ PLANT CARE Section

| Field | Status | Notes |
|-------|--------|-------|
| **Watering Schedules** | ⚠️ PARTIAL | Only shows first schedule summary in "Care Highlights" - doesn't show all schedules with season/quantity/time_period details |
| **Advice Soil** | ✅ SHOWN | Displayed in "Care Details" section |
| **Advice Mulching** | ✅ SHOWN | Displayed in "Care Details" section |
| **Advice Fertilizer** | ✅ SHOWN | Displayed in "Care Details" section |

### ❌ GROWTH Section

| Field | Status | Notes |
|-------|--------|-------|
| **Sowing Month** | ⚠️ PARTIAL | Shown in timeline chart but not explicitly listed as text |
| **Flowering Month** | ⚠️ PARTIAL | Shown in timeline chart but not explicitly listed as text |
| **Fruiting Month** | ⚠️ PARTIAL | Shown in timeline chart but not explicitly listed as text |
| **Height** | ✅ SHOWN | Displayed in 3D dimension cube |
| **Wingspan** | ✅ SHOWN | Displayed in 3D dimension cube |
| **Separation** | ✅ SHOWN | Displayed in 3D dimension cube as "Spacing" |
| **Advice Tutoring** | ✅ SHOWN | Displayed as "Support Notes" in "Growth & Structure" |
| **Advice Sowing** | ✅ SHOWN | Displayed as "Sowing Notes" in "Growth & Structure" |
| **Cut** | ✅ SHOWN | Displayed as "Cut Type" in "Growth & Structure" |

### ❌ USAGE Section

| Field | Status | Notes |
|-------|--------|-------|
| **Advice Medicinal** | ✅ SHOWN | Displayed as "Medicinal Notes" |
| **Nutritional Intake** | ✅ SHOWN | Displayed |
| **Infusion** | ✅ SHOWN | Displayed as "Infusion Friendly" |
| **Advice Infusion** | ✅ SHOWN | Displayed as "Infusion Notes" |
| **Infusion Mix** | ✅ SHOWN | Displayed |
| **Recipes Ideas** | ⚠️ PARTIAL | Only shows first 3 recipes, not all |
| **Aromatherapy** | ✅ SHOWN | Displayed |
| **Spice Mixes** | ✅ SHOWN | Displayed |

### ❌ ECOLOGY Section

| Field | Status | Notes |
|-------|--------|-------|
| **Melliferous** | ✅ SHOWN | Displayed |
| **Polenizer** | ✅ SHOWN | Displayed as "Pollinators" |
| **Be Fertilizer** | ✅ SHOWN | Displayed as "Green Manure" |
| **Ground Effect** | ✅ SHOWN | Displayed |
| **Conservation Status** | ✅ SHOWN | Displayed in "Risk & Status" section |

### ❌ DANGER Section

| Field | Status | Notes |
|-------|--------|-------|
| **Pests** | ✅ SHOWN | Displayed |
| **Diseases** | ✅ SHOWN | Displayed |

### ❌ MISCELLANEOUS Section

| Field | Status | Notes |
|-------|--------|-------|
| **Companions** | ✅ SHOWN | Displayed |
| **Tags** | ✅ SHOWN | Displayed |
| **Sources** | ✅ SHOWN | Displayed at bottom |

### ❌ META Section

| Field | Status | Notes |
|-------|--------|-------|
| **Status** | ❌ MISSING | Not displayed (In Progress/Rework/Review/Approved) |
| **Admin Commentary** | ✅ SHOWN | Displayed in "Records & Sources" |
| **Created By** | ✅ SHOWN | Displayed at bottom |
| **Created Time** | ✅ SHOWN | Displayed at bottom |
| **Updated By** | ✅ SHOWN | Displayed at bottom |
| **Updated Time** | ✅ SHOWN | Displayed at bottom |

## Summary

### Completely Missing Fields:
1. **Promotion Month** - Not displayed anywhere
2. **Status** (In Progress/Rework/Review/Approved) - Not displayed

### Partially Displayed Fields:
1. **Watering Schedules** - Only shows summary, not full details with all seasons
2. **Sowing/Flowering/Fruiting Months** - Shown in chart but not as explicit text list
3. **Recipes Ideas** - Only shows first 3, not all recipes

## Recommendations

1. **Add Promotion Month** - Display in "Identity & Traits" section
2. **Add Status** - Display in "Records & Sources" or as a badge near the title
3. **Expand Watering Schedules** - Show all schedules with full details (season, quantity, time_period)
4. **Add Month Lists** - Show explicit text lists for sowing/flowering/fruiting months in addition to the chart
5. **Show All Recipes** - Display all recipes, not just first 3
