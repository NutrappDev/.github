/**
 * Barra de búsqueda, filtros de estado, fase y equipo.
 * Llama a onChange({ search, status, fase, team }) cuando el usuario interactúa.
 *
 * @param {HTMLElement} root
 * @param {(state: { search: string, status: string, fase: string, team: string }) => void} onChange
 */
export function renderFilters(root, onChange) {
  const statusFilters = [
    { key: 'all',       label: 'Todos' },
    { key: 'green',     label: '✓ Al día' },
    { key: 'pending',   label: '⚠ Actualización pendiente' },
    { key: 'migrating', label: '◈ En migración' },
    { key: 'gray',      label: '— Inactivos' },
  ];

  const faseFilters = [
    { key: 'all',    label: 'Todos los tipos' },
    { key: 'raiz',   label: 'Raíz' },
    { key: 'tronco', label: 'Tronco' },
    { key: 'ramas',  label: 'Ramas' },
    { key: 'fruto',  label: 'Fruto' },
  ];

  const teamFilters = [
    { key: 'all',     label: 'Todos los equipos' },
    { key: 'roble',   label: 'Roble' },
    { key: 'sakura',  label: 'Sakura' },
    { key: 'manglar', label: 'Manglar' },
  ];

  let state = { search: '', status: 'all', fase: 'all', team: 'all' };

  function html() {
    const statusBtns = statusFilters.map(f => `
      <button
        class="filter-btn ${state.status === f.key ? 'active' : ''}"
        data-filter-type="status"
        data-key="${f.key}"
      >${f.label}</button>
    `).join('');

    const faseBtns = faseFilters.map(f => `
      <button
        class="filter-btn filter-btn--fase ${state.fase === f.key ? 'active' : ''}"
        data-filter-type="fase"
        data-key="${f.key}"
      >${f.label}</button>
    `).join('');

    const teamBtns = teamFilters.map(f => `
      <button
        class="filter-btn filter-btn--team ${state.team === f.key ? 'active' : ''}"
        data-filter-type="team"
        data-key="${f.key}"
      >${f.label}</button>
    `).join('');

    return `
      <div class="filters-bar">
        <input
          class="filters-bar__search"
          type="search"
          placeholder="Buscar repositorio…"
          value="${state.search}"
          aria-label="Buscar repositorio"
        />
        ${statusBtns}
        <span class="filters-bar__count" id="visible-count"></span>
      </div>
      <div class="filters-bar filters-bar--fase">
        <span class="filters-bar__label">Tipo:</span>
        ${faseBtns}
      </div>
      <div class="filters-bar filters-bar--team">
        <span class="filters-bar__label">Equipo:</span>
        ${teamBtns}
      </div>
    `;
  }

  function bind() {
    root.querySelector('.filters-bar__search').addEventListener('input', e => {
      state = { ...state, search: e.target.value };
      onChange(state);
    });

    root.querySelectorAll('[data-filter-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.filterType;
        state = { ...state, [type]: btn.dataset.key };
        onChange(state);
        updateActiveButtons();
      });
    });
  }

  function updateActiveButtons() {
    ['status', 'fase', 'team'].forEach(type => {
      root.querySelectorAll(`[data-filter-type="${type}"]`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.key === state[type]);
      });
    });
  }

  root.innerHTML = html();
  bind();

  return {
    /** Actualiza el contador de resultados visibles */
    setCount(n, total) {
      const el = root.querySelector('#visible-count');
      if (el) el.textContent = n < total ? `${n} de ${total}` : `${total} repositorios`;
    },
  };
}
