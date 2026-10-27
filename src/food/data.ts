// GENERATED FILE - do not edit by hand. Regenerate with `npm run generate:food` (also runs in `npm run build`).
// Inputs: data/food-map.json joined to AGRIBALYSE v3.2 synthese.csv (data last updated 2025-02-27).
// Source ADEME, donnees AGRIBALYSE v3.2 - 2025. Licence Ouverte / Open Licence (Etalab). Credit text lives in data/NOTICE.

export type FoodCategory = "beef" | "lamb" | "pork" | "poultry" | "fish" | "egg" | "dairy" | "cheese" | "grain" | "vegetable" | "legume" | "soy" | "plant_fat" | "sweetener";
export type FoodState = "raw" | "dry" | "cooked" | "canned" | "as_sold";

export interface FoodEmissionFactor {
  id: string;
  label: string;
  category: FoodCategory;
  state: FoodState;
  /** AGRIBALYSE product key (Code AGB) this factor comes from. */
  agb: string;
  /** CIQUAL food code of that product. */
  ciqual: string;
  /** AGRIBALYSE product name (French), kept for traceability. */
  nameFr: string;
  /** Climate change indicator, kg CO2e per kg of product, farm to plate. */
  kgCo2ePerKg: number;
  /** AGRIBALYSE data quality rating (lower is better). */
  dqr: number;
}

export const FOOD_DATA_META = {
  source: "ADEME AGRIBALYSE",
  version: "v3.2",
  dataUpdatedAt: "2025-02-27",
  indicator: "Changement climatique (Environmental Footprint)",
  unit: "kg CO2e per kg of product",
  count: 46,
} as const;

export const FOOD_EMISSION_FACTORS: readonly FoodEmissionFactor[] = [
  { id: "beef-ground-raw", label: "Ground beef", category: "beef", state: "raw", agb: "6254", ciqual: "6254", nameFr: "Bœuf, steak haché 15% MG, cru", kgCo2ePerKg: 35.7, dqr: 2.89 },
  { id: "beef-stewing-raw", label: "Beef stewing cuts", category: "beef", state: "raw", agb: "6231", ciqual: "6231", nameFr: "Boeuf, à bourguignon ou pot-au-feu, cru", kgCo2ePerKg: 28.9, dqr: 2.85 },
  { id: "beef-steak-raw", label: "Beef steak", category: "beef", state: "raw", agb: "6212", ciqual: "6212", nameFr: "Boeuf, bavette d'aloyau, crue", kgCo2ePerKg: 28.9, dqr: 2.85 },
  { id: "lamb-leg-raw", label: "Lamb leg", category: "lamb", state: "raw", agb: "21502", ciqual: "21502", nameFr: "Agneau, gigot, cru", kgCo2ePerKg: 41.3, dqr: 2.97 },
  { id: "pork-loin-raw", label: "Pork loin chop", category: "pork", state: "raw", agb: "28100", ciqual: "28100", nameFr: "Porc, côte, crue", kgCo2ePerKg: 6.78, dqr: 2.85 },
  { id: "pork-shoulder-raw", label: "Pork shoulder", category: "pork", state: "raw", agb: "28302", ciqual: "28302", nameFr: "Porc, échine, crue", kgCo2ePerKg: 6.58, dqr: 2.85 },
  { id: "pork-belly-smoked-raw", label: "Smoked pork belly", category: "pork", state: "raw", agb: "28502", ciqual: "28502", nameFr: "Poitrine de porc, fumée, crue", kgCo2ePerKg: 6.58, dqr: 2.85 },
  { id: "chicken-raw", label: "Chicken", category: "poultry", state: "raw", agb: "36007", ciqual: "36007", nameFr: "Poulet (var. blanc), viande et peau, cru", kgCo2ePerKg: 5.78, dqr: 2.08 },
  { id: "turkey-raw", label: "Turkey", category: "poultry", state: "raw", agb: "36300", ciqual: "36300", nameFr: "Dinde, viande et peau, crue", kgCo2ePerKg: 4.56, dqr: 2.13 },
  { id: "salmon-farmed-raw", label: "Farmed salmon", category: "fish", state: "raw", agb: "26036", ciqual: "26036", nameFr: "Saumon, cru, élevage", kgCo2ePerKg: 5.55, dqr: 2.52 },
  { id: "cod-raw", label: "Cod", category: "fish", state: "raw", agb: "26043", ciqual: "26043", nameFr: "Cabillaud, cru", kgCo2ePerKg: 12, dqr: 3.07 },
  { id: "egg-raw", label: "Egg", category: "egg", state: "raw", agb: "22000", ciqual: "22000", nameFr: "Oeuf, cru", kgCo2ePerKg: 1.88, dqr: 2.44 },
  { id: "milk-whole", label: "Whole milk", category: "dairy", state: "as_sold", agb: "19024", ciqual: "19024", nameFr: "Lait entier, pasteurisé", kgCo2ePerKg: 1.46, dqr: 1.2 },
  { id: "milk-semi-skimmed", label: "Semi-skimmed milk", category: "dairy", state: "as_sold", agb: "19042", ciqual: "19042", nameFr: "Lait demi-écrémé, pasteurisé", kgCo2ePerKg: 1.27, dqr: 1.23 },
  { id: "butter", label: "Butter", category: "dairy", state: "as_sold", agb: "16400", ciqual: "16400", nameFr: "Beurre à 82% MG, doux", kgCo2ePerKg: 7.94, dqr: 1.09 },
  { id: "cream-30", label: "Cream (30% fat)", category: "dairy", state: "as_sold", agb: "19410", ciqual: "19410", nameFr: "Crème de lait, 30% MG, épaisse, rayon frais", kgCo2ePerKg: 3.83, dqr: 1.24 },
  { id: "yogurt-plain", label: "Plain yogurt", category: "dairy", state: "as_sold", agb: "19593", ciqual: "19593", nameFr: "Yaourt, lait fermenté ou spécialité laitière, nature", kgCo2ePerKg: 1.89, dqr: 1.22 },
  { id: "cheddar", label: "Cheddar", category: "cheese", state: "as_sold", agb: "12726", ciqual: "12726", nameFr: "Cheddar", kgCo2ePerKg: 6.65, dqr: 1.79 },
  { id: "parmesan", label: "Parmesan", category: "cheese", state: "as_sold", agb: "12120", ciqual: "12120", nameFr: "Parmesan", kgCo2ePerKg: 6.27, dqr: 1.77 },
  { id: "mozzarella", label: "Mozzarella", category: "cheese", state: "as_sold", agb: "19590", ciqual: "19590", nameFr: "Mozzarella au lait de vache", kgCo2ePerKg: 4.77, dqr: 1.78 },
  { id: "emmental", label: "Emmental", category: "cheese", state: "as_sold", agb: "12115", ciqual: "12115", nameFr: "Emmental ou emmenthal", kgCo2ePerKg: 6.28, dqr: 1.77 },
  { id: "feta-cow", label: "Feta (cow's milk)", category: "cheese", state: "as_sold", agb: "12060", ciqual: "12060", nameFr: "Fromage type feta, au lait de vache", kgCo2ePerKg: 5.56, dqr: 2.14 },
  { id: "rice-white-raw", label: "White rice", category: "grain", state: "raw", agb: "9100", ciqual: "9100", nameFr: "Riz blanc, cru", kgCo2ePerKg: 2.01, dqr: 3.85 },
  { id: "pasta-dry", label: "Dry pasta", category: "grain", state: "dry", agb: "9810", ciqual: "9810", nameFr: "Pâtes sèches standard, crues", kgCo2ePerKg: 1.98, dqr: 3.08 },
  { id: "flour-wheat", label: "Wheat flour", category: "grain", state: "as_sold", agb: "9436", ciqual: "9436", nameFr: "Farine de blé tendre ou froment T55 (pour pains)", kgCo2ePerKg: 0.791, dqr: 2.87 },
  { id: "bread-baguette", label: "Baguette", category: "grain", state: "as_sold", agb: "7001", ciqual: "7001", nameFr: "Pain, baguette, courante", kgCo2ePerKg: 0.776, dqr: 2.34 },
  { id: "potato-raw", label: "Potato", category: "vegetable", state: "raw", agb: "4008", ciqual: "4008", nameFr: "Pomme de terre, sans peau, crue", kgCo2ePerKg: 0.788, dqr: 2.26 },
  { id: "onion-raw", label: "Onion", category: "vegetable", state: "raw", agb: "20034", ciqual: "20034", nameFr: "Oignon, cru", kgCo2ePerKg: 0.421, dqr: 2.39 },
  { id: "garlic-raw", label: "Garlic", category: "vegetable", state: "raw", agb: "11000", ciqual: "11000", nameFr: "Ail, cru", kgCo2ePerKg: 0.383, dqr: 2.88 },
  { id: "carrot-raw", label: "Carrot", category: "vegetable", state: "raw", agb: "20009", ciqual: "20009", nameFr: "Carotte, crue", kgCo2ePerKg: 0.396, dqr: 2.24 },
  { id: "tomato-raw", label: "Tomato", category: "vegetable", state: "raw", agb: "20047_1", ciqual: "20047", nameFr: "Tomate, crue", kgCo2ePerKg: 0.75, dqr: 2.77 },
  { id: "tomato-canned", label: "Canned tomatoes", category: "vegetable", state: "canned", agb: "20048", ciqual: "20048", nameFr: "Tomate, pelée, appertisée, égouttée", kgCo2ePerKg: 1.51, dqr: 2.96 },
  { id: "lentils-dry", label: "Lentils (dry)", category: "legume", state: "dry", agb: "20586", ciqual: "20586", nameFr: "Lentille blonde, sèche", kgCo2ePerKg: 0.581, dqr: 2.87 },
  { id: "lentils-cooked", label: "Lentils (cooked)", category: "legume", state: "cooked", agb: "20588", ciqual: "20588", nameFr: "Lentille blonde, cuite", kgCo2ePerKg: 0.466, dqr: 3.01 },
  { id: "lentils-canned", label: "Lentils (canned)", category: "legume", state: "canned", agb: "20510", ciqual: "20510", nameFr: "Lentille, cuisinée, appertisée, égouttée", kgCo2ePerKg: 1.13, dqr: 2.67 },
  { id: "chickpeas-dry", label: "Chickpeas (dry)", category: "legume", state: "dry", agb: "20516", ciqual: "20516", nameFr: "Pois chiche, sec", kgCo2ePerKg: 0.899, dqr: 3.68 },
  { id: "chickpeas-cooked", label: "Chickpeas (cooked)", category: "legume", state: "cooked", agb: "20507", ciqual: "20507", nameFr: "Pois chiche, cuit", kgCo2ePerKg: 0.603, dqr: 2.71 },
  { id: "chickpeas-canned", label: "Chickpeas (canned)", category: "legume", state: "canned", agb: "20532", ciqual: "20532", nameFr: "Pois chiche, appertisé, égoutté", kgCo2ePerKg: 2.2, dqr: 3.35 },
  { id: "kidney-beans-dry", label: "Kidney beans (dry)", category: "legume", state: "dry", agb: "20525", ciqual: "20525", nameFr: "Haricot rouge, sec", kgCo2ePerKg: 0.858, dqr: 3.27 },
  { id: "kidney-beans-cooked", label: "Kidney beans (cooked)", category: "legume", state: "cooked", agb: "20503", ciqual: "20503", nameFr: "Haricot rouge, cuit", kgCo2ePerKg: 0.585, dqr: 3.13 },
  { id: "kidney-beans-canned", label: "Kidney beans (canned)", category: "legume", state: "canned", agb: "20524", ciqual: "20524", nameFr: "Haricot rouge, appertisé, égoutté", kgCo2ePerKg: 1.45, dqr: 2.99 },
  { id: "tofu-plain", label: "Plain tofu", category: "soy", state: "as_sold", agb: "20904", ciqual: "20904", nameFr: "Tofu, nature", kgCo2ePerKg: 1, dqr: 2.04 },
  { id: "soy-drink-plain", label: "Soy drink", category: "soy", state: "as_sold", agb: "18900", ciqual: "18900", nameFr: "Boisson au soja, nature", kgCo2ePerKg: 0.427, dqr: 2.06 },
  { id: "coconut-milk", label: "Coconut milk", category: "plant_fat", state: "as_sold", agb: "18041", ciqual: "18041", nameFr: "Lait de coco ou Crème de coco", kgCo2ePerKg: 0.682, dqr: 2.6 },
  { id: "olive-oil", label: "Olive oil", category: "plant_fat", state: "as_sold", agb: "17270", ciqual: "17270", nameFr: "Huile d'olive vierge extra", kgCo2ePerKg: 1.63, dqr: 2.21 },
  { id: "sugar-white", label: "White sugar", category: "sweetener", state: "as_sold", agb: "31016", ciqual: "31016", nameFr: "Sucre blanc", kgCo2ePerKg: 0.746, dqr: 3.09 },
];
