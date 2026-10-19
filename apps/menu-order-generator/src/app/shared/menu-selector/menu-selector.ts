import { Component, input, output } from '@angular/core';
import type { Menu } from '@home-rpi/contracts';

@Component({
  selector: 'app-menu-selector',
  styleUrl: './menu-selector.scss',
  templateUrl: './menu-selector.html',
})
export class MenuSelector {
  readonly menus = input.required<readonly Menu[]>();
  readonly selectedId = input<string | null>(null);
  readonly menuSelected = output<string>();
}
