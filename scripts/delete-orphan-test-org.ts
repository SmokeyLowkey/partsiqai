/**
 * One-shot: delete `test-org-another`, an orphan left in production by a
 * failed platform-credentials test run on 2026-04-19. Before calling delete,
 * re-verifies the org still has zero related rows in every table the test
 * suite could have populated.
 *
 * Runs against whatever DATABASE_URL Prisma's dotenv resolves to — by design,
 * this is .env (the Render URL), not .env.test.local.
 */
import { prisma } from '../lib/prisma';

const ORG = 'test-org-another';

async function main() {
  const dbUrl = (process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':****@');
  console.log(`\nTarget DB: ${dbUrl}`);
  console.log(`Target org: ${ORG}\n`);

  const org = await prisma.organization.findUnique({ where: { id: ORG } });
  if (!org) {
    console.log('Org not found — nothing to do.');
    return;
  }

  // Safety: re-count every table that could hold org data. Delete only if ALL are zero.
  const counts = await Promise.all([
    prisma.user.count({ where: { organizationId: ORG } }),
    prisma.integrationCredential.count({ where: { organizationId: ORG } }),
    prisma.vehicle.count({ where: { organizationId: ORG } }),
    prisma.quoteRequest.count({ where: { organizationId: ORG } }),
    prisma.order.count({ where: { organizationId: ORG } }),
    prisma.supplier.count({ where: { organizationId: ORG } }),
    prisma.chatConversation.count({ where: { organizationId: ORG } }),
    prisma.emailThread.count({ where: { organizationId: ORG } }).catch(() => 0),
    prisma.invitation.count({ where: { organizationId: ORG } }).catch(() => 0),
    prisma.maintenanceSchedule.count({ where: { organizationId: ORG } }).catch(() => 0),
    prisma.ingestionJob.count({ where: { organizationId: ORG } }).catch(() => 0),
    prisma.supplierCall.count({ where: { organizationId: ORG } }).catch(() => 0),
  ]);

  const total = counts.reduce((a, b) => a + b, 0);
  console.log(`Related-row total: ${total}`);

  if (total !== 0) {
    console.error('Aborting — org has associated rows. Investigate before deleting.');
    process.exit(1);
  }

  const result = await prisma.organization.delete({ where: { id: ORG } });
  console.log(`\nDeleted organization ${result.id} (${result.name}).`);
}

main()
  .catch((err) => {
    console.error('Delete failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
