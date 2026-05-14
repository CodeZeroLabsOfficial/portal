"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProposalPublicSubscriptionUi } from "@/server/proposal/public-proposal-subscription-ui";
import { ProposalPublicSubscriptionFormPanel } from "@/components/proposal/proposal-public-subscription-form-panel";

export interface ProposalPublicSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string;
  ui: ProposalPublicSubscriptionUi;
}

export function ProposalPublicSubscriptionModal({
  open,
  onOpenChange,
  shareToken,
  ui,
}: ProposalPublicSubscriptionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,760px)] w-[min(100vw-2rem,560px)] max-w-[560px] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">New subscription</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Same billing setup as your portal — prefilled from this proposal.
          </p>
        </DialogHeader>

        <ProposalPublicSubscriptionFormPanel
          active={open}
          shareToken={shareToken}
          ui={ui}
          cardElementId="proposal-public-subscription-card-element"
          mode="manage_subscription"
        />

        <DialogFooter className="gap-2 pt-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
