'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, getDocs, query, orderBy, limit, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ADMIN_EMAILS } from '@/lib/constants';
import {
    LayoutDashboard,
    Settings,
    ClipboardList,
    TrendingUp,
    Users,
    Package,
    LogOut,
    ArrowUpRight,
    Search,
    Filter,
    Calendar,
    ChevronRight,
    DollarSign,
    Square as WindowIcon,
    Shield,
    Trash2,
    Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces ---
interface DashboardStats {
    totalBudgets: number;
    totalRevenue: number;
    avgBudget: number;
    budgetsThisMonth: number;
}

interface RecentBudget {
    id: string;
    clientName: string;
    totalPrice: number;
    date: Date;
    type: 'window' | 'termopanel';
    budgetNumber: number;
}

interface AdminUser {
    id: string;
    email: string;
    nombre?: string;
    apellido?: string;
    cargo?: string;
    rol: 'admin' | 'user';
    createdAt?: string;
}

export default function AdminDashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalBudgets: 0,
        totalRevenue: 0,
        avgBudget: 0,
        budgetsThisMonth: 0
    });
    const [recentBudgets, setRecentBudgets] = useState<RecentBudget[]>([]);
    const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
            if (u) {
                fetchDashboardData();
                fetchUsers();
            }
        });
        return () => unsub();
    }, []);

    async function fetchDashboardData() {
        try {
            // Fetch Window Budgets
            const qWindow = query(collection(db, 'presupuestos'), orderBy('date', 'desc'));
            const snapWindow = await getDocs(qWindow);

            // Fetch Termopanel Budgets
            const qTermo = query(collection(db, 'presupuestos_termopaneles'), orderBy('createdAt', 'desc'));
            const snapTermo = await getDocs(qTermo);

            const allBudgets: RecentBudget[] = [];
            let totalRev = 0;
            let thisMonthCount = 0;
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // Process Windows
            snapWindow.forEach(doc => {
                const data = doc.data();
                const date = data.date instanceof Timestamp ? data.date.toDate() : new Date();
                const price = data.totalPriceWithIVA || 0;
                totalRev += price;
                if (date >= startOfMonth) thisMonthCount++;

                allBudgets.push({
                    id: doc.id,
                    clientName: data.clientName || 'Cliente Anónimo',
                    totalPrice: price,
                    date: date,
                    type: 'window',
                    budgetNumber: data.budgetNumber || data.projectId || 0
                });
            });

            // Process Termopaneles
            snapTermo.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
                const price = (data.totalNeto || 0) * 1.19; // Estimate IVA for aggregation
                totalRev += price;
                if (createdAt >= startOfMonth) thisMonthCount++;

                allBudgets.push({
                    id: doc.id,
                    clientName: data.clientName || 'Cliente Anónimo',
                    totalPrice: price,
                    date: createdAt,
                    type: 'termopanel',
                    budgetNumber: data.budgetNumber || 0
                });
            });

            // Final Stats
            const totalCount = allBudgets.length;
            setStats({
                totalBudgets: totalCount,
                totalRevenue: totalRev,
                avgBudget: totalCount > 0 ? totalRev / totalCount : 0,
                budgetsThisMonth: thisMonthCount
            });

            // Sort and Get Recent
            allBudgets.sort((a, b) => b.date.getTime() - a.date.getTime());
            setRecentBudgets(allBudgets.slice(0, 8));

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        }
    }

    async function fetchUsers() {
        try {
            const q = query(collection(db, 'users'));
            const snap = await getDocs(q);
            const usersList: AdminUser[] = [];
            snap.forEach(doc => {
                usersList.push({ id: doc.id, ...doc.data() } as AdminUser);
            });
            setAllUsers(usersList);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    }

    async function handleUpdateRole(userId: string, newRole: 'admin' | 'user') {
        try {
            await updateDoc(doc(db, 'users', userId), { rol: newRole });
            setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: newRole } : u));
        } catch (error) {
            console.error("Error updating role:", error);
            alert("Error al actualizar el rol");
        }
    }

    async function handleDeleteUser(userId: string) {
        if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
            setAllUsers(prev => prev.filter(u => u.id !== userId));
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Error al eliminar el usuario");
        }
    }

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

    const handleLogout = async () => {
        await signOut(auth);
        window.location.href = '/';
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#19a8aa] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium tracking-wide">Iniciando Portal Admin...</p>
            </div>
        </div>
    );

    if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                    <Settings className="w-10 h-10 text-red-600 animate-pulse" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h1>
                <p className="text-slate-500 max-w-sm mb-8">
                    Esta área es exclusiva para administradores autorizados. Por favor, inicia sesión con una cuenta válida.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="/admin/config" className="px-8 py-3 bg-[#19a8aa] text-white rounded-full font-bold shadow-lg shadow-[#19a8aa]/20 hover:scale-105 transition-transform text-sm">
                        Configuración de Precios
                    </a>
                    <a href="/" className="px-8 py-3 bg-slate-200 text-slate-700 rounded-full font-bold hover:bg-slate-300 transition-all text-sm">
                        Volver al Inicio
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-0 h-screen">
                <div className="p-8 border-b border-slate-100 mb-6">
                    <div className="flex items-center gap-3">
                        <img src="/images/logo.png" alt="Logo Cripter" className="w-10 h-10 object-contain" />
                        <div>
                            <span className="font-extrabold text-xl tracking-tight text-slate-800">Cripter</span>
                            <p className="text-[10px] font-bold text-[#19a8aa] uppercase tracking-[0.2em] leading-none">Limitada</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <SidebarLink icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                    <SidebarLink icon={<Settings size={20} />} label="Configuración Precios" onClick={() => window.location.href = '/admin/config'} />
                    <SidebarLink icon={<Archive size={20} />} label="Inventario Materiales" onClick={() => window.location.href = '/admin/materiales'} />
                    <SidebarLink icon={<ClipboardList size={20} />} label="Presupuestos" onClick={() => window.location.href = '/presupuestos'} />
                    <SidebarLink icon={<Users size={20} />} label="Usuarios" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
                </nav>

                <div className="p-6 mt-auto border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-2xl">
                        <div className="w-10 h-10 bg-[#19a8aa] rounded-full flex items-center justify-center text-white font-bold">
                            {user.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{user.email?.split('@')[0]}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Administrator</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-3 text-red-500 font-bold text-sm bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                    >
                        <LogOut size={18} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 lg:p-10 space-y-8 max-w-7xl mx-auto overflow-x-hidden">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            {activeTab === 'overview' ? `Bienvenido, ${user.email?.split('@')[0]}` : 'Gestión de Usuarios'}
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            {activeTab === 'overview'
                                ? 'Aquí tienes un resumen de la actividad del negocio.'
                                : 'Administra los accesos y roles de tu equipo.'}
                        </p>
                    </div>
                    {activeTab === 'overview' && (
                        <div className="flex gap-3 w-full md:w-auto">
                            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                                <Calendar size={18} />
                                Este Mes
                            </button>
                            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#19a8aa] text-white rounded-xl font-bold text-sm shadow-xl shadow-[#19a8aa]/20 hover:scale-[1.02] active:scale-95 transition-all">
                                Nuevo Reporte
                            </button>
                        </div>
                    )}
                </header>

                <AnimatePresence mode="wait">
                    {activeTab === 'overview' ? (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard
                                    icon={<DollarSign size={24} />}
                                    label="Ingresos Totales"
                                    value={formatCurrency(stats.totalRevenue)}
                                    trend="+12%"
                                    color="bg-emerald-500"
                                />
                                <StatCard
                                    icon={<ClipboardList size={24} />}
                                    label="Presupuestos Emitidos"
                                    value={stats.totalBudgets.toString()}
                                    trend="+5%"
                                    color="bg-blue-500"
                                />
                                <StatCard
                                    icon={<TrendingUp size={24} />}
                                    label="Ticket Promedio"
                                    value={formatCurrency(stats.avgBudget)}
                                    trend="-2%"
                                    color="bg-orange-500"
                                />
                                <StatCard
                                    icon={<Package size={24} />}
                                    label="Este Mes"
                                    value={stats.budgetsThisMonth.toString()}
                                    trend="+18%"
                                    color="bg-purple-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                {/* Recent Activity */}
                                <div className="xl:col-span-2 space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                            <ArrowUpRight className="text-[#19a8aa]" size={20} />
                                            Actividad Reciente
                                        </h2>
                                        <button onClick={() => window.location.href = '/presupuestos'} className="text-sm font-bold text-[#19a8aa] hover:underline">Ver Todo</button>
                                    </div>

                                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">N°</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tipo</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Monto</th>
                                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {recentBudgets.map((budget, i) => (
                                                    <motion.tr
                                                        key={budget.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        className="group hover:bg-slate-50 transition-colors"
                                                    >
                                                        <td className="px-6 py-5">
                                                            <span className="text-sm font-extrabold text-[#19a8aa]">#{budget.budgetNumber}</span>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-800">{budget.clientName}</p>
                                                                <p className="text-[10px] text-slate-400 font-medium">{budget.date.toLocaleDateString('es-CL')}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-sm font-bold text-slate-600">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] uppercase ${budget.type === 'window' ? 'bg-blue-100 text-blue-600' : 'bg-teal-100 text-teal-600'}`}>
                                                                {budget.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-5 text-sm font-extrabold text-slate-800">
                                                            {formatCurrency(budget.totalPrice)}
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <button
                                                                onClick={() => window.location.href = `/presupuestos?editId=${budget.id}`}
                                                                className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 group-hover:text-[#19a8aa] group-hover:bg-[#19a8aa]/10 transition-all"
                                                            >
                                                                <ChevronRight size={18} />
                                                            </button>
                                                        </td>
                                                    </motion.tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Quick Shortcuts */}
                                <div className="space-y-6">
                                    <h2 className="text-xl font-bold text-slate-800">Accesos Rápidos</h2>
                                    <div className="grid grid-cols-1 gap-4">
                                        <ShortcutCard
                                            icon={<WindowIcon size={22} />}
                                            title="Cotizador Aluminio"
                                            description="Gestionar cotizaciones de líneas de aluminio."
                                            link="/aluminio"
                                            color="border-emerald-200 bg-emerald-50 text-emerald-600"
                                        />
                                        <ShortcutCard
                                            icon={<WindowIcon size={22} />}
                                            title="Cotizador PVC"
                                            description="Cotizador inteligente para sistemas de PVC."
                                            link="/pvc"
                                            color="border-blue-200 bg-blue-50 text-blue-600"
                                        />
                                        <ShortcutCard
                                            icon={<Settings size={22} />}
                                            title="Ajustes de Precios"
                                            description="Actualizar valores de perfiles y cristales."
                                            link="/admin/config"
                                            color="border-slate-200 bg-slate-100 text-slate-600"
                                        />
                                        <ShortcutCard
                                            icon={<Archive size={22} />}
                                            title="Gestión de Materiales"
                                            description="Administrar inventario de insumos."
                                            link="/admin/materiales"
                                            color="border-purple-200 bg-purple-50 text-purple-600"
                                        />
                                    </div>

                                    <div className="bg-[#19a8aa] rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-[#19a8aa]/30">
                                        <div className="relative z-10">
                                            <h3 className="text-xl font-bold mb-2">Manual de Usuario</h3>
                                            <p className="text-[#e2f8f8] text-sm font-medium mb-6">Aprende a gestionar tu catálogo y presupuestos de forma eficiente.</p>
                                            <button className="px-6 py-3 bg-white text-[#19a8aa] rounded-2xl font-bold text-sm hover:scale-105 transition-transform">
                                                Descargar PDF
                                            </button>
                                        </div>
                                        <Package className="absolute right-[-20px] bottom-[-20px] opacity-10 w-40 h-40" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="users"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-between items-center px-2">
                                <div className="flex bg-white border border-slate-200 p-1 rounded-xl">
                                    <button className="px-4 py-2 bg-slate-100 text-slate-800 rounded-lg text-sm font-bold">Todos {allUsers.length}</button>
                                    <button className="px-4 py-2 text-slate-400 rounded-lg text-sm font-bold hover:text-slate-600">Admin</button>
                                    <button className="px-4 py-2 text-slate-400 rounded-lg text-sm font-bold hover:text-slate-600">Vendedores</button>
                                </div>
                                <button
                                    onClick={fetchUsers}
                                    className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-[#19a8aa] hover:border-[#19a8aa]/30 transition-all"
                                    title="Refrescar Lista"
                                >
                                    <LayoutDashboard size={18} />
                                </button>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Usuario</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contacto</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Rol</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Registro</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {allUsers.map((u, i) => (
                                            <motion.tr
                                                key={u.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="hover:bg-slate-50/50 transition-colors"
                                            >
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-[#19a8aa]">
                                                            {u.nombre?.[0] || u.email[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">
                                                                {u.nombre} {u.apellido}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{u.cargo || 'Sin Cargo'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="text-sm font-medium text-slate-600">{u.email}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <select
                                                        value={u.rol}
                                                        onChange={(e) => handleUpdateRole(u.id, e.target.value as any)}
                                                        className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full border-0 focus:ring-2 focus:ring-[#19a8aa] cursor-pointer ${u.rol === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'
                                                            }`}
                                                    >
                                                        <option value="user">Vendedor</option>
                                                        <option value="admin">Administrador</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-5 text-sm font-medium text-slate-500">
                                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id)}
                                                            className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                                            title="Eliminar Usuario"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

// --- Subcomponents ---

function SidebarLink({ icon, label, active = false, disabled = false, onClick }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${active
                ? 'bg-[#19a8aa] text-white shadow-lg shadow-[#19a8aa]/30'
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
            {icon}
            {label}
        </button>
    );
}

function StatCard({ icon, label, value, trend, color }: any) {
    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all group">
            <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/5`}>
                    {icon}
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${trend.startsWith('+') ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {trend}
                </span>
            </div>
            <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function ShortcutCard({ icon, title, description, link, color }: any) {
    return (
        <button
            onClick={() => window.location.href = link}
            className={`flex items-start gap-5 p-5 rounded-3xl border text-left hover:scale-[1.02] active:scale-95 transition-all ${color}`}
        >
            <div className="mt-1">{icon}</div>
            <div>
                <h4 className="font-bold text-sm mb-1">{title}</h4>
                <p className="text-xs opacity-70 leading-relaxed font-medium">{description}</p>
            </div>
        </button>
    );
}
