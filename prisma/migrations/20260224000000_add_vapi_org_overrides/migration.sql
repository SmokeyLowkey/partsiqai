-- Add per-organization VAPI phone number and assistant ID overrides
ALTER TABLE "organizations" ADD COLUMN "vapiPhoneNumberId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "vapiAssistantId" TEXT;
