import { TestBed } from '@angular/core/testing';
import { ShareService } from './share.service';


describe('ShareService', () => {
  let service: ShareService;

  beforeEach(() => {
    service = TestBed.inject(ShareService);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse') }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('usa navigator.share en táctil', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    expect(await service.share('texto', 'titulo')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'titulo', text: 'texto' });
  });

  it('cancelar el diálogo devuelve cancelled', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')) });
    expect(await service.share('t', 't')).toBe('cancelled');
  });

  it('sin Web Share copia con la Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await service.share('texto', 't')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('texto');
  });

  it('sin Clipboard API usa execCommand si el navegador lo confirma', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn().mockReturnValue(true);
    expect(await service.share('t', 't')).toBe('copied');
  });

  it('devuelve failed si todo falla', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn().mockReturnValue(false);
    expect(await service.share('t', 't')).toBe('failed');
  });
});
