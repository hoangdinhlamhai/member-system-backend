import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { AdminMembersService } from '../services/admin-members.service';
import { AdjustPointsDto } from '../dto/config.dto';
import { CreateMemberDto, UpdateMemberDto } from '../dto/member.dto';

@Controller('api/v1/admin/members')
export class AdminMembersController {
  constructor(private readonly service: AdminMembersService) {}

  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.service.findAll(q, parseInt(page || '1'), parseInt(perPage || '20'));
  }

  @Get('stats/overview')
  getOverviewStats() {
    return this.service.getOverviewStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMemberDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/adjust-points')
  adjustPoints(@Param('id') id: string, @Body() dto: AdjustPointsDto) {
    return this.service.adjustPoints(id, dto);
  }
}
