import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/errors/AppError';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsInput,
  UpdateStockInput,
  RegisterBarcodeInput,
} from './products.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Products
//
// Regras de negócio do catálogo, estoque e códigos de barras.
// ─────────────────────────────────────────────────────────────

export class ProductsService {
  constructor(private readonly db: BusinessClient) {}

  // ─── Listar com filtros e paginação ───────────────────────
 async listProducts(input: ListProductsInput) {
  const { name, category_id, is_active, low_stock, page, limit } = input;
  const skip = (page - 1) * limit;

  const where = {
    ...(name        && { name: { contains: name, mode: 'insensitive' as const } }),
    ...(category_id && { category_id }),
    ...(is_active   !== undefined && { is_active }),
    // low_stock é tratado após a busca — Prisma não compara dois campos na mesma query
  };

  let products = await this.db.product.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      category: { select: { id: true, name: true } },
      barcodes:  true,
    },
  });

  // Filtra em memória os produtos abaixo do estoque mínimo
  if (low_stock) {
    products = products.filter(p => p.stock_qty < p.stock_min);
  }

  // Paginação manual após o filtro em memória
  const total      = products.length;
  const paginated  = products.slice(skip, skip + limit);

  return {
    data: paginated,
    meta: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      has_next:    page * limit < total,
      has_prev:    page > 1,
    },
  };
}

  // ─── Buscar por ID ─────────────────────────────────────────
  async getProductById(id: string) {
    const product = await this.db.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        barcodes:  true,
      },
    });

    if (!product) throw new NotFoundError('Produto');

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
            barcodes:  true,
          },
        },
      },
    });

    if (!barcode) throw new NotFoundError('Produto com esse código de barras');

    return barcode.product;
  }

  // ─── Criar produto ─────────────────────────────────────────
  async createProduct(input: CreateProductInput) {
    // Valida se a categoria existe antes de vincular
    if (input.category_id) {
      await this.ensureCategoryExists(input.category_id);
    }

    return this.db.product.create({
      data: {
        category_id:     input.category_id,
        name:            input.name,
        description:     input.description,
        price:           input.price,
        price_wholesale: input.price_wholesale,
        cost_price:      input.cost_price,
        stock_qty:       input.stock_qty,
        stock_min:       input.stock_min,
        ncm:             input.ncm,
        cfop:            input.cfop,
        unit:            input.unit,
        is_active:       input.is_active,
      },
      include: {
        category: { select: { id: true, name: true } },
        barcodes:  true,
      },
    });
  }

  // ─── Atualizar produto ─────────────────────────────────────
  async updateProduct(id: string, input: UpdateProductInput) {
    await this.getProductById(id);

    if (input.category_id) {
      await this.ensureCategoryExists(input.category_id);
    }

    return this.db.product.update({
      where: { id },
      data:  input,
      include: {
        category: { select: { id: true, name: true } },
        barcodes:  true,
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

    await this.db.product.delete({ where: { id } });

    return { message: `Produto "${product.name}" deletado com sucesso.` };
  }

  // ─── Pausar / Retomar produto ──────────────────────────────
  // Alternativa segura ao delete — mantém histórico de pedidos
  async pauseProduct(id: string) {
    const product = await this.getProductById(id);

    const updated = await this.db.product.update({
      where: { id },
      data:  { is_active: !product.is_active },
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

    if (operation === 'IN') {
      // Entrada: soma ao estoque atual
      newQty = product.stock_qty + quantity;

    } else if (operation === 'OUT') {
      // Saída: subtrai do estoque atual
      newQty = product.stock_qty - quantity;

      // Não permite estoque negativo
      if (newQty < 0) {
        throw new ValidationError(
          `Estoque insuficiente. Disponível: ${product.stock_qty}, solicitado: ${quantity}.`
        );
      }

    } else {
      // Ajuste: substitui o valor atual pelo informado
      newQty = quantity;
    }

    const updated = await this.db.product.update({
      where: { id },
      data:  { stock_qty: newQty },
    });

    // Dispara alerta se estoque ficou abaixo do mínimo
    const isLowStock = updated.stock_qty < updated.stock_min;

    return {
      ...updated,
      low_stock_alert: isLowStock,
      message: isLowStock
        ? `⚠️ Estoque de "${updated.name}" está abaixo do mínimo (${updated.stock_qty}/${updated.stock_min}).`
        : `Estoque de "${updated.name}" atualizado para ${updated.stock_qty} ${updated.unit}.`,
    };
  }

  // ─── Verificar disponibilidade antes de confirmar pedido ───
  async checkAvailability(id: string, quantity: number) {
    const product = await this.getProductById(id);

    const available = product.is_active && product.stock_qty >= quantity;

    return {
      product_id:  product.id,
      name:        product.name,
      stock_qty:   product.stock_qty,
      requested:   quantity,
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
    where:   { is_active: true },
    include: { category: { select: { id: true, name: true } } },
  });

  // Filtra em memória os que estão abaixo do mínimo
  const lowStock = products.filter(p => p.stock_qty < p.stock_min);

  return {
    total: lowStock.length,
    data:  lowStock.sort((a, b) => a.stock_qty - b.stock_qty),
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
        code:       input.code,
        unit:       input.unit,
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