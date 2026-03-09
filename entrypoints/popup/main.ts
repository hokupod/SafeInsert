import { mount } from 'svelte';

import PopupPage from '../../src/popup/PopupPage.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Popup root element not found');
}

mount(PopupPage, { target });
