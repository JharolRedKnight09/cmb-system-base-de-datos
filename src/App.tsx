import React, { useState } from 'react';
import { 
  Users, BookOpen, Settings, Home, FileText, DollarSign, 
  PlusCircle, LayoutDashboard, UserCheck, GraduationCap, 
  ClipboardList, PieChart, CheckSquare, FileBadge
} from 'lucide-react';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function App() {
  const [view, setView] = useState('inscripcion');
  const [ciclo, setCiclo] = useState('2026');

  // Form state
  const [formData, setFormData] = useState({
    codigo: '', nombres: '', apellidos: '', fechaNacimiento: '',
    grado: 'Primero', telefono: '', correo: '', password: '1234'
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const alumnoRef = doc(db, 'colegio_data', `alumno_${Date.now()}`);
      await setDoc(alumnoRef, { 
        value: JSON.stringify({...formData, cicloEscolar: ciclo, estado: 'Activo'})
      }, { merge: true });
      alert("Alumno Registrado en Firebase Exitosamente!");
      setFormData({
        codigo: '', nombres: '', apellidos: '', fechaNacimiento: '',
        grado: 'Primero', telefono: '', correo: '', password: '1234'
      });
    } catch(err) {
      console.error(err);
      alert("Error al registrar");
    }
  };

  const navItems = [
    { id: 'inscripcion', icon: FileText, label: 'Inscripción' },
    { id: 'listado', icon: ClipboardList, label: 'Ver Listado' },
    { id: 'mensualidades', icon: DollarSign, label: 'Mensualidades' },
    { id: 'pagos', icon: PlusCircle, label: 'Pagos Adicionales' },
    { id: 'panel', icon: LayoutDashboard, label: 'Panel Control' },
    { id: 'alumnos', icon: Users, label: 'Gestión Alumnos' },
    { id: 'maestros', icon: UserCheck, label: 'Maestros' },
    { id: 'tareas', icon: BookOpen, label: 'Tareas' },
    { id: 'cuadros', icon: PieChart, label: 'Cuadros de Zona' },
    { id: 'estadisticas', icon: CheckSquare, label: 'Estadísticas' },
    { id: 'notas', icon: GraduationCap, label: 'Registro Notas' },
    { id: 'boleta', icon: FileBadge, label: 'Boleta Individual' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Sidebar Original Style */}
      <aside className="w-[260px] bg-[#1e2733] text-slate-300 flex flex-col overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-white/10 text-white font-bold tracking-wider uppercase text-sm mt-4">
          <span className="text-emerald-500 mr-2 text-xl">≡</span>
          <span className="text-emerald-400 font-black text-xl">CMB</span> <span className="ml-2 font-normal opacity-80 text-xs">PANEL ADMIN</span>
        </div>
        <nav className="flex-1 py-4 space-y-1">
          {navItems.map(item => (
            <button 
              key={item.id}
              onClick={() => setView(item.id)} 
              className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors border-l-4 ${view === item.id ? 'bg-[#283546] text-white border-emerald-500' : 'border-transparent hover:bg-[#283546] hover:text-white'}`}
            >
              <item.icon className={`w-4 h-4 mr-4 ${view === item.id ? 'text-emerald-400' : 'text-slate-400'}`} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Dynamic Content */}
        <div className="p-10 overflow-y-auto flex-1">
          {view === 'inscripcion' ? (
            <div>
              <h1 className="text-2xl font-bold text-[#1f4e66] flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                📝 Nueva Inscripción
              </h1>
              <div className="bg-white rounded shadow-sm border border-slate-200 p-8 max-w-5xl">
                <form onSubmit={handleRegister} className="grid grid-cols-2 gap-x-8 gap-y-6">
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Código *</label>
                     <input type="text" required value={formData.codigo} onChange={e=>setFormData({...formData, codigo: e.target.value})} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Nombres *</label>
                     <input type="text" required value={formData.nombres} onChange={e=>setFormData({...formData, nombres: e.target.value})} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Apellidos *</label>
                     <input type="text" required value={formData.apellidos} onChange={e=>setFormData({...formData, apellidos: e.target.value})} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Fecha Nacimiento</label>
                     <input type="text" placeholder="mm / dd / yyyy" value={formData.fechaNacimiento} onChange={e=>setFormData({...formData, fechaNacimiento: e.target.value})} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Grado *</label>
                     <select value={formData.grado} onChange={e=>setFormData({...formData, grado: e.target.value})} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white">
                       <option>Primero</option>
                       <option>Segundo</option>
                       <option>Tercero</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
                     <input type="text" value={formData.telefono} onChange={e=>setFormData({...formData, telefono: e.target.value})} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Correo</label>
                     <input type="email" value={formData.correo} onChange={e=>setFormData({...formData, correo: e.target.value})} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Ciclo Escolar *</label>
                     <select value={ciclo} onChange={e=>setCiclo(e.target.value)} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white">
                       <option>2025</option>
                       <option>2026</option>
                       <option>2027</option>
                     </select>
                   </div>

                   <div className="col-span-1 border-t border-slate-100 pt-4 mt-2">
                     <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña (default 1234)</label>
                     <input type="text" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="w-full border border-slate-300 rounded-md px-4 py-2.5 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" />
                   </div>
                   <div className="col-span-2"></div>

                   <div className="col-span-2 mt-2">
                     <button type="submit" className="bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-2.5 px-6 rounded shadow transition duration-200 flex items-center gap-2">
                       <CheckSquare className="w-5 h-5"/>
                       Registrar Alumno
                     </button>
                   </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow border border-slate-200 p-12 text-center text-slate-500 flex flex-col items-center justify-center h-full">
              <Settings className="w-12 h-12 mb-4 text-slate-300" />
              <h2 className="text-xl font-medium mb-2">Sección en Construcción</h2>
              <p>Has navegado a: <strong>{navItems.find(i => i.id === view)?.label}</strong></p>
              <p className="mt-4 max-w-lg mx-auto text-sm text-slate-400">
                 Dado que ya tienes todas estas pantallas funcionando en tu sistema original, no es necesario reescribirlas desde cero aquí. Verás las instrucciones para conectarlo a tu código original.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
