export type EmailBlockType =
  | 'header'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'columns';

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  content: Record<string, unknown>;
  style?: Record<string, string>;
}

export interface HeaderBlockContent {
  text: string;
  level: 'h1' | 'h2' | 'h3';
  align: 'left' | 'center' | 'right';
}

export interface TextBlockContent {
  text: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageBlockContent {
  src: string;
  alt: string;
  link?: string;
  width?: string;
}

export interface ButtonBlockContent {
  text: string;
  url: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
  align: 'left' | 'center' | 'right';
}

export interface DividerBlockContent {
  color: string;
  thickness: string;
}

export interface SpacerBlockContent {
  height: string;
}

export interface ColumnsBlockContent {
  left: string;
  right: string;
}

export interface EmailEditorSettings {
  backgroundColor: string;
  contentWidth: string;
  fontFamily: string;
}

export const DEFAULT_EDITOR_SETTINGS: EmailEditorSettings = {
  backgroundColor: '#f4f4f4',
  contentWidth: '600',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
};

export function createDefaultBlock(type: EmailBlockType): EmailBlock {
  const id = crypto.randomUUID();

  const defaults: Record<EmailBlockType, Record<string, unknown>> = {
    header: {
      text: '見出しテキスト',
      level: 'h1',
      align: 'center',
    } satisfies HeaderBlockContent,
    text: {
      text: '本文テキストをここに入力してください。',
      align: 'left',
    } satisfies TextBlockContent,
    image: {
      src: '',
      alt: '',
      link: '',
      width: '100%',
    } satisfies ImageBlockContent,
    button: {
      text: '詳しくはこちら',
      url: '',
      backgroundColor: '#4F46E5',
      textColor: '#ffffff',
      borderRadius: '6px',
      align: 'center',
    } satisfies ButtonBlockContent,
    divider: {
      color: '#e5e7eb',
      thickness: '1',
    } satisfies DividerBlockContent,
    spacer: {
      height: '24',
    } satisfies SpacerBlockContent,
    columns: {
      left: '左カラムのテキスト',
      right: '右カラムのテキスト',
    } satisfies ColumnsBlockContent,
  };

  return { id, type, content: defaults[type] };
}
