/**
 * READ-ONLY: enumerate all rows associated with the orphaned test-org-another
 * org left behind by a failed platform-credentials test run, so we can confirm
 * it's safe to delete.
 */
import { prisma } from '../lib/prisma';

const ORG = 'test-org-another';

async function main() {
  console.log(`\nChecking all rows associated with organizationId=${ORG}\n`);
  console.log('='.repeat(80));

  const org = await prisma.organization.findUnique({ where: { id: ORG } });
  console.log('\nOrganization:', org ?? 'NOT FOUND');

  if (!org) {
    await prisma.$disconnect();
    return;
  }

  // Enumerate likely related tables. Prisma will happily no-op if there are zero rows.
  const [
    users,
    credentials,
    vehicles,
    quotes,
    orders,
    suppliers,
    chatConversations,
    emailThreads,
    invitations,
    maintenanceSchedules,
    ingestionJobs,
    supplierCalls,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: ORG } }),
    prisma.integrationCredential.count({ where: { organizationId: ORG } }),
    prisma.vehicle.count({ where: { organizationId: ORG } }),
    prisma.quoteRequest.count({ where: { organizationId: ORG } }),
    prisma.order.count({ where: { organizationId: ORG } }),
    prisma.supplier.count({ where: { organizationId: ORG } }),
    prisma.chatConversation.count({ where: { organizationId: ORG } }),
    prisma.emailThread.count({ where: { organizationId: ORG } }).catch(() => 'n/a'),
    prisma.invitation.count({ where: { organizationId: ORG } }).catch(() => 'n/a'),
    prisma.maintenanceSchedule.count({ where: { organizationId: ORG } }).catch(() => 'n/a'),
    prisma.ingestionJob.count({ where: { organizationId: ORG } }).catch(() => 'n/a'),
    prisma.supplierCall.count({ where: { organizationId: ORG } }).catch(() => 'n/a'),
  ]);

  console.log('\nRelated row counts:');
  console.table({
    users,
    integrationCredentials: credentials,
    vehicles,
    quoteRequests: quotes,
    orders,
    suppliers,
    chatConversations,
    emailThreads,
    invitations,
    maintenanceSchedules,
    ingestionJobs,
    supplierCalls,
  });
}

main()
  .catch((err) => {
    console.error('Check failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
