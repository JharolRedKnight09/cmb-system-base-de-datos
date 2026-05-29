    _mostrarModalRegistroMaestro() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:500px;">
                <div class="modal-header">
                    <h3>Registrar Nuevo Maestro</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div class="form-group"><label>Usuario</label><input type="text" id="regUsuario"></div>
                <div class="form-group"><label>Contraseña</label><input type="password" id="regPassword"></div>
                <div class="form-group"><label>Nombre</label><input type="text" id="regNombre"></div>
                <div class="form-group"><label>Apellidos</label><input type="text" id="regApellidos"></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary cerrar-modal">Cancelar</button>
                    <button class="btn btn-primary" id="btnGuardarMaestro">Guardar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.btn-close-modal').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.cerrar-modal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.getElementById('btnGuardarMaestro').addEventListener('click', async () => {
            const usuario = document.getElementById('regUsuario').value.trim();
            const password = document.getElementById('regPassword').value.trim();
            const nombre = document.getElementById('regNombre').value.trim();
            const apellidos = document.getElementById('regApellidos').value.trim();

            if (!usuario || !password || !nombre || !apellidos) {
                return Swal.fire('Error', 'Todos los campos son obligatorios.', 'error');
            }

            const maestro = this.colegio.agregarMaestro(usuario, password, nombre, apellidos);
            if (maestro) {
                overlay.remove();
                Swal.fire('Registrado', 'Maestro creado con éxito.', 'success');
                this._renderGestionMaestros(); 
            } else {
                Swal.fire('Error', 'El usuario ya existe.', 'error');
            }
        });
    }

    _abrirModalAsignacion(idMaestro) {
        const maestro = this.colegio.maestros.find(m => m.id === idMaestro);
        if (!maestro) return;

        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        const materias = this.colegio.notas.materias;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';

        let tablaHTML = '<table class="table-container"><thead><tr><th>Grado</th>';
        materias.forEach(mat => tablaHTML += `<th>${mat}</th>`);
        tablaHTML += '</tr></thead><tbody>';

        grados.forEach(grado => {
            tablaHTML += `<tr><td>${grado}</td>`;
            materias.forEach(mat => {
                const checked = maestro.asignaciones[grado] && maestro.asignaciones[grado].includes(mat) ? 'checked' : '';
                tablaHTML += `<td style="text-align:center;"><input type="checkbox" class="chk-asignar" data-grado="${grado}" data-materia="${mat}" ${checked}></td>`;
            });
            tablaHTML += '</tr>';
        });
        tablaHTML += '</tbody></table>';

        overlay.innerHTML = `
            <div class="modal-card" style="max-width:900px; width:95%;">
                <div class="modal-header">
                    <h3>Asignar grados y materias - ${maestro.nombreCompleto}</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div style="max-height:60vh; overflow:auto;">
                    ${tablaHTML}
                </div>
                <div class="modal-footer" style="margin-top:15px;">
                    <button class="btn btn-secondary cerrar-modal">Cancelar</button>
                    <button class="btn btn-primary" id="btnGuardarAsignacion">Guardar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.btn-close-modal').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.cerrar-modal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.getElementById('btnGuardarAsignacion').addEventListener('click', () => {
            const asignaciones = {};
            overlay.querySelectorAll('.chk-asignar:checked').forEach(cb => {
                const grado = cb.dataset.grado;
                const materia = cb.dataset.materia;
                if (!asignaciones[grado]) asignaciones[grado] = [];
                asignaciones[grado].push(materia);
            });
            maestro.asignaciones = asignaciones;
            this.colegio.guardarMaestros();
            overlay.remove();
            this._renderGestionMaestros();
        });
    }

  _renderSubirEvidencia() {
        if (!this.sesion.esMaestro) { Swal.fire('Acceso denegado', 'Solo los maestros pueden subir evidencias.', 'error'); return; }
        const maestro = this.sesion.usuario;
        const evidencias = this.colegio.getEvidenciasPorMaestro(maestro.id);
        this.mainContent.innerHTML = `<h2 class="section-title">📎 Subir Evidencia de Control de Zona</h2><div class="card"><h3>📤 Subir nuevo archivo Excel</h3><div class="form-group"><label>Archivo Excel (.xlsx, .xls)</label><input type="file" id="fileEvidencia" accept=".xlsx,.xls"></div><div class="form-group"><label>Comentario (opcional)</label><textarea id="comentarioEvidencia" rows="2" placeholder="Ej: Control de zona unidad 1, parcial 1..."></textarea></div><button class="btn btn-success" id="btnSubirEvidencia">📤 Subir archivo</button></div><div class="card"><h3>📁 Mis evidencias subidas</h3><div id="listaEvidenciasMaestro" class="table-container">${this._generarListaEvidencias(evidencias)}</div></div>`;
        document.getElementById('btnSubirEvidencia').onclick = () => {
            const fileInput = document.getElementById('fileEvidencia');
            const comentario = document.getElementById('comentarioEvidencia').value.trim();
            if (!fileInput.files.length) return Swal.fire('Error', 'Seleccione un archivo Excel', 'error');
            const file = fileInput.files[0];
            if (!file.name.match(/\.(xlsx|xls)$/i)) return Swal.fire('Error', 'Solo se permiten archivos Excel (.xlsx, .xls)', 'error');
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                this.colegio.subirEvidenciaDocente(maestro.id, file.name, base64, comentario);
                Swal.fire('Subido', 'Archivo guardado como evidencia', 'success');
                this._renderSubirEvidencia();
            };
            reader.readAsDataURL(file);
        };
        document.querySelectorAll('.ver-evidencia').forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); const data = link.dataset.data; const binary = atob(data); const array = new Uint8Array(binary.length); for(let i=0;i<binary.length;i++) array[i]=binary.charCodeAt(i); const blob = new Blob([array], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); window.open(URL.createObjectURL(blob)); }));
        document.querySelectorAll('.eliminar-evidencia').forEach(btn => btn.addEventListener('click', async () => { const id = parseInt(btn.dataset.id); const confirm = await Swal.fire({title:'¿Eliminar?', text:'No se puede deshacer', icon:'warning', showCancelButton:true}); if(confirm.isConfirmed) { this.colegio.eliminarEvidenciaDocente(id); this._renderSubirEvidencia(); } }));
    }

    _generarListaEvidencias(evidencias) {
        if (!evidencias.length) return '<p>No ha subido ninguna evidencia aún.</p>';
        return `<table class="table"><thead><tr><th>Archivo</th><th>Comentario</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>${evidencias.map(ev => `<tr><td><a href="#" class="ver-evidencia" data-data="${ev.datosBase64}" data-nombre="${ev.nombreArchivo}">📄 ${ev.nombreArchivo}</a></td><td>${ev.comentario || '—'}</td><td>${new Date(ev.fecha).toLocaleString()}</td><td><button class="btn btn-sm btn-danger eliminar-evidencia" data-id="${ev.id}">Eliminar</button></td></tr>`).join('')}</tbody></table>`;
    }

    _renderVerEvidenciasAdmin() {
        if (!this.sesion.esAdmin) { Swal.fire('Acceso denegado', 'Solo el administrador puede ver estas evidencias.', 'error'); return; }
        const todosMaestros = this.colegio.maestros;
        const maestrosConEvidencias = this.colegio.getTodosMaestrosConEvidencias();
        this.mainContent.innerHTML = `<h2 class="section-title">📂 Evidencias de Maestros (Controles de Zona)</h2><div class="toolbar"><input type="text" id="buscarMaestro" placeholder="Buscar por nombre..." style="width:250px;"></div><div class="card"><h3>👨‍🏫 Lista de maestros con evidencias</h3><div id="listaMaestrosEvidencias" class="table-container">${this._generarListaMaestrosConEvidencias(todosMaestros, maestrosConEvidencias)}</div></div>`;
        const inputBusqueda = document.getElementById('buscarMaestro');
        const actualizarLista = () => {
            const texto = inputBusqueda.value.toLowerCase();
            const filtrados = todosMaestros.filter(m => m.nombreCompleto.toLowerCase().includes(texto) && maestrosConEvidencias.some(me => me.id === m.id));
            document.getElementById('listaMaestrosEvidencias').innerHTML = this._generarListaMaestrosConEvidencias(filtrados, maestrosConEvidencias);
            document.querySelectorAll('.btn-ver-evidencias').forEach(btn => btn.addEventListener('click', () => {
                const maestroId = parseInt(btn.dataset.id);
                const evidencias = this.colegio.getEvidenciasPorMaestro(maestroId);
                const maestro = this.colegio.maestros.find(m => m.id === maestroId);
                this._mostrarEvidenciasMaestro(maestro, evidencias);
            }));
        };
        inputBusqueda.addEventListener('input', actualizarLista);
        actualizarLista();
    }

    _mostrarEvidenciasMaestro(maestro, evidencias) {
        if (!evidencias.length) { Swal.fire('Sin evidencias', `El maestro ${maestro.nombreCompleto} no tiene evidencias subidas.`, 'info'); return; }
        let html = `<div style="max-height: 500px; overflow-y: auto;"><table style="width:100%; border-collapse: collapse;"><thead><tr><th>Archivo</th><th>Comentario</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>`;
        evidencias.forEach(ev => {
            html += `<tr><td>${ev.nombreArchivo}</td><td>${ev.comentario || '—'}</td><td>${new Date(ev.fecha).toLocaleString()}</td><td><button class="btn-descargar-evidencia swal2-btn" data-data="${ev.datosBase64}" data-nombre="${ev.nombreArchivo}">⬇️ Descargar</button></td></tr>`;
        });
        html += `</tbody></table></div>`;
        Swal.fire({ title: `Evidencias de ${maestro.nombreCompleto}`, html: html, width: '900px', showConfirmButton: true, confirmButtonText: 'Cerrar', didOpen: () => {
            document.querySelectorAll('.btn-descargar-evidencia').forEach(btn => btn.addEventListener('click', (e) => {
                e.preventDefault();
                const data = btn.dataset.data;
                const nombre = btn.dataset.nombre;
                const binary = atob(data);
                const array = new Uint8Array(binary.length);
                for (let i=0; i<binary.length; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.download = nombre;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }));
        }});
    }

    _generarListaMaestrosConEvidencias(maestros, maestrosConEvidencias) {
        if (maestros.length === 0) return '<p>No hay maestros con evidencias.</p>';
        return `<table class="table"><thead><tr><th>ID</th><th>Maestro</th><th>Acción</th></tr></thead><tbody>${maestros.map(m => `<tr><td>${m.id}</td><td>${m.nombreCompleto}</td><td><button class="btn btn-sm btn-primary btn-ver-evidencias" data-id="${m.id}">📂 Ver evidencias</button></td></tr>`).join('')}</tbody></table>`;
    }

    _renderEstadisticasGlobal() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `<h2 class="section-title">📊 Estadísticas Globales (Rendimiento por Tareas)</h2><div class="toolbar"><select id="gradoEstadistica">${grados.map(g=>`<option>${g}</option>`).join('')}</select></div><div class="card"><canvas id="globalChart" style="max-width:500px; margin:0 auto;"></canvas></div>`;
        const actualizar = () => {
            const grado = document.getElementById('gradoEstadistica').value;
            const alumnos = this.colegio.getAlumnosFiltrados(grado, this.cicloActual);
            const promedios = {};
            alumnos.forEach(a => { const r = this.colegio.obtenerRendimientoPorMaterias(a.id); Object.entries(r).forEach(([mat,val]) => { if(!promedios[mat]) promedios[mat]={suma:0,count:0}; promedios[mat].suma+=val; promedios[mat].count++; }); });
            const labels = Object.keys(promedios);
            const data = labels.map(l=>+(promedios[l].suma/promedios[l].count).toFixed(2));
            const canvas = document.getElementById('globalChart');
            if(window.globalChart) window.globalChart.destroy();
            window.globalChart = new Chart(canvas, { type:'bar', data:{ labels, datasets:[{ label:'Promedio %', data, backgroundColor:'#1a5276' }] } });
        };
        document.getElementById('gradoEstadistica').addEventListener('change', actualizar);
        actualizar();
    }
