import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

  // Admin account
  const adminPasswordHash = bcrypt.hashSync('123456', 10);
  const admin = await prisma.staff.upsert({
    where: { phone: '0123456789' },
    update: { passwordHash: adminPasswordHash, role: 'admin' },
    create: {
      branchId: branch1.id,
      phone: '0123456789',
      fullName: 'Admin Zô Dứt Cạn',
      zaloId: null,
      role: 'admin',
      pinHash: null,
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });
  console.log(`✅ Admin: ${admin.fullName} - ${admin.role} (${admin.phone})`);

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
      minSpending: BigInt(5_000_000),
      pointsMultiplier: 1.2,
      referralBonusPercent: 5.0,
      themeConfig: { color: '#C0C0C0', icon: '🥈', gradient: 'linear-gradient(135deg, #A8A9AD, #D4D4D8)' },
    },
    {
      id: '00000000-0000-0000-0000-000000000203',
      name: 'Vàng',
      slug: 'gold',
      displayOrder: 3,
      minSpending: BigInt(20_000_000),
      pointsMultiplier: 1.5,
      referralBonusPercent: 5.0,
      themeConfig: { color: '#FFD700', icon: '🥇', gradient: 'linear-gradient(135deg, #D4A017, #FFD700)' },
    },
    {
      id: '00000000-0000-0000-0000-000000000204',
      name: 'Bạch Kim',
      slug: 'platinum',
      displayOrder: 4,
      minSpending: BigInt(50_000_000),
      pointsMultiplier: 2.0,
      referralBonusPercent: 5.0,
      themeConfig: { color: '#E5E4E2', icon: '💎', gradient: 'linear-gradient(135deg, #B0C4D8, #E5E4E2)' },
    },
    {
      id: '00000000-0000-0000-0000-000000000205',
      name: 'Kim Cương',
      slug: 'diamond',
      displayOrder: 5,
      minSpending: BigInt(100_000_000),
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

  // ─── 5. Tạo Rewards Catalog (Quà đổi điểm) ──────────────
  const rewards = [
    {
      id: '00000000-0000-0000-0000-000000000301',
      name: 'Trà Sữa Trân Châu',
      description: 'Đổi 1 ly Trà Sữa Trân Châu size L bất kỳ',
      type: 'drink',
      pointsRequired: 50,
      quantityLimit: 100,
      perMemberLimit: 3,
      imageUrl: '🧋',
    },
    {
      id: '00000000-0000-0000-0000-000000000302',
      name: 'Cà Phê Sữa Đá',
      description: 'Đổi 1 ly Cà Phê Sữa Đá size M',
      type: 'drink',
      pointsRequired: 30,
      quantityLimit: 200,
      perMemberLimit: 5,
      imageUrl: '☕',
    },
    {
      id: '00000000-0000-0000-0000-000000000303',
      name: 'Sinh Tố Bơ',
      description: 'Đổi 1 ly Sinh Tố Bơ size L',
      type: 'drink',
      pointsRequired: 45,
      quantityLimit: 80,
      perMemberLimit: 3,
      imageUrl: '🥤',
    },
    {
      id: '00000000-0000-0000-0000-000000000304',
      name: 'Bánh Mì Thịt Nướng',
      description: 'Đổi 1 phần Bánh Mì Thịt Nướng đặc biệt',
      type: 'food',
      pointsRequired: 60,
      quantityLimit: 50,
      perMemberLimit: 2,
      imageUrl: '🥖',
    },
    {
      id: '00000000-0000-0000-0000-000000000305',
      name: 'Combo Ăn Sáng',
      description: 'Combo: Bánh mì + Cà phê sữa + Bánh flan',
      type: 'food',
      pointsRequired: 100,
      quantityLimit: 30,
      perMemberLimit: 2,
      imageUrl: '🍽️',
    },
    {
      id: '00000000-0000-0000-0000-000000000306',
      name: 'Voucher 50K',
      description: 'Voucher giảm 50.000đ cho đơn từ 150.000đ',
      type: 'voucher',
      pointsRequired: 80,
      quantityLimit: null,
      perMemberLimit: 5,
      imageUrl: '🎫',
    },
    {
      id: '00000000-0000-0000-0000-000000000307',
      name: 'Túi Tote ZDC',
      description: 'Túi tote canvas thương hiệu Zô Dứt Cạn phiên bản giới hạn',
      type: 'gift',
      pointsRequired: 200,
      quantityLimit: 20,
      perMemberLimit: 1,
      imageUrl: '👜',
    },
    {
      id: '00000000-0000-0000-0000-000000000308',
      name: 'Ly Giữ Nhiệt ZDC',
      description: 'Ly giữ nhiệt inox 500ml in logo Zô Dứt Cạn',
      type: 'gift',
      pointsRequired: 300,
      quantityLimit: 15,
      perMemberLimit: 1,
      imageUrl: '🥤',
    },
  ];

  for (const reward of rewards) {
    const created = await prisma.rewardCatalog.upsert({
      where: { id: reward.id },
      update: {
        name: reward.name,
        description: reward.description,
        type: reward.type,
        pointsRequired: reward.pointsRequired,
        quantityLimit: reward.quantityLimit,
        perMemberLimit: reward.perMemberLimit,
        imageUrl: reward.imageUrl,
      },
      create: {
        id: reward.id,
        brandId: brand.id,
        name: reward.name,
        description: reward.description,
        imageUrl: reward.imageUrl,
        type: reward.type,
        pointsRequired: reward.pointsRequired,
        quantityLimit: reward.quantityLimit,
        quantityRedeemed: 0,
        perMemberLimit: reward.perMemberLimit,
        isActive: true,
      },
    });
    console.log(`✅ Quà: ${created.name} (${created.pointsRequired} điểm) — ${created.type}`);
  }

  // ─── 6. Tạo Discount Tiers (Giảm giá bill bằng điểm) ───
  const discountTiers = [
    {
      id: '00000000-0000-0000-0000-000000000401',
      discountPercent: 5,
      pointsRequired: 20,
      maxDiscountAmount: BigInt(25_000),
    },
    {
      id: '00000000-0000-0000-0000-000000000402',
      discountPercent: 10,
      pointsRequired: 40,
      maxDiscountAmount: BigInt(50_000),
    },
    {
      id: '00000000-0000-0000-0000-000000000403',
      discountPercent: 15,
      pointsRequired: 70,
      maxDiscountAmount: BigInt(100_000),
    },
    {
      id: '00000000-0000-0000-0000-000000000404',
      discountPercent: 20,
      pointsRequired: 120,
      maxDiscountAmount: BigInt(200_000),
    },
  ];

  for (const dt of discountTiers) {
    const created = await prisma.discountTier.upsert({
      where: { id: dt.id },
      update: {
        discountPercent: dt.discountPercent,
        pointsRequired: dt.pointsRequired,
        maxDiscountAmount: dt.maxDiscountAmount,
      },
      create: {
        id: dt.id,
        brandId: brand.id,
        discountPercent: dt.discountPercent,
        pointsRequired: dt.pointsRequired,
        maxDiscountAmount: dt.maxDiscountAmount,
        isActive: true,
      },
    });
    console.log(`✅ Giảm giá: ${created.discountPercent}% (${created.pointsRequired} điểm, max ${Number(created.maxDiscountAmount).toLocaleString()}đ)`);
  }

  console.log('\n🎉 Seed hoàn tất!');
  console.log(`  ${2} chi nhánh`);
  console.log(`  3 nhân viên (incl. 1 admin)`);
  console.log(`  ${tiers.length} hạng thẻ`);
  console.log(`  ${rewards.length} quà đổi điểm`);
  console.log(`  ${discountTiers.length} mức giảm giá`);
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
