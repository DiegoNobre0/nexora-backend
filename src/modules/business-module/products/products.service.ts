import { whatsappQueue } from 'src/worker/whatsapp.queue';
import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ConflictError, ValidationError, AppError } from '../../../shared/errors/AppError';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsInput,
  UpdateStockInput,
  RegisterBarcodeInput,
} from './products.schema';
import { StorageService } from 'src/shared/services/storage.service';


// ─────────────────────────────────────────────────────────────
// SERVICE — Products
//
// Regras de negócio do catálogo, estoque e códigos de barras.
// ─────────────────────────────────────────────────────────────

export class ProductsService {
  constructor(
    private readonly db: BusinessClient,
    private readonly tenantDbName: string = '') { }

  // ─── Listar com filtros e paginação ───────────────────────
  async listProducts(input: ListProductsInput) {
    const { name, category_id, is_active, low_stock, page, limit } = input;
    const skip = (page - 1) * limit;

  const where: any = {
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
      ...(is_active !== undefined && { is_active }),
      // low_stock é tratado na memória logo abaixo
    };

    if (category_id) {
      where.categories = {
        some: {
          id: category_id
        }
      };
    }

    let products = await this.db.product.findMany({
      where: where,
      orderBy: {
        name: "asc"
      },
      include: {
        categories: { // ✅ CORRIGIDO
          select: {
            id: true,
            name: true
          }
        },
        barcodes: true,
      }
    })

    // Filtra em memória os produtos abaixo do estoque mínimo
    if (low_stock) {
      products = products.filter((p: any) => p.stock_qty < p.stock_min);
    }

    // Paginação manual após o filtro em memória
    const total = products.length;
    const paginated = products.slice(skip, skip + limit);

    return {
      data: paginated,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  // ─── Buscar por ID ─────────────────────────────────────────
 async getProductById(id: string) {
  const product = await this.db.product.findUnique({
    where: { id },
    include: {
      categories: { 
        select: {
          id: true,
          name: true
        }
      },
      barcodes: true,
    }
  });

  if (!product) throw new AppError('Produto não encontrado', 404);
  return product;
}
  // ─── Buscar por código de barras ───────────────────────────
  async getProductByBarcode(code: string) {
    const barcode = await this.db.productBarcode.findUnique({
      where: { code },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true } },
            barcodes: true,
          },
        },
      },
    });

    if (!barcode) throw new NotFoundError('Produto com esse código de barras');

    return barcode.product;
  }

  // ─── Criar produto ─────────────────────────────────────────
  async createProduct(input: CreateProductInput, imageBuffer?: Buffer) {
    // 1. Valida se todas as categorias enviadas existem (Opcional, mas seguro)
    if (input.category_ids && input.category_ids.length > 0) {
      await Promise.all(
        input.category_ids.map(id => this.ensureCategoryExists(id))
      );
    }

    // 2. Upload da imagem se houver buffer
    let imageUrl = input.image_url;
    if (imageBuffer) {
      imageUrl = await StorageService.uploadImage(imageBuffer, this.tenantDbName || 'default');
    }

    // 3. Criação no Prisma
    return this.db.product.create({
      data: {
        name: input.name,
        image_url: imageUrl,
        description: input.description,
        price: input.price,
        price_wholesale: input.price_wholesale,
        cost_price: input.cost_price,
        stock_qty: input.stock_qty,
        stock_min: input.stock_min,
        ncm: input.ncm,
        cfop: input.cfop,
        unit: input.unit,
        is_active: input.is_active,

        // Relacionamento M:N - Conecta as categorias enviadas
        categories: {
          connect: input.category_ids?.map((id: string) => ({ id })) || []
        },

        // Relacionamento 1:N - Cria os códigos de barras
        barcodes: {
          create: input.barcodes?.map((bc: any) => ({
            code: bc.code,
            unit: bc.unit || input.unit || 'UN'
          })) || []
        }
      },
      include: {
        categories: {
          select: { id: true, name: true }
        },
        barcodes: true,
      },
    });
  }

  // ─── Atualizar produto ─────────────────────────────────────
  async updateProduct(id: string, input: UpdateProductInput, newImageBuffer?: Buffer) {
    const existingProduct = await this.getProductById(id);

    // 1. Validação das categorias (Plural)
    if (input.category_ids?.length) {
      await Promise.all(
        input.category_ids.map(catId => this.ensureCategoryExists(catId))
      );
    }

    // 2. Lógica de Imagem
    let updatedImageUrl = existingProduct.image_url;

    if (newImageBuffer) {
      updatedImageUrl = await StorageService.uploadImage(newImageBuffer, this.tenantDbName || 'default');

      if (existingProduct.image_url) {
        // Tenta deletar a antiga, mas não trava o processo se falhar
        StorageService.deleteImage(existingProduct.image_url).catch(err =>
          console.error('Erro ao deletar imagem antiga:', err)
        );
      }
    }

    // 3. Extraímos category_ids e barcodes para tratar as relações separadamente
    // Isso evita que o Prisma tente salvar o array direto na coluna (o que daria erro)
    const { category_ids, barcodes, ...dataToUpdate } = input;

    return this.db.product.update({
      where: { id },
      data: {
        ...dataToUpdate,
        image_url: updatedImageUrl,

        // No update de M:N, usamos 'set' para substituir a lista antiga pela nova
        categories: category_ids ? {
          set: category_ids.map(catId => ({ id: catId }))
        } : undefined,

        // Opcional: Se você quiser atualizar os barcodes também
        // Aqui limpamos os antigos e criamos os novos (Wipe and Replace)
        barcodes: barcodes ? {
          deleteMany: {},
          create: barcodes.map(bc => ({
            code: bc.code,
            unit: bc.unit || input.unit || 'UN'
          }))
        } : undefined
      },
      include: {
        categories: { select: { id: true, name: true } }, // Plural aqui!
        barcodes: true,
      },
    });
  }

  // ─── Deletar produto ───────────────────────────────────────
  async deleteProduct(id: string) {
    const product = await this.getProductById(id);

    // Produto com pedidos vinculados não pode ser deletado
    // para preservar o histórico financeiro
    const linkedOrders = await this.db.orderItem.count({
      where: { product_id: id },
    });

    if (linkedOrders > 0) {
      throw new ConflictError(
        `Produto "${product.name}" possui ${linkedOrders} pedido(s) vinculado(s). ` +
        `Use "pausar" para deixá-lo indisponível sem perder o histórico.`
      );
    }

    if (product.image_url) {
    // Usamos o .catch() para que, se o bucket falhar (ex: imagem já não existia lá), 
    // a gente não impeça o produto de ser deletado do banco de dados.
    await StorageService.deleteImage(product.image_url).catch(err => {
      console.error(`⚠️ Aviso: Falha ao remover imagem do bucket para o produto ${id}:`, err);
    });
  }

    await this.db.product.delete({ where: { id } });

    return { message: `Produto "${product.name}" deletado com sucesso.` };
  }

  // ─── Pausar / Retomar produto ──────────────────────────────
  // Alternativa segura ao delete — mantém histórico de pedidos
  async pauseProduct(id: string) {
    const product = await this.getProductById(id);

    const updated = await this.db.product.update({
      where: { id },
      data: { is_active: !product.is_active },
    });

    return {
      ...updated,
      message: `Produto "${updated.name}" ${updated.is_active ? 'reativado' : 'pausado'} com sucesso.`,
    };
  }

  // ─── Movimentação de estoque ───────────────────────────────
  async updateStock(id: string, input: UpdateStockInput) {
    const product = await this.getProductById(id);
    const { operation, quantity } = input;

    let newQty: number;
    if (operation === 'IN') newQty = product.stock_qty + quantity;
    else if (operation === 'OUT') {
      newQty = product.stock_qty - quantity;
      if (newQty < 0) throw new ValidationError(`Estoque insuficiente.`);
    } else {
      newQty = quantity;
    }

    const updated = await this.db.product.update({
      where: { id },
      data: { stock_qty: newQty },
    });

    const isLowStock = updated.stock_qty < updated.stock_min;

    // 🔥 NOVO: Dispara alerta assíncrono pro dono da loja
    if (isLowStock && this.tenantDbName) {
      await whatsappQueue.add('low-stock-alert', {
        business_db_name: this.tenantDbName,
        product_name: updated.name,
        stock_qty: updated.stock_qty
      });
    }

    return {
      ...updated,
      low_stock_alert: isLowStock,
      message: `Estoque de "${updated.name}" atualizado para ${updated.stock_qty} ${updated.unit}.`,
    };
  }

  // ─── Verificar disponibilidade antes de confirmar pedido ───
  async checkAvailability(id: string, quantity: number) {
    const product = await this.getProductById(id);

    const available = product.is_active && product.stock_qty >= quantity;

    return {
      product_id: product.id,
      name: product.name,
      stock_qty: product.stock_qty,
      requested: quantity,
      available,
      message: available
        ? 'Produto disponível.'
        : !product.is_active
          ? 'Produto está pausado.'
          : `Estoque insuficiente. Disponível: ${product.stock_qty}.`,
    };
  }

  // ─── Listar produtos abaixo do estoque mínimo ─────────────
  async lowStockAlert() {
    const products = await this.db.product.findMany({
      where: { is_active: true },
      include: { categories: { select: { id: true, name: true } } },
    });

    // Filtra em memória os que estão abaixo do mínimo
    const lowStock = products.filter((p: any) => p.stock_qty < p.stock_min);

    return {
      total: lowStock.length,
      data: lowStock.sort((a: any, b: any) => a.stock_qty - b.stock_qty),
    };
  }


  // ─── Vincular código de barras ao produto ──────────────────
  async registerBarcode(productId: string, input: RegisterBarcodeInput) {
    await this.getProductById(productId);

    // Código de barras deve ser único em toda a base
    const existing = await this.db.productBarcode.findUnique({
      where: { code: input.code },
    });

    if (existing) {
      throw new ConflictError(`Código "${input.code}" já está vinculado a outro produto.`);
    }

    return this.db.productBarcode.create({
      data: {
        product_id: productId,
        code: input.code,
        unit: input.unit,
      },
    });
  }

  // ─── Remover código de barras ──────────────────────────────
  async removeBarcode(productId: string, barcodeId: string) {
    const barcode = await this.db.productBarcode.findFirst({
      where: { id: barcodeId, product_id: productId },
    });

    if (!barcode) throw new NotFoundError('Código de barras');

    await this.db.productBarcode.delete({ where: { id: barcodeId } });

    return { message: `Código "${barcode.code}" removido com sucesso.` };
  }

  // ─── Métodos privados ──────────────────────────────────────

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.db.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) throw new NotFoundError('Categoria');
  }
}