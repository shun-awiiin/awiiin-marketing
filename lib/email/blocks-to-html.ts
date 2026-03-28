/**
 * Converts email editor blocks to email-client-compatible HTML.
 * Uses table-based layout and inline styles for maximum compatibility.
 */

import type {
  EmailBlock,
  EmailEditorSettings,
  HeaderBlockContent,
  TextBlockContent,
  ImageBlockContent,
  ButtonBlockContent,
  DividerBlockContent,
  SpacerBlockContent,
  ColumnsBlockContent,
} from '@/lib/types/email-editor';
import { DEFAULT_EDITOR_SETTINGS } from '@/lib/types/email-editor';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function preserveVariables(html: string): string {
  // Restore {{variable}} placeholders that were escaped
  return html.replace(/\{\{(\w+)\}\}/g, '{{$1}}');
}

function renderHeaderBlock(block: EmailBlock): string {
  const c = block.content as unknown as HeaderBlockContent;
  const fontSize = c.level === 'h1' ? '28px' : c.level === 'h2' ? '22px' : '18px';
  const text = preserveVariables(escapeHtml(c.text));

  return `<tr>
  <td style="padding: 16px 24px; text-align: ${c.align};">
    <${c.level} style="margin: 0; font-size: ${fontSize}; font-weight: 700; color: #1f2937; line-height: 1.3;">
      ${text}
    </${c.level}>
  </td>
</tr>`;
}

function renderTextBlock(block: EmailBlock): string {
  const c = block.content as unknown as TextBlockContent;
  const text = preserveVariables(escapeHtml(c.text)).replace(/\n/g, '<br>');

  return `<tr>
  <td style="padding: 8px 24px; text-align: ${c.align}; font-size: 16px; line-height: 1.6; color: #374151;">
    ${text}
  </td>
</tr>`;
}

function renderImageBlock(block: EmailBlock): string {
  const c = block.content as unknown as ImageBlockContent;
  if (!c.src) return '';

  const width = c.width || '100%';
  const alt = escapeHtml(c.alt);
  const imgTag = `<img src="${escapeHtml(c.src)}" alt="${alt}" width="${width}" style="display: block; max-width: 100%; height: auto; border: 0;" />`;
  const wrapped = c.link
    ? `<a href="${escapeHtml(c.link)}" target="_blank" style="text-decoration: none;">${imgTag}</a>`
    : imgTag;

  return `<tr>
  <td style="padding: 8px 24px; text-align: center;">
    ${wrapped}
  </td>
</tr>`;
}

function renderButtonBlock(block: EmailBlock): string {
  const c = block.content as unknown as ButtonBlockContent;
  const text = preserveVariables(escapeHtml(c.text));
  const url = escapeHtml(c.url || '#');

  return `<tr>
  <td style="padding: 16px 24px; text-align: ${c.align};">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" fillcolor="${c.backgroundColor}">
      <center style="color:${c.textColor};font-family:sans-serif;font-size:16px;font-weight:bold;">${text}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 32px; background-color: ${c.backgroundColor}; color: ${c.textColor}; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: ${c.borderRadius}; mso-hide: all;">
      ${text}
    </a>
    <!--<![endif]-->
  </td>
</tr>`;
}

function renderDividerBlock(block: EmailBlock): string {
  const c = block.content as unknown as DividerBlockContent;

  return `<tr>
  <td style="padding: 8px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="border-top: ${c.thickness}px solid ${c.color}; font-size: 0; line-height: 0;">&nbsp;</td>
      </tr>
    </table>
  </td>
</tr>`;
}

function renderSpacerBlock(block: EmailBlock): string {
  const c = block.content as unknown as SpacerBlockContent;

  return `<tr>
  <td style="padding: 0; height: ${c.height}px; font-size: 0; line-height: 0;">&nbsp;</td>
</tr>`;
}

function renderColumnsBlock(block: EmailBlock): string {
  const c = block.content as unknown as ColumnsBlockContent;
  const left = preserveVariables(escapeHtml(c.left)).replace(/\n/g, '<br>');
  const right = preserveVariables(escapeHtml(c.right)).replace(/\n/g, '<br>');

  return `<tr>
  <td style="padding: 8px 24px;">
    <!--[if mso]>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="50%" valign="top">
    <![endif]-->
    <div style="display: inline-block; width: 100%; max-width: 272px; vertical-align: top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 8px; font-size: 15px; line-height: 1.5; color: #374151;">${left}</td>
        </tr>
      </table>
    </div>
    <!--[if mso]>
        </td>
        <td width="50%" valign="top">
    <![endif]-->
    <div style="display: inline-block; width: 100%; max-width: 272px; vertical-align: top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 8px; font-size: 15px; line-height: 1.5; color: #374151;">${right}</td>
        </tr>
      </table>
    </div>
    <!--[if mso]>
        </td>
      </tr>
    </table>
    <![endif]-->
  </td>
</tr>`;
}

const BLOCK_RENDERERS: Record<string, (block: EmailBlock) => string> = {
  header: renderHeaderBlock,
  text: renderTextBlock,
  image: renderImageBlock,
  button: renderButtonBlock,
  divider: renderDividerBlock,
  spacer: renderSpacerBlock,
  columns: renderColumnsBlock,
};

export function renderBlockToHtml(block: EmailBlock): string {
  const renderer = BLOCK_RENDERERS[block.type];
  if (!renderer) return '';
  return renderer(block);
}

export function blocksToHtml(
  blocks: EmailBlock[],
  settings: EmailEditorSettings = DEFAULT_EDITOR_SETTINGS
): string {
  const contentWidth = settings.contentWidth || '600';
  const bgColor = settings.backgroundColor || '#f4f4f4';
  const fontFamily = settings.fontFamily || "'Helvetica Neue', Arial, sans-serif";

  const blockRows = blocks.map(renderBlockToHtml).filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="ja" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title></title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td { font-family: ${fontFamily}; }
    img { -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${bgColor}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${bgColor};">
    <tr>
      <td align="center" style="padding: 24px 0;">
        <!--[if mso]>
        <table role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
        <![endif]-->
        <table class="email-container" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: ${contentWidth}px; background-color: #ffffff; border-radius: 8px;">
${blockRows}
          <tr>
            <td style="padding: 24px; text-align: center; font-size: 12px; color: #9ca3af;">
              <a href="{{unsubscribe_url}}" style="color: #9ca3af; text-decoration: underline;">配信停止</a>
            </td>
          </tr>
        </table>
        <!--[if mso]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
