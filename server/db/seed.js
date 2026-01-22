// Muze Café Menu Seed Data
// This file contains the baseline menu data

export const categories = [
  { id: 1, name: 'Coffee & Espresso', sort_order: 1, description: 'All coffee, smoothies, and frozen drinks come in 16 oz cups.' },
  { id: 2, name: 'Breakfast', sort_order: 2, description: 'Start your day right with our breakfast favorites.' },
  { id: 3, name: 'Smoothies', sort_order: 3, description: 'Refreshing fruit smoothies served in 16 oz cups.' },
  { id: 4, name: 'Frozen Coffee', sort_order: 4, description: 'Blended coffee drinks served in 16 oz cups.' },
  { id: 5, name: 'Salads', sort_order: 5, description: 'Fresh salads made with crisp ingredients.' },
  { id: 6, name: 'Sandwiches & Paninis', sort_order: 6, description: 'Handcrafted sandwiches and hot-pressed paninis.' },
  { id: 7, name: 'Tea & Lemonade', sort_order: 7, description: 'Refreshing teas and lemonades served in 20 oz cups.' },
];

export const menuItems = [
  // Coffee & Espresso
  { name: 'Cappuccino', price: 5.00, description: '', category_id: 1 },
  { name: 'Mocha', price: 6.00, description: 'Milk chocolate, espresso, and steamed milk. 16 oz.', category_id: 1 },
  { name: 'White Chocolate Mocha', price: 6.00, description: 'White chocolate, espresso, and steamed milk. 16 oz.', category_id: 1 },
  { name: 'Chai with Steamed Milk', price: 5.00, description: '', category_id: 1 },
  { name: 'Caramel Macchiato', price: 6.00, description: 'Espresso with vanilla syrup, steamed milk, and caramel sauce topping.', category_id: 1 },
  { name: 'Banana Cold Foam', price: 6.00, description: 'With espresso. 16 oz.', category_id: 1 },
  { name: 'Vanilla Cold Foam', price: 6.00, description: 'With espresso. 16 oz.', category_id: 1 },
  { name: 'House Blend', price: 4.00, description: '', category_id: 1 },
  { name: 'Double Espresso', price: 4.00, description: '', category_id: 1 },
  { name: 'Cafe Latte', price: 5.00, description: '', category_id: 1 },
  { name: 'Dirty Chai', price: 6.00, description: 'Chai with steamed milk and espresso. 16 oz.', category_id: 1 },
  { name: 'Affogato', price: 7.00, description: 'Vanilla bean ice cream topped with a double shot of espresso and chocolate candy sprinkles.', category_id: 1 },

  // Breakfast
  { name: 'Fruit & Yogurt Parfait', price: 7.00, description: 'Seasonal berries with granola and low-fat vanilla yogurt.', category_id: 2 },
  { name: 'Bagel with Butter', price: 6.00, description: 'Served with jam.', category_id: 2 },
  { name: 'Bagel with Cream Cheese', price: 7.00, description: 'Served with jam.', category_id: 2 },
  { name: 'Breakfast Burrito', price: 10.00, description: 'Bacon, sausage, scrambled eggs and cheese in a flour tortilla. Served with sour cream and salsa.', category_id: 2 },
  { name: 'Breakfast Croissant', price: 8.00, description: 'Bacon or ham, cheddar cheese and fried egg on a flakey croissant.', category_id: 2 },

  // Smoothies
  { name: 'Sun Burn', price: 6.95, description: 'Mango & passion fruit with strawberry bottom.', category_id: 3 },
  { name: 'Blue Hawaiian', price: 6.95, description: 'Fresh bananas, blueberries and low-fat vanilla ice cream.', category_id: 3 },
  { name: 'Lava Flow', price: 6.95, description: 'Pineapple, coconut & banana with a strawberry bottom.', category_id: 3 },
  { name: 'Jamaican Me Crazy', price: 6.95, description: 'Passion fruit, strawberry, and mango.', category_id: 3 },

  // Frozen Coffee
  { name: 'Frozen Mocha Java', price: 6.95, description: 'Whipped topping available upon request.', category_id: 4 },
  { name: 'White Chocolate Frozen Mocha', price: 6.95, description: 'Whipped topping available upon request.', category_id: 4 },
  { name: 'Caramel Frozen Mocha', price: 6.95, description: 'Whipped topping available upon request.', category_id: 4 },
  { name: 'Frozen Dirty Chai', price: 6.95, description: 'Whipped topping available upon request.', category_id: 4 },

  // Salads
  { name: 'Southwest Caesar Salad', price: 15.00, description: 'Romaine lettuce, chicken, crunchy tortilla strips and parmesan cheese. Served in a flour tortilla bowl.', category_id: 5 },
  { name: 'Cilantro-Lime Chicken Salad', price: 15.00, description: 'Romaine lettuce, roasted corn, black beans, jack cheese, crunchy tortilla strips, avocado and cotija cheese. Served with cilantro-lime vinaigrette.', category_id: 5 },

  // Sandwiches & Paninis
  { name: 'Roast Beef Panini', price: 14.00, description: 'Roast beef with grilled onions and mushrooms, mozzarella cheese on parmesan panini bread.', category_id: 6 },
  { name: 'Italian Chicken Panini', price: 14.00, description: 'Chicken, pesto, mozzarella cheese and roasted red peppers on panini bread.', category_id: 6 },
  { name: 'Turkey Grill', price: 14.00, description: 'Turkey, melted swiss, avocado, lettuce, tomato, and mayo on grilled sourdough.', category_id: 6 },
  { name: 'Jalapeno Tuna', price: 14.00, description: 'Home-made tuna salad, swiss cheese, tomato, and fried jalapenos on your choice of bread. Served cold or grilled.', category_id: 6 },
  { name: 'Chicken Pita Pocket', price: 14.00, description: 'Chicken, cucumbers, lettuce, tomato, and red onions in a pita pocket. Served with cucumber ranch.', category_id: 6 },
  { name: 'Southwest Caesar Wrap', price: 14.00, description: 'Chicken, romaine lettuce, tomato, tortilla strips, and parmesan cheese in a spinach tortilla.', category_id: 6 },
  { name: 'Chicken Salad BLT', price: 14.00, description: 'Chicken salad, crispy bacon, lettuce, tomato, and mayo on a flaky croissant.', category_id: 6 },
  { name: 'The "Robby"', price: 15.00, description: 'Pulled chicken, stuffing, cranberry sauce and mayo on panini bread.', category_id: 6 },

  // Tea & Lemonade
  { name: 'Iced Tea', price: 4.00, description: '20 oz.', category_id: 7 },
  { name: 'Tropical Iced Tea', price: 4.00, description: '20 oz.', category_id: 7 },
  { name: 'Lemonade', price: 4.00, description: '20 oz.', category_id: 7 },
  { name: 'Twisted Lemonade', price: 5.00, description: 'Choice of lavender, strawberry, blueberry, mango, or passionfruit. 20 oz.', category_id: 7 },
  { name: 'Sunkissed Tea', price: 4.00, description: 'Tropical tea & lemonade. 20 oz.', category_id: 7 },
];

export const modifierGroups = [
  { id: 1, name: 'Coffee Add-ons', display_name: 'Add-ons', sort_order: 1, category_ids: [1, 4] },
  { id: 2, name: 'Milk Options', display_name: 'Milk Options', sort_order: 2, category_ids: [1, 4] },
  { id: 3, name: 'Smoothie Add-ins', display_name: 'Add-ins', sort_order: 3, category_ids: [3] },
  { id: 4, name: 'Sandwich Add-ons', display_name: 'Add-ons', sort_order: 4, category_ids: [6] },
  { id: 5, name: 'Salad Add-ons', display_name: 'Add-ons', sort_order: 5, category_ids: [5] },
  { id: 6, name: 'Lemonade Flavors', display_name: 'Flavor', sort_order: 6, item_names: ['Twisted Lemonade'] },
  { id: 7, name: 'Breakfast Proteins', display_name: 'Protein Choice', sort_order: 7, item_names: ['Breakfast Croissant'] },
];

export const modifierOptions = [
  // Coffee Add-ons
  { group_id: 1, name: 'Extra Shot', price: 1.00 },
  { group_id: 1, name: 'Whipped Cream', price: 0.50 },
  { group_id: 1, name: 'Vanilla Syrup', price: 0.75 },
  { group_id: 1, name: 'Caramel Syrup', price: 0.75 },
  { group_id: 1, name: 'Hazelnut Syrup', price: 0.75 },
  { group_id: 1, name: 'Lavender Syrup', price: 0.75 },

  // Milk Options
  { group_id: 2, name: 'Oat Milk', price: 0.75 },
  { group_id: 2, name: 'Almond Milk', price: 0.75 },
  { group_id: 2, name: 'Coconut Milk', price: 0.75 },
  { group_id: 2, name: 'Soy Milk', price: 0.75 },

  // Smoothie Add-ins
  { group_id: 3, name: 'Whey Protein', price: 1.50 },
  { group_id: 3, name: 'Extra Fruit', price: 1.00 },
  { group_id: 3, name: 'Peanut Butter', price: 1.00 },

  // Sandwich Add-ons
  { group_id: 4, name: 'Bacon', price: 2.00 },
  { group_id: 4, name: 'Avocado', price: 1.50 },
  { group_id: 4, name: 'Extra Cheese', price: 1.00 },
  { group_id: 4, name: 'Extra Meat', price: 3.00 },

  // Salad Add-ons
  { group_id: 5, name: 'Grilled Chicken', price: 3.00 },
  { group_id: 5, name: 'Avocado', price: 1.50 },
  { group_id: 5, name: 'Extra Dressing', price: 0.50 },

  // Lemonade Flavors
  { group_id: 6, name: 'Lavender', price: 0 },
  { group_id: 6, name: 'Strawberry', price: 0 },
  { group_id: 6, name: 'Blueberry', price: 0 },
  { group_id: 6, name: 'Mango', price: 0 },
  { group_id: 6, name: 'Passionfruit', price: 0 },

  // Breakfast Proteins
  { group_id: 7, name: 'Bacon', price: 0 },
  { group_id: 7, name: 'Ham', price: 0 },
];
