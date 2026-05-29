    _renderAdminTareas() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        const materias = this.colegio.notas.materias;
        const bimestres = [1,2,3,4];
        this.tareasFiltro = { grado: null, materia: null };
        this.mainContent.innerHTML = `
            <h2 class="section-title">📚 Gestión de Tareas (Ciclo ${this.cicloActual})</h2>
            <div class="toolbar">
                <button class="btn btn-secondary" id="btnFiltrarTareas">🔍 Filtrar Tareas</button>
                <button class="btn btn-warning" id="btnMostrarTodasTareas">📋 Mostrar todas</button>
            </div>
            <div class="card"><h3>Crear Tarea</h3><div class="form-grid">
                <input id="titulo" placeholder="Título">
                <textarea id="descripcion" placeholder="Descripción"></textarea>
                <select id="materiaTarea">${materias.map(m=>`<option>${m}</option>`).join('')}</select>
                <select id="gradoTarea">${grados.map(g=>`<option>${g}</option>`).join('')}</select>
                <select id="bimestreTarea">${bimestres.map(b=>`<option value="${b}">Bimestre ${b}</option>`).join('')}</select>
                <input type="date" id="fechaEntrega">
                <input type="number" id="puntajeMaximo" placeholder="Puntaje máximo" value="10" step="0.01" min="0">
                <button class="btn btn-success" id="btnCrearTarea">➕ Crear</button>
            </div></div>
            <div class="card"><h3>Tareas Activas</h3><div id="listaTareas"></div></div>
        `;
        document.getElementById('btnFiltrarTareas').addEventListener('click', () => this._mostrarModalFiltroTareas());
        document.getElementById('btnMostrarTodasTareas').addEventListener('click', () => {
            this.tareasFiltro = { grado: null, materia: null };
            this._cargarListaTareas();
        });
        document.getElementById('btnCrearTarea').onclick = () => {
            let t = document.getElementById('titulo').value;
            let d = document.getElementById('descripcion').value;
            let m = document.getElementById('materiaTarea').value;
            let g = document.getElementById('gradoTarea').value;
            let bim = parseInt(document.getElementById('bimestreTarea').value);
            let f = document.getElementById('fechaEntrega').value;
            let puntaje = parseFloat(document.getElementById('puntajeMaximo').value);
            if (isNaN(puntaje)) puntaje = 10;
            if (t && d && m && g && bim && f) {
                this.colegio.crearTarea(t, d, m, g, this.cicloActual, bim, f, this.sesion.usuario?.nombreCompleto || 'Admin', puntaje);
                Swal.fire('Creada', 'Tarea asignada correctamente', 'success');
                document.getElementById('titulo').value = '';
                document.getElementById('descripcion').value = '';
                document.getElementById('fechaEntrega').value = '';
                document.getElementById('puntajeMaximo').value = '10';
                this._cargarListaTareas();
            } else Swal.fire('Error', 'Complete todos los campos', 'error');
        };
        this._cargarListaTareas();
    }
    
    _mostrarModalFiltroTareas() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        const materias = this.colegio.notas.materias;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:500px;">
                <div class="modal-header">
                    <h3>Filtrar Tareas</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div class="form-group"><label>Grado</label><select id="filtroGrado"><option value="">Todos</option>${grados.map(g=>`<option>${g}</option>`).join('')}</select></div>
                <div class="form-group"><label>Materia</label><select id="filtroMateria"><option value="">Todas</option>${materias.map(m=>`<option>${m}</option>`).join('')}</select></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary cerrar-modal">Cancelar</button>
                    <button class="btn btn-primary" id="btnAplicarFiltro">Aplicar filtro</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const closeModal = () => overlay.remove();
        overlay.querySelector('.btn-close-modal').addEventListener('click', closeModal);
        overlay.querySelector('.cerrar-modal').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        document.getElementById('btnAplicarFiltro').addEventListener('click', () => {
            const grado = document.getElementById('filtroGrado').value;
            const materia = document.getElementById('filtroMateria').value;
            this.tareasFiltro = { grado: grado || null, materia: materia || null };
            this._cargarListaTareas();
            closeModal();
        });
    }
    
    _cargarListaTareas() {
        let tareasFiltradas = this.colegio.tareas.filter(t => t.cicloEscolar === this.cicloActual);
        if (this.tareasFiltro.grado) tareasFiltradas = tareasFiltradas.filter(t => t.grado === this.tareasFiltro.grado);
        if (this.tareasFiltro.materia) tareasFiltradas = tareasFiltradas.filter(t => t.materia === this.tareasFiltro.materia);
        const container = document.getElementById('listaTareas');
        if (!container) return;
        container.innerHTML = tareasFiltradas.map(t => `
            <div style="border:1px solid #ddd; margin:10px; padding:10px;">
                <b>${t.titulo}</b> - ${t.materia} (${t.grado}) - Bimestre ${t.bimestre} - Puntaje máximo: ${t.puntajeMaximo}<br>
                ${t.descripcion}<br>
                📅 Entrega: ${t.fechaEntrega}<br>
                <button class="btn btn-sm btn-primary ver-entregas" data-id="${t.id}">📋 Ver Entregas</button>
                <button class="btn btn-sm btn-danger eliminar-tarea" data-id="${t.id}">🗑️ Eliminar</button>
            </div>
        `).join('');
        document.querySelectorAll('.eliminar-tarea').forEach(btn => btn.addEventListener('click', () => {
            this.colegio.eliminarTarea(parseInt(btn.dataset.id));
            this._cargarListaTareas();
        }));
        document.querySelectorAll('.ver-entregas').forEach(btn => btn.addEventListener('click', () => this._mostrarEntregas(parseInt(btn.dataset.id))));
    }
    
   _mostrarEntregas(tareaId) {
        const tarea = this.colegio.tareas.find(t => t.id === tareaId);
        const entregas = this.colegio.getEntregasPorTarea(tareaId);
        const alumnos = this.colegio.getAlumnosFiltrados(tarea.grado, this.cicloActual);
        const modal = document.getElementById('modalEntregas');
        const content = document.getElementById('entregasContent');

        let html = `
            <p><strong>${tarea.titulo}</strong> (${tarea.materia}, Bimestre ${tarea.bimestre}) - Puntaje máximo: ${tarea.puntajeMaximo}</p>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Alumno</th>
                            <th>Archivo</th>
                            <th>Calificación</th>
                            <th>Comentario</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>`;

        alumnos.forEach(alumno => {
            const entrega = entregas.find(e => e.alumnoId === alumno.id);
            html += `
                <tr data-alumno="${alumno.id}">
                    <td>${alumno.nombreCompleto}</td>
                    <td>
                        ${entrega ? `<a href="#" class="ver-pdf" data-data="${entrega.archivoData}" data-nombre="${entrega.archivoNombre}">📄 ${entrega.archivoNombre}</a>` : '<span class="text-muted">No entregado</span>'}
                    </td>
                    <td>
                        <input type="number" id="calf-${alumno.id}" 
                            value="${entrega ? (entrega.calificacion || '') : ''}" 
                            step="0.01" min="0" max="${tarea.puntajeMaximo}" 
                            class="form-control" style="width:80px;">
                    </td>
                    <td>
                        <input type="text" id="com-${alumno.id}" 
                            value="${entrega ? (entrega.comentario || '') : ''}" 
                            placeholder="Comentario" class="form-control">
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary calificar-btn" 
                            data-alumno="${alumno.id}" data-tarea="${tareaId}">
                            Guardar
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        content.innerHTML = html;

        document.querySelectorAll('.calificar-btn').forEach(btn => {
            btn.onclick = async () => {
                const alumnoId = parseInt(btn.dataset.alumno);
                const tId = parseInt(btn.dataset.tarea);
                const calificacion = parseFloat(document.getElementById(`calf-${alumnoId}`).value);
                const comentario = document.getElementById(`com-${alumnoId}`).value;

                const entregaExistente = this.colegio.entregas.find(e => e.tareaId === tId && e.alumnoId === alumnoId);

                if (entregaExistente) {
                    this.colegio.calificarEntrega(entregaExistente.id, calificacion, comentario);
                    Swal.fire('Calificación guardada', '', 'success');
                    this._mostrarEntregas(tareaId);
                } else {
                    Swal.fire('Error', 'El alumno aún no ha entregado la tarea', 'error');
                }
            };
        });

        document.querySelectorAll('.ver-pdf').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                const data = link.dataset.data;
                const binary = atob(data);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array], { type: 'application/pdf' });
                window.open(URL.createObjectURL(blob));
            };
        });

        modal.style.display = 'flex';
        document.getElementById('btnCerrarModalEntregas').onclick = () => modal.style.display = 'none';
        modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    }
