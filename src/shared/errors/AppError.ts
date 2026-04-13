export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

// ── Erros específicos prontos para usar ───────────────────

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} não encontrado.`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(resource = 'Registro') {
    super(`${resource} já existe.`, 409, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos.') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UpgradeRequiredError extends AppError {
  public readonly feature: string;

  constructor(feature: string) {
    super(
      `Seu plano não inclui acesso a "${feature}". Faça upgrade para continuar.`,
      403,
      'UPGRADE_REQUIRED'
    );
    this.feature = feature;
  }
}