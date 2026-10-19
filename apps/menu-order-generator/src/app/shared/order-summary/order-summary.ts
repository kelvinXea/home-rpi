import { Component, input, output } from '@angular/core';
import type { OrderLine } from '../order/order';

@Component({
  selector: 'app-order-summary',
  styleUrl: './order-summary.scss',
  templateUrl: './order-summary.html',
})
export class OrderSummary {
  readonly lines = input.required<readonly OrderLine[]>();
  readonly total = input.required<number>();
  readonly formatPrice = input.required<(value: number) => string>();
  readonly share = output<void>();
}
