'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    setDoc,
    writeBatch,
    query,
    where
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
    LayoutDashboard, ArrowLeft, Search, Plus, Trash2, Edit2,
    FileSpreadsheet, Upload, Save, X, Filter
} from 'lucide-react';
import { ADMIN_EMAILS } from '@/lib/constants';

// Tipos
type Material = {
    id: string;
    nombre: string;
    categoria: string;
    precio: number;
    unidad: string;
    stock?: number;
    codigo?: string;
    descripcion?: string;
    proveedor?: string;
};

const CATEGORIAS = [
    'Accesorios',
    'Acrílicos',
    'Burletes y Cepillos',
    'Ciegos',
    'Perfiles',
    'Mallas Mosquiteras',
    'Recubrimientos',
    'Vidrios',
    'Otros'
];

export default function MaterialesPage() {
    const [user, setUser] = useState<any>(null);
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCat, setFilterCat] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [importing, setImporting] = useState(false);

    // Estado para el modal de edición/creación
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentMaterial, setCurrentMaterial] = useState<Partial<Material>>({});

    const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => {
            setUser(u);
            if (u) fetchMateriales();
        });
        return () => unsub();
    }, []);

    const fetchMateriales = async () => {
        setLoading(true);
        try {
            const col = collection(db, 'materiales');
            const snap = await getDocs(col);
            const list: Material[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as Material));
            setMateriales(list);
        } catch (e) {
            console.error(e);
            alert('Error cargando materiales');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!isAdmin) return;
        if (!confirm('¿Borrar material?')) return;
        try {
            await deleteDoc(doc(db, 'materiales', id));
            setMateriales(prev => prev.filter(m => m.id !== id));
        } catch (e) {
            alert('Error eliminando');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentMaterial.nombre || !currentMaterial.categoria) return alert('Datos incompletos');

        try {
            const id = currentMaterial.id || Date.now().toString();
            const data = {
                nombre: currentMaterial.nombre,
                categoria: currentMaterial.categoria,
                precio: Number(currentMaterial.precio) || 0,
                unidad: currentMaterial.unidad || 'ud',
                stock: Number(currentMaterial.stock) || 0,
                codigo: currentMaterial.codigo || '',
                updatedAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'materiales', id), data, { merge: true });

            if (currentMaterial.id) {
                setMateriales(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
            } else {
                setMateriales(prev => [...prev, { id, ...data } as Material]);
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            alert('Error guardando');
        }
    };

    // Lógica de importación simple (simulada o real si leemos archivos locales vía input)
    // Como el usuario dijo que los archivos están en la raiz, asumiremos que quiere un botón
    // que dispare la lectura DEL LADO DEL SERVIDOR o que nos permita subirlos.
    // Para simplificar y ser robustos en navegador sin backend custom, usaremos un input file.
    // PERO, implementaré un botón especial "Cargar Predeterminados" que use fetch a api local si existiera,
    // o mas simple: input file y le decimos al usuario "Selecciona los archivos".

    // Como el usuario fue especifico "estan en la raiz", quizas espera que sea automatico.
    // En Nextjs cliente no podemos leer fs.
    // Creare 'components/CsvImporter.tsx' o una utilidad.

    // Para esta iteración, usaré inputs de archivo ocultos o visibles para que el usuario seleccione.

    const processCsv = (text: string, isPlantilla: boolean) => {
        const lines = text.split('\n');
        const newItems: Material[] = [];

        if (isPlantilla) {
            // plantilla_producto.csv: referencia,nombre,categoria,precio,stock,costo
            lines.slice(1).forEach(line => {
                const cols = line.split(',');
                if (cols.length < 4) return;
                newItems.push({
                    id: cols[0].trim(),
                    codigo: cols[0].trim(),
                    nombre: cols[1].trim(),
                    categoria: mapCategory(cols[2].trim()) || 'Accesorios',
                    precio: parseFloat(cols[3]) || 0,
                    unidad: 'ud',
                    stock: parseFloat(cols[4]) || 0
                });
            });
        } else {
            // Productos.csv (estructura compleja separada por ;)
            // Ejemplo: MD4123545;...;Angulo 50x50;...
            lines.forEach(line => {
                const cols = line.split(';');
                if (cols.length < 6) return;
                // Intentar deducir campos.
                // Col 5 suele ser descripcion
                // Precio suele estar en col 6 o 7
                const desc = cols[5]?.trim();
                if (!desc) return;

                let cat = 'Otros';
                const lowerDesc = desc.toLowerCase();

                if (lowerDesc.includes('angulo') || lowerDesc.includes('canal') || lowerDesc.includes('tubular') || lowerDesc.includes('perfil')) cat = 'Perfiles';
                else if (lowerDesc.includes('acrilico')) cat = 'Acrílicos';
                else if (lowerDesc.includes('vidrio') || lowerDesc.includes('doble') || lowerDesc.includes('laminado')) cat = 'Vidrios';
                else if (lowerDesc.includes('felpa') || lowerDesc.includes('goma') || lowerDesc.includes('burlete')) cat = 'Burletes y Cepillos';
                else if (lowerDesc.includes('malla')) cat = 'Mallas Mosquiteras';
                else if (lowerDesc.includes('ciego')) cat = 'Ciegos';

                // Precio: buscar primera columna numérica grande > 100 después de la descripción
                let precio = 0;
                for (let i = 6; i < 10; i++) {
                    const val = parseFloat(cols[i]?.replace(',', '.') || '0');
                    if (val > 0) { precio = val; break; }
                }

                newItems.push({
                    id: (cols[0] + cols[4]).replace(/\s/g, ''), // ID compuesto
                    codigo: cols[4] || cols[0],
                    nombre: desc,
                    categoria: cat,
                    precio: precio,
                    unidad: 'ud', // default
                    stock: 0
                });
            });
        }
        return newItems;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isPlantilla: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            const parsed = processCsv(text, isPlantilla);

            // Batch uploading to Firestore
            const batchSize = 400;
            let batches = [];
            for (let i = 0; i < parsed.length; i += batchSize) {
                batches.push(parsed.slice(i, i + batchSize));
            }

            let count = 0;
            for (const batchItems of batches) {
                const batch = writeBatch(db);
                batchItems.forEach(item => {
                    const ref = doc(db, 'materiales', item.id);
                    batch.set(ref, item, { merge: true });
                });
                await batch.commit();
                count += batchItems.length;
            }

            alert(`Importados ${count} items exitosamente.`);
            fetchMateriales();
            setImporting(false);
        };
        reader.readAsText(file);
    };

    const mapCategory = (csvCat: string) => {
        const map: Record<string, string> = {
            'CILINDROS': 'Accesorios',
            'CERRADEROS': 'Accesorios',
            'MANILLAS': 'Accesorios',
            'CREMONAS': 'Accesorios',
            'BISAGRAS': 'Accesorios',
            'CARROS': 'Accesorios',
            'PERFILES': 'Perfiles',
            // Add more mappings as needed
        };
        return map[csvCat] || 'Accesorios';
    };

    const filtered = useMemo(() => {
        return materiales.filter(m => {
            const matchesTerm = m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = filterCat === 'Todos' || m.categoria === filterCat;
            return matchesTerm && matchesCat;
        });
    }, [materiales, filterCat, searchTerm]);

    return (
        <main className="p-6 bg-gray-50 min-h-screen">
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <a href={isAdmin ? "/admin" : "/"} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600">
                        {isAdmin ? <LayoutDashboard size={20} /> : <ArrowLeft size={20} />}
                    </a>
                    <h1 className="text-2xl font-bold text-gray-800">Gestión de Materiales</h1>
                </div>

                {isAdmin && (
                    <div className="flex gap-2">
                        <button onClick={() => { setCurrentMaterial({}); setIsModalOpen(true); }} className="bg-[#19a8aa] text-white px-4 py-2 rounded flex items-center gap-2">
                            <Plus size={18} /> Nuevo
                        </button>
                    </div>
                )}
            </header>

            {/* TOOLS & FILTERS */}
            <section className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
                <div className="flex flex-wrap gap-4 items-center justify-between">

                    {/* SEARCH */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            className="w-full pl-10 pr-4 py-2 border rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                            placeholder="Buscar material..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* CATEGORY FILTER */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                        <button
                            onClick={() => setFilterCat('Todos')}
                            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterCat === 'Todos' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Todos
                        </button>
                        {CATEGORIAS.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCat(cat)}
                                className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterCat === cat ? 'bg-[#19a8aa] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* IMPORT BUTTONS */}
                {isAdmin && (
                    <div className="flex gap-4 border-t pt-4">
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                id="file-plantilla"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e, true)}
                            />
                            <label htmlFor="file-plantilla" className={`cursor-pointer flex items-center gap-2 text-sm text-blue-600 hover:bg-blue-50 px-3 py-2 rounded border border-blue-200 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                                <FileSpreadsheet size={16} /> Importar Plantilla (Accesorios)
                            </label>
                        </div>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                id="file-productos"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e, false)}
                            />
                            <label htmlFor="file-productos" className={`cursor-pointer flex items-center gap-2 text-sm text-green-600 hover:bg-green-50 px-3 py-2 rounded border border-green-200 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                                <FileSpreadsheet size={16} /> Importar Productos Legacy (Perfiles)
                            </label>
                        </div>
                        {importing && <span className="text-sm text-gray-500 animate-pulse">Procesando archivo...</span>}
                    </div>
                )}
            </section>

            {/* TABLE */}
            <section className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Cargando inventario...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No se encontraron materiales.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-4 font-semibold text-gray-600 text-sm">Código</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm">Nombre</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm">Categoría</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm text-right">Precio ($)</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm text-center">Stock</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map(mat => (
                                    <tr key={mat.id} className="hover:bg-gray-50/50">
                                        <td className="p-4 text-sm text-gray-500 font-mono">{mat.codigo || mat.id.substring(0, 8)}</td>
                                        <td className="p-4 text-sm font-medium text-gray-900">{mat.nombre}</td>
                                        <td className="p-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold
                                        ${mat.categoria === 'Accesorios' ? 'bg-gray-100 text-gray-700' :
                                                    mat.categoria === 'Acrílicos' ? 'bg-blue-100 text-blue-700' :
                                                        mat.categoria === 'Perfiles' ? 'bg-red-100 text-red-700' :
                                                            mat.categoria === 'Vidrios' ? 'bg-cyan-100 text-cyan-700' :
                                                                'bg-purple-100 text-purple-700'}
                                     `}>
                                                {mat.categoria}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-right font-medium text-[#19a8aa]">
                                            ${mat.precio.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm text-center text-gray-500">
                                            {mat.stock}
                                        </td>
                                        <td className="p-4 flex items-center justify-center gap-2">
                                            {isAdmin && (
                                                <>
                                                    <button
                                                        onClick={() => { setCurrentMaterial(mat); setIsModalOpen(true); }}
                                                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(mat.id)}
                                                        className="p-1.5 hover:bg-red-50 text-red-600 rounded"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                        <form onSubmit={handleSave}>
                            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                                <h3 className="font-bold text-gray-700">{currentMaterial.id ? 'Editar Material' : 'Nuevo Material'}</h3>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                    <input
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                        value={currentMaterial.nombre || ''}
                                        onChange={e => setCurrentMaterial({ ...currentMaterial, nombre: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                        <select
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                            value={currentMaterial.categoria || ''}
                                            onChange={e => setCurrentMaterial({ ...currentMaterial, categoria: e.target.value })}
                                            required
                                        >
                                            <option value="">Seleccionar...</option>
                                            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                                        <input
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                            value={currentMaterial.codigo || ''}
                                            onChange={e => setCurrentMaterial({ ...currentMaterial, codigo: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                            value={currentMaterial.precio || 0}
                                            onChange={e => setCurrentMaterial({ ...currentMaterial, precio: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                            value={currentMaterial.stock || 0}
                                            onChange={e => setCurrentMaterial({ ...currentMaterial, stock: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-[#19a8aa] text-white rounded hover:bg-[#158f91]">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
