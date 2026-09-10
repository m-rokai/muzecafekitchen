import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getSql, closeDatabase } from '../db/postgres.js';
import {
  parseSquareCatalogCsv,
  SQUARE_SOURCE_PROVIDER,
} from '../services/squareCatalog.js';

function usage() {
  return 'Usage: npm --prefix server run catalog:square -- --file /path/to/catalog.csv [--publish]';
}

function argumentsFrom(argv) {
  const publish = argv.includes('--publish');
  const fileIndex = argv.indexOf('--file');
  const file = fileIndex >= 0 ? argv[fileIndex + 1] : null;
  if (!file) throw new Error(usage());
  return { file: path.resolve(file), publish };
}

async function publishCatalog(catalog) {
  const sql = getSql();
  return sql.begin(async tx => {
    // Retire first, then reactivate every row present in this export. The whole
    // operation is transactional, so a later validation/database error rolls
    // this retirement back along with the rest of the sync.
    await tx`
      update public.menu_items
      set available = false, updated_at = now()
      where channel = 'cafe'
    `;
    await tx`
      update public.modifier_options
      set available = false
      where source_provider is distinct from ${SQUARE_SOURCE_PROVIDER}
    `;

    const categories = new Map();
    for (const category of catalog.categories) {
      const [row] = await tx`
        insert into public.categories (name, description, sort_order, channel)
        values (${category.name}, '', ${category.sortOrder}, 'cafe')
        on conflict (name) do update set
          sort_order = excluded.sort_order,
          channel = 'cafe'
        returning id
      `;
      categories.set(category.name, row.id);
    }

    const modifierGroups = new Map();
    for (const [groupSort, group] of catalog.modifierSets.entries()) {
      await tx`
        update public.modifier_groups
        set source_provider = ${SQUARE_SOURCE_PROVIDER}, external_source_id = ${group.externalSourceId}
        where name = ${group.name} and source_provider is null
      `;
      const [groupRow] = await tx`
        insert into public.modifier_groups (
          name, display_name, min_selections, max_selections, required, sort_order,
          source_provider, external_source_id
        ) values (
          ${group.name}, ${group.displayName}, ${group.minSelections}, ${group.maxSelections},
          ${group.minSelections > 0}, ${groupSort}, ${SQUARE_SOURCE_PROVIDER}, ${group.externalSourceId}
        )
        on conflict (source_provider, external_source_id) where source_provider is not null
        do update set
          name = excluded.name,
          display_name = excluded.display_name,
          min_selections = excluded.min_selections,
          max_selections = excluded.max_selections,
          required = excluded.required,
          sort_order = excluded.sort_order
        returning id
      `;
      modifierGroups.set(group.externalSourceId, groupRow.id);

      for (const [optionSort, option] of group.options.entries()) {
        const optionExternalId = `${group.externalSourceId}:${option.name.toLocaleLowerCase('en-US')}`;
        await tx`
          update public.modifier_options
          set source_provider = ${SQUARE_SOURCE_PROVIDER}, external_source_id = ${optionExternalId}
          where group_id = ${groupRow.id} and name = ${option.name} and source_provider is null
        `;
        await tx`
          insert into public.modifier_options (
            group_id, name, display_name, price_adjustment_cents, available, sort_order,
            source_provider, external_source_id
          ) values (
            ${groupRow.id}, ${option.name}, ${option.name}, ${option.priceCents}, true, ${optionSort},
            ${SQUARE_SOURCE_PROVIDER}, ${optionExternalId}
          )
          on conflict (source_provider, external_source_id) where source_provider is not null
          do update set
            group_id = excluded.group_id,
            name = excluded.name,
            display_name = excluded.display_name,
            price_adjustment_cents = excluded.price_adjustment_cents,
            available = true,
            sort_order = excluded.sort_order
        `;
      }
    }

    for (const item of catalog.items) {
      const [itemRow] = await tx`
        insert into public.menu_items (
          name, description, price_cents, category_id, available, sort_order, channel,
          source_provider, external_source_id
        ) values (
          ${item.name}, ${item.description}, ${item.priceCents}, ${categories.get(item.category)},
          ${item.available}, ${item.sortOrder}, 'cafe', ${SQUARE_SOURCE_PROVIDER}, ${item.externalSourceId}
        )
        on conflict (source_provider, external_source_id) where channel = 'cafe' and source_provider is not null
        do update set
          name = excluded.name,
          description = excluded.description,
          price_cents = excluded.price_cents,
          category_id = excluded.category_id,
          available = excluded.available,
          sort_order = excluded.sort_order,
          updated_at = now()
        returning id
      `;
      await tx`delete from public.item_modifier_groups where item_id = ${itemRow.id}`;
      for (const groupExternalId of item.modifierExternalSourceIds) {
        await tx`
          insert into public.item_modifier_groups (item_id, group_id)
          values (${itemRow.id}, ${modifierGroups.get(groupExternalId)})
          on conflict do nothing
        `;
      }
    }

    return { publishedItems: catalog.items.length, categories: categories.size };
  });
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  const catalog = parseSquareCatalogCsv(await fs.readFile(args.file, 'utf8'));
  const summary = {
    mode: args.publish ? 'publish' : 'dry-run',
    sourceFile: args.file,
    sourceRows: catalog.sourceRows,
    customerFacingItems: catalog.items.length,
    categories: catalog.categories.map(category => category.name),
    modifierSets: catalog.modifierSets.map(group => group.name),
    excluded: catalog.excluded,
    warnings: catalog.warnings,
  };
  if (args.publish) summary.result = await publishCatalog(catalog);
  console.log(JSON.stringify(summary, null, 2));
  if (!args.publish) console.log('\nDry run only. Re-run with --publish after reviewing this output.');
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
