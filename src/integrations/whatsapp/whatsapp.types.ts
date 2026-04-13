// ─────────────────────────────────────────────────────────────
// TIPAGENS — Meta Cloud API
// ─────────────────────────────────────────────────────────────

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
    image?: { link: string };
    // ... outros tipos podem ser adicionados conforme necessidade
  }>;
}

export interface InteractiveRow {
  id: string;          // Máximo 200 caracteres
  title: string;       // Máximo 24 caracteres
  description?: string; // Máximo 72 caracteres
}

export interface InteractiveSection {
  title?: string;      // Título da seção (opcional)
  rows: InteractiveRow[];
}

export interface InteractiveButton {
  id: string;    // ID de payload para o Webhook ler quando clicado
  title: string; // Máximo 20 caracteres
}