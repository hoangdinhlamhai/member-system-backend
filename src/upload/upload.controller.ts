import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Logger,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StaffAuthGuard } from '../auth/guards/staff-auth.guard';
import { UploadService } from './upload.service';
import type { Request } from 'express';

@Controller('api/v1/upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /api/v1/upload/bill-image
   * Staff uploads a bill image → returns GCS URL
   *
   * Body: multipart/form-data with field "file"
   * Max: 5MB, JPG/PNG/WEBP only
   */
  @Post('bill-image')
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadBillImage(
    @Req() req: Request,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    this.logger.log(`[UPLOAD] Request received`);
    this.logger.log(`[UPLOAD] Content-Type: ${req.headers['content-type']}`);
    this.logger.log(`[UPLOAD] File present: ${!!file}`);

    if (file) {
      this.logger.log(`[UPLOAD] File info: name=${file.originalname}, size=${file.size}, mimetype=${file.mimetype}`);
    }

    if (!file) {
      this.logger.error('[UPLOAD] No file in request body');
      throw new BadRequestException('Vui lòng chọn ảnh bill để upload.');
    }

    try {
      const url = await this.uploadService.uploadFile(
        file.buffer,
        file.originalname,
        'bill-images',
      );

      this.logger.log(`[UPLOAD] Success: ${url}`);
      return {
        success: true,
        data: { url },
        message: 'Upload ảnh bill thành công.',
      };
    } catch (error) {
      this.logger.error(`[UPLOAD] Failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
