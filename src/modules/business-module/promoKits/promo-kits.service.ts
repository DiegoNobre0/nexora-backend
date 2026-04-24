import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError } from '../../../shared/errors/AppError';
import { StorageService } from '../../../shared/services/storage.service';
import type { CreatePromoKitInput, UpdatePromoKitInput } from './promo-kits.schema';

export class PromoKitsService {
    constructor(
        private readonly db: BusinessClient,
        private readonly tenantDbName: string = ''
    ) { }

    // ─── Criar Kit Promocional ─────────────────────────────
    async createPromoKit(input: CreatePromoKitInput, images: Buffer[]) {
        // Sobe as imagens em paralelo para o Cloudflare R2
        const uploadPromises = images.map(img =>
            StorageService.uploadImage(img, this.tenantDbName || 'default', 'kits')
        );
        const imageUrls = await Promise.all(uploadPromises);

        // Cria o Kit e os Itens numa única transação
        return this.db.promoKit.create({
            data: {
                name: input.name,
                description: input.description,
                price: input.price,
                is_active: input.is_active,
                image_url_1: imageUrls[0] || null,
                image_url_2: imageUrls[1] || null,               
                // Relacionamento com os produtos do kit
                items: {
                    create: input.items.map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                    })),
                },
            },
            include: {
                items: {
                    include: { product: { select: { id: true, name: true, price: true } } }
                }
            }
        });
    }

    // ─── Listar Kits ─────────────────────────────────────────
   async listPromoKits() {
    return this.db.promoKit.findMany({
        orderBy: { created_at: 'desc' },
        include: {
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            price: true,      
                            cost_price: true,  
                            image_url: true,   
                            unit: true,        
                            stock_qty: true,   
                            is_active: true,   
                        }
                    }
                }
            }
        }
    });
}


    // ─── Editar Kit Promocional ──────────────────────────────
    async updatePromoKit(id: string, input: UpdatePromoKitInput, newImages: Buffer[]) {
        const existingKit = await this.db.promoKit.findUnique({ where: { id } });
        if (!existingKit) throw new NotFoundError('Kit Promocional');

        // Recupera as URLs atuais
        let imageUrls = [
            existingKit.image_url_1,
            existingKit.image_url_2,
            
        ];

        // Se o usuário mandou novas imagens no form, nós substituímos as antigas
        if (newImages && newImages.length > 0) {
            // 1. Limpa as imagens velhas do Bucket R2
            for (const url of imageUrls) {
                if (url) await StorageService.deleteImage(url);
            }

            // 2. Faz o upload das novas
            const uploadPromises = newImages.map(img =>
                StorageService.uploadImage(img, this.tenantDbName || 'default', 'kits')
            );
            const uploaded = await Promise.all(uploadPromises);

            // Preenche o array com as novas URLs (ou null se tiverem menos de 4)
            imageUrls = [uploaded[0] || null, uploaded[1] || null, uploaded[2] || null, uploaded[3] || null];
        }

        return this.db.promoKit.update({
            where: { id },
            data: {
                name: input.name,
                description: input.description,
                price: input.price,
                is_active: input.is_active,
                image_url_1: imageUrls[0],
                image_url_2: imageUrls[1],
               

                // Magia do Prisma: Se enviaram os itens do kit, a gente limpa os antigos e cria os novos na mesma transação!
                ...(input.items && {
                    items: {
                        deleteMany: {}, // Apaga os itens antigos da tabela PromoKitItem
                        create: input.items.map((item: any) => ({
                            product_id: item.product_id,
                            quantity: item.quantity,
                        })),
                    }
                })
            },
            include: {
                items: {
                    include: { product: { select: { id: true, name: true, price: true, cost_price: true } } }
                }
            }
        });
    }

    // ─── Deletar Kit ─────────────────────────────────────────
    async deletePromoKit(id: string) {
        const kit = await this.db.promoKit.findUnique({ where: { id } });
        if (!kit) throw new NotFoundError('Kit Promocional');

        // Remove as imagens do bucket para não gerar lixo
        const urls = [kit.image_url_1, kit.image_url_2].filter(Boolean);
        for (const url of urls) {
            if (url) await StorageService.deleteImage(url);
        }

        await this.db.promoKit.delete({ where: { id } });
        return { message: 'Kit deletado com sucesso.' };
    }
}