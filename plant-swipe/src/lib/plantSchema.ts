// ============================================================================
// Plant Schema — Structured definition for AI fill requests
// Uses camelCase field names matching TypeScript types.
// AI generates data in this format; it's then mapped to snake_case for the DB.
// ============================================================================

export const plantSchema = {
  // -- Section 1: Base --------------------------------------------------------
  scientificNameSpecies: {
    type: 'text',
    description: 'Scientific (Latin) species name, e.g. "Monstera deliciosa"',
  },
  scientificNameVariety: {
    type: 'text',
    description: 'Variety or cultivar name if applicable, e.g. "Variegata"',
  },
  family: {
    type: 'text',
    description: 'Botanical family name, e.g. "Araceae"',
  },
  commonNames: {
    type: 'tag[]',
    description: 'Common names for this plant (multiple entries)',
  },
  presentation: {
    type: 'longtext',
    description: 'Encyclopedia-style presentation of the plant (150–300 words, factual prose, no bullet lists)',
  },
  featuredMonth: {
    type: 'enum[]',
    options: ['january','february','march','april','may','june','july','august','september','october','november','december'],
    description: 'Month(s) when the plant should be highlighted/featured',
  },

  // -- Section 2: Identity ----------------------------------------------------
  origin: {
    type: 'tag[]',
    description: 'Countries or regions of origin (e.g. ["South Africa", "Madagascar"])',
  },
  climate: {
    type: 'enum[]',
    options: ['polar','montane','oceanic','degraded_oceanic','temperate_continental','mediterranean','tropical_dry','tropical_humid','tropical_volcanic','tropical_cyclonic','humid_insular','subtropical_humid','equatorial','windswept_coastal'],
    description: 'Climate types where plant naturally grows',
  },
  season: {
    type: 'enum[]',
    options: ['spring','summer','autumn','winter'],
    description: 'Active/peak seasons',
  },
  utility: {
    type: 'enum[]',
    options: ['edible','ornamental','aromatic','medicinal','fragrant','cereal','spice'],
    description: 'Practical or ornamental uses',
  },
  ediblePart: {
    type: 'enum[]',
    options: ['flower','fruit','seed','leaf','stem','bulb','rhizome','bark','wood'],
    description: 'Edible anatomical parts (empty array if not edible)',
  },
  thorny: { type: 'boolean', description: 'Whether plant has thorns or spines' },
  toxicityHuman: {
    type: 'enum',
    options: ['non_toxic','slightly_toxic','very_toxic','deadly','undetermined'],
    description: 'Toxicity level to humans. Use "undetermined" when data is insufficient.',
  },
  toxicityPets: {
    type: 'enum',
    options: ['non_toxic','slightly_toxic','very_toxic','deadly','undetermined'],
    description: 'Toxicity level to pets/animals',
  },
  poisoningMethod: {
    type: 'enum[]',
    options: ['touch','ingestion','eye_contact','inhalation','sap_contact'],
    description: 'How poisoning can occur',
  },
  poisoningSymptoms: {
    type: 'text',
    description: 'Description of poisoning symptoms for prevention',
  },
  allergens: { type: 'tag[]', description: 'Known allergens (e.g. ["Pollen", "Latex", "Sap"])' },
  lifeCycle: {
    type: 'enum[]',
    options: ['annual','biennial','perennial','succulent_perennial','monocarpic','short_cycle','ephemeral'],
    description: 'Plant life cycle type(s)',
  },
  averageLifespan: {
    type: 'enum[]',
    options: ['less_than_1_year','2_years','3_to_10_years','10_to_50_years','over_50_years'],
    description: 'Average lifespan range',
  },
  foliagePersistence: {
    type: 'enum[]',
    options: ['deciduous','evergreen','semi_evergreen','marcescent','winter_dormant','dry_season_deciduous'],
    description: 'Foliage persistence type',
  },
  livingSpace: {
    type: 'enum[]',
    options: ['indoor','outdoor','both','terrarium','greenhouse'],
    description: 'Where the plant can be grown',
  },
  landscaping: {
    type: 'enum[]',
    options: ['pot','planter','hanging','window_box','green_wall','flowerbed','border','edging','path','tree_base','vegetable_garden','orchard','hedge','free_growing','trimmed_hedge','windbreak','pond_edge','waterside','ground_cover','grove','background','foreground'],
    description: 'Landscaping/placement uses',
  },
  plantHabit: {
    type: 'enum[]',
    options: ['upright','arborescent','shrubby','bushy','clumping','erect','creeping','carpeting','ground_cover','prostrate','spreading','climbing','twining','scrambling','liana','trailing','columnar','conical','fastigiate','globular','spreading_flat','rosette','cushion','ball_shaped','succulent','palmate','rhizomatous','suckering'],
    description: 'Plant growth habit/shape',
  },
  colors: {
    type: 'color[]',
    description: 'Plant colors — MUST match colors from the database. Return array of objects with "name" and "hexCode" (e.g., [{"name": "Deep Pink", "hexCode": "#d62d5b"}]). Use the provided color list.',
  },
  multicolor: { type: 'boolean', description: 'Whether plant displays 3+ distinct colors' },
  bicolor: { type: 'boolean', description: 'Whether plant displays exactly 2 colors' },

  // -- Section 3: Care --------------------------------------------------------
  careLevel: {
    type: 'enum[]',
    options: ['easy','moderate','complex'],
    description: 'Care difficulty level',
  },
  sunlight: {
    type: 'enum[]',
    options: ['full_sun','partial_sun','partial_shade','light_shade','deep_shade','direct_light','bright_indirect_light','medium_light','low_light'],
    description: 'Light requirements (outdoor: full_sun to deep_shade; indoor: direct_light to low_light)',
  },
  temperatureMax: { type: 'int', description: 'Maximum temperature tolerance in °C' },
  temperatureMin: { type: 'int', description: 'Minimum temperature tolerance in °C' },
  temperatureIdeal: { type: 'int', description: 'Ideal growing temperature in °C' },
  wateringMode: {
    type: 'enum',
    options: ['always', 'seasonal'],
    description: 'Whether watering is the same year-round ("always") or varies by temperature ("seasonal" = hot/cold)',
  },
  wateringFrequencyWarm: { type: 'int', description: 'Watering times per week in warm/hot season (legacy — prefer wateringSchedules)' },
  wateringFrequencyCold: { type: 'int', description: 'Watering times per week in cold season (legacy — prefer wateringSchedules)' },
  wateringType: {
    type: 'enum[]',
    options: ['hose','surface','drip','soaking','wick'],
    description: 'Preferred watering methods',
  },
  hygrometry: { type: 'int', description: 'Preferred humidity percentage (0–100)' },
  mistingFrequency: { type: 'int', description: 'Misting times per week (0 if not needed)' },
  specialNeeds: { type: 'tag[]', description: 'Special care requirements (e.g. ["winter_veil", "rain_protection"])' },
  substrate: {
    type: 'tag[]',
    description: 'Suitable substrates from the substrate list (e.g. ["universal_potting_mix", "perlite", "coconut_coir"])',
  },
  substrateMix: {
    type: 'tag[]',
    description: 'Special substrate mix names if applicable (e.g. ["orchid_mix", "cactus_mix"])',
  },
  soilAdvice: { type: 'text', description: 'Soil/substrate guidance (airy, water-retentive, epiphyte, etc.)' },
  mulchingNeeded: { type: 'boolean', description: 'Whether mulching is recommended' },
  mulchType: { type: 'tag[]', description: 'Recommended mulch types (e.g. ["pine_bark", "straw", "gravel"])' },
  mulchAdvice: { type: 'text', description: 'Mulching advice' },
  nutritionNeed: { type: 'tag[]', description: 'Key nutrient needs (e.g. ["nitrogen", "potassium", "iron"])' },
  fertilizer: { type: 'tag[]', description: 'Recommended fertilizer types' },
  fertilizerAdvice: { type: 'text', description: 'Fertilizing schedule and advice' },

  // -- Section 4: Growth ------------------------------------------------------
  sowingMonth: {
    type: 'enum[]',
    options: ['january','february','march','april','may','june','july','august','september','october','november','december'],
    description: 'Months for sowing seeds',
  },
  floweringMonth: {
    type: 'enum[]',
    options: ['january','february','march','april','may','june','july','august','september','october','november','december'],
    description: 'Months when plant flowers',
  },
  fruitingMonth: {
    type: 'enum[]',
    options: ['january','february','march','april','may','june','july','august','september','october','november','december'],
    description: 'Months when plant fruits',
  },
  heightCm: { type: 'int', description: 'Mature height in centimeters' },
  wingspanCm: { type: 'int', description: 'Mature spread/width in centimeters' },
  staking: { type: 'boolean', description: 'Whether staking/support is needed' },
  stakingAdvice: { type: 'text', description: 'What type of support and how to stake' },
  division: {
    type: 'enum[]',
    options: ['seed','clump_division','bulb_division','rhizome_division','cutting','layering','stolon','sucker','grafting','spore'],
    description: 'Propagation/division methods',
  },
  cultivationMode: {
    type: 'enum[]',
    options: ['open_ground','flowerbed','vegetable_garden','raised_bed','orchard','rockery','slope','mound','pot','planter','hanging','greenhouse','indoor','pond','waterlogged_soil','hydroponic','aquaponic','mineral_substrate','permaculture','agroforestry'],
    description: 'Cultivation modes/settings',
  },
  sowingMethod: {
    type: 'enum[]',
    options: ['open_ground','pot','tray','greenhouse','mini_greenhouse','broadcast','row'],
    description: 'Sowing methods',
  },
  transplanting: { type: 'boolean', description: 'Whether plant can/should be transplanted' },
  transplantingTime: { type: 'text', description: 'When to transplant (e.g. "After 4 true leaves")' },
  outdoorPlantingTime: { type: 'text', description: 'When to plant outdoors (e.g. "After 6 true leaves")' },
  sowingAdvice: { type: 'longtext', description: 'Sowing and planting instructions' },
  pruning: { type: 'boolean', description: 'Whether pruning is needed' },
  pruningMonth: {
    type: 'enum[]',
    options: ['january','february','march','april','may','june','july','august','september','october','november','december'],
    description: 'Best months for pruning',
  },
  pruningAdvice: { type: 'text', description: 'Pruning technique and advice' },

  // -- Section 5: Danger ------------------------------------------------------
  pests: { type: 'tag[]', description: 'Common pest threats (e.g. ["Aphids", "Spider mites"])' },
  diseases: { type: 'tag[]', description: 'Common diseases (e.g. ["Powdery mildew", "Root rot"])' },

  // -- Section 6: Ecology -----------------------------------------------------
  conservationStatus: {
    type: 'enum[]',
    options: ['least_concern','near_threatened','vulnerable','endangered','critically_endangered','extinct_in_wild','extinct','data_deficient','not_evaluated'],
    description: 'IUCN conservation status',
  },
  ecologicalStatus: {
    type: 'tag[]',
    description: 'Ecological status tags (e.g. ["indigenous", "pioneer_species", "nitrogen_fixer"])',
  },
  biotopes: {
    type: 'tag[]',
    description: 'Natural biotopes (e.g. ["temperate_deciduous_forest", "wet_meadow"])',
  },
  urbanBiotopes: {
    type: 'tag[]',
    description: 'Urban/anthropized biotopes (e.g. ["urban_garden", "balcony", "park"])',
  },
  ecologicalTolerance: {
    type: 'enum[]',
    options: ['drought','scorching_sun','permanent_shade','excess_water','frost','heatwave','wind'],
    description: 'Environmental tolerances',
  },
  biodiversityRole: {
    type: 'tag[]',
    description: 'Biodiversity roles (e.g. ["melliferous", "insect_refuge", "nitrogen_fixer", "soil_improver"])',
  },
  pollinatorsAttracted: { type: 'tag[]', description: 'Pollinators attracted (short list, e.g. ["Bees", "Butterflies"])' },
  birdsAttracted: { type: 'tag[]', description: 'Birds attracted (short list)' },
  mammalsAttracted: { type: 'tag[]', description: 'Mammals attracted (short list)' },
  beneficialRoles: { type: 'tag[]', description: 'Beneficial ecological roles in free text' },
  harmfulRoles: { type: 'tag[]', description: 'Harmful ecological roles in free text' },
  symbiosis: { type: 'tag[]', description: 'Symbiotic relationships (plant, insect, or fungus names)' },
  symbiosisNotes: { type: 'text', description: 'Detailed description of symbiotic relationships' },
  ecologicalManagement: {
    type: 'tag[]',
    description: 'Ecological management tips (e.g. ["let_seed", "no_winter_pruning", "natural_foliage_mulch"])',
  },
  ecologicalImpact: {
    type: 'enum[]',
    options: ['neutral','favorable','potentially_invasive','locally_invasive'],
    description: 'Overall ecological impact',
  },

  // -- Section 7: Consumption -------------------------------------------------
  infusion: { type: 'boolean', description: 'Whether plant can be used for infusions/tea' },
  infusionParts: {
    type: 'tag[]',
    description: 'Which parts can be used for infusion (e.g. ["leaf", "flower"])',
  },
  infusionBenefits: { type: 'text', description: 'Benefits of infusion/tea from this plant' },
  infusionRecipeIdeas: { type: 'text', description: 'Infusion/tea recipe ideas' },
  medicinal: { type: 'boolean', description: 'Whether plant has medicinal uses' },
  medicinalBenefits: { type: 'text', description: 'Medicinal benefits' },
  medicinalUsage: { type: 'text', description: 'How to use medicinally' },
  medicinalWarning: { type: 'text', description: 'Safety warning (historical vs modern use)' },
  medicinalHistory: { type: 'text', description: 'Historical medicinal use' },
  nutritionalValue: { type: 'text', description: 'Nutritional information for edible plants' },
  recipes: {
    type: 'array',
    description: 'Structured recipe ideas (2-3 max)',
    items: {
      name: { type: 'text', description: 'Recipe or dish name' },
      category: {
        type: 'enum',
        options: ['Breakfast & Brunch', 'Starters & Appetizers', 'Soups & Salads', 'Main Courses', 'Side Dishes', 'Desserts', 'Drinks', 'Other'],
        description: 'Meal category',
      },
      time: {
        type: 'enum',
        options: ['Quick and Effortless', '30+ minutes Meals', 'Slow Cooking', 'Undefined'],
        description: 'Preparation time',
      },
    },
  },
  aromatherapy: { type: 'boolean', description: 'Whether used in aromatherapy' },
  aromatherapyBenefits: { type: 'text', description: 'Aromatherapy benefits' },
  essentialOilBlends: { type: 'text', description: 'Essential oil blend ideas' },
  fragrance: { type: 'boolean', description: 'Whether plant has a notable fragrance' },
  edibleOil: {
    type: 'enum',
    options: ['yes', 'no', 'unknown'],
    description: 'Whether the plant produces an edible oil',
  },
  spiceMixes: { type: 'tag[]', description: 'Spice blend uses' },

  // -- Section 8: Misc --------------------------------------------------------
  companionPlants: { type: 'tag[]', description: 'Companion plants for garden pairing (common names)' },
  plantTags: { type: 'tag[]', description: 'Searchable plant tags' },
  biodiversityTags: { type: 'tag[]', description: 'Biodiversity-specific tags' },
  sources: {
    type: 'dict[]',
    description: 'Citation sources as [{name: "...", url: "..."}]',
  },

  // -- Section 9: Meta --------------------------------------------------------
  adminCommentary: { type: 'longtext', description: 'Internal notes for editors' },
  userNotes: { type: 'text', description: 'User-contributed notes' },
} as const

export type PlantSchema = typeof plantSchema
