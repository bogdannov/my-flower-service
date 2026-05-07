/**
 * Seed script — writes the initial flower catalog to DynamoDB.
 *
 * Usage:
 *   npx ts-node scripts/seed-flowers.ts --stage dev
 *   npx ts-node scripts/seed-flowers.ts --stage prod
 *
 * The FLOWERS_TABLE env var must be set, or use --stage to derive it.
 * AWS credentials must be configured in the environment.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const stageArg = process.argv.find((_, i) => process.argv[i - 1] === "--stage") ?? "dev";
const tableName = process.env.FLOWERS_TABLE ?? `my-flowers-service-flowers-${stageArg}`;

// ─── DynamoDB client ──────────────────────────────────────────────────────────

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION ?? "eu-central-1",
    ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
  }),
);

// ─── Flower catalog data ──────────────────────────────────────────────────────

const FLOWERS = [
  {
    id: "peace-lily",
    name: "Peace Lily",
    flowerUserName: "Lily",
    scientificName: "Spathiphyllum wallisii",
    category: "tropical",
    imageUrl: "https://placehold.co/400x400/e8f5e9/2e7d32?text=Peace+Lily",
    shortDescription: "A graceful shade-lover that purifies indoor air and blooms in low light.",
    fullDescription:
      "The Peace Lily is one of the most forgiving indoor plants you can own. Native to the tropical rainforests of Central America, it thrives in low-light corners and communicates thirst by drooping its leaves slightly — a helpful signal for beginners. Its elegant white spathes appear in spring and sometimes again in autumn.",
    flowerNotes:
      "Hi there! I love a shady corner far from the window — bright sun makes my leaf tips go crispy and brown. When I droop just a little, that's my gentle way of asking for a drink. Give me a good soak and watch me spring back up!",
    careMantra: "Keep me shady and slightly damp, and I'll clean your air with a smile!",
    difficultyBadge: { emoji: "🌱", label: "Easy" },
    wateringFrequencyDays: 7,
    wateringAmountMl: 250,
    wateringNotes:
      "Water thoroughly until it drains from the bottom, then let the top 2 cm of soil dry out before watering again. Never leave standing water in the saucer.",
    sunlight: "partial_shade",
    sunlightImportance: "important",
    idealPlacement: "North or east-facing room, away from direct sun",
    placementTips: [
      "Avoid south-facing windows in summer — direct sun scorches the leaves.",
      "Works well in bathrooms where humidity is naturally higher.",
      "Keep at least 1 m away from air vents and radiators.",
    ],
    temperatureMinC: 16,
    temperatureMaxC: 30,
    humidity: "medium",
    humidityTip: "Mist the leaves once a week or place the pot on a tray of damp pebbles to raise humidity without overwatering.",
    growthSpeed: "moderate",
    soilType: "Rich, well-draining potting mix with added perlite",
    repottingFrequencyYears: 2,
    repottingTip: "Repot in spring when roots start poking out of the drainage holes. Move up only one pot size to avoid waterlogging.",
    toxicity: "mildly_toxic",
    toxicityLabel: "Keep away from pets & small children",
    isAllergyRisk: true,
    allergyNotes: "The sap can irritate skin and mucous membranes. Wear gloves when repotting and wash hands afterwards.",
    isPetSafe: false,
    isChildSafe: false,
    scent: "mild",
    scentDescription: "A faint, fresh green scent — barely noticeable unless up close.",
    happySigns: [
      "Deep green, glossy leaves with no yellowing",
      "New leaves unfurling from the centre",
      "White spathes appearing in spring",
      "Upright stems with no drooping",
    ],
    sadSigns: [
      "Drooping leaves — thirsty; water immediately",
      "Yellow leaves — overwatering or too much direct light",
      "Brown leaf tips — low humidity or fluoride in tap water",
      "No new growth — needs repotting or more nutrients",
    ],
    interestingFacts: [
      "NASA listed the Peace Lily as one of the top air-purifying houseplants in its Clean Air Study.",
      "Despite the common name, the Peace Lily is not a true lily — it belongs to the Araceae family.",
      "It can bloom twice a year if given the right conditions.",
      "In feng shui, it is said to bring peace and purify negative energy.",
    ],
    origin: "Central and South America",
    bloomSeason: "Spring and occasionally Autumn",
    difficulty: "beginner",
  },
  {
    id: "pothos",
    name: "Golden Pothos",
    flowerUserName: "Goldie",
    scientificName: "Epipremnum aureum",
    category: "tropical vine",
    imageUrl: "https://placehold.co/400x400/f9fbe7/558b2f?text=Golden+Pothos",
    shortDescription: "The ultimate beginner plant — trails beautifully and survives almost anything.",
    fullDescription:
      "Golden Pothos is one of the world's most popular houseplants for good reason: it tolerates neglect, low light, and irregular watering with cheerful resilience. Its heart-shaped leaves are splashed with golden-yellow variegation, and its trailing vines can reach several metres indoors.",
    flowerNotes:
      "I can live in almost any light — but I love a bright spot without harsh direct sun! Check the top centimetre of my soil: if it's dry, I'm ready for a drink; if it's still damp, I'm absolutely fine waiting a bit longer. I'm very forgiving!",
    careMantra: "Bright light, dry spells welcome — I'll grow wherever life takes me!",
    difficultyBadge: { emoji: "🌱", label: "Easy" },
    wateringFrequencyDays: 10,
    wateringAmountMl: 200,
    wateringNotes: "Allow the top 2–3 cm of soil to dry completely between waterings. Pothos is far more tolerant of underwatering than overwatering.",
    sunlight: "partial_shade",
    sunlightImportance: "flexible",
    idealPlacement: "Bright shelf or hanging basket away from direct sun",
    placementTips: [
      "Variegation fades in very low light — a brighter spot keeps the golden pattern vivid.",
      "Trails beautifully from a high shelf or hanging planter.",
      "Can be trained to climb a moss pole for a more upright look.",
    ],
    temperatureMinC: 15,
    temperatureMaxC: 30,
    humidity: "medium",
    humidityTip: "Adapts to normal home humidity. Misting is not necessary but won't hurt.",
    growthSpeed: "fast",
    soilType: "Standard potting mix; excellent drainage essential",
    repottingFrequencyYears: 2,
    repottingTip: "Repot when roots circle the bottom or emerge from drainage holes. Spring is the ideal time; use a pot 2–3 cm wider.",
    toxicity: "mildly_toxic",
    toxicityLabel: "Keep away from pets & small children",
    isAllergyRisk: false,
    allergyNotes: "",
    isPetSafe: false,
    isChildSafe: false,
    scent: "none",
    scentDescription: "",
    happySigns: [
      "Bright golden variegation on the leaves",
      "Long, actively growing vines",
      "Firm, vibrant leaves with no wilting",
    ],
    sadSigns: [
      "Yellow leaves — overwatering or root rot; check drainage",
      "All-green leaves losing variegation — needs more light",
      "Brown, mushy stems — root rot; remove affected sections and repot",
      "Wilting despite moist soil — root rot; reduce watering immediately",
    ],
    interestingFacts: [
      "Golden Pothos can grow in water indefinitely — just pop a cutting in a vase.",
      "It has been shown to reduce indoor carbon monoxide levels.",
      "In the wild it can grow vines up to 20 metres long.",
      "The \"golden\" in its name refers to the yellow streaks on its leaves.",
    ],
    origin: "French Polynesia (Mo'orea)",
    bloomSeason: "Rarely blooms indoors",
    difficulty: "beginner",
  },
  {
    id: "snake-plant",
    name: "Snake Plant",
    flowerUserName: "Snakey",
    scientificName: "Dracaena trifasciata",
    category: "succulent",
    imageUrl: "https://placehold.co/400x400/e8f5e9/1b5e20?text=Snake+Plant",
    shortDescription: "An indestructible air-purifier that thrives on neglect and looks stunning in any corner.",
    fullDescription:
      "The Snake Plant is the closest thing to an indestructible houseplant. Its stiff, upright leaves with striking grey-green banding store water efficiently. It is one of the few plants that converts CO₂ to oxygen at night, making it a popular choice for bedrooms.",
    flowerNotes:
      "I'm the perfect beginner plant because I actually love a little bit of neglect! Too much water is my only real enemy — it makes my roots go soft and mushy. Pop me in any corner, bright or dim, and I'll quietly get on with cleaning your air.",
    careMantra: "Forget me sometimes — I actually like it that way!",
    difficultyBadge: { emoji: "🌱", label: "Easy" },
    wateringFrequencyDays: 14,
    wateringAmountMl: 150,
    wateringNotes: "Water sparingly — allow the soil to dry out completely between waterings. In winter, once a month is often enough. Always err on the side of underwatering.",
    sunlight: "partial_shade",
    sunlightImportance: "flexible",
    idealPlacement: "Any room — tolerates dim corners and bright windowsills equally",
    placementTips: [
      "Avoid prolonged direct sun which can scorch the leaf edges.",
      "Excellent choice for offices and rooms with artificial lighting only.",
      "Thrives in bedrooms — produces oxygen overnight.",
    ],
    temperatureMinC: 15,
    temperatureMaxC: 32,
    humidity: "low",
    humidityTip: "Prefers dry air. Avoid misting and keep away from humidifiers — excess moisture on leaves causes rot.",
    growthSpeed: "slow",
    soilType: "Sandy, well-draining cactus or succulent mix",
    repottingFrequencyYears: 3,
    repottingTip: "Repot only when completely root-bound. Terracotta pots are ideal as they draw moisture away from the roots.",
    toxicity: "mildly_toxic",
    toxicityLabel: "Keep away from pets & small children",
    isAllergyRisk: false,
    allergyNotes: "",
    isPetSafe: false,
    isChildSafe: false,
    scent: "none",
    scentDescription: "",
    happySigns: [
      "Upright, firm leaves with vivid banding",
      "Slow but steady new shoots appearing from the base",
      "No soft or mushy spots anywhere on the leaves",
    ],
    sadSigns: [
      "Soft, mushy base — root rot from overwatering; repot immediately",
      "Wrinkled leaves — underwatering; give a thorough soak",
      "Brown leaf tips — fluoride or salt build-up in soil; flush with water",
      "Pale, washed-out colour — too much direct sun; move to a shadier spot",
    ],
    interestingFacts: [
      "NASA included the Snake Plant in its list of air-purifying houseplants.",
      "It is one of very few plants that photosynthesises at night (CAM metabolism).",
      "In West Africa, the plant is used to make rope and bowstrings from its fibres.",
      "It can survive up to 6 weeks without water in cooler months.",
    ],
    origin: "West Africa (Nigeria and Congo)",
    bloomSeason: "Rarely — small, fragrant white flowers appear occasionally",
    difficulty: "beginner",
  },
  {
    id: "monstera",
    name: "Monstera",
    flowerUserName: "Monty",
    scientificName: "Monstera deliciosa",
    category: "tropical",
    imageUrl: "https://placehold.co/400x400/e0f2f1/004d40?text=Monstera",
    shortDescription: "The iconic split-leaf jungle giant that makes every room feel like a rainforest.",
    fullDescription:
      "Monstera deliciosa — the Swiss Cheese Plant — is one of the most recognisable houseplants in the world. Its dramatic, fenestrated leaves are an evolutionary adaptation to let wind and light filter through in the dense rainforest canopy. Indoors it grows large and fast.",
    flowerNotes:
      "I'm the jungle celebrity of your home! I love bright, indirect light — think the dappled glow under a big tree. Water me when the top 5 cm of my soil feels dry. And please give me some space — my leaves want to grow big and bold!",
    careMantra: "Bright shade, room to grow, and I'll fill your home with jungle magic!",
    difficultyBadge: { emoji: "🌿", label: "Medium" },
    wateringFrequencyDays: 7,
    wateringAmountMl: 400,
    wateringNotes: "Water thoroughly and allow the top 5 cm of soil to dry before watering again. Reduce frequency in winter.",
    sunlight: "partial_shade",
    sunlightImportance: "important",
    idealPlacement: "Bright room with indirect light, away from full sun",
    placementTips: [
      "A few metres back from a south or west-facing window is ideal.",
      "Wipe leaves occasionally with a damp cloth to keep them dust-free.",
      "Provide a moss pole or trellis — Monstera is a natural climber.",
    ],
    temperatureMinC: 18,
    temperatureMaxC: 30,
    humidity: "high",
    humidityTip: "Mist the leaves two or three times a week, or use a humidifier nearby.",
    growthSpeed: "moderate",
    soilType: "Rich, well-draining mix with perlite and orchid bark",
    repottingFrequencyYears: 2,
    repottingTip: "Repot in spring when roots emerge from drainage holes. Move up one size.",
    toxicity: "mildly_toxic",
    toxicityLabel: "Keep away from pets & small children",
    isAllergyRisk: true,
    allergyNotes: "The sap contains calcium oxalate crystals which irritate skin, eyes, and the mouth if chewed. Wear gloves when pruning.",
    isPetSafe: false,
    isChildSafe: false,
    scent: "none",
    scentDescription: "",
    happySigns: [
      "Large new leaves with increasingly pronounced splits and holes",
      "Deep green, glossy foliage",
      "Aerial roots reaching towards the nearest support",
      "Steady growth of 1–2 new leaves per month in summer",
    ],
    sadSigns: [
      "Yellow leaves — overwatering; let soil dry further between sessions",
      "Brown crispy edges — low humidity or too much direct sun",
      "Small new leaves with no fenestrations — needs more light",
      "Wilting despite moist soil — root rot; check drainage urgently",
    ],
    interestingFacts: [
      "The \"deliciosa\" in the name refers to the edible fruit the plant produces in the wild.",
      "The holes in the leaves (fenestrations) help the plant withstand strong rainforest winds.",
      "A single Monstera can live for decades and grow leaves up to 90 cm wide.",
      "It was one of the most searched plants on the internet throughout the 2020s.",
    ],
    origin: "Southern Mexico and Central America",
    bloomSeason: "Rarely blooms indoors; outdoors in Spring–Summer",
    difficulty: "intermediate",
  },
  {
    id: "african-violet",
    name: "African Violet",
    flowerUserName: "Violet",
    scientificName: "Saintpaulia ionantha",
    category: "tropical",
    imageUrl: "https://placehold.co/400x400/f3e5f5/6a1b9a?text=African+Violet",
    shortDescription: "A cheerful compact bloomer that flowers almost year-round in bright filtered light.",
    fullDescription:
      "African Violets are among the most popular flowering houseplants in the world. Despite their delicate appearance, they bloom prolifically in shades of purple, pink, and white. They are pet-safe and child-safe, making them an ideal choice for family homes.",
    flowerNotes:
      "I'm a cheerful little plant who loves bright, gentle light — not harsh sun, just warm brightness. My leaves are quite fussy: please water me from below by pouring water into my saucer. Wet leaves make me sad and spotty!",
    careMantra: "Water my feet, not my face, and I'll bloom for you all year!",
    difficultyBadge: { emoji: "🌿", label: "Medium" },
    wateringFrequencyDays: 7,
    wateringAmountMl: 150,
    wateringNotes: "Always bottom-water: fill the saucer with room-temperature water and let the plant absorb what it needs over 30 minutes, then discard any excess.",
    sunlight: "partial_shade",
    sunlightImportance: "important",
    idealPlacement: "East- or north-facing windowsill with bright, indirect light",
    placementTips: [
      "Avoid direct sunlight — leaves will scorch and bleach.",
      "A sheer curtain filters south-facing sun to the ideal level.",
      "Rotate the pot a quarter turn each week so all leaves get even light.",
    ],
    temperatureMinC: 18,
    temperatureMaxC: 28,
    humidity: "medium",
    humidityTip: "Aim for 40–60% humidity. Never mist directly — the water droplets leave permanent marks on the velvety leaves.",
    growthSpeed: "slow",
    soilType: "Specialised African Violet mix (light and slightly acidic)",
    repottingFrequencyYears: 1,
    repottingTip: "Repot once a year into a pot only slightly larger than the root ball. African Violets actually prefer being slightly root-bound.",
    toxicity: "non_toxic",
    toxicityLabel: "Safe for pets & kids",
    isAllergyRisk: false,
    allergyNotes: "",
    isPetSafe: true,
    isChildSafe: true,
    scent: "none",
    scentDescription: "",
    happySigns: [
      "Compact, symmetrical rosette of leaves",
      "Multiple clusters of flowers in bloom simultaneously",
      "Dark green, velvety leaves with no spotting",
      "Continuous production of new flower buds",
    ],
    sadSigns: [
      "White or brown leaf spots — cold water or misting; switch to bottom watering",
      "Leggy, stretched leaves — needs more light",
      "Crown rot — overwatering from above; remove affected leaves and dry the crown",
      "No flowers — needs more light or a feed of high-phosphorus fertiliser",
    ],
    interestingFacts: [
      "There are over 16,000 registered cultivars of African Violet.",
      "They were discovered by Baron Walter von Saint Paul in Tanzania in 1892.",
      "African Violets bloom more readily when slightly pot-bound.",
      "They are one of the only houseplants that can be propagated from a single leaf.",
    ],
    origin: "Tanzania and Kenya (East Africa)",
    bloomSeason: "Almost year-round with adequate light",
    difficulty: "intermediate",
  },
  {
    id: "lavender",
    name: "Lavender",
    flowerUserName: "Lavy",
    scientificName: "Lavandula angustifolia",
    category: "herb",
    imageUrl: "https://placehold.co/400x400/ede7f6/4527a0?text=Lavender",
    shortDescription: "The fragrant purple herb of the Mediterranean — calming, beautiful, and bee-friendly.",
    fullDescription:
      "English Lavender is beloved for its intensely calming fragrance and stunning purple flower spikes. Originally from the sun-drenched Mediterranean, it thrives in full sun and well-drained soil. It is completely non-toxic, safe for pets and children.",
    flowerNotes:
      "I adore sunshine — give me a full day of it if you possibly can! I come from the hot, rocky hillsides of the Mediterranean, so I like to dry out a bit between drinks. My purple flowers will smell absolutely wonderful!",
    careMantra: "Lots of sunshine and a little thirst keep my purple flowers at their best!",
    difficultyBadge: { emoji: "🌿", label: "Medium" },
    wateringFrequencyDays: 10,
    wateringAmountMl: 200,
    wateringNotes: "Allow the soil to dry out almost completely between waterings — lavender hates wet feet. Water at the base, never overhead.",
    sunlight: "full_sun",
    sunlightImportance: "critical",
    idealPlacement: "Sunniest windowsill or outdoor spot with 6+ hours of direct sun",
    placementTips: [
      "A south-facing windowsill is ideal indoors.",
      "Outdoors, place in a raised bed or gravel garden for perfect drainage.",
      "Avoid shady spots — lavender will become leggy and produce few flowers.",
    ],
    temperatureMinC: 5,
    temperatureMaxC: 35,
    humidity: "low",
    humidityTip: "Lavender loves dry air. High humidity leads to fungal disease. Ensure excellent ventilation.",
    growthSpeed: "moderate",
    soilType: "Alkaline, sandy or gravelly, extremely well-draining soil",
    repottingFrequencyYears: 2,
    repottingTip: "Repot in spring into a terracotta pot with plenty of drainage holes. Mix potting compost with up to 50% horticultural grit.",
    toxicity: "non_toxic",
    toxicityLabel: "Safe for pets & kids",
    isAllergyRisk: false,
    allergyNotes: "",
    isPetSafe: true,
    isChildSafe: true,
    scent: "strong",
    scentDescription: "Deeply floral, herbaceous, and calming — the definitive scent of the Mediterranean summer. Most intense just as the flowers open.",
    happySigns: [
      "Dense, upright flower spikes in vivid purple",
      "Silver-grey-green foliage that is firm and aromatic when touched",
      "Bees and butterflies visiting regularly",
      "Strong, woody base with bushy new growth",
    ],
    sadSigns: [
      "Leggy, sparse growth — not enough sun; move to a brighter spot",
      "Grey, powdery coating on leaves — powdery mildew from high humidity",
      "Root rot (soft, mushy base) — overwatering; improve drainage immediately",
      "Brown, dead wood — frost damage or age; prune back to green growth in spring",
    ],
    interestingFacts: [
      "Lavender has been used medicinally and cosmetically for over 2,500 years.",
      "The name derives from the Latin \"lavare\" — to wash — as Romans used it in baths.",
      "A single lavender plant can produce up to 2,000 flowers per spike.",
      "Lavender oil is one of the most widely studied essential oils for anxiety reduction.",
    ],
    origin: "Mediterranean region (Spain, France, Italy)",
    bloomSeason: "Late Spring to mid-Summer",
    difficulty: "intermediate",
  },
  {
    id: "rose",
    name: "Rose",
    flowerUserName: "Rosa",
    scientificName: "Rosa × hybrida",
    category: "shrub",
    imageUrl: "https://placehold.co/400x400/fce4ec/b71c1c?text=Rose",
    shortDescription: "The timeless queen of flowers — stunning blooms, intoxicating fragrance, and a rewarding challenge.",
    fullDescription:
      "Hybrid roses are the result of centuries of selective breeding, combining the beauty and fragrance of wild species into dramatic, repeat-blooming garden aristocrats. Growing roses well requires consistent watering, feeding, pruning, and pest monitoring.",
    flowerNotes:
      "I'm a classic beauty who loves plenty of sunshine and fresh air around my leaves. Please water me at my base and keep my leaves dry — wet leaves invite all sorts of fungal problems. Feed me regularly and I'll reward you with gorgeous blooms!",
    careMantra: "Sunshine, fresh air, and a little love will make me the queen of your garden!",
    difficultyBadge: { emoji: "🌿", label: "Medium" },
    wateringFrequencyDays: 5,
    wateringAmountMl: 500,
    wateringNotes: "Water deeply at the base 2–3 times per week in warm weather, less in cool weather. Avoid wetting the foliage.",
    sunlight: "full_sun",
    sunlightImportance: "critical",
    idealPlacement: "Open sunny spot with good air circulation on all sides",
    placementTips: [
      "At least 6 hours of direct sunlight per day is non-negotiable for good blooms.",
      "Good airflow reduces the risk of black spot and powdery mildew.",
      "Avoid planting near walls that reflect heat.",
    ],
    temperatureMinC: 5,
    temperatureMaxC: 32,
    humidity: "medium",
    humidityTip: "Moderate humidity is ideal. High humidity with poor airflow causes fungal disease.",
    growthSpeed: "moderate",
    soilType: "Rich, loamy, well-draining soil with a slightly acidic pH (6.0–6.5)",
    repottingFrequencyYears: 3,
    repottingTip: "Repot container roses in early spring before new growth begins. Use a deep pot and add fresh rose compost.",
    toxicity: "non_toxic",
    toxicityLabel: "Non-toxic — but thorns are sharp!",
    isAllergyRisk: true,
    allergyNotes: "Rose pollen can trigger hay fever in some people. The thorns pose a physical injury risk for young children.",
    isPetSafe: true,
    isChildSafe: true,
    scent: "strong",
    scentDescription: "Rich, deep, and unmistakably floral — the classic \"rose\" fragrance. Intensity varies by variety.",
    happySigns: [
      "Abundant, richly coloured blooms that hold their shape well",
      "Healthy, deep-green leaves with no spotting",
      "New red-tipped shoots emerging after pruning",
      "Flower buds forming regularly throughout the season",
    ],
    sadSigns: [
      "Black spots on leaves — black spot fungal disease; remove affected leaves and treat",
      "White powdery coating — powdery mildew; improve airflow and treat with fungicide",
      "Yellow leaves — nutrient deficiency or overwatering; feed and check drainage",
      "Eaten leaves with holes — caterpillars or beetles; inspect undersides of leaves",
    ],
    interestingFacts: [
      "Roses have been cultivated for at least 5,000 years.",
      "There are over 300 species and tens of thousands of cultivated varieties of roses.",
      "Rose hips (the fruit) are one of the richest plant sources of vitamin C.",
      "The world's oldest living rose is said to be growing on the wall of Hildesheim Cathedral in Germany — estimated to be over 1,000 years old.",
    ],
    origin: "Asia (most wild species), with hybrids developed globally",
    bloomSeason: "Late Spring through Autumn (repeat-flowering varieties)",
    difficulty: "intermediate",
  },
  {
    id: "echeveria",
    name: "Echeveria",
    flowerUserName: "Echo",
    scientificName: "Echeveria elegans",
    category: "succulent",
    imageUrl: "https://placehold.co/400x400/f1f8e9/33691e?text=Echeveria",
    shortDescription: "A rosette-shaped succulent that stores water in its plump leaves — almost impossible to kill.",
    fullDescription:
      "Echeveria elegans — the Mexican Snowball — is a compact, rosette-forming succulent native to the semi-arid highlands of Mexico. Its fleshy, blue-grey leaves are coated in a natural waxy powder that helps reflect intense sunlight. It is completely non-toxic and beginner-friendly.",
    flowerNotes:
      "I store water in my fat, chunky leaves, so I really don't need watering very often! I love sitting in the sunniest spot in the house. When you do water me, drench the soil completely — then wait until it's absolutely bone dry before watering again.",
    careMantra: "Soak me, then forget me — my fat leaves have everything I need!",
    difficultyBadge: { emoji: "🌱", label: "Easy" },
    wateringFrequencyDays: 14,
    wateringAmountMl: 100,
    wateringNotes: "Use the \"soak and dry\" method: water thoroughly until it drains from the bottom, then wait until the soil is completely dry. In winter, water once a month or less.",
    sunlight: "full_sun",
    sunlightImportance: "critical",
    idealPlacement: "Sunniest windowsill — south or west-facing preferred",
    placementTips: [
      "At least 4–6 hours of bright light per day is needed to maintain the compact rosette shape.",
      "Insufficient light causes \"etiolation\" — the plant stretches and loses its neat form.",
      "Outdoors in summer (after acclimatising gradually) produces the most vivid colouring.",
    ],
    temperatureMinC: 5,
    temperatureMaxC: 35,
    humidity: "low",
    humidityTip: "Echeveria thrives in dry air. High humidity causes rot. Avoid bathrooms and kitchens where steam accumulates.",
    growthSpeed: "slow",
    soilType: "Cactus and succulent mix with added coarse grit or perlite",
    repottingFrequencyYears: 2,
    repottingTip: "Repot in spring when the rosette fills the pot. Shallow, wide pots are better than deep ones as the roots are naturally shallow.",
    toxicity: "non_toxic",
    toxicityLabel: "Safe for pets & kids",
    isAllergyRisk: false,
    allergyNotes: "",
    isPetSafe: true,
    isChildSafe: true,
    scent: "none",
    scentDescription: "",
    happySigns: [
      "Tight, compact rosette with plump, firm leaves",
      "Blue-grey or purple-tinged leaf colour (stress colouring from sun)",
      "Small pink or orange bell flowers on arching stems in spring",
      "Offsets (baby rosettes) appearing around the base",
    ],
    sadSigns: [
      "Stretched, spaced-out leaves — needs much more light",
      "Soft, translucent, mushy leaves — overwatering or root rot; stop watering immediately",
      "Shrivelled, thin leaves — underwatering; give a thorough soak",
      "Brown, watery patches — frost damage; bring indoors immediately",
    ],
    interestingFacts: [
      "The waxy powder (farina) on Echeveria leaves is a natural sunscreen — never wipe it off.",
      "Echeveria is named after Atanasio Echeverría, an 18th-century Mexican botanical artist.",
      "A single fallen leaf can grow into a full new plant.",
      "There are over 150 species of Echeveria, all native to the Americas.",
    ],
    origin: "Mexico and Central America (semi-arid highlands)",
    bloomSeason: "Spring to Summer",
    difficulty: "beginner",
  },
] as const;

// ─── Seed logic ───────────────────────────────────────────────────────────────

// DynamoDB BatchWrite limit is 25 items per request
function chunk<T>(arr: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size) as T[]);
  }
  return chunks;
}

async function seed() {
  console.log(`Seeding ${FLOWERS.length} flowers into table: ${tableName}`);

  for (const batch of chunk(FLOWERS, 25)) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((flower) => ({
            PutRequest: { Item: { PK: flower.id, ...flower } },
          })),
        },
      }),
    );
    console.log(`  ✓ Written batch of ${batch.length}`);
  }

  console.log("Seeding complete.");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
