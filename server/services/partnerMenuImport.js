import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import * as db from '../db/database.js';
import { deliveryDateFromSource, partnerScheduleForDelivery } from '../lib/partnerSchedule.js';

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const PARTNER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_PARTNER_PRICE_CENTS = 2059;
const DEFAULT_PARTNER_SECTION = 'Land & Sea';
const MAX_PARTNER_MEALS = 6;
const MEALS_PER_PRIMARY_SECTION = 3;
const ALLOWED_MEAL_PATTERNS = Object.freeze([/\bvegetarian\b/i, /\bplant[ -]?based\b/i, /\btofu\b/i, /\beggplant\b/i, /\bzucchini\b/i, /\bchicken\b/i, /\bbeef\b/i]);
const BLOCKED_MEAL_PATTERNS = Object.freeze([/\bpork\b/i, /\bham\b/i, /\bbacon\b/i, /\bsalmon\b/i, /\bseafood\b/i, /\bfish\b/i, /\bshrimp\b/i, /\bprawn\b/i, /\bcrab\b/i, /\blobster\b/i, /\btuna\b/i, /\bcod\b/i, /\bhalibut\b/i, /\btilapia\b/i, /\btrout\b/i, /\bshellfish\b/i]);
const MAJOR_ALLERGEN_PATTERNS = Object.freeze([
  ['Milk', /\b(?:milk|buttermilk|cream|cheese|cheddar|parmesan|mozzarella|feta|ricotta|yogurt|yoghurt|butter(?!\s+lettuce)|ghee|whey|casein)\b/i],
  ['Egg', /\b(?:egg|eggs|mayonnaise|mayo|aioli)\b/i],
  ['Fish', /\b(?:fish|salmon|tuna|cod|halibut|tilapia|trout|bass|flounder)\b/i],
  ['Crustacean shellfish', /\b(?:shellfish|shrimp|prawn|crab|lobster|crayfish)\b/i],
  ['Tree nuts', /\b(?:almonds?|walnuts?|cashews?|pecans?|pistachios?|hazelnuts?|macadamias?|brazil nuts?|pine nuts?)\b/i],
  ['Peanuts', /\b(?:peanuts?|groundnuts?)\b/i],
  ['Wheat', /\b(?:wheat|couscous|pasta|orzo|breads?|breadcrumbs?|bulgur|farro|semolina|noodles?)\b/i],
  ['Soy', /\b(?:soy(?:beans?)?|soya|tofu|tempeh|edamame|miso|tamari)\b/i],
  ['Sesame', /\b(?:sesame|tahini)\b/i],
]);

export function inferPossibleAllergens(name, description) {
  const dishText = `${name || ''} ${description || ''}`;
  return MAJOR_ALLERGEN_PATTERNS
    .filter(([, pattern]) => pattern.test(dishText))
    .map(([allergen]) => allergen);
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a >= 224;
  }
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === '::'
    || normalized.startsWith('fc') || normalized.startsWith('fd')
    || normalized.startsWith('fe8') || normalized.startsWith('fe9')
    || normalized.startsWith('fea') || normalized.startsWith('feb');
}

async function validatedSourceUrl(source) {
  const url = new URL(source);
  const allowedHost = process.env.PARTNER_MENU_ALLOWED_HOST?.trim().toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Partner menu URL must be a credential-free HTTPS URL on the default port');
  }
  if (!allowedHost || url.hostname.toLowerCase() !== allowedHost) {
    throw new Error('Partner menu host is not explicitly allowlisted');
  }
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(result => isPrivateAddress(result.address))) {
    throw new Error('Partner menu host resolved to a private or unsafe network address');
  }
  return url;
}

async function limitedText(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_SOURCE_BYTES) throw new Error('Partner menu source exceeds the 2 MB limit');
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error('Partner menu source exceeds the 2 MB limit');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function requestOptions() {
  return {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/json',
      'User-Agent': 'MuzeMenuImporter/1.0 (+menu partnership)',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  };
}

async function fetchPartnerMenuHtml(url) {
  let response = await fetch(url, requestOptions());
  if (response.status === 403
    && url.hostname === 'www.downtoearthcuisine.com'
    && url.pathname === '/delivery-menu/') {
    // The public page is Cloudflare-protected on some serverless networks.
    // WordPress exposes the same rendered page through its public, same-origin
    // REST representation; no protected endpoint or challenge is bypassed.
    const apiUrl = new URL('/wp-json/wp/v2/pages', url);
    apiUrl.searchParams.set('slug', 'delivery-menu');
    apiUrl.searchParams.set('_fields', 'content,modified,link');
    response = await fetch(apiUrl, requestOptions());
    if (!response.ok) throw new Error(`Partner menu request failed with HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!/^application\/json\b/i.test(contentType)) {
      throw new Error('Partner menu API did not return JSON');
    }
    const raw = await limitedText(response);
    let pages;
    try {
      pages = JSON.parse(raw);
    } catch {
      throw new Error('Partner menu API returned malformed JSON');
    }
    const html = pages?.[0]?.content?.rendered;
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Partner menu API did not include rendered page content');
    }
    return { html, sourceBytes: raw };
  }
  if (!response.ok) throw new Error(`Partner menu request failed with HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/^text\/html\b|^application\/xhtml\+xml\b/i.test(contentType)) {
    throw new Error('Partner menu source did not return HTML');
  }
  const html = await limitedText(response);
  return { html, sourceBytes: html };
}

function flattenJsonLd(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLd(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  output.push(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') flattenJsonLd(child, output);
  }
  return output;
}

function text(value, max = 500) {
  if (typeof value !== 'string') return null;
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || null;
}

function decodeHtmlEntities(value) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const valueCode = code[1]?.toLowerCase() === 'x'
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    try {
      return Number.isFinite(valueCode) ? String.fromCodePoint(valueCode) : entity;
    } catch {
      return entity;
    }
  });
}

function htmlText(value, max = 500) {
  return text(decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' ')), max);
}

function attribute(markup, name) {
  const match = String(markup || '').match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decodeHtmlEntities(match[2]).trim() : null;
}

function elementTextByClass(markup, tagName, className, max = 500) {
  const match = String(markup || '').match(new RegExp(
    `<${tagName}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    'i',
  ));
  return match ? htmlText(match[1], max) : null;
}

function isAllowedMeal(name, section, description) {
  const classification = `${section || ''} ${name || ''}`;
  const fullDish = `${classification} ${description || ''}`;
  return !BLOCKED_MEAL_PATTERNS.some(pattern => pattern.test(fullDish))
    && ALLOWED_MEAL_PATTERNS.some(pattern => pattern.test(classification));
}

function safeHttpsUrl(value, baseUrl) {
  const raw = text(value, 1000);
  if (!raw) return null;
  try {
    const url = new URL(raw, baseUrl);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function priceCents(node) {
  const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  const raw = offer?.price ?? node.price;
  const amount = Number(String(raw ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

export function parseJsonLdMenu(html, sourceUrl) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];
  for (const match of scripts) {
    try {
      flattenJsonLd(JSON.parse(match[1]), nodes);
    } catch {
      // One malformed block should not hide valid structured data elsewhere.
    }
  }
  const byExternalId = new Map();
  for (const node of nodes) {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (!types.some(type => ['MenuItem', 'Product'].includes(type))) continue;
    const name = text(node.name, 120);
    const cents = priceCents(node);
    if (!name || cents == null) continue;
    const externalSourceId = text(node.sku || node['@id'] || node.url, 300)
      || crypto.createHash('sha256').update(`${name}:${cents}`).digest('hex');
    byExternalId.set(externalSourceId, {
      externalSourceId,
      name,
      description: text(node.description),
      priceCents: cents,
      imageUrl: safeHttpsUrl(Array.isArray(node.image) ? node.image[0] : node.image, sourceUrl),
      sourceUrl: safeHttpsUrl(node.url || sourceUrl, sourceUrl),
      sourcePayload: {
        type: types.filter(Boolean),
        sku: text(node.sku, 300),
        possibleAllergens: inferPossibleAllergens(name, text(node.description)),
      },
    });
  }
  const candidates = [...byExternalId.values()];
  if (!candidates.length) throw new Error('No priced MenuItem or Product JSON-LD entries were found');
  if (candidates.length > 100) throw new Error('Partner menu returned an unexpected number of items');
  return candidates;
}

export function parseDownToEarthMenu(html, sourceUrl, {
  priceCents = DEFAULT_PARTNER_PRICE_CENTS,
  sections = [DEFAULT_PARTNER_SECTION, 'Vegetarian'],
} = {}) {
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0) {
    throw new Error('Partner meal price must be a positive whole number of cents');
  }
  const carousel = String(html || '').match(/<div\b([^>]*class=["'][^"']*\bwp-block-dtec-meal-carousel\b[^"']*["'][^>]*)>/i);
  if (!carousel) throw new Error('Down to Earth weekly meal carousel was not found');
  const sourceMenuDate = attribute(carousel[1], 'data-menu-date');
  const cutoff = attribute(carousel[1], 'data-cutoff');
  const deliveryDate = deliveryDateFromSource({ sourceMenuDate, sourceCutoff: cutoff });
  const schedule = partnerScheduleForDelivery(deliveryDate);
  const wantedSections = new Set(sections.map(value => String(value).trim()).filter(Boolean));
  const candidates = new Map();

  for (const match of String(html || '').matchAll(/<template\b([^>]*)>([\s\S]*?)<\/template>/gi)) {
    const className = attribute(match[1], 'class') || '';
    const section = attribute(match[1], 'data-section');
    if (!className.split(/\s+/).includes('mc-section-template') || !wantedSections.has(section)) continue;

    for (const cardMatch of match[2].matchAll(/<article\b[\s\S]*?<\/article>/gi)) {
      const card = cardMatch[0];
      const name = elementTextByClass(card, 'h4', 'mc-card__name', 120);
      const description = elementTextByClass(card, 'p', 'mc-card__desc');
      if (!name || !isAllowedMeal(name, section, description)) continue;
      const imageTag = card.match(/<img\b[^>]*>/i)?.[0];
      const imageUrl = safeHttpsUrl(
        attribute(imageTag, 'src') || attribute(imageTag, 'data-src'),
        sourceUrl,
      );
      const dietaryTags = [...card.matchAll(/<span\b[^>]*class=["'][^"']*\bmc-tag\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
        .map(tag => htmlText(tag[1], 20))
        .filter(Boolean);
      const externalSourceId = crypto.createHash('sha256')
        .update(`${section}:${name.toLocaleLowerCase('en-US')}`)
        .digest('hex');
      candidates.set(externalSourceId, {
        externalSourceId,
        name,
        description,
        priceCents,
        imageUrl,
        sourceUrl,
        sourcePayload: {
          parser: 'dtec-meal-carousel',
          section,
          dietaryTags,
          possibleAllergens: inferPossibleAllergens(name, description),
          sourceMenuDate,
          sourceCutoff: cutoff || null,
          menuDate: schedule.deliveryDate,
          deliveryDate: schedule.deliveryDate,
          orderDeadline: schedule.deadline.toISOString(),
        },
      });
    }
  }

  const result = [...candidates.values()];
  if (!result.length) throw new Error('No allowed vegetarian, chicken, or beef meals were found');
  if (result.length > 24) throw new Error('Partner menu returned an unexpected number of allowed meals');

  const selected = [];
  const selectedIds = new Set();
  for (const section of [...wantedSections].slice(0, 2)) {
    for (const candidate of result.filter(item => item.sourcePayload.section === section).slice(0, MEALS_PER_PRIMARY_SECTION)) {
      selected.push(candidate);
      selectedIds.add(candidate.externalSourceId);
    }
  }
  for (const candidate of result) {
    if (selected.length >= MAX_PARTNER_MEALS) break;
    if (!selectedIds.has(candidate.externalSourceId)) selected.push(candidate);
  }
  if (selected.length !== MAX_PARTNER_MEALS) {
    throw new Error(`Expected six approved partner meals but found ${selected.length}`);
  }
  return selected;
}

export function parsePartnerMenu(html, sourceUrl, options = {}) {
  if (/\bwp-block-dtec-meal-carousel\b/i.test(html)) {
    return parseDownToEarthMenu(html, sourceUrl, options);
  }
  return parseJsonLdMenu(html, sourceUrl);
}

export async function importPartnerMenu() {
  const source = process.env.PARTNER_MENU_URL?.trim();
  if (!source) return { status: 'disabled', reason: 'PARTNER_MENU_URL is not configured' };
  const slug = process.env.PARTNER_SLUG?.trim() || 'weekly-partner';
  const name = process.env.PARTNER_NAME?.trim() || 'Weekly Meal Partner';
  if (!PARTNER_SLUG_PATTERN.test(slug)) throw new Error('PARTNER_SLUG is invalid');
  const url = await validatedSourceUrl(source);
  const partner = await db.upsertPartner({ slug, name, sourceUrl: url.toString() });
  const run = await db.createPartnerMenuImportRun({ partnerId: partner.id, sourceUrl: url.toString() });
  try {
    const { html, sourceBytes } = await fetchPartnerMenuHtml(url);
    const sourceSha256 = crypto.createHash('sha256').update(sourceBytes).digest('hex');
    const candidates = parsePartnerMenu(html, url.toString(), {
      priceCents: DEFAULT_PARTNER_PRICE_CENTS,
      sections: (process.env.PARTNER_MENU_SECTIONS || `${DEFAULT_PARTNER_SECTION},Vegetarian`)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean),
    });
    const staged = await db.stagePartnerMenuImport(run.id, { sourceSha256, candidates });
    if (process.env.PARTNER_MENU_AUTO_PUBLISH === 'true') {
      const published = await db.publishPartnerMenuImport(staged.id);
      if (!published.ok) throw new Error(published.message);
      return { status: 'published', runId: staged.id, candidateCount: candidates.length };
    }
    return { status: staged.status, runId: staged.id, candidateCount: candidates.length };
  } catch (error) {
    await db.failPartnerMenuImport(run.id, error.message);
    throw error;
  }
}
