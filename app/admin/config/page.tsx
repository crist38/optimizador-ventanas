'use client';
import React, { useEffect, useState, useId } from 'react';
import { auth, db, storage, googleProvider } from '@/lib/firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    User,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    runTransaction,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LayoutDashboard, Save, LogOut, Check, X, AlertCircle, Upload, ArrowLeft } from 'lucide-react';

// --- ADMIN ---
import { ADMIN_EMAILS } from '@/lib/constants';

// --- TIPOS ---
type PriceMap = Record<string, { label: string; price: number; image?: string }>;

type ConfigDoc = {
    preciosBase: { base: number };
    aperturas: PriceMap;
    colores: PriceMap;
    manillas: PriceMap;
    vidrios: PriceMap;
    accesorios: PriceMap;
    lineas: PriceMap; // New category
};

// --- CONFIGURACIÓN POR DEFECTO: ALUMINIO ---
const DEFAULT_ALUMINIO: ConfigDoc = {
    preciosBase: { base: 60000 },
    aperturas: {
        fijo: { label: 'Fijo', price: 0 },
        corredera: { label: 'Corredera', price: 25000 },
        proyectante: { label: 'Proyectante', price: 30000 },
        abatible: { label: 'Abatible', price: 34000 },
        oscilobatiente: { label: 'Oscilobatiente', price: 55000 },
        puerta: { label: 'Puerta', price: 45000 },
        practicable: { label: 'Practicable', price: 34000 },
    },
    colores: {
        blanco: { label: 'Blanco', price: 26000 },
        mate: { label: 'Mate', price: 20000 },
        titanio: { label: 'Titanio', price: 28000 },
        negro: { label: 'Negro', price: 30000 },
        nogal: { label: 'Nogal', price: 33000 },
        roble_dorado: { label: 'Roble Dorado', price: 35000 },
    },
    manillas: {
        blanco: { label: 'Manilla Blanca', price: 0 },
        negro: { label: 'Manilla Negra', price: 5000 },
    },
    vidrios: {
        simple: { label: 'Vidrio Simple', price: 10000 },
        doble: { label: 'Doble Vidrio (DVH)', price: 29000 },
        triple: { label: 'Triple Vidrio', price: 40000 },
        // Acrylics
        'acr.lluvia': { label: 'Acrílico Lluvia', price: 15600 },
        'acr.burbujas': { label: 'Acrílico Burbujas', price: 15600 },
        'acr.arabesco': { label: 'Acrílico Arabesco', price: 15900 },
        'acr.amazonas': { label: 'Acrílico Amazonas', price: 15600 },
        'acr.gaviotas': { label: 'Acrílico Gaviotas', price: 15600 },
        'acr.15900': { label: 'Acrílico Diseño 15900', price: 15900 },
    },
    lineas: {
        'al_5000': { label: 'Línea AL 5000', price: 35000 },
        'al_20': { label: 'Línea AL 20', price: 55000 },
        'al_25': { label: 'Línea AL 25', price: 75000 },
        's33_rpt': { label: 'Serie S-33 RPT', price: 85000 },
        'al_32': { label: 'Línea AL 32', price: 29000 },
        'al_42': { label: 'Línea AL 42', price: 40000 },
        's38_rpt': { label: 'Serie S-38 RPT', price: 60000 },
        'am_35': { label: 'Línea AM-35', price: 45000 },
        'l12_shower': { label: 'Línea L-12 Shower Door', price: 45000 },
    },
    accesorios: {
        Palillos: { label: 'Palillaje', price: 3000 },
        cierre: { label: 'Mosquitero', price: 50000 },
        cremona: { label: 'Cremona', price: 19000 },
        zocalo: { label: 'Zócalo', price: 14000 },
    },
};

// --- CONFIGURACIÓN POR DEFECTO: PVC ---
const DEFAULT_PVC: ConfigDoc = {
    preciosBase: { base: 220000 },
    aperturas: {
        fijo: { label: 'Fijo', price: 0 },
        corredera: { label: 'Corredera', price: 25000 },
        proyectante: { label: 'Proyectante', price: 30000 },
        abatible: { label: 'Abatible', price: 34000 },
        oscilobatiente: { label: 'Oscilobatiente', price: 55000 },
        puerta: { label: 'Puerta', price: 45000 },
        practicable: { label: 'Practicable', price: 34000 },
    },
    colores: {
        blanco: { label: 'Blanco', price: 29000 },
        roble_dorado: { label: 'Roble Dorado', price: 34000 },
        antracita: { label: 'Gris Antracita', price: 30000 },
        nogal: { label: 'Nogal', price: 35000 },
        negro: { label: 'Negro', price: 33000 },
    },
    manillas: {
        blanco: { label: 'Manilla Blanca', price: 0 },
        negro: { label: 'Manilla Negra', price: 5000 },
        titanio: { label: 'Manilla Titanio', price: 8000 },
    },
    vidrios: {
        simple: { label: 'Vidrio Simple', price: 10000 },
        doble: { label: 'Doble Vidrio (DVH)', price: 29000 },
        triple: { label: 'Triple Vidrio', price: 40000 },
    },
    accesorios: {
        Palillos: { label: 'Palillaje', price: 3000 },
        cierre: { label: 'Mosquitero', price: 50000 },
        vierteaguas: { label: 'Vierteaguas', price: 8000 },
        zocalo: { label: 'Zócalo', price: 14000 },
        cremona: { label: 'Cremona', price: 19000 },
    },
    lineas: {
        'pvc_58cd': { label: 'PVC 58 CD', price: 0 },
        'pvc_70cd': { label: 'PVC 70 CD', price: 15000 },
        'pvc_58dj': { label: 'PVC 58 DJ', price: 10000 },
        'pvc_50dj': { label: 'PVC 50 DJ', price: 8000 },
        'pvc_pd10': { label: 'PVC PD-10', price: 12000 },
    },
};

import { VIDRIOS_FLAT } from '@/lib/data/vidrios';
const DEFAULT_VIDRIOS_DOC: ConfigDoc = {
    preciosBase: { base: 0 },
    aperturas: {},
    colores: {},
    manillas: {},
    vidrios: VIDRIOS_FLAT.reduce((acc, v) => {
        acc[v.value] = { label: v.label, price: v.price };
        return acc;
    }, {} as PriceMap),
    accesorios: {},
    lineas: {},
};

function smartMerge(defaultMap: PriceMap, dbMap: any) {
    const result = { ...defaultMap };
    if (!dbMap) return result;

    Object.keys(dbMap).forEach((key) => {
        const dbItem = dbMap[key];
        const defaultItem = result[key];
        result[key] = defaultItem ? { ...defaultItem, ...dbItem } : dbItem;
    });
    return result;
}

export default function AdminEditarValores() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<ConfigDoc | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [material, setMaterial] = useState<'aluminio' | 'pvc' | 'vidrios'>('aluminio');
    const [isRegistering, setIsRegistering] = useState(false);


    const basePriceId = useId();
    const emailId = useId();
    const passwordId = useId();

    const canEdit = !!user;
    const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
            if (u) fetchConfig();
        });
        return () => unsub();
    }, [material]);

    const getCurrentDefaults = () => (material === 'pvc' ? DEFAULT_PVC : material === 'vidrios' ? DEFAULT_VIDRIOS_DOC : DEFAULT_ALUMINIO);

    async function fetchConfig() {
        try {
            const refDoc = doc(db, 'configuracion', material);
            const snap = await getDoc(refDoc);
            const defaults = getCurrentDefaults();

            if (!snap.exists()) {
                await setDoc(refDoc, defaults);
                setConfig(defaults);
                return;
            }

            const data = snap.data() as ConfigDoc;

            const mergedConfig: ConfigDoc = {
                preciosBase: { ...defaults.preciosBase, ...data.preciosBase },
                aperturas: smartMerge(defaults.aperturas, data.aperturas),
                colores: smartMerge(defaults.colores, data.colores),
                manillas: smartMerge(defaults.manillas, data.manillas),
                vidrios: smartMerge(defaults.vidrios, data.vidrios),
                accesorios: smartMerge(defaults.accesorios, data.accesorios),
                lineas: smartMerge(defaults.lineas, data.lineas),
            };

            setConfig(mergedConfig);
        } catch (e: any) {
            setError(e.message);
        }
    }

    async function saveConfig(updated: ConfigDoc) {
        if (!canEdit) return alert("Debes iniciar sesión para guardar.");
        try {
            await setDoc(doc(db, 'configuracion', material), updated, { merge: true });
            setConfig(updated);
        } catch (e: any) {
            alert('Error guardando: ' + e.message);
        }
    }

    async function addOption(collectionKey: keyof ConfigDoc, key: string, payload: any) {
        if (!canEdit) return alert("No tienes permiso para agregar.");

        if (!config) return;
        const newConfig = JSON.parse(JSON.stringify(config)) as ConfigDoc;

        // @ts-ignore
        newConfig[collectionKey][key] = payload;

        await saveConfig(newConfig);
    }

    async function editOption(collectionKey: keyof ConfigDoc, key: string, payload: any) {
        if (!canEdit) return alert("No tienes permiso para editar.");

        if (!config) return;
        const newConfig = JSON.parse(JSON.stringify(config)) as ConfigDoc;

        // @ts-ignore
        newConfig[collectionKey][key] = { ...newConfig[collectionKey][key], ...payload };

        await saveConfig(newConfig);
    }

    async function deleteOption(collectionKey: keyof ConfigDoc, key: string) {
        if (!canEdit) return alert("No tienes permiso para borrar.");

        if (!config) return;

        const refDoc = doc(db, 'configuracion', material);

        await runTransaction(db, async (t) => {
            const snap = await t.get(refDoc);
            const data = snap.data() as any;
            delete data[collectionKey][key];
            t.set(refDoc, data);
        });

        const newConfig = { ...config } as any;
        delete newConfig[collectionKey][key];
        setConfig(newConfig);
    }

    async function uploadImage(file: File, path = `config-images/${file.name}`) {
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    }

    async function doLogin(e: React.FormEvent) {
        e.preventDefault();
        const target: any = e.target;
        setError(null);
        try {
            if (isRegistering) {
                const nombre = target.nombre.value;
                const apellido = target.apellido.value;
                const cargo = target.cargo.value;

                const userCredential = await createUserWithEmailAndPassword(auth, target.email.value, target.password.value);
                const newUser = userCredential.user;


                await setDoc(doc(db, 'users', newUser.uid), {
                    nombre,
                    apellido,
                    cargo,
                    email: newUser.email,
                    createdAt: new Date().toISOString(),
                    rol: 'user' // default role
                });
            } else {
                await signInWithEmailAndPassword(auth, target.email.value, target.password.value);
            }
        } catch (e: any) {
            if (e.code === 'auth/email-already-in-use') {
                setError('El correo ya está registrado.');
            } else if (e.code === 'auth/weak-password') {
                setError('La contraseña debe tener al menos 6 caracteres.');
            } else if (e.code === 'auth/invalid-email') {
                setError('Correo inválido.');
            } else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
                setError('Credenciales incorrectas.');
            } else {
                setError(e.message);
            }
        }
    }

    async function doLogout() {
        await signOut(auth);
        setConfig(null);
    }

    if (loading) return <div role="status" className="p-8">Cargando aplicación...</div>;


    async function verifyUserRole(user: User) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            await setDoc(userRef, {
                email: user.email,
                nombre: user.displayName?.split(' ')[0] || 'Usuario',
                apellido: user.displayName?.split(' ').slice(1).join(' ') || '',
                photoURL: user.photoURL,
                createdAt: new Date().toISOString(),
                rol: 'user'
            });
        }
    }

    async function handleGoogleLogin() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            await verifyUserRole(result.user);
            setError(null);
        } catch (e: any) {
            console.error(e);
            setError('Error al iniciar con Google. Intenta nuevamente.');
        }
    }

    if (!user)
        return (
            <main className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow">
                <h1 className="text-xl font-bold mb-4 text-center">
                    {isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
                </h1>
                {error && (
                    <div role="alert" className="text-red-600 mb-2 border border-red-400 p-2 rounded bg-red-50">
                        {error}
                    </div>
                )}
                <div className="space-y-4">
                    <form onSubmit={doLogin} className="space-y-4">
                        {isRegistering && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                        <input
                                            name="nombre"
                                            type="text"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                                        <input
                                            name="apellido"
                                            type="text"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                                    <input
                                        name="cargo"
                                        type="text"
                                        placeholder="Ej. Vendedor, Instalador"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                        required
                                    />
                                </div>
                            </>
                        )}
                        <div>
                            <label htmlFor={emailId} className="block text-sm font-medium text-gray-700 mb-1">
                                Correo Electrónico
                            </label>
                            <input
                                id={emailId}
                                name="email"
                                type="email"
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor={passwordId} className="block text-sm font-medium text-gray-700 mb-1">
                                Contraseña
                            </label>
                            <input
                                id={passwordId}
                                name="password"
                                type="password"
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                required
                            />
                        </div>
                        <button className="w-full bg-[#19a8aa] text-white p-2 rounded font-semibold hover:bg-[#158f91] transition-colors">
                            {isRegistering ? 'Registrarse' : 'Entrar'}
                        </button>
                    </form>

                    <div className="relative flex items-center justify-center text-sm">
                        <div className="border-t border-gray-200 w-full absolute"></div>
                        <span className="bg-white px-2 text-gray-500 relative z-10">O continuar con</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full bg-white border border-gray-300 text-gray-700 p-2 rounded font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                        Google Account
                    </button>
                </div>

                <div className="mt-4 text-center text-sm">
                    <button
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError(null);
                        }}
                        className="text-[#19a8aa] hover:underline"
                    >
                        {isRegistering
                            ? '¿Ya tienes cuenta? Inicia sesión'
                            : '¿No tienes cuenta? Regístrate'}
                    </button>
                </div>
            </main >
        );

    const categories: (keyof ConfigDoc)[] = ['lineas', 'aperturas', 'colores', 'manillas', 'vidrios', 'accesorios'];

    return (
        <main className="p-6 bg-gray-50 min-h-screen">
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <a
                        href={isAdmin ? "/admin" : "/"}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
                        title={isAdmin ? "Volver al Dashboard Central" : "Volver al Inicio"}
                    >
                        {isAdmin ? <LayoutDashboard size={20} /> : <ArrowLeft size={20} />}
                    </a>
                    <h1 className="text-2xl font-bold text-gray-800">Cripter — Configuración</h1>
                </div>

                <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-3">
                    {isAdmin ? (
                        <a href="/admin" className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded text-center font-medium">
                            Volver al Dashboard
                        </a>
                    ) : (
                        <a href="/" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded text-center font-medium">
                            Volver al Inicio
                        </a>
                    )}

                    <a href="/pvc" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-center">
                        Ventanas PVC
                    </a>

                    <a href="/aluminio" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-center">
                        Ventanas Aluminio
                    </a>

                    <a href="/admin/materiales" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-center">
                        Materiales
                    </a>

                    <a href="/presupuestos" className="bg-[#380ef5] hover:bg-[#2a0ab5] text-white px-4 py-2 rounded text-center">
                        Presupuestos
                    </a>

                    <a href="/cotizador-termopaneles" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-center">
                        Termopaneles
                    </a>

                    <div className="text-sm text-gray-600 px-2" aria-label="Usuario conectado">
                        {user?.email}
                    </div>

                    <button onClick={doLogout} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded">
                        Cerrar Sesión
                    </button>
                </nav>
            </header>

            <section aria-labelledby="material-selection" className="flex flex-col sm:flex-row gap-4 mb-6">
                <h2 id="material-selection" className="sr-only">Selección de Material</h2>
                <div className="flex p-1 bg-gray-200 rounded-lg" role="group" aria-label="Seleccionar material a editar">
                    <button
                        onClick={() => { setConfig(null); setMaterial('aluminio'); }}
                        aria-pressed={material === 'aluminio'}
                        className={`px-6 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#19a8aa] ${material === 'aluminio' ? 'bg-white text-[#19a8aa] shadow-sm' : 'text-gray-600 hover:bg-gray-300'
                            }`}
                    >
                        Aluminio
                    </button>
                    <button
                        onClick={() => { setConfig(null); setMaterial('pvc'); }}
                        aria-pressed={material === 'pvc'}
                        className={`px-6 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#19a8aa] ${material === 'pvc' ? 'bg-white text-[#19a8aa] shadow-sm' : 'text-gray-600 hover:bg-gray-300'
                            }`}
                    >
                        PVC
                    </button>
                    <button
                        onClick={() => { setConfig(null); setMaterial('vidrios'); }}
                        aria-pressed={material === 'vidrios'}
                        className={`px-6 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#19a8aa] ${material === 'vidrios' ? 'bg-white text-[#19a8aa] shadow-sm' : 'text-gray-600 hover:bg-gray-300'
                            }`}
                    >
                        Cristales
                    </button>
                </div>

                <div className="text-sm font-bold text-gray-500 uppercase flex items-center" aria-live="polite">
                    Editando: <span className="text-[#19a8aa] ml-1">{material}</span>
                </div>
            </section>

            {
                !config ? (
                    <div role="status" className="p-4 bg-yellow-50 rounded border border-yellow-200 text-yellow-800">
                        Cargando configuración...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {material === 'vidrios' ? (
                            <div className="md:col-span-3 space-y-6">
                                <CollectionEditor
                                    key="vidrios"
                                    label="Catálogo de Cristales"
                                    data={config.vidrios}
                                    colKey="vidrios"
                                    onAdd={addOption}
                                    onEdit={editOption}
                                    onDelete={deleteOption}
                                    onUploadImage={uploadImage}
                                    isAdmin={canEdit}
                                />
                            </div>
                        ) : (
                            <>
                                {/* PRECIO BASE */}
                                <section className="col-span-1 bg-white p-4 rounded-lg shadow border h-fit sticky top-6" aria-labelledby="heading-base-price">
                                    <h2 id="heading-base-price" className="font-bold text-lg mb-4 text-[#19a8aa]">Precio Base Global</h2>

                                    <div className="mb-3">
                                        <label htmlFor={basePriceId} className="block text-sm font-medium text-gray-700 mb-1">
                                            Monto Base ($)
                                        </label>
                                        <input
                                            id={basePriceId}
                                            type="number"
                                            disabled={!isAdmin}
                                            className="w-full border p-2 rounded disabled:bg-gray-100 focus:ring-2 focus:ring-[#19a8aa] outline-none"
                                            value={config.preciosBase.base}
                                            onChange={(e) =>
                                                canEdit &&
                                                setConfig(prev => prev ? { ...prev, preciosBase: { base: parseInt(e.target.value) || 0 } } : prev)
                                            }
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            disabled={!canEdit}
                                            className="flex-1 bg-[#19a8aa] hover:bg-[#158f91] text-white px-3 py-2 rounded disabled:bg-gray-300 transition-colors"
                                            onClick={() => canEdit && saveConfig(config)}
                                        >
                                            Guardar Todo
                                        </button>

                                        <button className="px-3 py-2 border rounded hover:bg-gray-50" onClick={fetchConfig}>
                                            Cancelar
                                        </button>
                                    </div>
                                </section>

                                {/* CATEGORÍAS */}
                                <section className="md:col-span-2 space-y-6" aria-label="Categorías de precios">
                                    {categories.map((colKey) => (
                                        <CollectionEditor
                                            key={colKey}
                                            label={colKey}
                                            data={(config as any)[colKey]}
                                            colKey={colKey}
                                            onAdd={addOption}
                                            onEdit={editOption}
                                            onDelete={deleteOption}
                                            onUploadImage={uploadImage}
                                            isAdmin={canEdit}
                                        />
                                    ))}
                                </section>
                            </>
                        )}

                    </div>
                )
            }
        </main >
    );
}

function CollectionEditor({ label, data, colKey, onAdd, onEdit, onDelete, onUploadImage, isAdmin }: any) {
    const [keyInput, setKeyInput] = useState('');
    const [labelInput, setLabelInput] = useState('');
    const [priceInput, setPriceInput] = useState<number>(0);

    // IDs únicos para los inputs del formulario
    const formKeyId = useId();
    const formLabelId = useId();
    const formPriceId = useId();

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        if (!isAdmin) return alert("No tienes permiso para agregar.");
        if (!keyInput) return alert("Ingrese clave");

        await onAdd(colKey, keyInput, {
            label: labelInput || keyInput,
            price: priceInput,
        });

        setKeyInput('');
        setLabelInput('');
        setPriceInput(0);
    }

    return (
        <article className="bg-white p-5 rounded-lg shadow border">

            <h3 className="font-bold text-lg mb-3 text-gray-700 capitalize">{label}</h3>

            {/* LISTA */}
            <ul className="space-y-3 mb-6">
                {Object.entries(data).map(([k, v]: any) => (
                    <li key={k} className="flex flex-col sm:flex-row justify-between bg-gray-50 p-3 rounded border">

                        <div>
                            <div className="font-semibold text-gray-900">{v.label}</div>
                            <div className="text-xs text-gray-500 font-mono">Clave interna: {k}</div>
                        </div>

                        <div className="flex items-center gap-4 mt-2 sm:mt-0">
                            <div className="font-medium text-[#19a8aa]">
                                <span className="sr-only">Precio:</span> ${v.price.toLocaleString()}
                            </div>

                            {isAdmin && (
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => {
                                            const newLabel = prompt("Nuevo nombre:", v.label);
                                            if (newLabel === null) return;
                                            const newPrice = prompt("Nuevo precio:", v.price);
                                            if (newPrice === null) return;

                                            onEdit(colKey, k, { label: newLabel, price: parseInt(newPrice) || 0 });
                                        }}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 focus:ring-2 focus:ring-blue-500"
                                        aria-label={`Editar ${v.label}`}
                                    >
                                        Editar
                                    </button>

                                    <button
                                        onClick={() => onDelete(colKey, k)}
                                        className="px-3 py-1 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 focus:ring-2 focus:ring-red-500"
                                        aria-label={`Borrar ${v.label}`}
                                    >
                                        Borrar
                                    </button>
                                </div>
                            )}

                        </div>
                    </li>
                ))}
            </ul>

            {/* AGREGAR */}
            {isAdmin && (
                <div className="bg-gray-50 p-4 rounded border border-dashed border-gray-400">
                    <h4 className="text-sm font-bold text-gray-600 mb-3">Agregar nuevo elemento en {label}</h4>

                    <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3">

                        <div className="md:col-span-3">
                            <label htmlFor={formKeyId} className="block text-xs font-semibold text-gray-500 mb-1">Clave (ID)</label>
                            <input
                                id={formKeyId}
                                value={keyInput}
                                onChange={(e) => setKeyInput(e.target.value)}
                                placeholder="ej: blanco_mate"
                                className="w-full border p-2 rounded focus:ring-1 focus:ring-[#19a8aa] outline-none"
                                required
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label htmlFor={formLabelId} className="block text-xs font-semibold text-gray-500 mb-1">Nombre Visible</label>
                            <input
                                id={formLabelId}
                                value={labelInput}
                                onChange={(e) => setLabelInput(e.target.value)}
                                placeholder="ej: Blanco Mate"
                                className="w-full border p-2 rounded focus:ring-1 focus:ring-[#19a8aa] outline-none"
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label htmlFor={formPriceId} className="block text-xs font-semibold text-gray-500 mb-1">Precio ($)</label>
                            <input
                                id={formPriceId}
                                type="number"
                                value={priceInput}
                                onChange={(e) => setPriceInput(parseInt(e.target.value) || 0)}
                                className="w-full border p-2 rounded focus:ring-1 focus:ring-[#19a8aa] outline-none"
                            />
                        </div>

                        <div className="md:col-span-3 flex items-end">
                            <button className="w-full bg-[#19a8aa] hover:bg-[#158f91] text-white p-2 rounded font-medium transition-colors">
                                Agregar
                            </button>
                        </div>
                    </form>
                </div>
            )}

        </article>
    );
}
