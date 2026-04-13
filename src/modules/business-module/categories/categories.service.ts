import type { BusinessClient } from '../../../database/business-manager';
import { NotFoundError, ConflictError } from '../../../shared/errors/AppError';
import type { CreateCategoryInput, UpdateCategoryInput, ListCategoriesInput } from './categories.schema';

// ─────────────────────────────────────────────────────────────
// SERVICE — Categories
//
// Toda lógica de negócio fica aqui.
// O controller apenas valida os dados e chama o service.
// O service nunca conhece req/reply — apenas dados e erros.
// ─────────────────────────────────────────────────────────────

export class CategoriesService {
  constructor(private readonly db: BusinessClient) {}

  // ─── Listar com filtros e paginação ───────────────────────
  async list(input: ListCategoriesInput) {
    const { name, is_active, page, limit } = input;
    const skip = (page - 1) * limit;

    // Monta o filtro dinamicamente — só inclui o campo se foi enviado
    const where = {
      ...(name      !== undefined && { name: { contains: name, mode: 'insensitive' as const } }),
      ...(is_active !== undefined && { is_active }),
    };

    // Busca dados e total em paralelo para melhor performance
    const [categories, total] = await Promise.all([
      this.db.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          // Retorna a contagem de produtos por categoria
          // Útil para o front exibir badge de quantidade
          _count: { select: { products: true } },
        },
      }),
      this.db.category.count({ where }),
    ]);

    return {
      data: categories,
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
  async findById(id: string) {
    const category = await this.db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) throw new NotFoundError('Categoria');

    return category;
  }

  // ─── Criar ────────────────────────────────────────────────
  async create(input: CreateCategoryInput) {
    // Usa o slug enviado ou gera automaticamente a partir do nome
    const slug = input.slug ?? this.generateSlug(input.name);

    // Slug é o identificador único — não pode duplicar
    await this.ensureSlugAvailable(slug);

    return this.db.category.create({
      data: {
        name:      input.name,
        slug,
        is_active: input.is_active,
      },
    });
  }

  // ─── Atualizar ────────────────────────────────────────────
  async update(id: string, input: UpdateCategoryInput) {
    // Garante que a categoria existe antes de atualizar
    await this.findById(id);

    // Regera slug somente se o nome mudou e slug não foi enviado explicitamente
    const slug = input.slug
      ? input.slug
      : input.name
        ? this.generateSlug(input.name)
        : undefined;

    // Verifica conflito de slug com OUTRA categoria (exclui ela mesma)
    if (slug) await this.ensureSlugAvailable(slug, id);

    return this.db.category.update({
      where: { id },
      data: {
        ...(input.name      !== undefined && { name: input.name }),
        ...(slug            !== undefined && { slug }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      },
    });
  }

  // ─── Deletar ──────────────────────────────────────────────
  async delete(id: string) {
    const category = await this.findById(id);

    // Regra de negócio: categoria com produtos vinculados não pode ser deletada.
    // O operador precisa mover ou remover os produtos antes.
    const linkedProducts = await this.db.product.count({
      where: { category_id: id },
    });

    if (linkedProducts > 0) {
      throw new ConflictError(
        `Não é possível deletar "${category.name}" pois ela possui ` +
        `${linkedProducts} produto(s) vinculado(s). Mova ou remova os produtos antes.`
      );
    }

    await this.db.category.delete({ where: { id } });

    return { message: `Categoria "${category.name}" deletada com sucesso.` };
  }

  // ─── Ativar / Desativar ───────────────────────────────────
  async toggle(id: string) {
    const category = await this.findById(id);

    const updated = await this.db.category.update({
      where: { id },
      data: { is_active: !category.is_active },
    });

    return {
      ...updated,
      message: `Categoria "${updated.name}" ${updated.is_active ? 'ativada' : 'desativada'} com sucesso.`,
    };
  }

  // ─── Métodos privados ──────────────────────────────────────

  /**
   * Converte um nome legível em slug URL-safe.
   * @example "Frios e Laticínios" → "frios-e-laticinios"
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')                 // separa letra + acento
      .replace(/[\u0300-\u036f]/g, '')  // remove acentos
      .replace(/[^a-z0-9\s-]/g, '')    // remove caracteres especiais
      .trim()
      .replace(/\s+/g, '-');           // espaços → hífens
  }

  /**
   * Verifica se um slug já está em uso por outra categoria.
   * Lança ConflictError se estiver duplicado.
   *
   * @param excludeId — ao atualizar, ignora o próprio registro
   */
  private async ensureSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.db.category.findFirst({
      where: {
        slug,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
    });

    if (existing) throw new ConflictError('Já existe uma categoria com esse nome.');
  }
}