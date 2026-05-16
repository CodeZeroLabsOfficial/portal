"use client";

import * as React from "react";
import { contractTemplateDocumentToHtml } from "@/lib/contract-template-document";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";
import { cn } from "@/lib/utils";
import type { ProposalDocument } from "@/types/proposal";

const richClass = cn(
  "proposal-rich-text max-w-none text-[15px] leading-relaxed text-zinc-700",
  "[&_h1]:mt-10 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-zinc-900",
  "[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900",
  "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900",
  "[&_p]:mb-4 [&_p:last-child]:mb-0",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_a]:text-zinc-900 [&_a]:underline",
);

export function ContractTemplateAgreementPreview({
  agreementTitle,
  document,
}: {
  agreementTitle: string;
  document: ProposalDocument;
}) {
  const { introHtml, legalHtml } = React.useMemo(
    () => contractTemplateDocumentToHtml(document),
    [document],
  );

  return (
    <div className="mx-auto w-full max-w-3xl bg-white px-5 py-12 sm:px-10 sm:py-16">
      <header className="text-center">
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
          {agreementTitle.trim() || "Services Agreement"}
        </h1>
        <p className="mt-3 text-sm font-medium text-zinc-500">Live preview — buyer agreement modal</p>
      </header>

      {introHtml ? (
        <section className="mx-auto mt-10 max-w-2xl">
          <div
            className={cn(richClass, "text-zinc-600")}
            dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(introHtml) }}
          />
        </section>
      ) : null}

      <section className="mt-12">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">The agreement</p>
        <div className="mt-6">
          {legalHtml.trim() ? (
            <div
              className={richClass}
              dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(legalHtml) }}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Add section blocks to build the legal body. When empty, buyers see the built-in default sections until
              you add content.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
