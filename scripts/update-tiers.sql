-- Update BASIC tier to STARTER before removing enum value
UPDATE "organizations" 
SET "subscriptionTier" = 'STARTER'::text::"SubscriptionTier"
WHERE "subscriptionTier"::text = 'BASIC';

-- Update PROFESSIONAL tier to GROWTH before removing enum value  
UPDATE "organizations" 
SET "subscriptionTier" = 'GROWTH'::text::"SubscriptionTier"
WHERE "subscriptionTier"::text = 'PROFESSIONAL';
