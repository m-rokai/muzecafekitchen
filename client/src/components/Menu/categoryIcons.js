import {
  Coffee, Cookie, Sandwich, Croissant, Pizza, Salad, IceCream2,
  CupSoda, Beer, Wine, Soup, Egg, Apple, Cake, Donut, UtensilsCrossed,
} from 'lucide-react';

// Map category names (case-insensitive substring match) to a Lucide icon
// and a soft tinted gradient. Lets us swap real food photos in later
// without touching the cards.
const RULES = [
  { match: /coffee|espresso|latte|cappuccin|brew|drip|cold brew/i, icon: Coffee,            tint: 'from-amber-200 to-amber-100' },
  { match: /tea|matcha|chai/i,                                     icon: CupSoda,           tint: 'from-emerald-200 to-amber-100' },
  { match: /smoothie|juice|soda|drink|beverage|bottled/i,          icon: CupSoda,           tint: 'from-orange-200 to-yellow-100' },
  { match: /beer|cider/i,                                          icon: Beer,              tint: 'from-amber-300 to-amber-100' },
  { match: /wine/i,                                                icon: Wine,              tint: 'from-rose-300 to-rose-100' },
  { match: /soup|broth/i,                                          icon: Soup,              tint: 'from-orange-200 to-amber-100' },
  { match: /salad|bowl|grain/i,                                    icon: Salad,             tint: 'from-emerald-200 to-lime-100' },
  { match: /sandwich|panini|wrap|toast|bagel/i,                    icon: Sandwich,          tint: 'from-yellow-200 to-amber-100' },
  { match: /pizza|flatbread/i,                                     icon: Pizza,             tint: 'from-red-200 to-orange-100' },
  { match: /pastry|croissant|scone/i,                              icon: Croissant,         tint: 'from-yellow-200 to-orange-100' },
  { match: /donut|doughnut/i,                                      icon: Donut,             tint: 'from-pink-200 to-amber-100' },
  { match: /cookie|biscuit/i,                                      icon: Cookie,            tint: 'from-orange-200 to-yellow-100' },
  { match: /cake|brownie|dessert|sweet|treat/i,                    icon: Cake,              tint: 'from-pink-200 to-rose-100' },
  { match: /ice ?cream|gelato|frozen/i,                            icon: IceCream2,         tint: 'from-sky-200 to-pink-100' },
  { match: /breakfast|egg|omelet/i,                                icon: Egg,                tint: 'from-yellow-200 to-amber-100' },
  { match: /fruit|apple|berry/i,                                   icon: Apple,              tint: 'from-rose-200 to-emerald-100' },
];

const FALLBACK = { icon: UtensilsCrossed, tint: 'from-amber-200 to-amber-100' };

export function getCategoryStyle(categoryName = '', itemName = '') {
  const haystack = `${categoryName} ${itemName}`;
  for (const rule of RULES) {
    if (rule.match.test(haystack)) {
      return { Icon: rule.icon, tint: rule.tint };
    }
  }
  return { Icon: FALLBACK.icon, tint: FALLBACK.tint };
}
