import { Controller, Get, Post, Delete, Param, Body, Patch } from '@nestjs/common';
import { AdminConfigsService } from '../services/admin-configs.service';
import { UpsertConfigDto } from '../dto/config.dto';

@Controller('api/v1/admin/configs')
export class AdminConfigsController {
  constructor(private readonly service: AdminConfigsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  upsert(@Body() dto: UpsertConfigDto) {
    return this.service.upsert(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Branches ──

  @Get('branches')
  findAllBranches() {
    return this.service.findAllBranches();
  }

  @Patch('branches/:id')
  updateBranch(
    @Param('id') id: string,
    @Body() data: { address?: string; phone?: string; webhookSecret?: string; isActive?: boolean },
  ) {
    return this.service.updateBranch(id, data);
  }
}
