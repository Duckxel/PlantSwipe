// Structured schema definition used for AI fill requests.
// Uses camelCase field names to match AI prompts and TypeScript types.
// The AI generates data in this format, which is then transformed to snake_case
// when saving to the database by aiPrefillService.ts and CreatePlantPage.tsx.
export const plantSchema = {
  plantType: {
    type: 'enum',
    options: ['plant', 'flower', 'bamboo', 'shrub', 'tree', 'cactus', 'succulent'],
    description: 'The plant growth habit or form classification',
  },
  utility: {
    type: 'enum[]',
    options: ['comestible', 'ornemental', 'produce_fruit', 'aromatic', 'medicinal', 'odorous', 'climbing', 'cereal', 'spice'],
    description: 'Practical or ornamental roles the plant serves',
  },
  comestiblePart: {
    type: 'enum[]',
    options: ['flower', 'fruit', 'seed', 'leaf', 'stem', 'root', 'bulb', 'bark', 'wood'],
    description: 'Edible anatomical parts of the plant',
  },
  fruitType: {
    type: 'enum[]',
    options: ['nut', 'seed', 'stone'],
    description: 'Fruiting category if plant produces harvestable fruit',
  },
  seasons: {
    type: 'enum[]',
    options: ['Spring', 'Summer', 'Autumn', 'Winter'],
    description: 'Seasons when plant is most attractive or at peak',
  },
  description: {
    type: 'longtext',
    description: 'Horticultural overview of the plant (150-300 words)',
  },
  identity: {
    type: 'object',
    description: 'Taxonomy, naming, and identification information',
    properties: {
      givenNames: { type: 'tag[]', description: 'Common names for this plant' },
      scientificName: { type: 'text', description: 'Botanical binomial (Genus species)' },
      family: { type: 'text', description: 'Plant family name' },
      overview: { type: 'longtext', description: 'Brief 2-3 sentence summary' },
      promotionMonth: { type: 'int', description: 'Month (1-12) when plant should be featured' },
      lifeCycle: { 
        type: 'enum', 
        options: ['Annual', 'Biennials', 'Perenials', 'Ephemerals', 'Monocarpic', 'Polycarpic'],
        description: 'Plant life cycle type'
      },
      season: { 
        type: 'enum[]', 
        options: ['Spring', 'Summer', 'Autumn', 'Winter'],
        description: 'Active seasons for the plant'
      },
      foliagePersistance: { 
        type: 'enum', 
        options: ['Deciduous', 'Evergreen', 'Semi-Evergreen', 'Marcescent'],
        description: 'Foliage persistence type'
      },
      spiked: { type: 'boolean', description: 'Whether plant has spikes or thorns' },
      toxicityHuman: { 
        type: 'enum', 
        options: ['Non-Toxic', 'Midly Irritating', 'Highly Toxic', 'Lethally Toxic'],
        description: 'Toxicity level to humans'
      },
      toxicityPets: { 
        type: 'enum', 
        options: ['Non-Toxic', 'Midly Irritating', 'Highly Toxic', 'Lethally Toxic'],
        description: 'Toxicity level to pets'
      },
      allergens: { type: 'tag[]', description: 'List of allergens present in the plant' },
      colors: { 
        type: 'color[]', 
        description: 'Array of color objects with name and hexCode (e.g., {"name": "Deep Pink", "hexCode": "#d62d5b"})'
      },
      multicolor: { type: 'boolean', description: 'Whether plant has multiple distinct colors' },
      bicolor: { type: 'boolean', description: 'Whether plant has exactly two colors' },
      scent: { type: 'boolean', description: 'Whether plant has a notable scent' },
      symbolism: { type: 'tag[]', description: 'Cultural or symbolic meanings' },
      livingSpace: { 
        type: 'enum', 
        options: ['Indoor', 'Outdoor', 'Both'],
        description: 'Where the plant is typically grown'
      },
      composition: { 
        type: 'enum[]', 
        options: ['Flowerbed', 'Path', 'Hedge', 'Ground Cover', 'Pot'],
        description: 'Garden composition uses'
      },
      maintenanceLevel: { 
        type: 'enum', 
        options: ['None', 'Low', 'Moderate', 'Heavy'],
        description: 'Required maintenance effort'
      },
    },
  },
  plantCare: {
    type: 'object',
    description: 'Care requirements and growing conditions',
    properties: {
      origin: { type: 'tag[]', description: 'Regions or countries where plant originates' },
      habitat: { 
        type: 'enum[]', 
        options: ['Aquatic', 'Semi-Aquatic', 'Wetland', 'Tropical', 'Temperate', 'Arid', 'Mediterranean', 'Mountain', 'Grassland', 'Forest', 'Coastal', 'Urban'],
        description: 'Natural habitat types'
      },
      temperatureMax: { type: 'int', description: 'Maximum temperature tolerance in Celsius' },
      temperatureMin: { type: 'int', description: 'Minimum temperature tolerance in Celsius' },
      temperatureIdeal: { type: 'int', description: 'Ideal growing temperature in Celsius' },
      levelSun: { 
        type: 'enum', 
        options: ['Low Light', 'Shade', 'Partial Sun', 'Full Sun'],
        description: 'Light requirement level'
      },
      hygrometry: { type: 'int', description: 'Ambient humidity preference (0-100)' },
      watering: {
        type: 'object',
        description: 'Watering requirements with schedules array',
        properties: {
          schedules: {
            type: 'array',
            description: 'Array of seasonal watering schedules',
            items: {
              season: { type: 'enum', options: ['Spring', 'Summer', 'Autumn', 'Winter'] },
              quantity: { type: 'int', description: 'Number of times to water per time period' },
              timePeriod: { type: 'enum', options: ['week', 'month', 'year'] },
            },
          },
        },
      },
      wateringType: { 
        type: 'enum[]', 
        options: ['surface', 'buried', 'hose', 'drop', 'drench'],
        description: 'Preferred watering methods'
      },
      division: { 
        type: 'enum[]', 
        options: ['Seed', 'Cutting', 'Division', 'Layering', 'Grafting', 'Tissue Separation', 'Bulb separation'],
        description: 'Propagation methods'
      },
      soil: { 
        type: 'enum[]', 
        options: ['Vermiculite', 'Perlite', 'Sphagnum moss', 'rock wool', 'Sand', 'Gravel', 'Potting Soil', 'Peat', 'Clay pebbles', 'coconut fiber', 'Bark', 'Wood Chips'],
        description: 'Suitable soil types'
      },
      adviceSoil: { type: 'text', description: 'Soil preparation advice' },
      mulching: { 
        type: 'enum[]', 
        options: ['Wood Chips', 'Bark', 'Green Manure', 'Cocoa Bean Hulls', 'Buckwheat Hulls', 'Cereal Straw', 'Hemp Straw', 'Woven Fabric', 'Pozzolana', 'Crushed Slate', 'Clay Pellets'],
        description: 'Recommended mulching materials'
      },
      adviceMulching: { type: 'text', description: 'Mulching advice' },
      nutritionNeed: { 
        type: 'enum[]', 
        options: ['Nitrogen', 'Phosphorus', 'Potassium', 'Calcium', 'Magnesium', 'Sulfur', 'Iron', 'Boron', 'Manganese', 'Molybene', 'Chlorine', 'Copper', 'Zinc', 'Nitrate', 'Phosphate'],
        description: 'Nutritional requirements'
      },
      fertilizer: { 
        type: 'enum[]', 
        options: ['Granular fertilizer', 'Liquid Fertilizer', 'Meat Flour', 'Fish flour', 'Crushed bones', 'Crushed Horns', 'Slurry', 'Manure', 'Animal excrement', 'Sea Fertilizer', 'Yurals', 'Wine', 'guano', 'Coffee Grounds', 'Banana peel', 'Eggshell', 'Vegetable cooking water', 'Urine', 'Grass Clippings', 'Vegetable Waste', 'Natural Mulch'],
        description: 'Recommended fertilizer types'
      },
      adviceFertilizer: { type: 'text', description: 'Fertilizing advice' },
    },
  },
  growth: {
    type: 'object',
    description: 'Growth and propagation profile',
    properties: {
      sowingMonth: { type: 'int[]', description: 'Months (1-12) for sowing seeds' },
      floweringMonth: { type: 'int[]', description: 'Months (1-12) when plant flowers' },
      fruitingMonth: { type: 'int[]', description: 'Months (1-12) when plant fruits' },
      height: { type: 'int', description: 'Mature height in centimeters' },
      wingspan: { type: 'int', description: 'Mature spread/wingspan in centimeters' },
      tutoring: { type: 'boolean', description: 'Whether plant needs staking/support' },
      adviceTutoring: { type: 'longtext', description: 'Staking and support advice' },
      sowType: { 
        type: 'enum[]', 
        options: ['Direct', 'Indoor', 'Row', 'Hill', 'Broadcast', 'Seed Tray', 'Cell', 'Pot'],
        description: 'Recommended sowing techniques'
      },
      separation: { type: 'int', description: 'Spacing between plants in centimeters' },
      transplanting: { type: 'boolean', description: 'Whether plant can be transplanted' },
      adviceSowing: { type: 'longtext', description: 'Sowing and planting advice' },
      cut: { type: 'text', description: 'Pruning or cutting notes' },
    },
  },
  usage: {
    type: 'object',
    description: 'Culinary, medicinal, and other uses',
    properties: {
      adviceMedicinal: { type: 'longtext', description: 'Traditional medicinal uses' },
      nutritionalIntake: { type: 'tag[]', description: 'Nutritional benefits (vitamins, minerals)' },
      infusion: { type: 'boolean', description: 'Whether plant can be used for infusions/tea' },
      adviceInfusion: { type: 'longtext', description: 'Infusion preparation advice' },
      infusionMix: { 
        type: 'dict[]', 
        description: 'Array of infusion mix objects with mix_name and benefit keys'
      },
      recipesIdeas: { type: 'tag[]', description: 'Culinary recipe ideas (legacy, prefer recipes)' },
      recipes: {
        type: 'array',
        description: 'Structured recipe ideas with name, category, and time',
        items: {
          name: { type: 'text', description: 'Recipe or dish name (e.g., "Pesto", "Herbal Butter")' },
          category: {
            type: 'enum',
            options: ['Breakfast & Brunch', 'Starters & Appetizers', 'Soups & Salads', 'Main Courses', 'Side Dishes', 'Desserts', 'Drinks', 'Other'],
            description: 'Meal category',
          },
          time: {
            type: 'enum',
            options: ['Quick and Effortless', '30+ minutes Meals', 'Slow Cooking', 'Undefined'],
            description: 'Preparation time estimate',
          },
        },
      },
      aromatherapy: { type: 'boolean', description: 'Whether used in aromatherapy' },
      spiceMixes: { type: 'tag[]', description: 'Spice blend uses' },
    },
  },
  ecology: {
    type: 'object',
    description: 'Ecological value and environmental considerations',
    properties: {
      melliferous: { type: 'boolean', description: 'Whether plant provides nectar for pollinators' },
      polenizer: { 
        type: 'enum[]', 
        options: ['Bee', 'Wasp', 'Ant', 'Butterfly', 'Bird', 'Mosquito', 'Fly', 'Beetle', 'ladybug', 'Stagbeetle', 'Cockchafer', 'dungbeetle', 'weevil'],
        description: 'Pollinator species attracted'
      },
      beFertilizer: { type: 'boolean', description: 'Whether plant can be used as fertilizer/compost' },
      groundEffect: { type: 'text', description: 'Environmental benefits (erosion control, nitrogen fixing, etc.)' },
      conservationStatus: { 
        type: 'enum', 
        options: ['Safe', 'At Risk', 'Vulnerable', 'Endangered', 'Critically Endangered', 'Extinct'],
        description: 'Conservation status'
      },
    },
  },
  danger: {
    type: 'object',
    description: 'Pests and diseases that affect the plant',
    properties: {
      pests: { type: 'tag[]', description: 'Common pest threats' },
      diseases: { type: 'tag[]', description: 'Common disease issues' },
    },
  },
  miscellaneous: {
    type: 'object',
    description: 'Additional information and metadata',
    properties: {
      companions: { type: 'tag[]', description: 'Companion plants (common names)' },
      tags: { type: 'tag[]', description: 'Searchable tags and keywords' },
      sources: { 
        type: 'dict[]', 
        description: 'Citation sources with name and url keys'
      },
    },
  },
  meta: {
    type: 'object',
    description: 'Editorial and administrative metadata',
    properties: {
      funFact: { type: 'text', description: 'Interesting trivia about the plant (max 40 words)' },
      adminCommentary: { type: 'longtext', description: 'Internal notes for editors' },
    },
  },
} as const

export type PlantSchema = typeof plantSchema
