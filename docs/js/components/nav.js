/**
 * Barra de navegación principal con tabs.
 */
export function renderNav(root, activeTab, onChange) {
  const tabs = [
    { key: 'resumen',      label: 'Resumen' },
    { key: 'repos',        label: 'Repositorios' },
    { key: 'equipo',       label: 'Equipo' },
    { key: 'deployments',  label: 'Deployments' },
  ];

  root.innerHTML = tabs.map(t => `
    <button class="nav-tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
      ${t.label}
    </button>
  `).join('');

  root.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => onChange(btn.dataset.tab));
  });

  return {
    setActive(tab) {
      root.querySelectorAll('[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
    },
  };
}
