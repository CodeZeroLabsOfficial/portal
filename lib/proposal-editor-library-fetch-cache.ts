import { PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX } from "@/lib/proposal-media-library-blob";
import type { ProposalLibraryAsset } from "@/lib/proposal-media-library-types";

export type ContractTemplateLibraryRow = {
  id: string;
  name: string;
  agreementTitle: string;
  introHtml: string;
  legalHtml: string;
  previewSnippet: string;
};

export type ProposalMediaLibraryFetchResult = {
  assets: ProposalLibraryAsset[];
  libraryPrefix: string;
};

let contractTemplatesCache: ContractTemplateLibraryRow[] | null = null;
let contractTemplatesInflight: Promise<ContractTemplateLibraryRow[]> | null = null;

let mediaLibraryCache: ProposalMediaLibraryFetchResult | null = null;
let mediaLibraryInflight: Promise<ProposalMediaLibraryFetchResult> | null = null;

export function invalidateContractTemplatesLibraryCache(): void {
  contractTemplatesCache = null;
  contractTemplatesInflight = null;
}

export function invalidateProposalMediaLibraryCache(): void {
  mediaLibraryCache = null;
  mediaLibraryInflight = null;
}

export async function fetchContractTemplatesLibrary(
  options?: { force?: boolean },
): Promise<ContractTemplateLibraryRow[]> {
  if (!options?.force && contractTemplatesCache) {
    return contractTemplatesCache;
  }
  if (!options?.force && contractTemplatesInflight) {
    return contractTemplatesInflight;
  }

  const promise = fetch("/api/contract-templates")
    .then(async (res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.json() as Promise<{ templates?: ContractTemplateLibraryRow[] }>;
    })
    .then((data) => {
      const templates = Array.isArray(data.templates) ? data.templates : [];
      contractTemplatesCache = templates;
      contractTemplatesInflight = null;
      return templates;
    })
    .catch((err) => {
      contractTemplatesInflight = null;
      throw err;
    });

  contractTemplatesInflight = promise;
  return promise;
}

export async function fetchProposalMediaLibrary(
  options?: { force?: boolean },
): Promise<ProposalMediaLibraryFetchResult> {
  if (!options?.force && mediaLibraryCache) {
    return mediaLibraryCache;
  }
  if (!options?.force && mediaLibraryInflight) {
    return mediaLibraryInflight;
  }

  const promise = fetch("/api/proposal-media-library")
    .then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? res.statusText ?? "Request failed");
      }
      return res.json() as Promise<{ assets?: ProposalLibraryAsset[]; libraryPrefix?: string }>;
    })
    .then((data) => {
      const libraryPrefix =
        typeof data.libraryPrefix === "string" && data.libraryPrefix.trim()
          ? data.libraryPrefix.trim().replace(/\/?$/, "/")
          : PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX;
      const result: ProposalMediaLibraryFetchResult = {
        assets: Array.isArray(data.assets) ? data.assets : [],
        libraryPrefix,
      };
      mediaLibraryCache = result;
      mediaLibraryInflight = null;
      return result;
    })
    .catch((err) => {
      mediaLibraryInflight = null;
      throw err;
    });

  mediaLibraryInflight = promise;
  return promise;
}
