import { mount } from 'svelte';

import SidePanelPage from '../../src/sidepanel/SidePanelPage.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Side panel root element not found');
}

mount(SidePanelPage, {
  target
});
