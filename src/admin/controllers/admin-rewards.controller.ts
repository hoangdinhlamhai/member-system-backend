import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { AdminRewardsService } from '../services/admin-rewards.service';
import { CreateRewardDto, UpdateRewardDto, CreateDiscountTierDto, UpdateDiscountTierDto } from '../dto/reward.dto';

@Controller('api/v1/admin/rewards')
export class AdminRewardsController {
  constructor(private readonly service: AdminRewardsService) {}

  // ── Rewards Catalog ──

  @Get()
  findAllRewards() {
    return this.service.findAllRewards();
  }

  @Get(':id')
  findOneReward(@Param('id') id: string) {
    return this.service.findOneReward(id);
  }

  @Post()
  createReward(@Body() dto: CreateRewardDto) {
    return this.service.createReward(dto);
  }

  @Patch(':id')
  updateReward(@Param('id') id: string, @Body() dto: UpdateRewardDto) {
    return this.service.updateReward(id, dto);
  }

  @Delete(':id')
  removeReward(@Param('id') id: string) {
    return this.service.removeReward(id);
  }

  // ── Discount Tiers ──

  @Get('discount-tiers/list')
  findAllDiscountTiers() {
    return this.service.findAllDiscountTiers();
  }

  @Post('discount-tiers')
  createDiscountTier(@Body() dto: CreateDiscountTierDto) {
    return this.service.createDiscountTier(dto);
  }

  @Patch('discount-tiers/:id')
  updateDiscountTier(@Param('id') id: string, @Body() dto: UpdateDiscountTierDto) {
    return this.service.updateDiscountTier(id, dto);
  }

  @Delete('discount-tiers/:id')
  removeDiscountTier(@Param('id') id: string) {
    return this.service.removeDiscountTier(id);
  }
}
