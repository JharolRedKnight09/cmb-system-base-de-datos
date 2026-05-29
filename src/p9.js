    _mostrarModalEstadoPagosAdicionales() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        const items = this.colegio.config.extrasItems;
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        
        let selectConceptoHTML = `<select id="modalConcepto">`;
        items.forEach(it => selectConceptoHTML += `<option value="${it.nombre}">${it.nombre}</option>`);
        selectConceptoHTML += `</select>`;

        overlay.innerHTML = `
            <div class="modal-card" style="max-width:800px; width:95%;">
                <div class="modal-header">
                    <h3>👥 Estado de Pagos Adicionales</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div class="toolbar" style="margin-bottom: 20px;">
                    <label>Concepto:</label> ${selectConceptoHTML}
                    <label style="margin-left:15px;">Grado:</label>
                    <select id="modalGrado">
                        ${grados.map(g => `<option value="${g}">${g}</option>`).join('')}
                    </select>
                </div>
                <div id="modalEstadoTabla" class="table-container" style="max-height: 40vh; overflow-y: auto;">
                </div>
                <div class="modal-footer" style="margin-top:20px;">
                    <button class="btn btn-secondary cerrar-modal">Cerrar</button>
                    <button class="btn btn-success" id="btnImprimirEstado">🖨 Imprimir Listado</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const actualizarTabla = () => {
            const concepto = document.getElementById('modalConcepto').value;
            const grado = document.getElementById('modalGrado').value;
            const item = this.colegio.config.extrasItems.find(i => i.nombre === concepto);
            if (!item) return;

            const alumnos = this.colegio.getAlumnosFiltrados(grado, this.cicloActual);
            
            let html = `<table style="width:100%; border-collapse: collapse;">
                <thead><tr><th>No. Clave</th><th>Alumno</th><th>Abonado (Q)</th><th>Pendiente (Q)</th><th>Estado</th><th>Abonar</th></tr></thead><tbody>`;
            
            alumnos.forEach(a => {
                const abonado = a.extrasPagados[concepto] || 0;
                const pendiente = item.montoTotal - abonado;
                const estadoText = pendiente <= 0 ? 'Al día' : 'Pendiente';
                const estadoClass = pendiente <= 0 ? 'badge-activo' : 'badge-suspendido';

                html += `<tr>
                    <td style="text-align:center;">${a.clave}</td>
                    <td>${a.nombreCompleto}</td>
                    <td style="text-align:center;">Q${abonado.toFixed(2)}</td>
                    <td style="text-align:center;">Q${Math.max(0, pendiente).toFixed(2)}</td>
                    <td style="text-align:center;"><span class="badge ${estadoClass}">${estadoText}</span></td>
                    <td style="text-align:center;">
                        ${pendiente > 0 ? `<button class="btn btn-sm btn-primary btn-abonar" data-id="${a.id}">Abonar</button>` : '---'}
                    </td>
                </tr>`;
            });
            html += `</tbody></table>`;
            document.getElementById('modalEstadoTabla').innerHTML = html;

            document.querySelectorAll('.btn-abonar').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const idAlumno = parseInt(btn.dataset.id);
                    const alumno = this.colegio.getAlumnoPorId(idAlumno);
                    const pen = item.montoTotal - (alumno.extrasPagados[concepto] || 0);

                    const { value: montoAbono } = await Swal.fire({
                        title: `Abonar a ${concepto}`,
                        text: `${alumno.nombreCompleto} (Pendiente: Q${pen.toFixed(2)})`,
                        input: 'number',
                        inputAttributes: { min: 1, max: pen, step: 'any' },
                        inputPlaceholder: 'Monto a abonar',
                        showCancelButton: true
                    });

                    if (montoAbono) {
                        const cant = parseFloat(montoAbono);
                        if (cant > 0 && cant <= pen) {
                            if (this.colegio.registrarAbonoExtra(idAlumno, concepto, cant)) {
                                Swal.fire('Éxito', `Abono de Q${cant} registrado correctamente.`, 'success');
                                actualizarTabla();
                                
                                const ventana = window.open('', 'Recibo', 'width=400,height=600');
                                ventana.document.write(`
                                    <html><head><title>Recibo Extra</title>
                                    <style>body{font-family:monospace;padding:20px;}.logo-container{text-align:right;}img{max-width:100px;}pre{text-align:left;}</style></head>
                                    <body><div class="logo-container"><img src="logo.jpeg" alt="Logo"></div><pre>
==========================================
        COLEGIO MIXTO BELÉN
      RECIBO DE PAGO ADICIONAL
==========================================
Alumno: ${alumno.nombreCompleto}
Grado: ${alumno.grado}   Ciclo: ${alumno.cicloEscolar}
------------------------------------------
Concepto: ${concepto}
Monto Abonado: Q${cant.toFixed(2)}
Saldo Restante: Q${(pen - cant).toFixed(2)}
------------------------------------------
Fecha: ${new Date().toLocaleString()}
==========================================
        ¡Gracias por su pago!
                                    </pre><script>window.print();<\/script></body></html>
                                `);
                            }
                        } else {
                            Swal.fire('Error', 'Monto inválido', 'error');
                        }
                    }
                });
            });
        };

        const modalConcepto = document.getElementById('modalConcepto');
        const modalGrado = document.getElementById('modalGrado');

        if (modalConcepto) modalConcepto.addEventListener('change', actualizarTabla);
        if (modalGrado) modalGrado.addEventListener('change', actualizarTabla);

        actualizarTabla();

        document.getElementById('btnImprimirEstado').addEventListener('click', () => {
            const concepto = document.getElementById('modalConcepto').value;
            const grado = document.getElementById('modalGrado').value;
            const tablaConfig = document.getElementById('modalEstadoTabla').innerHTML;
            const ventana = window.open('', '_blank');
            ventana.document.write(`
                <html><head><title>Estado Pagos Extras</title>
                <style>body{font-family:sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ccc;padding:8px;text-align:center;} th{background:#1a5276;color:white;} .badge{padding:3px 8px;border-radius:10px;font-size:12px;}</style>
                </head><body>
                <h2>COLEGIO MIXTO BELÉN</h2>
                <h3>Estado de pago - Concepto: ${concepto}</h3>
                <p>Grado: ${grado} | Ciclo: ${this.cicloActual}</p>
                ${tablaConfig.replace(/<td.*?>.*?<button.*?>.*?<\/td>/g, '')}
                <script>window.print();<\/script>
                </body></html>
            `);
        });

        const closeModal = () => overlay.remove();
        overlay.querySelector('.btn-close-modal').addEventListener('click', closeModal);
        overlay.querySelector('.cerrar-modal').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    }

    _renderEstadisticasAlumno() {
        if (!this.sesion.esAlumno) return;
        const alumno = this.sesion.usuario;
        const rendimiento = this.colegio.obtenerRendimientoPorMaterias(alumno.id);

        this.mainContent.innerHTML = `
            <h2 class="section-title">📊 Mi Rendimiento Académico</h2>
            <div class="card">
                <canvas id="miRendimientoChart" style="max-width:500px; margin:0 auto;"></canvas>
            </div>
            <div class="card" style="margin-top: 20px;">
                <h3>Mis Logros y Medallas</h3>
                <div id="logrosContainer" style="display:flex; gap:15px; flex-wrap:wrap; margin-top:15px;"></div>
            </div>
        `;

        const labels = Object.keys(rendimiento);
        const data = Object.values(rendimiento);

        if (labels.length) {
            const canvas = document.getElementById('miRendimientoChart');
            new Chart(canvas, {
                type: 'pie',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: ['#e74c3c', '#8e44ad', '#3498db', '#e67e22', '#2ecc71', '#f1c40f']
                    }]
                }
            });

            // Lógica simple de logros
            const logrosContainer = document.getElementById('logrosContainer');
            let logrosHTML = '';
            const promedioGeneral = data.length ? data.reduce((a,b)=>a+b,0)/data.length : 0;
            
            if (promedioGeneral >= 90) logrosHTML += `<div style="text-align:center; padding:10px; border:1px solid #ddd; border-radius:8px;">🏆<br><b>Excelencia</b><br><small>>90Pts</small></div>`;
            const perfectMate = (rendimiento['Matemática'] && rendimiento['Matemática'] === 100);
            if (perfectMate) logrosHTML += `<div style="text-align:center; padding:10px; border:1px solid #ddd; border-radius:8px;">🔢<br><b>Genio Matemático</b><br><small>100 pts</small></div>`;
            
            const todasAprobadas = data.every(v => v >= 60);
            if (todasAprobadas && data.length > 0) logrosHTML += `<div style="text-align:center; padding:10px; border:1px solid #ddd; border-radius:8px;">⭐<br><b>Todo Aprobado</b></div>`;

            if (!logrosHTML) logrosHTML = '<p>Aún no tienes medallas desbloqueadas. ¡Sigue esforzándote!</p>';
            logrosContainer.innerHTML = logrosHTML;

        } else {
            document.querySelector('#miRendimientoChart').parentElement.innerHTML = '<p>No hay notas registradas para generar el gráfico.</p>';
        }
    }
   
}

// ==================== INICIALIZACIÓN ====================
const colegio = new Colegio();
colegio._syncContadores();
const app = new UIColegio(colegio);

if (colegio.maestros.length === 0) {
    const m = colegio.agregarMaestro('maestro', '1234', 'Juan', 'Pérez');
    if (m) {
        m.asignaciones = { 'Primero': ['Matemática', 'Comunicación'], 'Segundo': ['Matemática'] };
        colegio.guardarMaestros();
    }
}
