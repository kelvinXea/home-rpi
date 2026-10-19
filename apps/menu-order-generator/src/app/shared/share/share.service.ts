import { Service } from '@angular/core';

export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'failed';

@Service()
export class ShareService {
  /**
   * Móvil (puntero táctil) con Web Share → hoja de compartir; en caso contrario, portapapeles.
   * Nunca devuelve `shared`/`copied` antes de que la API correspondiente haya resuelto.
   */
  async share(text: string, title: string): Promise<ShareResult> {
    if (this.prefersNativeShare()) {
      try {
        await navigator.share({ title, text });
        return 'shared';
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
        // otro error (p. ej. NotAllowedError): se intenta el portapapeles
      }
    }
    return this.copy(text);
  }

  private prefersNativeShare(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    if (navigator.canShare && !navigator.canShare({ text: ' ' })) return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }

  private async copy(text: string): Promise<ShareResult> {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Sin contexto seguro (p. ej. HTTP en la LAN) `navigator.clipboard` no existe.
      return this.legacyCopy(text) ? 'copied' : 'failed';
    }
  }

  /** Alternativa con `execCommand`; solo cuenta como éxito si el navegador lo confirma. */
  private legacyCopy(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    try {
      textarea.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
}
