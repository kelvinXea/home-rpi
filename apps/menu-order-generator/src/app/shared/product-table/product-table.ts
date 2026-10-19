import { Component, input, output } from '@angular/core';
import type { MenuProduct } from '@home-rpi/contracts';

export interface QuantityChange {
  index: number;
  delta: 1 | -1;
}

@Component({
  selector: 'app-product-table',
  styleUrl: './product-table.scss',
  templateUrl: './product-table.html',
})
export class ProductTable {
  readonly products = input.required<readonly MenuProduct[]>();
  readonly quantities = input.required<readonly number[]>();
  readonly formatPrice = input.required<(value: number) => string>();
  readonly quantityChange = output<QuantityChange>();
}
