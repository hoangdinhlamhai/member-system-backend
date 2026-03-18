import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { AdminTiersService } from '../services/admin-tiers.service';
import { CreateTierDto, UpdateTierDto } from '../dto/tier.dto';

@Controller('api/v1/admin/tiers')
export class AdminTiersController {
  constructor(private readonly service: AdminTiersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTierDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
