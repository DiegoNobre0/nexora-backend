import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';

// Instancia o cliente S3 apontando para o seu Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export class StorageService {
  /**
   * Recebe um Buffer de imagem, otimiza com Sharp (converte para WebP, 
   * reduz tamanho sem perder qualidade visível) e envia para o Bucket R2.
   * * @param fileBuffer Buffer do arquivo recebido na requisição
   * @param tenantId ID do cliente/empresa (para separar as pastas)
   * @param folder Subpasta (ex: 'products', 'kits', 'logos')
   * @returns URL pública da imagem salva
   */
  static async uploadImage(fileBuffer: Buffer, tenantId: string, folder: string = 'misc'): Promise<string> {
    try {
      // 1. Otimização pesada com Sharp (Padrão Ouro de Performance)
      const optimizedBuffer = await sharp(fileBuffer)
        .resize({
          width: 1080, // Tamanho máximo excelente para E-commerce/Catálogo
          height: 1080,
          fit: 'inside', // Não estica a imagem, só reduz se for maior que 1080
          withoutEnlargement: true,
        })
        .webp({ quality: 80 }) // Converte para WebP (super leve) com 80% de qualidade
        .toBuffer();

      // 2. Cria um nome de arquivo único e à prova de colisão
      const uniqueFileName = `${tenantId}/${folder}/${crypto.randomUUID()}.webp`;

      // 3. Envia para o Cloudflare R2
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: uniqueFileName,
          Body: optimizedBuffer,
          ContentType: 'image/webp',
        })
      );

      // 4. Retorna a URL final pronta para salvar no Banco de Dados
      const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, ''); // Remove barra final se houver
      return `${publicUrl}/${uniqueFileName}`;
      
    } catch (error) {
      console.error('❌ Erro no StorageService.uploadImage:', error);
      throw new Error('Falha ao processar e salvar a imagem.');
    }
  }

  /**
   * Deleta uma imagem do Bucket R2 baseada na URL pública dela.
   * Excelente para usar quando o usuário deletar um produto ou trocar a foto.
   */
  static async deleteImage(fileUrl: string | null | undefined): Promise<void> {
    if (!fileUrl) return;

    try {
      const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
      
      // Se a URL não for do nosso bucket, ignora
      if (!fileUrl.startsWith(publicUrl)) return;

      // Extrai apenas o "Caminho" da imagem (ex: tenant/products/id.webp)
      const key = fileUrl.replace(`${publicUrl}/`, '');

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
        })
      );
      
    } catch (error) {
      console.error(`❌ Erro ao deletar imagem do R2 (${fileUrl}):`, error);
      // Não damos throw aqui para não quebrar fluxos de deleção em cascata
    }
  }
}