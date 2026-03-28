/**
 * Backfill: Gán hạng Đồng mặc định cho member chưa có tierHistory
 * Chạy 1 lần: npx ts-node prisma/backfill-default-tier.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Tìm tier thấp nhất (Đồng)
  const defaultTier = await prisma.tier.findFirst({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  if (!defaultTier) {
    console.log('❌ Không tìm thấy tier nào active. Hãy seed tiers trước.');
    return;
  }

  console.log(`🎯 Default tier: ${defaultTier.name} (${defaultTier.id})`);

  // 2. Tìm member chưa có tierHistory
  const membersWithoutTier = await prisma.member.findMany({
    where: {
      tierHistories: { none: {} },
    },
    select: { id: true, zaloName: true, phone: true },
  });

  console.log(`📋 Tìm thấy ${membersWithoutTier.length} member chưa có hạng`);

  if (membersWithoutTier.length === 0) {
    console.log('✅ Tất cả member đã có hạng. Không cần backfill.');
    return;
  }

  // 3. Gán hạng mặc định
  const result = await prisma.tierHistory.createMany({
    data: membersWithoutTier.map((m) => ({
      memberId: m.id,
      toTierId: defaultTier.id,
      reason: 'Backfill: gán hạng mặc định',
    })),
  });

  console.log(`✅ Đã gán hạng "${defaultTier.name}" cho ${result.count} member`);

  // 4. Liệt kê chi tiết
  for (const m of membersWithoutTier) {
    console.log(`  → ${m.zaloName || m.phone || m.id}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Backfill thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
