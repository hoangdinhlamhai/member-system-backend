import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu...');

  // ─── 1. Tạo Brand ───────────────────────────────────────
  const brand = await prisma.brand.upsert({
    where: { slug: 'zo-dut-can' },
    update: {},
    create: {
      name: 'Zo Dứt Cạn',
      slug: 'zo-dut-can',
      logoUrl: null,
      zaloOaId: null,
      isActive: true,
    },
  });
  console.log(`✅ Brand: ${brand.name} (${brand.id})`);

  // ─── 2. Tạo 2 Chi nhánh (Branches) ─────────────────────
  const branch1 = await prisma.branch.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { cukcukBranchId: 'CK-BRANCH-001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      brandId: brand.id,
      address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
      phone: '0901234567',
      cukcukBranchId: 'CK-BRANCH-001',
      webhookSecret: null,
      isActive: true,
    },
  });
  console.log(`✅ Chi nhánh 1: ${branch1.address} (${branch1.id})`);

  const branch2 = await prisma.branch.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: { cukcukBranchId: 'CK-BRANCH-002' },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      brandId: brand.id,
      address: '456 Lê Lợi, Quận 3, TP.HCM',
      phone: '0907654321',
      cukcukBranchId: 'CK-BRANCH-002',
      webhookSecret: null,
      isActive: true,
    },
  });
  console.log(`✅ Chi nhánh 2: ${branch2.address} (${branch2.id})`);

  // ─── 3. Tạo 2 Nhân viên (Staff) ────────────────────────
  const staff1 = await prisma.staff.upsert({
    where: { phone: '0912345678' },
    update: {},
    create: {
      branchId: branch1.id,
      phone: '0912345678',
      fullName: 'Nguyễn Văn An',
      zaloId: null,
      role: 'store_manager',
      pinHash: null,
      passwordHash: null,
      isActive: true,
    },
  });
  console.log(`✅ Nhân viên 1: ${staff1.fullName} - ${staff1.role} @ Chi nhánh 1 (${staff1.id})`);

  const staff2 = await prisma.staff.upsert({
    where: { phone: '0987654321' },
    update: {},
    create: {
      branchId: branch2.id,
      phone: '0987654321',
      fullName: 'Trần Thị Bình',
      zaloId: null,
      role: 'cashier',
      pinHash: null,
      passwordHash: null,
      isActive: true,
    },
  });
  console.log(`✅ Nhân viên 2: ${staff2.fullName} - ${staff2.role} @ Chi nhánh 2 (${staff2.id})`);

  // ─── 4. Tạo 5 Hạng thẻ (Tiers) ─────────────────────────
  const tiers = [
    {
      id: '00000000-0000-0000-0000-000000000201',
      name: 'Đồng',
      slug: 'bronze',
      displayOrder: 1,
      minSpending: BigInt(0),
      pointsMultiplier: 1.0,
      referralBonusPercent: 5.0,
      themeConfig: { color: '#CD7F32', icon: '🥉', gradient: 'linear-gradient(135deg, #CD7F32, #E8A96A)' },
    },
    {
      id: '00000000-0000-0000-0000-000000000202',
      name: 'Bạc',
      slug: 'silver',
      displayOrder: 2,
      minSpending: BigInt(2_000_000),
      pointsMultiplier: 1.2,
      referralBonusPercent: 5.0,
      themeConfig: { color: '#C0C0C0', icon: '🥈', gradient: 'linear-gradient(135deg, #A8A9AD, #D4D4D8)' },
    },
    {
      id: '00000000-0000-0000-0000-000000000203',
      name: 'Vàng',
      slug: 'gold',
      displayOrder: 3,
      minSpending: BigInt(5_000_000),
      pointsMultiplier: 1.5,
      referralBonusPercent: 5.0,
      themeConfig: { color: '#FFD700', icon: '🥇', gradient: 'linear-gradient(135deg, #D4A017, #FFD700)' },
    },
    {
      id: '00000000-0000-0000-0000-000000000204',
      name: 'Bạch Kim',
      slug: 'platinum',
      displayOrder: 4,
      minSpending: BigInt(15_000_000),
      pointsMultiplier: 2.0,
      referralBonusPercent: 5.0,
      themeConfig: { color: '#E5E4E2', icon: '💎', gradient: 'linear-gradient(135deg, #B0C4D8, #E5E4E2)' },
    },
    {
      id: '00000000-0000-0000-0000-000000000205',
      name: 'Kim Cương',
      slug: 'diamond',
      displayOrder: 5,
      minSpending: BigInt(50_000_000),
      pointsMultiplier: 3.0,
      referralBonusPercent: 5.0,
      themeConfig: { color: '#B9F2FF', icon: '👑', gradient: 'linear-gradient(135deg, #4FC3F7, #B9F2FF)' },
    },
  ];

  for (const tier of tiers) {
    const created = await prisma.tier.upsert({
      where: { id: tier.id },
      update: {
        name: tier.name,
        slug: tier.slug,
        displayOrder: tier.displayOrder,
        minSpending: tier.minSpending,
        pointsMultiplier: tier.pointsMultiplier,
        referralBonusPercent: tier.referralBonusPercent,
        themeConfig: tier.themeConfig,
      },
      create: {
        id: tier.id,
        name: tier.name,
        slug: tier.slug,
        displayOrder: tier.displayOrder,
        minSpending: tier.minSpending,
        pointsMultiplier: tier.pointsMultiplier,
        referralBonusPercent: tier.referralBonusPercent,
        themeConfig: tier.themeConfig,
        isActive: true,
      },
    });
    console.log(`✅ Hạng ${created.displayOrder}: ${created.name} (${created.slug}) - min ${created.minSpending.toLocaleString()}đ, x${created.pointsMultiplier}`);
  }

  console.log('\n🎉 Seed hoàn tất!');
  console.log(`${2} chi nhánh`);
  console.log(`${2} nhân viên`);
  console.log(`${tiers.length} hạng thẻ`);
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
