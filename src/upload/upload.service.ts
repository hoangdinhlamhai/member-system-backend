import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private storage: Storage;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const keyFile = this.configService.get<string>('GCS_KEY_FILE');
    const projectId = this.configService.get<string>('GCS_PROJECT_ID');

    this.bucketName =
      this.configService.get<string>('GCS_BUCKET_NAME') ||
      'zo-dut-can-storage';

    this.storage = new Storage({
      projectId,
      keyFilename: keyFile,
    });

    this.logger.log(
      `GCS initialized: bucket=${this.bucketName}, project=${projectId}`,
    );
  }

  /**
   * Upload a file buffer to GCS and return the public URL.
   *
   * @param fileBuffer - Raw file buffer
   * @param originalName - Original file name (for extension)
   * @param folder - GCS folder prefix (e.g. 'bill-images')
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    folder = 'bill-images',
  ): Promise<string> {
    const ext = path.extname(originalName) || '.jpg';
    const fileName = `${folder}/${randomUUID()}${ext}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    await file.save(fileBuffer, {
      metadata: {
        contentType: this.getContentType(ext),
      },
      resumable: false,
    });

    // Make the file publicly readable
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

    this.logger.log(`Uploaded: ${publicUrl}`);
    return publicUrl;
  }

  private getContentType(ext: string): string {
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
    };
    return map[ext.toLowerCase()] || 'application/octet-stream';
  }
}
