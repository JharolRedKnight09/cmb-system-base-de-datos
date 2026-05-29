    _renderBoletaLista() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `
            <h2 class="section-title">📄 Boleta Individual</h2>
            <div class="toolbar">
                <select id="boletaGrado">${grados.map(g => `<option>${g}</option>`).join('')}</select>
            </div>
            <div class="table-container">
                <table><thead><tr><th>No. Clave</th><th>Alumno</th><th>Acciones</th></tr></thead>
                <tbody id="tbodyBoletaLista"></tbody>
            </div>
            <div id="boletaPreview" style="margin-top:20px;"></div>
        `;
        const selectGrado = document.getElementById('boletaGrado');
        const self = this;
        const actualizar = () => {
            const grado = selectGrado.value;
            const alumnos = self.colegio.getAlumnosFiltrados(grado, self.cicloActual);
            const tbody = document.getElementById('tbodyBoletaLista');
            tbody.innerHTML = alumnos.map(a => `
                <tr>
                    <td>${a.clave}</td>
                    <td>${a.nombreCompleto}</td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-ver-boleta" data-id="${a.id}">👁 Ver Notas</button>
                        <button class="btn btn-sm btn-success btn-imprimir-boleta" data-id="${a.id}">🖨 Imprimir</button>
                    </td>
                </tr>`).join('');
            tbody.querySelectorAll('.btn-ver-boleta').forEach(btn => {
                btn.addEventListener('click', () => self._mostrarBoletaModal(parseInt(btn.dataset.id)));
            });
            tbody.querySelectorAll('.btn-imprimir-boleta').forEach(btn => {
                btn.addEventListener('click', () => self._imprimirBoleta(parseInt(btn.dataset.id)));
            });
        };
        selectGrado.addEventListener('change', actualizar);
        actualizar();
    }

    _mostrarBoletaModal(idAlumno) {
        const alumno = this.colegio.getAlumnoPorId(idAlumno);
        if (!alumno) return;
        const contenido = this._generarHTMLBoleta(alumno);
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:800px; text-align:center;">
                <div class="modal-header">
                    <h3>Boleta de Calificaciones</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div>${contenido}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary cerrar-modal">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.btn-close-modal').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.cerrar-modal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        return overlay;
    }

    _imprimirBoleta(idAlumno) {
        const alumno = this.colegio.getAlumnoPorId(idAlumno);
        if (!alumno) return;
        const overlay = this._mostrarBoletaModal(idAlumno);
        if (overlay) { setTimeout(() => { window.print(); window.onafterprint = () => overlay.remove(); }, 300); }
    }

    _generarHTMLBoleta(alumno) {
        const bimestres = ['Bimestre 1','Bimestre 2','Bimestre 3','Bimestre 4'];
        const materias = this.colegio.notas.materias;
        let filas = materias.map(mat => {
            let cels = `<td class="materia-col">${mat}</td>`;
            let suma = 0, count = 0;
            bimestres.forEach(bim => {
                const v = this.colegio.notas.getNota(alumno.id, bim, mat);
                if (v > 0) { suma += v; count++; }
                cels += `<td>${v}</td>`;
            });
            cels += `<td>${count > 0 ? +(suma/count).toFixed(2) : 0}</td>`;
            return `<tr>${cels}</tr>`;
        }).join('');
        return `
            <div id="boletaPrintArea" class="boleta-print" style="text-align:center;">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:20px;">
                    <div style="text-align:left;">
                        <h2>COLEGIO MIXTO BELÉN</h2>
                        <p><strong>Alumno:</strong> ${alumno.nombreCompleto}</p>
                        <p>Grado: ${alumno.grado} | Ciclo: ${alumno.cicloEscolar}</p>
                    </div>
                    <img src="logo.jpeg" style="max-width:120px;">
                </div>
                <table class="boleta-table" style="margin:20px auto; width:90%;">
                    <thead><tr><th>Materia</th>${bimestres.map(b=>`<th>${b}</th>`).join('')}<th>Promedio</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        `;
    }

    _renderZonaCuadro() {
        if (!this.sesion.esAdmin && !this.sesion.esMaestro) {
            Swal.fire('Acceso denegado', 'Solo administradores y maestros pueden acceder.', 'error');
            return;
        }
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        const materias = this.colegio.notas.materias;
        const bimestres = [1,2,3,4];
        this.mainContent.innerHTML = `
            <h2 class="section-title">📊 Cuadros de Zona por Clase</h2>
            <div class="toolbar" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <label>Grado: </label><select id="zonaGrado">${grados.map(g=>`<option>${g}</option>`).join('')}</select>
                    <label>Materia: </label><select id="zonaMateria">${materias.map(m=>`<option>${m}</option>`).join('')}</select>
                    <label>Bimestre: </label><select id="zonaBimestre">${bimestres.map(b=>`<option value="${b}">Bimestre ${b}</option>`).join('')}</select>
                    <button class="btn btn-primary" id="btnCargarZona">📊 Cargar Cuadro</button>
                </div>
                <button class="btn btn-success" id="btnImprimirZona">🖨️ Imprimir Cuadro</button>
            </div>
            <div id="zonaTablaContainer" class="table-container" style="margin-top:20px;"></div>
        `;
        document.getElementById('btnCargarZona').addEventListener('click', () => this._cargarZonaCuadro());
        document.getElementById('btnImprimirZona').addEventListener('click', () => this._imprimirZonaCuadro());
    }

    _cargarZonaCuadro() {
        const grado = document.getElementById('zonaGrado').value;
        const materia = document.getElementById('zonaMateria').value;
        const bimestre = parseInt(document.getElementById('zonaBimestre').value);
        const { tareas, data } = this.colegio.obtenerZonaCuadro(grado, materia, bimestre, this.cicloActual);
        if (!data.length) {
            document.getElementById('zonaTablaContainer').innerHTML = '<p>No hay alumnos en este grado y ciclo.</p>';
            return;
        }
        let html = `<table class="table"><thead><tr><th>No. Clave</th><th>Alumno</th>`;
        tareas.forEach(t => html += `<th>${t.titulo}<br><small>(${t.puntajeMaximo} pts)</small></th>`);
        html += `<th>Punteo Evaluación Bimestre</th><th>Total Nota</th></tr></thead><tbody>`;
        data.forEach(item => {
            const a = item.alumno;
            html += `<tr data-id="${a.id}"><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td>`;
            tareas.forEach((t, idx) => {
                const calif = item.tareasCalif[idx];
                html += `<td style="text-align:center;">${calif !== null ? calif : '-'}</td>`;
            });
            html += `<td style="text-align:center;"><input type="number" class="input-examen" value="${item.examen}" min="0" max="100" step="0.01" style="width:80px;"></td>
                     <td style="text-align:center; font-weight:bold;" class="total-nota">${item.total}</td>
                    </tr>`;
        });
        html += `</tbody></table>`;
        document.getElementById('zonaTablaContainer').innerHTML = html;
        document.querySelectorAll('.input-examen').forEach(input => {
            input.addEventListener('change', async (e) => {
                const fila = input.closest('tr');
                const alumnoId = parseInt(fila.dataset.id);
                const nuevaNota = parseFloat(input.value);
                if (isNaN(nuevaNota)) return;
                await this.colegio.setExamenBimestral(alumnoId, materia, bimestre, nuevaNota);
                const total = this.colegio.calcularTotalBimestre(alumnoId, materia, bimestre);
                fila.querySelector('.total-nota').innerText = total;
                Swal.fire('Actualizado', 'Nota del examen guardada', 'success');
            });
        });
        this.zonaActual = { grado, materia, bimestre, tareas, data };
    }

    _imprimirZonaCuadro() {
        if (!this.zonaActual) {
            Swal.fire('Error', 'Debe cargar un cuadro de zona antes de imprimir.', 'error');
            return;
        }
        const { grado, materia, bimestre, tareas, data } = this.zonaActual;
        const nombreMaestro = this.sesion.esMaestro ? this.sesion.usuario.nombreCompleto : 'Administrador';
        const ciclo = this.cicloActual;
        const fechaActual = new Date().toLocaleString();
        const logoUrl = 'logo.jpeg';
        let tablaHTML = `<table><thead><tr><th>No. Clave</th><th>Alumno</th>`;
        tareas.forEach(t => tablaHTML += `<th>${t.titulo} (${t.puntajeMaximo} pts)</th>`);
        tablaHTML += `<th>Punteo Evaluación</th><th>Total Nota</th></tr></thead><tbody>`;
        data.forEach(item => {
            const a = item.alumno;
            tablaHTML += `<tr><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td>`;
            tareas.forEach((t, idx) => {
                const calif = item.tareasCalif[idx];
                tablaHTML += `<td style="text-align:center;">${calif !== null ? calif : '-'}</td>`;
            });
            tablaHTML += `<td style="text-align:center;">${item.examen}</td><td style="text-align:center;">${item.total}</td></tr>`;
        });
        tablaHTML += `</tbody></table>`;
        const ventana = window.open('', '_blank');
        ventana.document.write(`
            <!DOCTYPE html>
            <html>
            <head><title>Cuadro de Zona - ${materia} - ${grado}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #1a5276; padding-bottom: 10px; }
                .logo { max-width: 100px; }
                .info { text-align: right; }
                h2 { margin: 0; color: #1a5276; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #1a5276; color: white; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #7f8c8d; }
                @media print { body { margin: 0; } .no-print { display: none; } }
            </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Logo" class="logo" onerror="this.style.display='none'">
                    <div class="info">
                        <h2>COLEGIO MIXTO BELÉN</h2>
                        <p><strong>Maestro(a):</strong> ${nombreMaestro}<br>
                        <strong>Materia:</strong> ${materia}<br>
                        <strong>Grado:</strong> ${grado}<br>
                        <strong>Bimestre:</strong> ${bimestre}<br>
                        <strong>Ciclo Escolar:</strong> ${ciclo}<br>
                        <strong>Fecha de impresión:</strong> ${fechaActual}</p>
                    </div>
                </div>
                <h3 style="text-align:center;">Cuadro de Zona - Evaluaciones</h3>
                ${tablaHTML}
                <div class="footer">Documento generado por el Sistema de Gestión Escolar - Colegio Mixto Belén</div>
                <script>window.print();<\/script>
            </body>
            </html>
        `);
        ventana.document.close();
    }
