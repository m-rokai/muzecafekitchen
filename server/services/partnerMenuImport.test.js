import assert from 'node:assert/strict';
import test from 'node:test';
import { inferPossibleAllergens, parseDownToEarthMenu, parseJsonLdMenu } from './partnerMenuImport.js';

test('infers only named FDA major allergens from published dish text', () => {
  assert.deepEqual(
    inferPossibleAllergens('Za’atar Chicken', 'Pearl Couscous, Garlic Yogurt Sauce, Sesame Seeds'),
    ['Milk', 'Wheat', 'Sesame'],
  );
  assert.deepEqual(inferPossibleAllergens('Caramelized Pineapple Tofu', 'Coconut rice'), ['Soy']);
  assert.deepEqual(inferPossibleAllergens('Jamaican Jerk Zucchini', 'Coconut Rice, Sesame Seeds'), ['Sesame']);
  assert.deepEqual(inferPossibleAllergens('Harvest Bowl', 'Walnuts, peanuts, soybeans, noodles'), ['Tree nuts', 'Peanuts', 'Wheat', 'Soy']);
  assert.deepEqual(inferPossibleAllergens('Beef Pot Roast', 'Potatoes, carrots, rosemary'), []);
});

test('parses and deduplicates priced partner meals from JSON-LD', () => {
  const html = `
    <html><head><script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {"@type":"Product","sku":"meal-1","name":"Chicken Bowl","description":"Rice and vegetables","offers":{"price":"12.50"}},
          {"@type":"Product","sku":"meal-1","name":"Chicken Bowl","offers":{"price":"12.50"}},
          {"@type":"MenuItem","@id":"meal-2","name":"Veggie Bowl","price":"10.00"}
        ]
      }
    </script></head></html>`;
  const meals = parseJsonLdMenu(html, 'https://partner.example/menu');
  assert.equal(meals.length, 2);
  assert.deepEqual(meals.map(meal => meal.priceCents).sort(), [1000, 1250]);
  assert.ok(meals.every(meal => meal.externalSourceId));
});

test('refuses a page without a parseable priced menu', () => {
  assert.throws(
    () => parseJsonLdMenu('<html><body>No structured menu</body></html>', 'https://partner.example/menu'),
    /No priced MenuItem or Product JSON-LD entries/,
  );
});

test('imports only vegetarian, chicken, and beef cards from the Down to Earth carousel', () => {
  const card = (name, description = 'Seasonal vegetables') => `
    <article class="mc-card">
      <div class="mc-card__image"><img src="/images/${name}.jpg" alt=""></div>
      <div class="mc-card__body">
        <span class="mc-tag">GF</span>
        <h4 class="mc-card__name">${name}</h4>
        <p class="mc-card__desc">${description}</p>
      </div>
    </article>`;
  const html = `
    <div class="mc-carousel wp-block-dtec-meal-carousel" data-menu-date="2026-09-13" data-cutoff="2026-09-09T12:00:00-07:00"></div>
    <template class="mc-section-template" data-section="Land &amp; Sea">
      ${card('Za&#8217;atar Chicken', 'Pearl couscous, garlic yogurt sauce, sesame seeds')}
      ${card('Caramelized Pineapple Chicken')}
      ${card('Beef Pot Roast')}
      ${card('Jamaican Jerk Pork')}
      ${card('Pan-Fried Salmon')}
    </template>
    <template class="mc-section-template" data-section="Vegetarian">
      ${card('Caramelized Pineapple Tofu', 'Honey, tofu &amp; vegetables')}
      ${card('Za&#8217;atar Eggplant', 'Pearl couscous, garlic yogurt sauce, sesame seeds')}
      ${card('Jamaican Jerk Zucchini', 'Coconut rice, sesame seeds')}
      ${card('Vegetarian Chef&#039;s Special')}
    </template>`;

  const meals = parseDownToEarthMenu(html, 'https://www.downtoearthcuisine.com/delivery-menu/');
  assert.deepEqual(meals.map(meal => meal.name), [
    'Za’atar Chicken',
    'Caramelized Pineapple Chicken',
    'Beef Pot Roast',
    'Caramelized Pineapple Tofu',
    'Za’atar Eggplant',
    'Jamaican Jerk Zucchini',
  ]);
  assert.ok(meals.every(meal => meal.priceCents === 2059));
  assert.ok(meals.every(meal => meal.sourcePayload.sourceMenuDate === '2026-09-13'));
  assert.ok(meals.every(meal => meal.sourcePayload.menuDate === '2026-09-14'));
  assert.ok(meals.every(meal => meal.sourcePayload.orderDeadline === '2026-09-09T19:00:00.000Z'));
  assert.ok(meals.every(meal => !/pork|salmon/i.test(meal.name)));
  assert.deepEqual(meals[0].sourcePayload.possibleAllergens, ['Milk', 'Wheat', 'Sesame']);
  assert.deepEqual(meals[3].sourcePayload.possibleAllergens, ['Soy']);
});

test('fails closed when the requested sections contain no approved meal type', () => {
  const html = `
    <div class="wp-block-dtec-meal-carousel" data-menu-date="2026-09-13"></div>
    <template class="mc-section-template" data-section="Land &amp; Sea">
      <article><h4 class="mc-card__name">Thai Seafood Stew</h4></article>
    </template>`;
  assert.throws(
    () => parseDownToEarthMenu(html, 'https://www.downtoearthcuisine.com/delivery-menu/'),
    /No allowed vegetarian, chicken, or beef meals/,
  );
});

test('fails closed instead of publishing fewer than six approved meals', () => {
  const html = `
    <div class="wp-block-dtec-meal-carousel" data-menu-date="2026-09-13" data-cutoff="2026-09-09T12:00:00-07:00"></div>
    <template class="mc-section-template" data-section="Land &amp; Sea">
      <article><h4 class="mc-card__name">Roast Chicken</h4></article>
    </template>
    <template class="mc-section-template" data-section="Vegetarian">
      <article><h4 class="mc-card__name">Roasted Eggplant</h4></article>
    </template>`;
  assert.throws(
    () => parseDownToEarthMenu(html, 'https://www.downtoearthcuisine.com/delivery-menu/'),
    /Expected six approved partner meals but found 2/,
  );
});
