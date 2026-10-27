import type { QuantityUnit } from './quantity';

/**
 * Maps ingredient wording to food ids in the emission table (src/food/data.ts) and carries the
 * household-measure conversions needed to turn cups/counts into grams. Precision over recall:
 * every entry lists what it must NOT match, and a line that fits no entry stays unknown.
 */

export interface MatchContext {
  /** Lowercased description before the first comma ("ground beef, browned" -> "ground beef"). */
  head: string;
  full: string;
  unit: QuantityUnit | null;
  /** True for a "can"/"tin" unit or the words canned/tinned anywhere in the line. */
  canned: boolean;
}

export interface LexiconEntry {
  id: string;
  include: RegExp[];
  exclude: RegExp[];
  when?: (ctx: MatchContext) => boolean;
  /** Grams per US cup (about 236.6 ml) of this food as it is measured in recipes. */
  cupG?: number;
  /** Grams per whole item when a recipe counts them ("2 eggs"). */
  eachG?: number;
  cloveG?: number;
  stickG?: number;
  sliceG?: number;
  /** Fraction of a can's stated weight that is the food itself once drained. */
  drainedFraction?: number;
}

const BROTHY = /\b(?:broth|stock|bouillon|consomm[eé]|soup|gravy|base|cubes?)\b/;
const COOKED = /\b(?:cooked|roasted|grilled|fried|baked|boiled|steamed|leftover|rotisserie|smoked|pre-?cooked|canned|tinned|breaded|shredded cooked)\b/;
const SUBSTITUTE = /\b(?:vegan|vegetarian|plant[- ]based|meatless|meat[- ]free|dairy[- ]free|imitation|substitute|alternative|faux|veggie|mock|flavou?red?|flavou?ring|seasoning|powder)\b/;
const PLANT_MILK = /\b(?:coconut|soy|soya|almond|oat|rice|cashew|hemp|pea|plant|nut|macadamia)\b/;
const COOKED_CUE = /\bcooked\b/;
const DRY_CUE = /\b(?:dry|dried|uncooked)\b/;

export const LEXICON: LexiconEntry[] = [
  {
    id: 'beef-ground-raw',
    include: [/\bground (?:beef|chuck|sirloin|round)\b/, /\b(?:beef mince|minced beef|hamburger meat|ground hamburger)\b/],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\b(?:jerky|sausage|patt(?:y|ies)|burgers?)\b/],
  },
  {
    id: 'beef-stewing-raw',
    include: [
      /\b(?:beef )?stew(?:ing)? (?:meat|beef)\b/,
      /\bbeef (?:chuck|brisket|short ribs?|shank|roast|cubes?)\b/,
      /\bchuck (?:roast|steak)\b/,
      /\bpot roast\b/,
      /\bbrisket\b/,
    ],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\b(?:jerky|corned|sausage)\b/],
  },
  {
    id: 'beef-steak-raw',
    include: [
      /\bbeef (?:steaks?|tenderloin|filets?|fillets?)\b/,
      /\b(?:ribeye|rib[- ]eye|sirloin|flank|skirt|hanger|t-bone|porterhouse|filet mignon|new york strip)\b/,
    ],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\b(?:sauce|rub|spice|tuna|salmon|swordfish|pork|chicken|turkey|cauliflower|portobello|jerky)\b/],
  },
  {
    id: 'lamb-leg-raw',
    include: [/\blamb\b/],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\blamb'?s? (?:lettuce|quarters|ear)\b/],
  },
  {
    id: 'pork-loin-raw',
    include: [/\bpork (?:chops?|loin|tenderloin|cutlets?|steaks?|medallions?|fillet)\b/],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\b(?:sausage|rinds?|skins?)\b/],
  },
  {
    id: 'pork-shoulder-raw',
    include: [/\bpork (?:shoulder|butt|neck|collar)\b/, /\bboston butt\b/],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\b(?:sausage|rinds?)\b/],
  },
  {
    id: 'pork-belly-smoked-raw',
    include: [/\bbacon\b/],
    exclude: [/\b(?:cooked|roasted|grilled|fried|baked|boiled|pre-?cooked)\b/, SUBSTITUTE, /\b(?:bits|bacon-?flavou?red|grease|drippings|fat|turkey|tempeh|coconut|jam|salt|crumbles|crumbled)\b/],
    sliceG: 25,
  },
  {
    id: 'chicken-raw',
    include: [/\bchicken\b/],
    exclude: [
      BROTHY,
      COOKED,
      SUBSTITUTE,
      /\b(?:cream of|nuggets?|tenders|salad|sausage|bacon|ham|deli|lunch|liver|gizzards?|fat|schmaltz|egg|popcorn|wings sauce|chicken-?fried)\b/,
    ],
  },
  {
    id: 'turkey-raw',
    include: [/\bturkey\b/],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\b(?:bacon|sausage|deli|ham|sub|jerky|bologna|burgers?|patt(?:y|ies)|red lentils?)\b/],
  },
  {
    id: 'salmon-farmed-raw',
    include: [/\bsalmon\b/],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\b(?:smoked|canned|lox|cured|gravlax|burgers?|patt(?:y|ies)|roe|caviar|oil|wild)\b/],
  },
  {
    id: 'cod-raw',
    include: [/\bcod\b/],
    exclude: [BROTHY, COOKED, SUBSTITUTE, /\b(?:liver|roe|salt|salted|dried|smoked|cakes?)\b/],
  },
  {
    id: 'egg-raw',
    include: [/\beggs?\b/],
    exclude: [
      SUBSTITUTE,
      /\b(?:eggplants?|egg ?noodles?|egg whites?|egg yolks?|egg ?nog|egg (?:wash|replacer|roll|drop)|flax|chia|scotch|salad|deviled|boiled|hard[- ]?cooked|poached|fried|scrambled|pasta|bread|tortilla|mayonnaise|custard|duck|quail|goose)\b/,
    ],
    eachG: 50,
  },
  {
    id: 'milk-whole',
    include: [/\bwhole milk\b/, /\bfull[- ]fat milk\b/],
    exclude: [PLANT_MILK, SUBSTITUTE, /\b(?:chocolate|condensed|evaporated|goat|sheep|buttermilk|dry)\b/],
    cupG: 244,
  },
  {
    id: 'milk-semi-skimmed',
    include: [/\bmilk\b/],
    exclude: [
      PLANT_MILK,
      SUBSTITUTE,
      /\b(?:whole|full[- ]fat|skim(?:med)?|non-?fat|fat[- ]free|chocolate|condensed|evaporated|goat|sheep|dry|half and half|shake|bread|buttermilk|oat)\b/,
    ],
    cupG: 244,
  },
  {
    id: 'butter',
    include: [/\bbutter\b/],
    exclude: [
      SUBSTITUTE,
      /\b(?:peanut|almond|cashew|nut|seed|sunflower|cocoa|cacao|shea|apple|pumpkin|body|soy|clarified|ghee|brown|garlic|herb|compound|lemon)\b/,
      /\bbutter (?:beans?|lettuce|cookies?|crackers?|extract|spray|cream|nut|milk|scotch)\b/,
    ],
    cupG: 227,
    stickG: 113,
  },
  {
    id: 'cream-30',
    include: [/\bheavy (?:whipping )?cream\b/, /\bwhipping cream\b/, /\bdouble cream\b/],
    exclude: [SUBSTITUTE, /\b(?:ice|sour|cream cheese|coconut|cream of|soured)\b/],
    cupG: 238,
  },
  {
    id: 'yogurt-plain',
    include: [/\byogh?urt\b/],
    exclude: [
      SUBSTITUTE,
      PLANT_MILK,
      /\b(?:vanilla|strawberry|blueberry|fruit|sweetened|frozen|drink|dessert|honey|lemon|peach|raspberry|banana|chocolate|covered|pretzel|raisin)\b/,
    ],
    cupG: 245,
  },
  {
    id: 'cheddar',
    include: [/\bcheddar\b/],
    exclude: [SUBSTITUTE, /\b(?:sauce|soup|crackers?|goldfish|bunnies|dip|spread|biscuits?|scones?|chips?)\b/],
    cupG: 113,
  },
  {
    id: 'parmesan',
    include: [/\bparm(?:esan|igiano)(?:[- ]reggiano)?\b/],
    exclude: [SUBSTITUTE, /\b(?:crisps?|crusted|breaded|dip|sauce)\b/],
    cupG: 100,
  },
  {
    id: 'mozzarella',
    include: [/\bmozzarella\b/],
    exclude: [SUBSTITUTE, /\b(?:sticks?|sauce|burrata)\b/],
    cupG: 113,
  },
  {
    id: 'emmental',
    include: [/\bemm?ent(?:h)?al(?:er)?\b/, /\bswiss cheese\b/],
    exclude: [SUBSTITUTE, /\b(?:sauce|dip|soup)\b/],
    cupG: 113,
  },
  {
    id: 'feta-cow',
    include: [/\bfeta\b/],
    exclude: [SUBSTITUTE, /\b(?:dip|stuffed|sauce|whipped)\b/],
    cupG: 150,
  },
  {
    id: 'rice-white-raw',
    include: [/\brice\b/],
    exclude: [
      SUBSTITUTE,
      COOKED,
      /\b(?:brown|wild|black|red|cauliflower|vinegar|flour|wine|noodles?|paper|milk|syrup|cakes?|krispies?|cereal|pudding|crackers?|bran|pilaf|mix|instant|minute|frozen|microwave|bowl|water|starch|puffed|flakes?|and)\b/,
    ],
    cupG: 185,
  },
  {
    id: 'pasta-dry',
    include: [
      /\b(?:spaghetti|penne|rigatoni|fusilli|farfalle|linguine|fettuccine|tagliatelle|macaroni|orzo|rotini|ziti|bucatini|capellini|vermicelli|ditalini|orecchiette|conchiglie|shells|elbows?|pasta)\b/,
      /\blasagn[ae] (?:noodles?|sheets?)\b/,
    ],
    exclude: [
      SUBSTITUTE,
      COOKED,
      /\b(?:sauce|fresh|salad|water|bake|casserole|and cheese|soup|stuffed|filled|ravioli|tortellini|gnocchi|gluten[- ]free|chickpea|lentil|rice|protein|whole[- ]wheat|whole[- ]grain|wholemeal|egg|bean)\b/,
    ],
  },
  {
    id: 'flour-wheat',
    include: [/\bflour\b/],
    exclude: [/\b(?:almond|coconut|rice|oat|chickpea|gram|besan|corn|buckwheat|rye|spelt|cassava|tapioca|potato|soy|masa|banana|cricket|lupin|tortillas?|gluten[- ]free|semolina|00)\b/],
    cupG: 125,
  },
  {
    id: 'bread-baguette',
    include: [/\bbaguettes?\b/],
    exclude: [/\b(?:sandwich|sub|crumbs?|croutons?|stale)\b/],
    eachG: 250,
  },
  {
    id: 'potato-raw',
    include: [/\bpotato(?:es)?\b/],
    exclude: [
      COOKED,
      /\b(?:sweet|yam|chips?|crisps?|starch|flour|gnocchi|mashed|fries|hash(?:es)?|salad|frozen|instant|flakes?|tots?|skins?|wedges|dehydrated|bread|rolls?|soup|pierogi|latke|gratin|vodka)\b/,
    ],
    eachG: 170,
    cupG: 150,
  },
  {
    id: 'onion-raw',
    include: [/\bonions?\b/],
    exclude: [
      /\b(?:green|spring|welsh|pearl|frozen|fried|crispy|powder|flakes?|salt|soup|rings?|dip|marmalade|jam|caramelized|dried|dehydrated|granulated|bagel|juice|chives?|garlic)\b/,
    ],
    eachG: 110,
    cupG: 160,
  },
  {
    id: 'garlic-raw',
    include: [/\bgarlic\b/],
    exclude: [/\b(?:powder|salt|bread|sauce|paste|granules?|chili|chilli|aioli|butter|dip|oil|mayo|seasoning|confit|black|roasted|pickled|jarred|scapes|chives|naan|knots?)\b/],
    cloveG: 4,
  },
  {
    id: 'carrot-raw',
    include: [/\bcarrots?\b/],
    exclude: [COOKED, /\b(?:cake|juice|puree|pickled|salad|slaw)\b/],
    eachG: 60,
    cupG: 128,
  },
  {
    id: 'tomato-raw',
    include: [/\btomato(?:es)?\b/],
    exclude: [
      COOKED,
      /\b(?:crushed|puree|purée|paste|sauce|sun[- ]?dried|dried|juice|ketchup|soup|salsa|passata|stewed|pickled|green|powder|jam|chutney|seeds?|plant|bloody|marinara|peeled|fire[- ]roasted|rotel)\b/,
    ],
    when: (ctx) => !ctx.canned,
    eachG: 120,
    cupG: 180,
  },
  {
    id: 'tomato-canned',
    include: [/\btomato(?:es)?\b/],
    exclude: [/\b(?:crushed|puree|purée|paste|sauce|sun[- ]?dried|dried|juice|ketchup|soup|salsa|passata|green|powder|jam|chutney|marinara|bloody)\b/],
    when: (ctx) => ctx.canned,
    // The juice in the can is tomato too, so the whole stated weight counts.
    drainedFraction: 1,
  },
  {
    id: 'lentils-dry',
    include: [/\blentils?\b/],
    exclude: [SUBSTITUTE, /\b(?:soup|pasta|chips|flour|noodles?|burgers?|patt(?:y|ies)|salad)\b/],
    // Recipes list lentils dry unless they say cooked or canned.
    when: (ctx) => !ctx.canned && !COOKED_CUE.test(ctx.head),
    cupG: 192,
  },
  {
    id: 'lentils-cooked',
    include: [/\blentils?\b/],
    exclude: [SUBSTITUTE, /\b(?:soup|pasta|chips|flour|noodles?|burgers?|patt(?:y|ies)|salad)\b/],
    when: (ctx) => COOKED_CUE.test(ctx.head),
    cupG: 198,
  },
  {
    id: 'lentils-canned',
    include: [/\blentils?\b/],
    exclude: [SUBSTITUTE, /\b(?:soup|pasta|chips|flour|noodles?|burgers?|patt(?:y|ies)|salad)\b/],
    when: (ctx) => ctx.canned,
    drainedFraction: 0.6,
  },
  {
    id: 'chickpeas-dry',
    include: [/\b(?:chickpeas?|chick peas?|garbanzo(?: beans?)?)\b/],
    exclude: [SUBSTITUTE, /\b(?:flour|hummus|pasta|chips|snack|roasted|falafel|crispy|soup|salad)\b/],
    when: (ctx) => !ctx.canned && DRY_CUE.test(ctx.head),
    cupG: 200,
  },
  {
    id: 'chickpeas-cooked',
    include: [/\b(?:chickpeas?|chick peas?|garbanzo(?: beans?)?)\b/],
    exclude: [SUBSTITUTE, /\b(?:flour|hummus|pasta|chips|snack|roasted|falafel|crispy|soup|salad)\b/],
    when: (ctx) => !ctx.canned && COOKED_CUE.test(ctx.head),
    cupG: 164,
  },
  {
    id: 'chickpeas-canned',
    include: [/\b(?:chickpeas?|chick peas?|garbanzo(?: beans?)?)\b/],
    exclude: [SUBSTITUTE, /\b(?:flour|hummus|pasta|chips|snack|roasted|falafel|crispy|soup|salad)\b/],
    when: (ctx) => ctx.canned,
    // A can of beans is roughly 60% beans by weight once the liquid is drained off.
    drainedFraction: 0.6,
  },
  {
    id: 'kidney-beans-dry',
    include: [/\bkidney beans?\b/],
    exclude: [SUBSTITUTE, /\b(?:soup|salad|chili)\b/],
    when: (ctx) => !ctx.canned && DRY_CUE.test(ctx.head),
    cupG: 184,
  },
  {
    id: 'kidney-beans-cooked',
    include: [/\bkidney beans?\b/],
    exclude: [SUBSTITUTE, /\b(?:soup|salad|chili)\b/],
    when: (ctx) => !ctx.canned && COOKED_CUE.test(ctx.head),
    cupG: 177,
  },
  {
    id: 'kidney-beans-canned',
    include: [/\bkidney beans?\b/],
    exclude: [SUBSTITUTE, /\b(?:soup|salad|chili)\b/],
    when: (ctx) => ctx.canned,
    drainedFraction: 0.6,
  },
  {
    id: 'tofu-plain',
    include: [/\btofu\b/],
    exclude: [SUBSTITUTE, /\b(?:fried|smoked|baked|marinated|scramble|dessert|skin|puffs?|sheets?)\b/],
  },
  {
    id: 'soy-drink-plain',
    include: [/\bsoy(?:a)? ?milk\b/, /\bsoy drink\b/],
    exclude: [/\b(?:yogurt|powder|sauce|chocolate|vanilla)\b/],
    cupG: 243,
  },
  {
    id: 'coconut-milk',
    include: [/\bcoconut (?:milk|cream)\b/],
    exclude: [/\b(?:powder|yogurt|water|flakes?|beverage|carton|drink|ice)\b/],
    cupG: 226,
    drainedFraction: 1,
  },
  {
    id: 'olive-oil',
    include: [/\bolive oil\b/],
    exclude: [/\b(?:spray|mayo(?:nnaise)?|tuna|sardines?|packed|marinated|infused|pesto|dressing|vinaigrette)\b/],
    cupG: 216,
  },
  {
    id: 'sugar-white',
    include: [/\bsugar\b/],
    exclude: [
      /\b(?:brown|powdered|icing|confectioners?|coconut|cane|raw|demerara|turbinado|muscovado|palm|maple|date|snap|snow|substitute|free|syrup|cookies?|sanding|pearl|vanilla|cinnamon|alcohol|sweetener|stevia|monk|invert|liquid)\b/,
    ],
    cupG: 200,
  },
];

/** Lines that carry negligible emissions or no food at all: they never block a footprint. */
export const IGNORABLE = new RegExp(
  String.raw`\b(?:salt|pepper|peppercorns?|paprika|cumin|oregano|thyme|basil|parsley|cilantro|coriander|chili powder|chilli powder|cayenne|cinnamon|nutmeg|bay leaf|bay leaves|rosemary|sage|dill|mint|vanilla|baking (?:soda|powder)|yeast|water|ice|stock|broth|bouillon|vinegar|soy sauce|worcestershire|mustard|hot sauce|lemon juice|lime juice|cooking spray|seasoning|spices?|herbs?|garnish|to taste|extract|food colou?ring|cornstarch|msg|turmeric|ginger|garlic powder|onion powder|chives)\b|:\s*$`
);
