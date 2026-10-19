import { TestBed } from '@angular/core/testing';
import type { Menu } from '@home-rpi/contracts';
import { MenuSelector } from './menu-selector';

const menus: Menu[] = [
  { id: 'id-1', commerce: 'Pepezolano', products: [] },
  { id: 'id-2', commerce: 'El hediondito', products: [] },
];

describe('MenuSelector', () => {
  function setup(selectedId: string | null = null) {
    const fixture = TestBed.createComponent(MenuSelector);
    fixture.componentRef.setInput('menus', menus);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra commerce como etiqueta e id como valor', () => {
    const options = Array.from((setup().nativeElement as HTMLElement).querySelectorAll('option')).filter((o) => o.value);
    expect(options.map((o) => [o.textContent, o.value])).toEqual([
      ['Pepezolano', 'id-1'],
      ['El hediondito', 'id-2'],
    ]);
  });

  it('emite el id al cambiar la selección', () => {
    const fixture = setup();
    const emitted: string[] = [];
    fixture.componentInstance.menuSelected.subscribe((id) => emitted.push(id));
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    select.value = 'id-2';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual(['id-2']);
  });

  it('refleja el menú seleccionado', () => {
    const select = (setup('id-1').nativeElement as HTMLElement).querySelector('select')!;
    expect(select.value).toBe('id-1');
  });
});
