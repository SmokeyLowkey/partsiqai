import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'yuriykondakov04+master@gmail.com';
  const password = 'MasterAdmin123!';
  const name = 'Master Admin';

  console.log('Creating master admin user...');

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('⚠️  User already exists. Updating to MASTER_ADMIN role...');
    
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        role: 'MASTER_ADMIN',
        emailVerified: new Date(),
        isEmailVerified: true,
      },
    });

    console.log('✅ User updated:', {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    });
    return;
  }

  // Find or create a system organization for master admin
  let systemOrg = await prisma.organization.findFirst({
    where: { slug: 'system-admin' },
  });

  if (!systemOrg) {
    console.log('Creating system organization...');
    systemOrg = await prisma.organization.create({
      data: {
        name: 'System Administration',
        slug: 'system-admin',
        subscriptionTier: 'ENTERPRISE',
        subscriptionStatus: 'ACTIVE',
        maxUsers: 9999,
        maxVehicles: 9999,
        maxAICalls: 9999,
      },
    });
    console.log('✅ System organization created:', systemOrg.id);
  }

  // Create master admin user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: 'MASTER_ADMIN',
      emailVerified: new Date(),
      isEmailVerified: true,
      organizationId: systemOrg.id,
    },
  });

  console.log('✅ Master admin user created successfully!');
  console.log({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  });
  console.log('\n📧 Login credentials:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
