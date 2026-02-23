/**
 * Barra de búsqueda y filtros.
 * Llama a onChange({ search, status }) cuando el usuario interactúa.
 *
 * @param {HTMLElement} root
 * @param {(state: { search: string, status: string }) => void} onChange
 */
export function renderFilters(root, onChange) {
  const filters = [
    { key: 'all',   label: 'Todos' },
    { key: 'green', label: '✓ Al día' },
    { key: 'amber', label: '⚠ Pendientes' },
    { key: 'red',   label: '↑ Muy desactualizados' },
    { key: 'gray',  label: '— Sin releases' },
  ];

  let state = { search: '', status: 'all' };

  function html() {
    const btns = filters.map(f => `
      <button
        class="filter-btn ${state.status === f.key ? 'active' : ''}"
        data-status="${f.key}"
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
        ${btns}
        <span class="filters-bar__count" id="visible-count"></span>
      </div>
    `;
  }

  function bind() {
    const input = root.querySelector('.filters-bar__search');
    input.addEventListener('input', e => {
      state = { ...state, search: e.target.value };
      onChange(state);
      updateActiveButtons();
    });

    root.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state = { ...state, status: btn.dataset.status };
        onChange(state);
        updateActiveButtons();
      });
    });
  }

  function updateActiveButtons() {
    root.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === state.status);
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
