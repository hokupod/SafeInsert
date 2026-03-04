import { mount } from 'svelte';

import OptionsPage from '../../src/options/OptionsPage.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Options root element not found');
}

mount(OptionsPage, {
  target
});
