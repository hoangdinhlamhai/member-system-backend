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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StaffAuthGuard } from '../auth/guards/staff-auth.guard';
import { UploadService } from './upload.service';

@Controller('api/v1/upload')
export class UploadController {
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
    if (!file) {
      throw new BadRequestException('Vui lòng chọn ảnh bill để upload.');
    }

    const url = await this.uploadService.uploadFile(
      file.buffer,
      file.originalname,
      'bill-images',
    );

    return {
      success: true,
      data: { url },
      message: 'Upload ảnh bill thành công.',
    };
  }
}
