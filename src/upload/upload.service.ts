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
    const credentialsJson = this.configService.get<string>('GCS_CREDENTIALS');
    const projectId = this.configService.get<string>('GCS_PROJECT_ID');

    this.bucketName =
      this.configService.get<string>('GCS_BUCKET_NAME') ||
      'zo-dut-can-storage';

    // Ưu tiên GCS_CREDENTIALS (env var, dùng trên Vercel)
    // Fallback: GCS_KEY_FILE (file path, dùng local)
    if (credentialsJson) {
      try {
        let jsonStr = credentialsJson;

        // Nếu là base64 encoded (không bắt đầu bằng '{')
        if (!jsonStr.trim().startsWith('{')) {
          jsonStr = Buffer.from(jsonStr, 'base64').toString('utf-8');
          this.logger.log('GCS_CREDENTIALS decoded from base64');
        }

        const credentials = JSON.parse(jsonStr);

        // Fix: Vercel có thể double-escape \\n → cần chuyển thành real newline
        if (credentials.private_key) {
          credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }

        this.storage = new Storage({ projectId, credentials });
        this.logger.log(
          `GCS initialized with env credentials, client_email=${credentials.client_email}`,
        );
      } catch (e) {
        this.logger.error(`Failed to parse GCS_CREDENTIALS: ${e.message}`);
        this.storage = new Storage({ projectId, keyFilename: keyFile });
      }
    } else {
      this.storage = new Storage({ projectId, keyFilename: keyFile });
      this.logger.log('GCS initialized with key file');
    }

    this.logger.log(
      `GCS config: bucket=${this.bucketName}, project=${projectId}`,
    );

    // Auto-configure CORS cho bucket để frontend có thể PUT trực tiếp
    this.ensureBucketCors().catch((err) =>
      this.logger.warn(`Failed to set bucket CORS (may already be set): ${err.message}`),
    );
  }

  /**
   * Tự động cấu hình CORS cho GCS bucket.
   * Cho phép frontend PUT file trực tiếp qua signed URL.
   */
  private async ensureBucketCors(): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    await bucket.setCorsConfiguration([
      {
        origin: ['*'],
        method: ['PUT', 'GET', 'HEAD', 'OPTIONS'],
        responseHeader: ['Content-Type', 'x-goog-resumable'],
        maxAgeSeconds: 3600,
      },
    ]);
    this.logger.log(`GCS CORS configured for bucket: ${this.bucketName}`);
  }

  /**
   * Generate a signed URL for direct frontend → GCS upload.
   * Returns { signedUrl, publicUrl, fileName }.
   */
  async generateSignedUploadUrl(
    originalName: string,
    contentType: string,
    folder = 'bill-images',
  ): Promise<{ signedUrl: string; publicUrl: string; fileName: string }> {
    const ext = path.extname(originalName) || '.jpg';
    const fileName = `${folder}/${randomUUID()}${ext}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

    this.logger.log(`Signed URL generated for: ${fileName}`);
    return { signedUrl, publicUrl, fileName };
  }

  /**
   * Make an uploaded file public (called after frontend uploads via signed URL).
   */
  async makeFilePublic(fileName: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);
    await file.makePublic();
    this.logger.log(`Made public: ${fileName}`);
  }

  /**
   * Upload a file buffer to GCS, make it public, return permanent URL.
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    folder = 'bill-images',
  ): Promise<string> {
    const ext = path.extname(originalName) || '.jpg';
    const fileName = `${folder}/${randomUUID()}${ext}`;
    const contentType = this.getContentType(ext);

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    try {
      await file.save(fileBuffer, {
        metadata: { contentType },
        resumable: false,
      });

      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
      this.logger.log(`Uploaded: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      this.logger.error(`GCS upload failed: ${error.message}`, error.stack);
      throw error;
    }
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

