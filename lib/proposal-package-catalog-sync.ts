import { packageTierFromCatalogService } from "@/lib/catalog-service-tier";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type {
  PackageTier,
  PackagesBlock,
  ProposalBlock,
  ProposalColumnChildBlock,
  ProposalContentBlock,
  ProposalDocument,
} from "@/types/proposal";

/** Fields copied from the catalogue when a tier is linked via `serviceId`. */
function mergePackageTierFromCatalog(
  tier: PackageTier,
  catalogServices: readonly CatalogServicePickerOption[],
): PackageTier {
  const serviceId = tier.serviceId?.trim();
  if (!serviceId) return tier;
  const service = catalogServices.find((s) => s.serviceId === serviceId);
  if (!service) return tier;
  return {
    ...packageTierFromCatalogService(service, tier.id),
    recommended: tier.recommended,
  };
}

function packageTierCatalogFieldsEqual(a: PackageTier, b: PackageTier): boolean {
  return (
    a.name === b.name &&
    (a.serviceId ?? "") === (b.serviceId ?? "") &&
    a.includedUsers === b.includedUsers &&
    a.includedLocations === b.includedLocations &&
    a.includedAdmins === b.includedAdmins &&
    (a.monthlyCost12Minor ?? 0) === (b.monthlyCost12Minor ?? 0) &&
    (a.monthlyCost24Minor ?? 0) === (b.monthlyCost24Minor ?? 0) &&
    (a.upfrontCost12Minor ?? 0) === (b.upfrontCost12Minor ?? 0) &&
    JSON.stringify(a.features ?? []) === JSON.stringify(b.features ?? [])
  );
}

function syncPackagesBlock(
  block: PackagesBlock,
  catalogServices: readonly CatalogServicePickerOption[],
): PackagesBlock {
  const tiers = block.tiers ?? [];
  let changed = false;
  const nextTiers = tiers.map((tier) => {
    const merged = mergePackageTierFromCatalog(tier, catalogServices);
    if (!packageTierCatalogFieldsEqual(tier, merged)) changed = true;
    return merged;
  });
  if (!changed) return block;
  return { ...block, tiers: nextTiers };
}

function syncContentBlock(
  block: ProposalContentBlock,
  catalogServices: readonly CatalogServicePickerOption[],
): ProposalContentBlock {
  if (block.type === "packages") {
    return syncPackagesBlock(block, catalogServices);
  }
  if (block.type === "columns") {
    let changed = false;
    const stacks = block.stacks.map((stack) =>
      stack.map((child) => {
        const next = syncContentBlock(child as ProposalContentBlock, catalogServices);
        if (next !== child) changed = true;
        return next as ProposalColumnChildBlock;
      }),
    );
    return changed ? { ...block, stacks } : block;
  }
  return block;
}

function syncBlock(
  block: ProposalBlock,
  catalogServices: readonly CatalogServicePickerOption[],
): ProposalBlock {
  if (block.type === "packages") {
    return syncPackagesBlock(block, catalogServices);
  }
  if (block.type === "section") {
    let changed = false;
    const children = block.children.map((child) => {
      const next = syncContentBlock(child, catalogServices);
      if (next !== child) changed = true;
      return next;
    });
    return changed ? { ...block, children } : block;
  }
  if (block.type === "agreement") {
    let changed = false;
    const children = block.children.map((child) => {
      const next = syncContentBlock(child as ProposalContentBlock, catalogServices);
      if (next !== child) changed = true;
      return next as ProposalContentBlock;
    });
    return changed ? { ...block, children } : block;
  }
  return block;
}

/** Refresh linked package tiers from the services catalogue (proposal templates only). */
export function syncProposalDocumentPackageTiersFromCatalog(
  document: ProposalDocument,
  catalogServices: readonly CatalogServicePickerOption[],
): ProposalDocument {
  if (catalogServices.length === 0) return document;
  let changed = false;
  const blocks = document.blocks.map((block) => {
    const next = syncBlock(block, catalogServices);
    if (next !== block) changed = true;
    return next;
  });
  return changed ? { ...document, blocks } : document;
}

export function syncProposalBlocksPackageTiersFromCatalog(
  blocks: ProposalBlock[],
  catalogServices: readonly CatalogServicePickerOption[],
): ProposalBlock[] {
  if (catalogServices.length === 0) return blocks;
  let changed = false;
  const next = blocks.map((block) => {
    const synced = syncBlock(block, catalogServices);
    if (synced !== block) changed = true;
    return synced;
  });
  return changed ? next : blocks;
}
