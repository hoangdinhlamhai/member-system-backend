import {
  Controller,
  Post,
  Get,
  UseGuards,
  Query,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/guards/staff-auth.guard';
import { UploadService } from './upload.service';

@Controller('api/v1/upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  /**
   * GET /api/v1/upload/signed-url?fileName=xxx.jpg&contentType=image/jpeg
   */
  @Get('signed-url')
  @UseGuards(StaffAuthGuard)
  async getSignedUrl(
    @Query('fileName') fileName: string,
    @Query('contentType') contentType: string,
  ) {
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];

    const resolvedType = contentType || 'image/jpeg';
    if (!allowedTypes.includes(resolvedType)) {
      throw new BadRequestException(
        `Loại file không hợp lệ: ${resolvedType}. Chỉ chấp nhận JPG, PNG, WEBP, HEIC.`,
      );
    }

    try {
      const result = await this.uploadService.generateSignedUploadUrl(
        fileName,
        resolvedType,
        'bill-images',
      );

      this.logger.log(`[UPLOAD] Signed URL created for: ${fileName}`);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `[UPLOAD] Signed URL failed: ${error.message}`,
        error.stack,
      );
      // Trả lỗi chi tiết thay vì generic "Internal server error"
      throw new InternalServerErrorException(
        `GCS signed URL failed: ${error.message}`,
      );
    }
  }

  /**
   * POST /api/v1/upload/confirm?fileName=bill-images/xxx.jpg
   */
  @Post('confirm')
  @UseGuards(StaffAuthGuard)
  async confirmUpload(@Query('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    try {
      await this.uploadService.makeFilePublic(fileName);
      const publicUrl = `https://storage.googleapis.com/${
        process.env.GCS_BUCKET_NAME || 'zo-dut-can-storage'
      }/${fileName}`;

      this.logger.log(`[UPLOAD] Confirmed public: ${publicUrl}`);
      return {
        success: true,
        data: { url: publicUrl },
        message: 'Upload ảnh bill thành công.',
      };
    } catch (error) {
      this.logger.error(
        `[UPLOAD] Confirm failed: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `GCS confirm failed: ${error.message}`,
      );
    }
  }
}

