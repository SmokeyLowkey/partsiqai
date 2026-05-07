-- Procurement governance toggle on Organization. Default false preserves the
-- current SMB-friendly workflow (admins can convert their own quotes); orgs
-- that need segregation of duties between owner and procurement manager turn
-- this on, which gates every convert-to-order on a separate MANAGER+ approval.

ALTER TABLE "organizations"
  ADD COLUMN "requireApprovalForAllQuotes" BOOLEAN NOT NULL DEFAULT false;
