import { PrismaClient, VehicleType, IndustryCategory, VehicleStatus, VehicleSearchConfigStatus, SupplierType, SupplierStatus, ConversationContext, MessageRole, MessageType, PickListStatus } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // ========================================
  // CREATE MASTER ADMIN ORGANIZATION & USER
  // ========================================

  const masterOrg = await prisma.organization.upsert({
    where: { slug: 'master-admin' },
    update: {},
    create: {
      name: 'Platform Administration',
      slug: 'master-admin',
      domain: 'admin.yourplatform.com',
      subscriptionTier: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      billingEmail: 'admin@yourplatform.com',
      maxUsers: 10,
      maxVehicles: 0,  // Master org doesn't manage vehicles
      settings: {
        dashboardLayout: 'admin',
        notificationsEnabled: true,
        defaultCurrency: 'USD',
      },
      logo: '/master-admin-logo.svg',
      primaryColor: '#FF6B35',  // Orange for master admin
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        expiryDays: 60,
      },
      sessionTimeoutMinutes: 30,  // Shorter session for security
      requireTwoFactor: true,      // Require 2FA for master admin
      allowedEmailDomains: ['yourplatform.com'],
    },
  })

  console.log(`Created master admin organization: ${masterOrg.name}`)

  // Create master admin user
  const masterAdminPassword = await hash(
    process.env.MASTER_ADMIN_PASSWORD || 'MasterAdmin123!@#',
    12
  )

  const masterAdmin = await prisma.user.upsert({
    where: { email: 'master@yourplatform.com' },
    update: {},
    create: {
      email: 'master@yourplatform.com',
      name: 'Master Administrator',
      role: 'MASTER_ADMIN',  // NEW ROLE
      password: masterAdminPassword,
      isEmailVerified: true,
      emailVerified: new Date(),
      phone: '+1 (555) 000-0000',
      avatar: '/master-admin-avatar.jpg',
      organizationId: masterOrg.id,
      notifications: {
        email: true,
        push: true,
        sms: true,
      },
      theme: 'dark',
      timezone: 'America/New_York',
    },
  })

  console.log(`Created master admin user: ${masterAdmin.email}`)

  // ========================================
  // CREATE DEMO ORGANIZATION
  // ========================================

  // Create default organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-organization' },
    update: {},
    create: {
      name: 'Demo Construction Co.',
      slug: 'demo-organization',
      domain: 'demo-construction.com',
      subscriptionTier: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
      billingEmail: 'billing@demo-construction.com',
      maxUsers: 20,
      maxVehicles: 100,
      settings: {
        dashboardLayout: 'default',
        notificationsEnabled: true,
        defaultCurrency: 'USD',
      },
      logo: '/placeholder-logo.svg',
      primaryColor: '#0072B8',
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        expiryDays: 90,
      },
      sessionTimeoutMinutes: 60,
      requireTwoFactor: false,
      allowedEmailDomains: ['demo-construction.com'],
    },
  })

  console.log(`Created organization: ${organization.name}`)

  // Create admin user
  const adminPassword = await hash('Admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo-construction.com' },
    update: {},
    create: {
      email: 'admin@demo-construction.com',
      name: 'Admin User',
      role: 'ADMIN',
      password: adminPassword,
      isEmailVerified: true,
      emailVerified: new Date(),
      phone: '+1 (555) 123-4567',
      avatar: '/placeholder-user.jpg',
      organizationId: organization.id,
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      theme: 'light',
      timezone: 'America/New_York',
    },
  })

  console.log(`Created admin user: ${admin.email}`)

  // Create manager user
  const managerPassword = await hash('Manager123!', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'yuriykondakov04@gmail.com' },
    update: {},
    create: {
      email: 'yuriykondakov04@gmail.com',
      name: 'Manager User',
      role: 'MANAGER',
      password: managerPassword,
      isEmailVerified: true,
      emailVerified: new Date(),
      phone: '+1 (555) 234-5678',
      avatar: '/placeholder-user.jpg',
      organizationId: organization.id,
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      theme: 'light',
      timezone: 'America/Chicago',
    },
  })

  console.log(`Created manager user: ${manager.email}`)

  // Create technician user
  const technicianPassword = await hash('Tech123!', 12)
  const technician = await prisma.user.upsert({
    where: { email: 'tech@demo-construction.com' },
    update: {},
    create: {
      email: 'tech@demo-construction.com',
      name: 'Technician User',
      role: 'TECHNICIAN',
      password: technicianPassword,
      isEmailVerified: true,
      emailVerified: new Date(),
      phone: '+1 (555) 345-6789',
      avatar: '/placeholder-user.jpg',
      organizationId: organization.id,
      notifications: {
        email: true,
        push: true,
        sms: true,
      },
      theme: 'dark',
      timezone: 'America/Denver',
    },
  })

  console.log(`Created technician user: ${technician.email}`)

  // Create sample vehicles (production-like fleet)
  const vehicles = [
    {
      vehicleId: 'CAT-320D-001',
      serialNumber: 'CAT320D2019001',
      make: 'Caterpillar',
      model: '320D2',
      year: 2019,
      type: VehicleType.EXCAVATOR,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Site A - Downtown Project',
      operatingHours: 2847,
      healthScore: 85,
      engineModel: 'CAT C6.6 ACERT',
      specifications: {
        weight: 22800,
        horsePower: 148,
        bucketCapacity: '1.0 m³',
        maxDigDepth: '6.7 m',
      },
      ownerId: admin.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'JD-850K-002',
      serialNumber: 'JD850K2020002',
      make: 'John Deere',
      model: '850K',
      year: 2020,
      type: VehicleType.DOZER,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.MAINTENANCE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Shop - Main Facility',
      operatingHours: 1923,
      healthScore: 72,
      engineModel: 'JD 6068HF285',
      specifications: {
        weight: 20246,
        horsePower: 205,
        bladeCapacity: '3.7 m³',
      },
      ownerId: manager.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'KOM-PC200-003',
      serialNumber: 'KMTPC20082018003',
      make: 'Komatsu',
      model: 'PC200-8',
      year: 2018,
      type: VehicleType.EXCAVATOR,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Site B - Highway 101',
      operatingHours: 3421,
      healthScore: 91,
      engineModel: 'Komatsu SAA6D107E-1',
      specifications: {
        weight: 20000,
        horsePower: 155,
        bucketCapacity: '0.8 m³',
      },
      ownerId: technician.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'CAT-D6T-004',
      serialNumber: 'CATD6T2021004',
      make: 'Caterpillar',
      model: 'D6T',
      year: 2021,
      type: VehicleType.DOZER,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Site C - Airport Expansion',
      operatingHours: 1504,
      healthScore: 94,
      engineModel: 'CAT C9.3',
      specifications: {
        weight: 22600,
        horsePower: 235,
        bladeCapacity: '4.2 m³',
      },
      ownerId: admin.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'VOL-EC210-005',
      serialNumber: 'VLEC2102017005',
      make: 'Volvo',
      model: 'EC210BLC',
      year: 2017,
      type: VehicleType.EXCAVATOR,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Site D - Mall Development',
      operatingHours: 4215,
      healthScore: 78,
      engineModel: 'Volvo D6E',
      specifications: {
        weight: 21500,
        horsePower: 145,
        bucketCapacity: '1.07 m³',
      },
      ownerId: manager.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'JD-644K-006',
      serialNumber: 'JD644K2019006',
      make: 'John Deere',
      model: '644K',
      year: 2019,
      type: VehicleType.LOADER,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Site A - Downtown Project',
      operatingHours: 2634,
      healthScore: 88,
      engineModel: 'JD 9.0L',
      specifications: {
        weight: 25765,
        horsePower: 243,
        bucketCapacity: '4.2 m³',
      },
      ownerId: technician.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'CAT-950M-007',
      serialNumber: 'CAT950M2020007',
      make: 'Caterpillar',
      model: '950M',
      year: 2020,
      type: VehicleType.LOADER,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Site E - Bridge Construction',
      operatingHours: 1876,
      healthScore: 92,
      engineModel: 'CAT C7.1 ACERT',
      specifications: {
        weight: 24400,
        horsePower: 243,
        bucketCapacity: '4.6 m³',
      },
      ownerId: admin.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'KOM-WA470-008',
      serialNumber: 'KMWA4702018008',
      make: 'Komatsu',
      model: 'WA470-8',
      year: 2018,
      type: VehicleType.LOADER,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.MAINTENANCE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Shop - Main Facility',
      operatingHours: 3897,
      healthScore: 74,
      engineModel: 'Komatsu SAA6D114E-6',
      specifications: {
        weight: 27900,
        horsePower: 268,
        bucketCapacity: '5.0 m³',
      },
      ownerId: manager.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'JCB-JS220-009',
      serialNumber: 'JCBJS2202019009',
      make: 'JCB',
      model: 'JS220LC',
      year: 2019,
      type: VehicleType.EXCAVATOR,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Site F - Residential Complex',
      operatingHours: 2456,
      healthScore: 86,
      engineModel: 'JCB EcoMAX',
      specifications: {
        weight: 22000,
        horsePower: 145,
        bucketCapacity: '1.14 m³',
      },
      ownerId: technician.id,
      organizationId: organization.id,
    },
    {
      vehicleId: 'CAT-730-010',
      serialNumber: 'CAT7302021010',
      make: 'Caterpillar',
      model: '730',
      year: 2021,
      type: VehicleType.DUMP_TRUCK,
      industryCategory: IndustryCategory.CONSTRUCTION,
      status: VehicleStatus.ACTIVE,
      searchConfigStatus: VehicleSearchConfigStatus.SEARCH_READY,
      currentLocation: 'Site G - Quarry Operations',
      operatingHours: 982,
      healthScore: 96,
      engineModel: 'CAT C18 ACERT',
      specifications: {
        weight: 40800,
        horsePower: 536,
        payload: '30.9 metric tons',
      },
      ownerId: admin.id,
      organizationId: organization.id,
    },
  ]

  for (const vehicle of vehicles) {
    await prisma.vehicle.upsert({
      where: {
        organizationId_serialNumber: {
          organizationId: organization.id,
          serialNumber: vehicle.serialNumber,
        },
      },
      update: vehicle,
      create: vehicle,
    })
  }

  console.log(`Created ${vehicles.length} vehicles`)

  // Create sample suppliers (production-like variety)
  const suppliers = [
    {
      supplierId: 'SUP-CAT-001',
      name: 'Miller Parts Co.',
      type: SupplierType.DISTRIBUTOR,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'Sarah Miller',
      email: 'orders@millerparts.com',
      phone: '+1 (555) 123-4567',
      website: 'https://millerparts.com',
      address: '123 Parts Ave',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA',
      rating: 4.8,
      deliveryRating: 4.7,
      qualityRating: 4.9,
      avgDeliveryTime: 3,
      paymentTerms: 'Net 30',
      taxId: '12-3456789',
      certifications: ['ISO 9001', 'ISO 14001'],
      specialties: ['Caterpillar', 'John Deere', 'Hydraulics'],
      organizationId: organization.id,
    },
    {
      supplierId: 'SUP-JD-002',
      name: 'Johnson Heavy Parts',
      type: SupplierType.AFTERMARKET,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'Mike Johnson',
      email: 'sales@johnsonheavy.com',
      phone: '+1 (555) 987-6543',
      website: 'https://johnsonheavy.com',
      address: '456 Industrial Blvd',
      city: 'Houston',
      state: 'TX',
      zipCode: '77002',
      country: 'USA',
      rating: 4.6,
      deliveryRating: 4.8,
      qualityRating: 4.5,
      avgDeliveryTime: 2,
      paymentTerms: 'Net 45',
      taxId: '98-7654321',
      certifications: ['ISO 9001'],
      specialties: ['Komatsu', 'Volvo', 'Filters'],
      organizationId: organization.id,
    },
    {
      supplierId: 'SUP-KOM-003',
      name: 'Pacific Equipment Supply',
      type: SupplierType.OEM_DIRECT,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'Jennifer Chen',
      email: 'jchen@pacificequip.com',
      phone: '+1 (555) 246-8135',
      website: 'https://pacificequip.com',
      address: '789 Commerce Dr',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA',
      rating: 4.9,
      deliveryRating: 4.9,
      qualityRating: 5.0,
      avgDeliveryTime: 5,
      paymentTerms: 'Net 30',
      taxId: '45-6789012',
      certifications: ['ISO 9001', 'ISO 14001', 'IATF 16949'],
      specialties: ['Komatsu', 'Hitachi', 'OEM Parts'],
      organizationId: organization.id,
    },
    {
      supplierId: 'SUP-VOL-004',
      name: 'Northeast Heavy Equipment',
      type: SupplierType.DISTRIBUTOR,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'Robert Davis',
      email: 'rdavis@neheavy.com',
      phone: '+1 (555) 369-1470',
      website: 'https://neheavy.com',
      address: '321 Industrial Way',
      city: 'Boston',
      state: 'MA',
      zipCode: '02101',
      country: 'USA',
      rating: 4.7,
      deliveryRating: 4.6,
      qualityRating: 4.8,
      avgDeliveryTime: 4,
      paymentTerms: 'Net 45',
      taxId: '78-9012345',
      certifications: ['ISO 9001'],
      specialties: ['Volvo', 'JCB', 'Terex'],
      organizationId: organization.id,
    },
    {
      supplierId: 'SUP-GENERAL-005',
      name: 'Summit Auto Parts',
      type: SupplierType.AFTERMARKET,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'Amanda Rodriguez',
      email: 'arodriguez@summitauto.com',
      phone: '+1 (555) 147-2580',
      website: 'https://summitauto.com',
      address: '654 Auto Plaza',
      city: 'Denver',
      state: 'CO',
      zipCode: '80201',
      country: 'USA',
      rating: 4.5,
      deliveryRating: 4.7,
      qualityRating: 4.4,
      avgDeliveryTime: 2,
      paymentTerms: 'Net 30',
      taxId: '23-4567890',
      certifications: ['ISO 9001'],
      specialties: ['Filters', 'Belts', 'Generic Parts'],
      organizationId: organization.id,
    },
    {
      supplierId: 'SUP-FLUID-006',
      name: 'Fleet Solutions Inc',
      type: SupplierType.AFTERMARKET,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'David Thompson',
      email: 'dthompson@fleetsolutions.com',
      phone: '+1 (555) 258-3690',
      website: 'https://fleetsolutions.com',
      address: '147 Supply Lane',
      city: 'Atlanta',
      state: 'GA',
      zipCode: '30301',
      country: 'USA',
      rating: 4.6,
      deliveryRating: 4.8,
      qualityRating: 4.5,
      avgDeliveryTime: 1,
      paymentTerms: 'Net 15',
      taxId: '67-8901234',
      certifications: [],
      specialties: ['Fluids', 'Lubricants', 'Maintenance Supplies'],
      organizationId: organization.id,
    },
    {
      supplierId: 'SUP-ELEC-007',
      name: 'Battery Pro Supply',
      type: SupplierType.DISTRIBUTOR,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'Lisa Martinez',
      email: 'lmartinez@batterypro.com',
      phone: '+1 (555) 789-4561',
      website: 'https://batterypro.com',
      address: '963 Power Rd',
      city: 'Phoenix',
      state: 'AZ',
      zipCode: '85001',
      country: 'USA',
      rating: 4.8,
      deliveryRating: 4.9,
      qualityRating: 4.7,
      avgDeliveryTime: 2,
      paymentTerms: 'Net 30',
      taxId: '89-0123456',
      certifications: ['ISO 9001'],
      specialties: ['Batteries', 'Electrical', 'Starters'],
      organizationId: organization.id,
    },
    {
      supplierId: 'SUP-CAT-008',
      name: 'CAT Parts Direct',
      type: SupplierType.OEM_DIRECT,
      status: SupplierStatus.ACTIVE,
      contactPerson: 'James Wilson',
      email: 'jwilson@catpartsdirect.com',
      phone: '+1 (555) 456-7892',
      website: 'https://catpartsdirect.com',
      address: '852 CAT Boulevard',
      city: 'Peoria',
      state: 'IL',
      zipCode: '61601',
      country: 'USA',
      rating: 4.9,
      deliveryRating: 4.8,
      qualityRating: 5.0,
      avgDeliveryTime: 4,
      paymentTerms: 'Net 30',
      taxId: '34-5678901',
      certifications: ['ISO 9001', 'ISO 14001'],
      specialties: ['Caterpillar', 'OEM Parts', 'Genuine CAT'],
      organizationId: organization.id,
    },
  ]

  for (const supplier of suppliers) {
    const { supplierId: _, organizationId: __, ...supplierUpdate } = supplier;
    await prisma.supplier.upsert({
      where: {
        organizationId_supplierId: {
          organizationId: organization.id,
          supplierId: supplier.supplierId,
        },
      },
      update: supplierUpdate,
      create: supplier,
    })
  }

  console.log(`Created ${suppliers.length} suppliers`)

  // Create sample parts (production-like catalog)
  const parts = [
    // Engine Oil Filters
    {
      partNumber: '1R-0739',
      description: 'Engine Oil Filter - High Efficiency Spin-On',
      category: 'Engine',
      subcategory: 'Oil Filters',
      price: 42.50,
      cost: 28.75,
      stockQuantity: 28,
      minStockLevel: 10,
      maxStockLevel: 50,
      weight: 0.9,
      dimensions: { length: 14, width: 9, height: 9 },
      location: 'A-14-5',
      compatibility: ['CAT D6T', 'CAT D6R', 'CAT D6N'],
      specifications: {
        filterType: 'Spin-on',
        micronRating: 15,
        bypassValve: true,
      },
      organizationId: organization.id,
    },
    // Fuel Filters - Primary
    {
      partNumber: '1R-0750',
      description: 'Primary Fuel Filter - Fuel/Water Separator',
      category: 'Fuel System',
      subcategory: 'Fuel Filters',
      price: 67.99,
      cost: 45.25,
      stockQuantity: 35,
      minStockLevel: 15,
      maxStockLevel: 60,
      weight: 1.3,
      dimensions: { length: 16, width: 11, height: 11 },
      location: 'A-14-2',
      compatibility: ['CAT D6T', 'CAT D6R', 'CAT 320D2', 'CAT C9 Engine'],
      specifications: {
        filterType: 'Advanced Efficiency',
        waterSeparation: true,
        micronRating: 10,
      },
      organizationId: organization.id,
    },
    // Fuel Filters - Secondary
    {
      partNumber: '1R-0756',
      description: 'Secondary Fuel Filter - Fine Filtration',
      category: 'Fuel System',
      subcategory: 'Fuel Filters',
      price: 38.75,
      cost: 24.50,
      stockQuantity: 42,
      minStockLevel: 15,
      maxStockLevel: 70,
      weight: 0.7,
      dimensions: { length: 12, width: 8, height: 8 },
      location: 'B-08-4',
      compatibility: ['CAT D6T', 'CAT D6R', 'CAT C9 Engine'],
      specifications: {
        filterType: 'Fine Filtration',
        micronRating: 3,
      },
      organizationId: organization.id,
    },
    // Hydraulic Filters
    {
      partNumber: '1R-0659',
      description: 'Hydraulic Return Filter - High Capacity',
      category: 'Hydraulic',
      subcategory: 'Return Filters',
      price: 125.99,
      cost: 84.25,
      stockQuantity: 18,
      minStockLevel: 6,
      maxStockLevel: 30,
      weight: 2.1,
      dimensions: { length: 20, width: 12, height: 12 },
      location: 'A-15-7',
      compatibility: ['CAT D6T', 'CAT D6R', 'CAT D6N'],
      specifications: {
        filterType: 'High Capacity',
        micronRating: 10,
        flowRate: '60 GPM',
      },
      organizationId: organization.id,
    },
    // Air Filters
    {
      partNumber: '6I-2501',
      description: 'Primary Air Filter Element',
      category: 'Air Intake',
      subcategory: 'Air Filters',
      price: 89.50,
      cost: 59.75,
      stockQuantity: 22,
      minStockLevel: 8,
      maxStockLevel: 40,
      weight: 1.5,
      dimensions: { length: 18, width: 14, height: 14 },
      location: 'C-03-2',
      compatibility: ['CAT D6T', 'CAT D6R'],
      specifications: {
        filterType: 'Radial Seal',
        efficiency: '99.9%',
      },
      organizationId: organization.id,
    },
    {
      partNumber: '6I-2502',
      description: 'Secondary Air Filter - Safety Element',
      category: 'Air Intake',
      subcategory: 'Air Filters',
      price: 54.25,
      cost: 36.50,
      stockQuantity: 26,
      minStockLevel: 10,
      maxStockLevel: 45,
      weight: 0.9,
      dimensions: { length: 16, width: 12, height: 12 },
      location: 'C-03-3',
      compatibility: ['CAT D6T', 'CAT D6R'],
      specifications: {
        filterType: 'Safety Element',
        efficiency: '99.99%',
      },
      organizationId: organization.id,
    },
    // Transmission Filters
    {
      partNumber: '3I-0612',
      description: 'Transmission Oil Filter with Gasket',
      category: 'Transmission',
      subcategory: 'Filters',
      price: 94.99,
      cost: 63.25,
      stockQuantity: 14,
      minStockLevel: 5,
      maxStockLevel: 25,
      weight: 1.8,
      dimensions: { length: 15, width: 13, height: 10 },
      location: 'B-11-6',
      compatibility: ['CAT D6T', 'CAT D6R'],
      specifications: {
        filterType: 'Internal',
        includesGasket: true,
      },
      organizationId: organization.id,
    },
    // John Deere Parts
    {
      partNumber: 'RE504836',
      description: 'John Deere Fuel Filter - Primary',
      category: 'Fuel System',
      subcategory: 'Fuel Filters',
      price: 52.99,
      cost: 35.75,
      stockQuantity: 31,
      minStockLevel: 12,
      maxStockLevel: 50,
      weight: 1.1,
      dimensions: { length: 13, width: 9, height: 9 },
      location: 'B-05-2',
      compatibility: ['John Deere 850K', 'John Deere 750K', 'John Deere 644K'],
      specifications: {
        filterType: 'Water Separator',
        micronRating: 5,
      },
      organizationId: organization.id,
    },
    {
      partNumber: 'RE521420',
      description: 'John Deere Engine Oil Filter',
      category: 'Engine',
      subcategory: 'Oil Filters',
      price: 38.75,
      cost: 26.00,
      stockQuantity: 45,
      minStockLevel: 15,
      maxStockLevel: 70,
      weight: 0.8,
      dimensions: { length: 12, width: 8, height: 8 },
      location: 'B-05-1',
      compatibility: ['John Deere 850K', 'John Deere 644K'],
      specifications: {
        filterType: 'Spin-on',
        micronRating: 20,
      },
      organizationId: organization.id,
    },
    // Komatsu Parts
    {
      partNumber: '600-411-1191',
      description: 'Komatsu Engine Oil Filter',
      category: 'Engine',
      subcategory: 'Oil Filters',
      price: 45.50,
      cost: 30.25,
      stockQuantity: 36,
      minStockLevel: 12,
      maxStockLevel: 55,
      weight: 1.0,
      dimensions: { length: 13, width: 9, height: 9 },
      location: 'C-07-3',
      compatibility: ['Komatsu PC200-8', 'Komatsu WA470-8'],
      specifications: {
        filterType: 'Cartridge',
        micronRating: 15,
      },
      organizationId: organization.id,
    },
    {
      partNumber: '600-319-3750',
      description: 'Komatsu Fuel Filter',
      category: 'Fuel System',
      subcategory: 'Fuel Filters',
      price: 58.75,
      cost: 39.25,
      stockQuantity: 27,
      minStockLevel: 10,
      maxStockLevel: 45,
      weight: 1.2,
      dimensions: { length: 14, width: 10, height: 10 },
      location: 'C-07-2',
      compatibility: ['Komatsu PC200-8', 'Komatsu WA470-8'],
      specifications: {
        filterType: 'Water Separator',
        micronRating: 5,
      },
      organizationId: organization.id,
    },
    // Volvo Parts
    {
      partNumber: '14524171',
      description: 'Volvo Engine Oil Filter',
      category: 'Engine',
      subcategory: 'Oil Filters',
      price: 47.99,
      cost: 32.00,
      stockQuantity: 24,
      minStockLevel: 10,
      maxStockLevel: 40,
      weight: 0.9,
      dimensions: { length: 13, width: 9, height: 9 },
      location: 'D-02-1',
      compatibility: ['Volvo EC210BLC'],
      specifications: {
        filterType: 'Spin-on',
        micronRating: 18,
      },
      organizationId: organization.id,
    },
    // Fluids & Lubricants
    {
      partNumber: 'CAT-DEO-15W40',
      description: 'CAT DEO 15W-40 Engine Oil (5 Gallon)',
      category: 'Fluids',
      subcategory: 'Engine Oils',
      price: 145.99,
      cost: 98.50,
      stockQuantity: 48,
      minStockLevel: 20,
      maxStockLevel: 80,
      weight: 42.0,
      dimensions: { length: 12, width: 12, height: 14 },
      location: 'F-01-1',
      compatibility: ['All CAT Equipment'],
      specifications: {
        viscosity: '15W-40',
        apiRating: 'CK-4',
        volume: '5 Gallon',
      },
      organizationId: organization.id,
    },
    {
      partNumber: 'CAT-HYDO-10W',
      description: 'CAT HYDO Advanced 10W Hydraulic Oil (5 Gallon)',
      category: 'Fluids',
      subcategory: 'Hydraulic Oils',
      price: 185.99,
      cost: 125.00,
      stockQuantity: 52,
      minStockLevel: 25,
      maxStockLevel: 90,
      weight: 43.0,
      dimensions: { length: 12, width: 12, height: 14 },
      location: 'F-01-3',
      compatibility: ['All CAT Equipment'],
      specifications: {
        viscosity: '10W',
        zincFree: true,
        volume: '5 Gallon',
      },
      organizationId: organization.id,
    },
    // Belts
    {
      partNumber: '8T-5313',
      description: 'Fan Belt - Heavy Duty',
      category: 'Engine',
      subcategory: 'Belts',
      price: 68.75,
      cost: 45.50,
      stockQuantity: 19,
      minStockLevel: 6,
      maxStockLevel: 30,
      weight: 1.5,
      dimensions: { length: 48, width: 6, height: 2 },
      location: 'E-04-2',
      compatibility: ['CAT 320D2', 'CAT D6T'],
      specifications: {
        type: 'V-Belt',
        length: '48 inches',
      },
      organizationId: organization.id,
    },
    // Batteries
    {
      partNumber: 'CAT-950CCA',
      description: 'Heavy Duty Starting Battery - 950 CCA',
      category: 'Electrical',
      subcategory: 'Batteries',
      price: 285.99,
      cost: 192.00,
      stockQuantity: 12,
      minStockLevel: 4,
      maxStockLevel: 20,
      weight: 68.0,
      dimensions: { length: 13, width: 7, height: 9 },
      location: 'G-01-1',
      compatibility: ['All Heavy Equipment'],
      specifications: {
        voltage: '12V',
        cca: 950,
        warranty: '3 years',
      },
      organizationId: organization.id,
    },
    // Wipers & Fluids
    {
      partNumber: 'BOSCH-ICON-24OE',
      description: 'All-Season Beam Wiper Blades - 24" (Set of 2)',
      category: 'Cab',
      subcategory: 'Wipers',
      price: 29.99,
      cost: 19.75,
      stockQuantity: 38,
      minStockLevel: 15,
      maxStockLevel: 60,
      weight: 0.8,
      dimensions: { length: 24, width: 3, height: 2 },
      location: 'H-03-4',
      compatibility: ['Most Heavy-Duty Trucks and Equipment'],
      specifications: {
        length: '24 inches',
        type: 'Beam',
        winterRated: true,
      },
      organizationId: organization.id,
    },
    {
      partNumber: 'FRAM-CF10285',
      description: 'Fresh Breeze Cabin Air Filter with ARM & HAMMER',
      category: 'Cab',
      subcategory: 'Cabin Filters',
      price: 18.49,
      cost: 12.25,
      stockQuantity: 52,
      minStockLevel: 20,
      maxStockLevel: 80,
      weight: 0.5,
      dimensions: { length: 10, width: 8, height: 2 },
      location: 'H-03-2',
      compatibility: ['Various Equipment Cabs'],
      specifications: {
        filtration: '98% of dust and allergens',
        odorElimination: true,
      },
      organizationId: organization.id,
    },
    {
      partNumber: 'RAIN-X-DE-ICER-128',
      description: 'Rain-X De-Icer Windshield Washer Fluid (1 Gallon)',
      category: 'Fluids',
      subcategory: 'Washer Fluid',
      price: 6.99,
      cost: 4.50,
      stockQuantity: 120,
      minStockLevel: 50,
      maxStockLevel: 200,
      weight: 8.5,
      dimensions: { length: 10, width: 6, height: 11 },
      location: 'F-02-5',
      compatibility: ['All Equipment'],
      specifications: {
        temperatureRating: '-25°F',
        volume: '1 Gallon',
        rainRepellent: true,
      },
      organizationId: organization.id,
    },
    // Antifreeze
    {
      partNumber: 'PEAK-OET-AF-5050',
      description: 'PEAK OET Extended Life Antifreeze 50/50 Pre-Diluted (1 Gallon)',
      category: 'Fluids',
      subcategory: 'Coolant',
      price: 15.99,
      cost: 10.75,
      stockQuantity: 85,
      minStockLevel: 40,
      maxStockLevel: 150,
      weight: 9.0,
      dimensions: { length: 10, width: 6, height: 11 },
      location: 'F-02-1',
      compatibility: ['Universal - Most Engines'],
      specifications: {
        type: 'OAT',
        protection: '-34°F',
        preDiluted: true,
        volume: '1 Gallon',
      },
      organizationId: organization.id,
    },
    // Battery Maintenance
    {
      partNumber: 'CRC-05023',
      description: 'CRC Battery Terminal Protector Spray',
      category: 'Electrical',
      subcategory: 'Battery Maintenance',
      price: 8.49,
      cost: 5.50,
      stockQuantity: 42,
      minStockLevel: 15,
      maxStockLevel: 70,
      weight: 1.0,
      dimensions: { length: 8, width: 3, height: 3 },
      location: 'G-01-3',
      compatibility: ['All Equipment'],
      specifications: {
        volume: '7.5 oz',
        preventCorrosion: true,
      },
      organizationId: organization.id,
    },
    {
      partNumber: 'SCHUMACHER-BT-100',
      description: '100 Amp Digital Battery Tester',
      category: 'Tools',
      subcategory: 'Testing Equipment',
      price: 34.99,
      cost: 23.25,
      stockQuantity: 18,
      minStockLevel: 5,
      maxStockLevel: 25,
      weight: 2.5,
      dimensions: { length: 10, width: 6, height: 3 },
      location: 'I-01-1',
      compatibility: ['6V and 12V Batteries'],
      specifications: {
        testCapacity: '100 Amp',
        digital: true,
        ledIndicator: true,
      },
      organizationId: organization.id,
    },
    // Aftermarket Premium Filters
    {
      partNumber: 'WIX-51515',
      description: 'WIX Premium Oil Filter - Extended Life',
      category: 'Engine',
      subcategory: 'Oil Filters',
      price: 12.99,
      cost: 8.50,
      stockQuantity: 95,
      minStockLevel: 40,
      maxStockLevel: 150,
      weight: 0.7,
      dimensions: { length: 11, width: 8, height: 8 },
      location: 'A-14-8',
      compatibility: ['Multiple Applications'],
      specifications: {
        filterType: 'Spin-on',
        extendedLife: true,
        coldWeatherRated: '-40°F',
      },
      organizationId: organization.id,
    },
    {
      partNumber: 'K&N-33-2129',
      description: 'K&N High-Flow Air Filter - Washable & Reusable',
      category: 'Air Intake',
      subcategory: 'Air Filters',
      price: 64.99,
      cost: 43.25,
      stockQuantity: 28,
      minStockLevel: 10,
      maxStockLevel: 40,
      weight: 1.8,
      dimensions: { length: 16, width: 13, height: 13 },
      location: 'C-03-5',
      compatibility: ['Various Applications'],
      specifications: {
        washable: true,
        reusable: true,
        millionMileWarranty: true,
      },
      organizationId: organization.id,
    },
  ]

  for (const part of parts) {
    await prisma.part.upsert({
      where: {
        organizationId_partNumber: {
          organizationId: organization.id,
          partNumber: part.partNumber,
        },
      },
      update: {},
      create: part,
    })
  }

  console.log(`Created ${parts.length} parts`)

  // Create system settings
  const systemSettings = [
    {
      key: 'auth.allowSignup',
      value: 'true',
      description: 'Allow new user registrations',
      category: 'authentication',
    },
    {
      key: 'auth.defaultSessionTimeout',
      value: '60',
      description: 'Default session timeout in minutes',
      category: 'authentication',
    },
    {
      key: 'auth.passwordResetExpiry',
      value: '24',
      description: 'Password reset token expiry in hours',
      category: 'authentication',
    },
    {
      key: 'system.maintenanceMode',
      value: 'false',
      description: 'System maintenance mode',
      category: 'system',
    },
  ]

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }

  console.log(`Created ${systemSettings.length} system settings`)

  // Create sample chat conversations
  const conversations = [
    {
      title: 'CAT 320D Hydraulic Filter',
      context: ConversationContext.PARTS_SEARCH,
      isActive: true,
      userId: admin.id,
      organizationId: organization.id,
    },
    {
      title: 'John Deere 850K Parts',
      context: ConversationContext.PARTS_SEARCH,
      isActive: true,
      userId: manager.id,
      organizationId: organization.id,
    },
    {
      title: 'Komatsu PC200 Maintenance',
      context: ConversationContext.MAINTENANCE_HELP,
      isActive: true,
      userId: technician.id,
      organizationId: organization.id,
    },
    {
      title: 'CAT D6T Service Kit - Complete Parts',
      context: ConversationContext.PARTS_SEARCH,
      isActive: true,
      userId: technician.id,
      organizationId: organization.id,
    },
  ]

  const createdConversations = []
  for (const conversation of conversations) {
    const createdConversation = await prisma.chatConversation.create({
      data: conversation,
    })
    createdConversations.push(createdConversation)
  }

  console.log(`Created ${conversations.length} chat conversations`)

  // Create sample chat messages
  const messages = [
    // Messages for first conversation
    {
      role: MessageRole.ASSISTANT,
      content: "Hello! I'm your AI Parts Assistant. I can help you find parts, check compatibility, get pricing information, and answer technical questions about your construction equipment. What can I help you with today?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[0].id,
    },
    {
      role: MessageRole.USER,
      content: "I need a hydraulic filter for my CAT 320D excavator",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[0].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "For your CAT 320D excavator, I recommend the **Hydraulic Filter 1R-0750**. Here are the details:\n\n• **Part Number:** 1R-0750\n• **Compatibility:** CAT 320D, CAT 325D\n• **Current Stock:** 15 units available\n• **Price:** $89.99\n• **Supplier:** Miller Parts Co.\n• **Location:** A-12-3\n\nThis filter provides excellent filtration for your hydraulic system. Would you like me to check if we have any alternatives or help you place an order?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[0].id,
      context: { partNumber: "1R-0750" },
      metadata: {
        formattedResponse: {
          messageText: "I found the perfect hydraulic filter for your CAT 320D excavator.",
          parts: [{
            partNumber: "1R-0750",
            description: "Hydraulic Filter - High-efficiency filter for CAT excavators",
            price: 89.99,
            stockQuantity: 15,
            stockStatus: "In Stock",
            category: "Hydraulic Filters",
            confidence: 98,
            badges: ["OEM", "High Quality"],
            supplier: "Miller Parts Co.",
            compatibility: {
              compatibleModels: ["CAT 320D", "CAT 325D"],
              verified: true
            },
            callToAction: "Add to Pick List"
          }],
          summary: {
            totalFound: 1,
            avgConfidence: 98
          },
          metadata: {
            searchTime: 0.45,
            sourcesUsed: ["inventory", "pinecone"]
          }
        }
      },
    },

    // Messages for second conversation
    {
      role: MessageRole.ASSISTANT,
      content: "Hello! I'm your AI Parts Assistant. I see you're looking for parts for your John Deere 850K. How can I help you today?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[1].id,
    },
    {
      role: MessageRole.USER,
      content: "I need a fuel filter for the 850K dozer",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[1].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "For your John Deere 850K dozer, I recommend the **Fuel Filter JD-6068-F**. Here are the details:\n\n• **Part Number:** JD-6068-F\n• **Compatibility:** John Deere 850K, John Deere 750K\n• **Current Stock:** 22 units available\n• **Price:** $45.99\n• **Supplier:** Johnson Heavy Parts\n• **Location:** B-05-2\n\nThis fuel filter has excellent water separation capabilities. Would you like to add this to your pick list?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[1].id,
      context: { partNumber: "JD-6068-F" },
      metadata: {
        formattedResponse: {
          messageText: "Found the fuel filter for your John Deere 850K with excellent water separation.",
          parts: [{
            partNumber: "JD-6068-F",
            description: "Fuel Filter - Advanced water separation for John Deere dozers",
            price: 45.99,
            stockQuantity: 22,
            stockStatus: "In Stock",
            category: "Fuel Filters",
            confidence: 97,
            badges: ["OEM Equivalent", "Premium Quality"],
            supplier: "Johnson Heavy Parts",
            compatibility: {
              compatibleModels: ["John Deere 850K", "John Deere 750K"],
              verified: true
            },
            callToAction: "Add to Pick List"
          }],
          summary: {
            totalFound: 1,
            avgConfidence: 97
          },
          metadata: {
            searchTime: 0.38,
            sourcesUsed: ["inventory", "pinecone"]
          }
        }
      },
    },

    // Messages for third conversation
    {
      role: MessageRole.ASSISTANT,
      content: "Hello! I'm your AI Maintenance Assistant. I see you're looking for help with your Komatsu PC200. How can I assist you today?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[2].id,
    },
    {
      role: MessageRole.USER,
      content: "What's the recommended maintenance schedule for the PC200?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[2].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "For your Komatsu PC200 excavator, here's the recommended maintenance schedule:\n\n• **Every 250 hours:** Change engine oil and filter\n• **Every 500 hours:** Change fuel filter and hydraulic return filter\n• **Every 1000 hours:** Change hydraulic suction filter and transmission oil\n• **Every 2000 hours:** Change hydraulic oil and coolant\n\nWould you like me to help you schedule your next maintenance service?",
      messageType: MessageType.MAINTENANCE_SCHEDULE,
      conversationId: createdConversations[2].id,
    },

    // Messages for fourth conversation - CAT D6T Service Kit with multiple parts
    {
      role: MessageRole.ASSISTANT,
      content: "Hello! I'm your AI Parts Assistant. I can help you find parts, check compatibility, get pricing information, and answer technical questions about your construction equipment. What can I help you with today?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.USER,
      content: "I need to do a complete 500-hour service on my CAT D6T bulldozer. Can you help me find all the parts I'll need?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "Absolutely! For a 500-hour service on your CAT D6T bulldozer, you'll need several filters and fluids. Let me provide you with the complete list of parts:\n\nI'll start with the engine oil filter first.",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "**Engine Oil Filter - 1R-0739**\n\n• **Part Number:** 1R-0739\n• **Description:** High-efficiency spin-on engine oil filter\n• **Compatibility:** CAT D6T, D6R, D6N\n• **Current Stock:** 28 units available\n• **Price:** $42.50\n• **Supplier:** Miller Parts Co.\n• **Location:** A-14-5\n\nThis OEM filter provides excellent engine protection. Would you like me to add this to your pick list?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[3].id,
      context: { partNumber: "1R-0739", price: 42.50, stock: 28 },
      metadata: {
        formattedResponse: {
          messageText: "Starting with the engine oil filter for your CAT D6T service.",
          parts: [{
            partNumber: "1R-0739",
            description: "Engine Oil Filter - High-efficiency spin-on filter for CAT engines",
            price: 42.50,
            stockQuantity: 28,
            stockStatus: "In Stock",
            category: "Engine Filters",
            confidence: 99,
            badges: ["OEM", "500hr Service"],
            supplier: "Miller Parts Co.",
            compatibility: {
              compatibleModels: ["CAT D6T", "CAT D6R", "CAT D6N"],
              verified: true
            },
            callToAction: "Add to Pick List"
          }],
          summary: {
            totalFound: 1,
            avgConfidence: 99
          },
          metadata: {
            searchTime: 0.32,
            sourcesUsed: ["inventory", "pinecone"]
          }
        }
      },
    },
    {
      role: MessageRole.USER,
      content: "Yes, add it. What about the fuel filters?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "**Primary Fuel Filter - 1R-0750**\n\n• **Part Number:** 1R-0750\n• **Description:** Primary fuel/water separator\n• **Compatibility:** CAT D6T, D6R, C9 Engine\n• **Current Stock:** 35 units available\n• **Price:** $67.99\n• **Supplier:** Miller Parts Co.\n• **Location:** A-14-2\n\nThis filter separates water and large particles from the fuel. Shall I add this to your pick list as well?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[3].id,
      context: { partNumber: "1R-0750", price: 67.99, stock: 35 },
      metadata: {
        formattedResponse: {
          messageText: "Here's the primary fuel filter with water separation for your D6T.",
          parts: [{
            partNumber: "1R-0750",
            description: "Primary Fuel Filter - Fuel/water separator for CAT engines",
            price: 67.99,
            stockQuantity: 35,
            stockStatus: "In Stock",
            category: "Fuel Filters",
            confidence: 99,
            badges: ["OEM", "Water Separator"],
            supplier: "Miller Parts Co.",
            compatibility: {
              compatibleModels: ["CAT D6T", "CAT D6R", "C9 Engine"],
              verified: true
            },
            callToAction: "Add to Pick List"
          }],
          summary: {
            totalFound: 1,
            avgConfidence: 99
          },
          metadata: {
            searchTime: 0.29,
            sourcesUsed: ["inventory", "pinecone"]
          }
        }
      },
    },
    {
      role: MessageRole.USER,
      content: "Yes please. And the secondary fuel filter?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "**Secondary Fuel Filter - 1R-0756**\n\n• **Part Number:** 1R-0756\n• **Description:** Secondary fuel filter (fine filtration)\n• **Compatibility:** CAT D6T, D6R, C9 Engine\n• **Current Stock:** 42 units available\n• **Price:** $38.75\n• **Supplier:** Johnson Heavy Parts\n• **Location:** B-08-4\n\nThis provides fine filtration before fuel reaches the injectors. Adding to your pick list!",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[3].id,
      context: { partNumber: "1R-0756", price: 38.75, stock: 42 },
      metadata: {
        formattedResponse: {
          messageText: "Secondary fuel filter for fine filtration before fuel injection.",
          parts: [{
            partNumber: "1R-0756",
            description: "Secondary Fuel Filter - Fine filtration for CAT fuel systems",
            price: 38.75,
            stockQuantity: 42,
            stockStatus: "In Stock",
            category: "Fuel Filters",
            confidence: 99,
            badges: ["OEM", "Fine Filtration"],
            supplier: "Johnson Heavy Parts",
            compatibility: {
              compatibleModels: ["CAT D6T", "CAT D6R", "C9 Engine"],
              verified: true
            },
            callToAction: "Add to Pick List"
          }],
          summary: {
            totalFound: 1,
            avgConfidence: 99
          },
          metadata: {
            searchTime: 0.31,
            sourcesUsed: ["inventory", "pinecone"]
          }
        }
      },
    },
    {
      role: MessageRole.USER,
      content: "Great! What about hydraulic filters?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "**Hydraulic Return Filter - 1R-0659**\n\n• **Part Number:** 1R-0659\n• **Description:** High-capacity hydraulic return filter\n• **Compatibility:** CAT D6T, D6R, D6N\n• **Current Stock:** 18 units available\n• **Price:** $125.99\n• **Supplier:** Miller Parts Co.\n• **Location:** A-15-7\n\nThis filter protects your hydraulic system from contamination. Would you like me to add this as well?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[3].id,
      context: { partNumber: "1R-0659", price: 125.99, stock: 18 },
      metadata: {
        formattedResponse: {
          messageText: "High-capacity hydraulic return filter to protect your D6T hydraulic system.",
          parts: [{
            partNumber: "1R-0659",
            description: "Hydraulic Return Filter - High-capacity filter for CAT hydraulic systems",
            price: 125.99,
            stockQuantity: 18,
            stockStatus: "In Stock",
            category: "Hydraulic Filters",
            confidence: 99,
            badges: ["OEM", "High Capacity"],
            supplier: "Miller Parts Co.",
            compatibility: {
              compatibleModels: ["CAT D6T", "CAT D6R", "CAT D6N"],
              verified: true
            },
            callToAction: "Add to Pick List"
          }],
          summary: {
            totalFound: 1,
            avgConfidence: 99
          },
          metadata: {
            searchTime: 0.35,
            sourcesUsed: ["inventory", "pinecone"]
          }
        }
      },
    },
    {
      role: MessageRole.USER,
      content: "Definitely. Any other filters I'm missing?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "**Air Filter - 6I-2501**\n\n• **Part Number:** 6I-2501\n• **Description:** Primary air filter element\n• **Compatibility:** CAT D6T, D6R\n• **Current Stock:** 22 units available\n• **Price:** $89.50\n• **Supplier:** CAT Parts Direct\n• **Location:** C-03-2\n\n**Secondary Air Filter - 6I-2502**\n\n• **Part Number:** 6I-2502\n• **Description:** Secondary air filter (safety element)\n• **Compatibility:** CAT D6T, D6R\n• **Current Stock:** 26 units available\n• **Price:** $54.25\n• **Supplier:** CAT Parts Direct\n• **Location:** C-03-3\n\nBoth air filters should be replaced during a 500-hour service. Should I add both to your pick list?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[3].id,
      context: { partNumbers: ["6I-2501", "6I-2502"], prices: [89.50, 54.25] },
      metadata: {
        formattedResponse: {
          messageText: "Both primary and secondary air filters for complete air intake protection.",
          parts: [
            {
              partNumber: "6I-2501",
              description: "Primary Air Filter - Main air filter element for CAT engines",
              price: 89.50,
              stockQuantity: 22,
              stockStatus: "In Stock",
              category: "Air Filters",
              confidence: 99,
              badges: ["OEM", "Primary Element"],
              supplier: "CAT Parts Direct",
              compatibility: {
                compatibleModels: ["CAT D6T", "CAT D6R"],
                verified: true
              },
              callToAction: "Add to Pick List"
            },
            {
              partNumber: "6I-2502",
              description: "Secondary Air Filter - Safety element for CAT air intake systems",
              price: 54.25,
              stockQuantity: 26,
              stockStatus: "In Stock",
              category: "Air Filters",
              confidence: 99,
              badges: ["OEM", "Safety Element"],
              supplier: "CAT Parts Direct",
              compatibility: {
                compatibleModels: ["CAT D6T", "CAT D6R"],
                verified: true
              },
              callToAction: "Add to Pick List"
            }
          ],
          summary: {
            totalFound: 2,
            avgConfidence: 99
          },
          metadata: {
            searchTime: 0.41,
            sourcesUsed: ["inventory", "pinecone"]
          }
        }
      },
    },
    {
      role: MessageRole.USER,
      content: "Yes, add both. What about transmission filters?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "**Transmission Filter - 3I-0612**\n\n• **Part Number:** 3I-0612\n• **Description:** Transmission oil filter with gasket\n• **Compatibility:** CAT D6T, D6R\n• **Current Stock:** 14 units available\n• **Price:** $94.99\n• **Supplier:** Johnson Heavy Parts\n• **Location:** B-11-6\n\nThis filter includes a new gasket for proper sealing. Adding to your pick list!",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[3].id,
      context: { partNumber: "3I-0612", price: 94.99, stock: 14 },
      metadata: {
        formattedResponse: {
          messageText: "Transmission filter with gasket for your D6T transmission system.",
          parts: [{
            partNumber: "3I-0612",
            description: "Transmission Filter - Complete filter kit with gasket for CAT transmissions",
            price: 94.99,
            stockQuantity: 14,
            stockStatus: "In Stock",
            category: "Transmission Filters",
            confidence: 99,
            badges: ["OEM", "Includes Gasket"],
            supplier: "Johnson Heavy Parts",
            compatibility: {
              compatibleModels: ["CAT D6T", "CAT D6R"],
              verified: true
            },
            callToAction: "Add to Pick List"
          }],
          summary: {
            totalFound: 1,
            avgConfidence: 99
          },
          metadata: {
            searchTime: 0.33,
            sourcesUsed: ["inventory", "pinecone"]
          }
        }
      },
    },
    {
      role: MessageRole.USER,
      content: "Perfect! Can you give me a summary of everything?",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "Here's your complete CAT D6T 500-hour service kit:\n\n**Engine:**\n• 1R-0739 - Engine Oil Filter - $42.50\n\n**Fuel System:**\n• 1R-0750 - Primary Fuel Filter - $67.99\n• 1R-0756 - Secondary Fuel Filter - $38.75\n\n**Hydraulics:**\n• 1R-0659 - Hydraulic Return Filter - $125.99\n\n**Air Intake:**\n• 6I-2501 - Primary Air Filter - $89.50\n• 6I-2502 - Secondary Air Filter - $54.25\n\n**Transmission:**\n• 3I-0612 - Transmission Filter - $94.99\n\n**Total Parts Cost:** $513.97\n**All items in stock:** ✓\n\nAll 7 parts have been added to your pick list. You can convert this to a quote request when you're ready to order. Need anything else?",
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: createdConversations[3].id,
      context: { totalCost: 513.97, partCount: 7 },
      metadata: {
        formattedResponse: {
          messageText: "Complete service kit summary with all 7 parts for your CAT D6T 500-hour service.",
          parts: [
            {
              partNumber: "1R-0739",
              description: "Engine Oil Filter - High-efficiency spin-on filter",
              price: 42.50,
              stockQuantity: 28,
              stockStatus: "In Stock",
              category: "Engine Filters",
              confidence: 99,
              badges: ["OEM"],
              supplier: "Miller Parts Co.",
              callToAction: "Add to Pick List"
            },
            {
              partNumber: "1R-0750",
              description: "Primary Fuel Filter - Fuel/water separator",
              price: 67.99,
              stockQuantity: 35,
              stockStatus: "In Stock",
              category: "Fuel Filters",
              confidence: 99,
              badges: ["OEM"],
              supplier: "Miller Parts Co.",
              callToAction: "Add to Pick List"
            },
            {
              partNumber: "1R-0756",
              description: "Secondary Fuel Filter - Fine filtration",
              price: 38.75,
              stockQuantity: 42,
              stockStatus: "In Stock",
              category: "Fuel Filters",
              confidence: 99,
              badges: ["OEM"],
              supplier: "Johnson Heavy Parts",
              callToAction: "Add to Pick List"
            },
            {
              partNumber: "1R-0659",
              description: "Hydraulic Return Filter - High-capacity filter",
              price: 125.99,
              stockQuantity: 18,
              stockStatus: "In Stock",
              category: "Hydraulic Filters",
              confidence: 99,
              badges: ["OEM"],
              supplier: "Miller Parts Co.",
              callToAction: "Add to Pick List"
            },
            {
              partNumber: "6I-2501",
              description: "Primary Air Filter - Main air filter element",
              price: 89.50,
              stockQuantity: 22,
              stockStatus: "In Stock",
              category: "Air Filters",
              confidence: 99,
              badges: ["OEM"],
              supplier: "CAT Parts Direct",
              callToAction: "Add to Pick List"
            },
            {
              partNumber: "6I-2502",
              description: "Secondary Air Filter - Safety element",
              price: 54.25,
              stockQuantity: 26,
              stockStatus: "In Stock",
              category: "Air Filters",
              confidence: 99,
              badges: ["OEM"],
              supplier: "CAT Parts Direct",
              callToAction: "Add to Pick List"
            },
            {
              partNumber: "3I-0612",
              description: "Transmission Filter - Complete filter kit with gasket",
              price: 94.99,
              stockQuantity: 14,
              stockStatus: "In Stock",
              category: "Transmission Filters",
              confidence: 99,
              badges: ["OEM"],
              supplier: "Johnson Heavy Parts",
              callToAction: "Add to Pick List"
            }
          ],
          summary: {
            totalFound: 7,
            avgConfidence: 99
          },
          recommendations: [
            {
              type: "bundle",
              title: "Complete Service Kit Bundle",
              description: "All filters are OEM quality for maximum protection. Save time by ordering the complete kit.",
              partNumbers: ["1R-0739", "1R-0750", "1R-0756", "1R-0659", "6I-2501", "6I-2502", "3I-0612"]
            },
            {
              type: "related",
              title: "Maintenance Supplies",
              description: "Don't forget engine oil (15W-40), hydraulic oil, and coolant for your service.",
              partNumbers: ["CAT-10W30", "CAT-HYDO", "CAT-ELC"]
            },
            {
              type: "related",
              title: "Service Investment",
              description: "Total investment: $513.97 for comprehensive 500-hour maintenance. All parts currently in stock.",
              partNumbers: []
            }
          ],
          metadata: {
            searchTime: 1.2,
            sourcesUsed: ["inventory", "pinecone", "maintenance-manual"]
          }
        }
      },
    },
    {
      role: MessageRole.USER,
      content: "That's perfect! Thanks for the help.",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "You're welcome! Your CAT D6T service kit is ready in your pick list. When you're ready to proceed, you can:\n\n1. Review the pick list in your dashboard\n2. Convert it to a quote request\n3. Send to suppliers for pricing\n\nFeel free to ask if you need any other parts or have questions about installation. Good luck with the service! 🔧",
      messageType: MessageType.TEXT,
      conversationId: createdConversations[3].id,
    },
  ]

  for (const message of messages) {
    await prisma.chatMessage.create({
      data: message,
    })
  }

  console.log(`Created ${messages.length} chat messages`)

  // Create sample pick lists
  const pickLists = [
    {
      name: "CAT 320D Parts",
      status: PickListStatus.ACTIVE,
      conversationId: createdConversations[0].id,
    },
    {
      name: "John Deere 850K Parts",
      status: PickListStatus.ACTIVE,
      conversationId: createdConversations[1].id,
    },
    {
      name: "Komatsu PC200 Maintenance Parts",
      status: PickListStatus.ACTIVE,
      conversationId: createdConversations[2].id,
    },
    {
      name: "CAT D6T 500hr Service Kit",
      status: PickListStatus.ACTIVE,
      conversationId: createdConversations[3].id,
    },
  ]

  const createdPickLists = []
  for (const pickList of pickLists) {
    const createdPickList = await prisma.chatPickList.create({
      data: pickList,
    })
    createdPickLists.push(createdPickList)
  }

  console.log(`Created ${pickLists.length} pick lists`)

  // Create sample pick list items
  const pickListItems = [
    {
      partNumber: "1R-0750",
      description: "Hydraulic Filter",
      quantity: 2,
      estimatedPrice: 89.99,
      pickListId: createdPickLists[0].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "JD-6068-F",
      description: "Fuel Filter",
      quantity: 3,
      estimatedPrice: 45.99,
      pickListId: createdPickLists[1].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "KOM-PC200-OIL",
      description: "Engine Oil Filter",
      quantity: 1,
      estimatedPrice: 35.50,
      pickListId: createdPickLists[2].id,
      messageId: null,
      addedFromChat: true,
    },
    // CAT D6T service kit items
    {
      partNumber: "1R-0739",
      description: "Engine Oil Filter",
      quantity: 1,
      estimatedPrice: 42.50,
      pickListId: createdPickLists[3].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "1R-0750",
      description: "Primary Fuel Filter",
      quantity: 1,
      estimatedPrice: 67.99,
      pickListId: createdPickLists[3].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "1R-0756",
      description: "Secondary Fuel Filter",
      quantity: 1,
      estimatedPrice: 38.75,
      pickListId: createdPickLists[3].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "1R-0659",
      description: "Hydraulic Return Filter",
      quantity: 1,
      estimatedPrice: 125.99,
      pickListId: createdPickLists[3].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "6I-2501",
      description: "Primary Air Filter",
      quantity: 1,
      estimatedPrice: 89.50,
      pickListId: createdPickLists[3].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "6I-2502",
      description: "Secondary Air Filter",
      quantity: 1,
      estimatedPrice: 54.25,
      pickListId: createdPickLists[3].id,
      messageId: null,
      addedFromChat: true,
    },
    {
      partNumber: "3I-0612",
      description: "Transmission Filter",
      quantity: 1,
      estimatedPrice: 94.99,
      pickListId: createdPickLists[3].id,
      messageId: null,
      addedFromChat: true,
    },
  ]

  for (const item of pickListItems) {
    await prisma.chatPickListItem.create({
      data: item,
    })
  }

  console.log(`Created ${pickListItems.length} pick list items`)

  // Update conversation lastMessageAt timestamps
  for (const conversation of createdConversations) {
    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    })
  }

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
