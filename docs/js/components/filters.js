/**
 * Barra de búsqueda, filtros de estado y filtros de fase.
 * Llama a onChange({ search, status, fase }) cuando el usuario interactúa.
 *
 * @param {HTMLElement} root
 * @param {(state: { search: string, status: string, fase: string }) => void} onChange
 */
export function renderFilters(root, onChange) {
  const statusFilters = [
    { key: 'all',             label: 'Todos' },
    { key: 'green',           label: '✓ Al día' },
    { key: 'amber',           label: '⚠ Pendientes' },
    { key: 'red',             label: '↑ Muy desactualizados' },
    { key: 'needs-release',   label: '⬡ Sin releases' },
    { key: 'gray',            label: '— Inactivos' },
  ];

  const faseFilters = [
    { key: 'all',    label: 'Todas las fases' },
    { key: 'raiz',   label: 'Raíz' },
    { key: 'tronco', label: 'Tronco' },
    { key: 'ramas',  label: 'Ramas' },
    { key: 'fruto',  label: 'Fruto' },
  ];

  let state = { search: '', status: 'all', fase: 'all' };

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
        <span class="filters-bar__fase-label">Fase:</span>
        ${faseBtns}
      </div>
    `;
  }

  function bind() {
    const input = root.querySelector('.filters-bar__search');
    input.addEventListener('input', e => {
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
    root.querySelectorAll('[data-filter-type="status"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.key === state.status);
    });
    root.querySelectorAll('[data-filter-type="fase"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.key === state.fase);
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
