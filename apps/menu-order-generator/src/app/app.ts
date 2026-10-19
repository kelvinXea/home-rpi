import { Component } from '@angular/core';
import { MenuOrderPage } from './menu-order/menu-order-page';

@Component({
  imports: [MenuOrderPage],
  selector: 'app-root',
  template: '<app-menu-order-page />',
})
export class App {}
