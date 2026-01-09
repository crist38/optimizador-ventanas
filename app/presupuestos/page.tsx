'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, orderBy, query, deleteDoc, doc, where, addDoc, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDown, Loader2, FileText, Trash2, X, LogOut, Lock, Download, Edit, LayoutDashboard, Settings, Copy, RefreshCw } from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import SharedWindowPreview from '@/components/SharedWindowPreview';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// Constantes
const BUDGETS_COLLECTION = 'presupuestos';
const TERMOPANEL_COLLECTION = 'presupuestos_termopaneles';
import { ADMIN_EMAILS } from '@/lib/constants';

const formatCLP = (amount: number) => {
  if (isNaN(amount)) return '$0';
  return `$${Math.round(amount).toLocaleString('es-CL')}`;
};

const OPENING_NAMES: Record<string, string> = {
  fixed: 'Fijo',
  proyectante: 'Proyectante',
  abatible: 'Abatible',
  tilt_turn: 'Oscilobatiente',
  corredera: 'Corredera',
  door_right: 'Puerta (Ap. Derecha)',
  door_left: 'Puerta (Ap. Izquierda)',
  open_right: 'Practicable Derecha',
  open_left: 'Practicable Izquierda',
  practicable: 'Practicable',
};

const MATERIAL_MAP: Record<string, string> = {
  white: 'Blanco (Aluminio)',
  black: 'Negro (Aluminio)',
  matte: 'Mate (Aluminio)',
  titanium: 'Titanio (Aluminio)',
  walnut: 'Nogal (Aluminio)',
  golden_oak: 'Roble Dorado (Aluminio)',
  // PVC Defaults if simple strings used
  roble_dorado: 'Roble Dorado (PVC)',
  nogal: 'Nogal (PVC)',
};

// --- Interfaces ---
interface SavedAccessory {
  id: string;
  name: string;
  price: number;
}

interface SavedWindow {
  id: number | string;
  width: number;
  height: number;
  type: string;
  sashCount?: number;
  system?: {
    id?: string;
    name: string;
    color: string;
  };
  glass?: {
    name: string;
  };
  material?: string; // Aluminum identifier
  line?: string; // 'Aluminio' | 'PVC' | etc.
  accessories?: SavedAccessory[] | string[];
  palillosH?: number;
  palillosV?: number;
  glassColor?: string;
  frameThick?: number;
  price?: number;

  // Legacy fields
  name?: string;
  numLeaves?: number;
  frameColor?: string;
  handleColor?: string;
  glassType?: string;
  sashWidths?: number[];
}

interface BudgetData {
  id: string;
  budgetNumber: number;
  clientName: string;
  totalPrice: number;
  totalPriceWithIVA: number;
  date: Date;
  windows?: SavedWindow[]; // Optional for termopaneles
  items?: any[]; // For termopaneles
  userId?: string;
  type?: 'window' | 'termopanel'; // Distributor flag
  globalAdjustment?: number;
}

interface BudgetDetailsDialogProps {
  budget: BudgetData;
  onClose: () => void;
}

// --- Componente Dialog Detalle ---
const BudgetDetailsDialog: React.FC<BudgetDetailsDialogProps> = ({ budget, onClose }) => {
  const previewRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!budget) return null;

  const handleReprintPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;

      // Title
      doc.setFontSize(22);
      doc.text('Presupuesto de Ventanas', pageWidth / 2, margin, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`Cliente: ${budget.clientName}`, margin, margin + 15);
      doc.text(`Fecha: ${budget.date.toLocaleDateString('es-CL')}`, margin, margin + 22);
      doc.text(`Presupuesto N°: ${budget.budgetNumber}`, margin, margin + 29);

      let yPos = margin + 45;

      if (budget.windows && budget.windows.length > 0) {
        for (let i = 0; i < budget.windows.length; i++) {
          const win = budget.windows[i];

          // Render Image
          const previewElement = previewRefs.current[i];
          if (previewElement) {
            const imgHeight = 60;
            const imgWidth = 60;
            try {
              const dataUrl = await toPng(previewElement, { cacheBust: true, pixelRatio: 2 });

              // Check page break
              if (yPos + imgHeight + 40 > pageHeight) {
                doc.addPage();
                yPos = margin;
              }

              // Draw Window Details (Text)
              doc.setFontSize(14);
              doc.text(`Ventana #${i + 1}`, margin, yPos);

              doc.setFontSize(10);
              const typeName = OPENING_NAMES[win.type] || win.type || 'Desconocido';

              // Material name Logic for PDF
              let systemName = 'Estándar';
              let navLine = win.line || '';
              // Attempt inference for legacy data
              if (!navLine) {
                if (['matte', 'titanium'].includes(win.material || '')) navLine = 'Aluminio';
                else if (['anthracite'].includes(win.material || '')) navLine = 'PVC';
                if (win.system && win.system.name) {
                  if (win.system.name.includes('PVC')) navLine = 'PVC';
                  else if (win.system.name.includes('Aluminio')) navLine = 'Aluminio';
                }
              }

              if (win.system?.name) systemName = win.system.name;
              else if (win.material) systemName = win.material;

              if (navLine && !systemName.toLowerCase().includes(navLine.toLowerCase())) {
                systemName += ` (${navLine})`;
              }
              if (win.system?.color) systemName += ` - ${win.system.color}`;

              doc.text(`Dimensiones: ${win.width} x ${win.height} mm`, margin, yPos + 8);
              doc.text(`Tipo: ${typeName}`, margin, yPos + 14);
              doc.text(`Sistema: ${systemName}`, margin, yPos + 20);

              const glassName = win.glass?.name || win.glassType || 'Estándar';
              doc.text(`Vidrio: ${glassName}`, margin, yPos + 26);

              // Palillaje Text
              if ((win.palillosH && win.palillosH > 0) || (win.palillosV && win.palillosV > 0)) {
                doc.text(`Palillaje: ${win.palillosH || 0} Horizontal x ${win.palillosV || 0} Vertical`, margin, yPos + 32);
                yPos += 6;
              }

              // Accessory text
              let accText = 'Ninguno';
              if (Array.isArray(win.accessories)) {
                const accList = win.accessories as any[];
                if (accList.length > 0) {
                  if (typeof accList[0] === 'string') accText = accList.join(', ');
                  else accText = accList.map((a: SavedAccessory) => a.name).join(', ');
                }
              }
              doc.text(`Accesorios: ${accText}`, margin, yPos + 32);

              // Draw Image (Right side)
              doc.addImage(dataUrl, 'PNG', pageWidth - margin - imgWidth, yPos - 5, imgWidth, imgHeight);

            } catch (err) {
              console.error("Error generating image for PDF", err);
              // Fallback text if image fails
              doc.text('(Imagen no disponible)', pageWidth - margin - imgWidth, yPos + 10);
            }

            // Always advance yPos
            yPos += 70; // Fixed height per row (60mm image + 10mm padding)
          }
        }
      }

      // Totals
      if (yPos + 40 > pageHeight) doc.addPage();

      doc.setDrawColor(200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      const finalNeto = Math.round(budget.totalPrice * (1 + (budget.globalAdjustment || 0) / 100));
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL NETO: ${formatCLP(finalNeto)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 8;
      doc.text(`IVA (19%): ${formatCLP(Math.round(finalNeto * 0.19))}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 8;
      doc.text(`TOTAL A PAGAR: ${formatCLP(budget.totalPriceWithIVA)}`, pageWidth - margin, yPos, { align: 'right' });

      doc.save(`Presupuesto_${budget.budgetNumber}_${budget.clientName.replace(/\s+/g, '_')}.pdf`);

    } catch (error) {
      console.error("Error generating PDF", error);
      alert("Error al generar PDF. Intente nuevamente.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center backdrop-blur-sm p-4">
      <Card className="relative w-full max-w-4xl bg-white dark:bg-slate-900 shadow-2xl rounded-lg max-h-[90vh] overflow-y-auto flex flex-col dark:border dark:border-slate-800">
        <div className="flex justify-between items-center border-b dark:border-slate-800 p-6 sticky top-0 bg-white dark:bg-slate-900 z-10 shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Detalles del Presupuesto N° {budget.budgetNumber}</h2>
            <Button onClick={handleReprintPDF} variant="outline" size="sm" className="mt-2 text-blue-600 border-blue-200 hover:bg-blue-50">
              <Download className="w-4 h-4 mr-2" /> Descargar PDF
            </Button>
          </div>
          <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-500 hover:text-red-500">
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-slate-800/50 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium text-gray-500">Cliente</p>
              <p className="font-semibold text-gray-900 break-words">{budget.clientName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Fecha</p>
              <p className="font-semibold text-gray-900 dark:text-slate-100">{budget.date.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
            </div>
          </Card>

          <h3 className="text-xl font-semibold border-b pb-2">Configuración de Ventanas ({budget.windows?.length || 0})</h3>
          <div className="space-y-4">
            {budget.windows && budget.windows.map((win, index) => {
              const typeName = OPENING_NAMES[win.type] || win.type || win.name || 'Desconocido';
              const w = win.width;
              const h = win.height;

              // Infer sash count
              let sashCount = (win.sashCount !== undefined) ? win.sashCount : (win.numLeaves || 1);
              if (win.sashCount === undefined && typeof win.numLeaves === 'undefined') {
                const t = (win.type || '').toLowerCase();
                if (t.includes('corredera')) sashCount = 2;
                else sashCount = 1;
              }

              // Infer material and colors
              let matName = 'Estándar';
              let frameColorHex = '#ffffff';

              let navLine = win.line || '';
              // Attempt inference for legacy data
              if (!navLine) {
                if (['matte', 'titanium'].includes(win.material || '')) navLine = 'Aluminio';
                else if (['anthracite'].includes(win.material || '')) navLine = 'PVC';

                // Check system name for clues
                if (win.system && win.system.name) {
                  if (win.system.name.includes('PVC')) navLine = 'PVC';
                  else if (win.system.name.includes('Aluminio')) navLine = 'Aluminio';
                }
              }

              if (win.system) {
                matName = win.system.name;
                if (win.system.color && win.system.color.startsWith('#')) {
                  frameColorHex = win.system.color;
                }
              } else if (win.material) {
                const baseNames: Record<string, string> = {
                  white: 'Blanco', black: 'Negro', matte: 'Mate', titanium: 'Titanio',
                  walnut: 'Nogal', golden_oak: 'Roble Dorado', anthracite: 'Antracita'
                };
                matName = baseNames[win.material] || win.material;

                if (win.material === 'black' || win.material === 'anthracite') frameColorHex = '#111827';
                if (win.material === 'walnut') frameColorHex = '#5d4037';
                if (win.material === 'golden_oak') frameColorHex = '#b58149';
              } else if (win.frameColor) {
                matName = win.frameColor;
                if (win.frameColor.startsWith('#')) frameColorHex = win.frameColor;
              }

              // Append Line if inferred
              if (navLine && !matName.toLowerCase().includes(navLine.toLowerCase())) {
                matName = `${matName} (${navLine})`;
              }

              const glassColorHex = win.glassColor || '#e0f2fe';
              const vidName = win.glass?.name || win.glassType || 'Estándar';

              let accText = 'Ninguno';
              let accListStr: string[] = [];
              if (Array.isArray(win.accessories) && win.accessories.length > 0) {
                const accList = win.accessories as any[];
                if (typeof accList[0] === 'string') {
                  accText = accList.join(', ');
                  accListStr = accList;
                } else {
                  accText = accList.map((a: SavedAccessory) => a.name).join(', ');
                  accListStr = accList.map((a: SavedAccessory) => a.id || a.name);
                }
              }

              return (
                <Card key={index} className="p-4 border-l-4 border-[#380ef5] shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-900 dark:border-y-slate-800 dark:border-r-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Details */}
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">Ventana #{index + 1}</h4>
                      <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">ID: {win.id}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 uppercase">Apertura</span>
                      <span className="font-medium text-slate-800">{typeName}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 uppercase">Dimensiones</span>
                      <span className="font-medium text-slate-800">{w} x {h} mm</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 uppercase">Hojas</span>
                      <span className="font-medium text-slate-800">{sashCount}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 uppercase">Perfil/Color</span>
                      <span className="font-medium text-slate-800">{matName}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 uppercase">Vidrio</span>
                      <span className="font-medium text-slate-800">{vidName}</span>
                    </div>
                    <div className="border-t pt-2 mt-1">
                      <span className="block text-xs text-slate-400 uppercase">Accesorios</span>
                      <span className="font-medium text-slate-800">{accText}</span>
                    </div>
                    {(win.palillosH || win.palillosV) ? (
                      <div className="text-xs text-slate-500 mt-1">
                        Palillos: {win.palillosH || 0}H x {win.palillosV || 0}V
                      </div>
                    ) : null}
                  </div>

                  {/* Right: Preview */}
                  <div
                    className="relative bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center p-4 h-64 md:h-auto"
                    ref={(el) => { previewRefs.current[index] = el; }}
                  >
                    <SharedWindowPreview
                      width={w}
                      height={h}
                      type={win.type}
                      sashCount={Number(sashCount)}
                      frameColor={frameColorHex}
                      glassColor={glassColorHex}
                      frameThick={win.frameThick || 40}
                      showShadow={false}
                      palillosH={win.palillosH || 0}
                      palillosV={win.palillosV || 0}
                      accessories={accListStr}
                      sashWidths={win.sashWidths || []}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end p-4 border-t dark:border-slate-800 bg-gray-50 dark:bg-slate-900 rounded-b-lg">
          <Button onClick={onClose} variant="outline">Cerrar</Button>
        </div>
      </Card >
    </div >
  );
};

// --- Página Principal ---
export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetData | null>(null);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 1. Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      fetchBudgets(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Budgets
  const fetchBudgets = async (currentUser: User | null) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!currentUser) {
        setBudgets([]);
        setIsLoading(false);
        return;
      }

      const isAdmin = currentUser.email && ADMIN_EMAILS.includes(currentUser.email);
      let qWindow, qTermo;

      if (isAdmin) {
        qWindow = query(collection(db, BUDGETS_COLLECTION), orderBy('date', 'desc'));
        qTermo = query(collection(db, TERMOPANEL_COLLECTION), orderBy('createdAt', 'desc'));
        // Note: Termopanel uses createdAt, Window uses date. normalize later.
      } else {
        qWindow = query(collection(db, BUDGETS_COLLECTION), where('userId', '==', currentUser.uid), orderBy('date', 'desc'));
        qTermo = query(collection(db, TERMOPANEL_COLLECTION), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      }

      const [snapWindow, snapTermo] = await Promise.all([
        getDocs(qWindow),
        getDocs(qTermo)
      ]);

      const combinedBudgets: BudgetData[] = [];

      // Process Windows
      snapWindow.forEach((doc) => {
        const data = doc.data();
        let bNum = data.budgetNumber;
        if (!bNum && data.projectId) bNum = parseInt(data.projectId);

        // Calculate Totals if missing
        let total = data.totalPrice || 0;
        let totalIVA = data.totalPriceWithIVA || Math.round(total * 1.19);

        combinedBudgets.push({
          id: doc.id,
          budgetNumber: bNum || 0,
          clientName: data.clientName || 'Sin Nombre',
          totalPrice: total,
          totalPriceWithIVA: totalIVA,
          date: data.date ? data.date.toDate() : new Date(),
          windows: data.windows || [],
          userId: data.userId,
          globalAdjustment: data.globalAdjustment || 0,
          type: 'window'
        });
      });

      // Process Termopaneles
      snapTermo.forEach((doc) => {
        const data = doc.data();

        let total = data.totalNeto || 0;
        let totalIVA = Math.round(total * 1.19); // Assuming NETO saved

        combinedBudgets.push({
          id: doc.id,
          budgetNumber: data.budgetNumber || 0,
          clientName: data.clientName || 'Sin Nombre',
          totalPrice: total,
          totalPriceWithIVA: totalIVA,
          date: data.createdAt ? data.createdAt.toDate() : new Date(),
          items: data.items || [],
          userId: data.userId,
          type: 'termopanel'
        });
      });

      // Sort combined list by date desc
      combinedBudgets.sort((a, b) => b.date.getTime() - a.date.getTime());

      setBudgets(combinedBudgets);

    } catch (err: any) {
      console.error("Error al obtener:", err);
      if (err.code === 'permission-denied') {
        setError("Acceso denegado. No tienes permisos para ver estos datos.");
      } else if (err.message.includes('requires an index')) {
        setError("Falta un índice en Firebase. Revisa la consola.");
        console.error("FIREBASE INDEX ERROR: Check console link.");
      } else {
        setError("Error cargando presupuestos. Verifica tu conexión.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Delete Budget
  const handleDelete = async (budget: BudgetData) => {
    if (!window.confirm(`¿Eliminar Presupuesto N° ${budget.budgetNumber}?`)) return;

    try {
      const col = budget.type === 'termopanel' ? TERMOPANEL_COLLECTION : BUDGETS_COLLECTION;
      await deleteDoc(doc(db, col, budget.id));
      setBudgets(prev => prev.filter(b => b.id !== budget.id));
      alert(`Presupuesto N° ${budget.budgetNumber} eliminado.`);
    } catch (err) {
      console.error("Error eliminando:", err);
      alert("Error al eliminar. Verifica permisos.");
    }
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setShowLoginModal(false);
    } catch (err: any) {
      console.error("Login failed", err);
      setError('Credenciales incorrectas o error de conexión.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleViewDetails = (budget: BudgetData) => {
    // Basic Details View for Window Budgets - for Termopanel maybe direct edit/print?
    // For now reuse existing dialog if it's window type, else maybe custom or just generic.
    // Existing dialog relies heavily on budget.windows.
    if (budget.type === 'termopanel') {
      // Quick hack: Just open edit for now or show basic alert
      // A proper details view for Termopanel would require a similar Dialog component.
      // Let's redirect to edit for best "View" experience for now.
      handleEdit(budget);
    } else {
      setSelectedBudget(budget);
    }
  };

  const handleEdit = (budget: BudgetData) => {
    if (budget.type === 'termopanel') {
      window.location.href = `/cotizador-termopaneles?editId=${budget.id}`;
      return;
    }

    let targetRoute = '/aluminio';
    if (budget.windows && budget.windows.length > 0) {
      const firstWin = budget.windows[0];
      const line = (firstWin.line || '').toLowerCase();
      const material = (firstWin.material || '').toLowerCase();
      const systemName = (firstWin.system?.name || '').toLowerCase();

      if (line.includes('pvc') || material.includes('anthracite') || systemName.includes('pvc')) {
        targetRoute = '/pvc';
      }
    }
    window.location.href = `${targetRoute}?editId=${budget.id}`;
  };

  const handleDuplicateAndSwitch = async (budget: BudgetData) => {
    if (!budget.windows || budget.windows.length === 0) {
      alert("Este presupuesto no tiene ventanas para duplicar.");
      return;
    }

    const firstWin = budget.windows[0];
    const isAluminio = !((firstWin.line || '').toLowerCase().includes('pvc') ||
      (firstWin.material || '').toLowerCase().includes('anthracite') ||
      (firstWin.system?.name || '').toLowerCase().includes('pvc'));

    const targetMaterial = isAluminio ? 'PVC' : 'Aluminio';

    if (!window.confirm(`¿Deseas duplicar este presupuesto de ${isAluminio ? 'Aluminio' : 'PVC'} a ${targetMaterial}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      // Fetch next budget number
      let nextId = 1;
      const user = auth.currentUser;
      if (user) {
        const q = query(
          collection(db, BUDGETS_COLLECTION),
          where('userId', '==', user.uid),
          orderBy('budgetNumber', 'desc'),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const lastDoc = querySnapshot.docs[0].data();
          nextId = (lastDoc.budgetNumber || 0) + 1;
        }
      }

      // Material mapping
      const mapMaterial = (mat: string | undefined) => {
        if (!mat) return 'white';
        const m = mat.toLowerCase();
        if (isAluminio) {
          // AL -> PVC
          if (m === 'titanium') return 'anthracite';
          if (m === 'matte') return 'white';
          return m; // white, black, golden_oak, walnut
        } else {
          // PVC -> AL
          if (m === 'anthracite') return 'black';
          return m; // white, black, golden_oak, walnut
        }
      };

      const mappedWindows = budget.windows.map(w => {
        const newMat = mapMaterial(w.material || w.system?.id);
        return {
          ...w,
          line: targetMaterial,
          material: newMat,
          system: {
            ...w.system,
            id: newMat,
            name: newMat.charAt(0).toUpperCase() + newMat.slice(1).replace('_', ' '),
          }
        };
      });

      const newBudgetData = {
        clientName: `${budget.clientName} (Copia ${targetMaterial})`,
        budgetNumber: nextId,
        projectId: nextId.toString(),
        totalPrice: budget.totalPrice,
        totalPriceWithIVA: budget.totalPriceWithIVA,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        userId: budget.userId || user?.uid,
        windows: mappedWindows,
        globalAdjustment: budget.globalAdjustment || 0,
        type: 'window'
      };

      const docRef = await addDoc(collection(db, BUDGETS_COLLECTION), newBudgetData);
      alert(`Presupuesto duplicado exitosamente como N° ${nextId} (${targetMaterial}). Recuerda editarlo para recalcular los precios.`);

      // Refresh list
      fetchBudgets(user);
    } catch (err) {
      console.error("Error duplicando presupuesto:", err);
      alert("Hubo un error al duplicar el presupuesto.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50 dark:bg-slate-950">
        <Loader2 className="animate-spin w-10 h-10 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Cripter Limitada — Presupuestos</h1>
            <p className="text-sm text-gray-500">Gestión de cotizaciones realizadas</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
            {user ? (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-400 font-medium">Usuario</p>
                  <p className="text-sm text-gray-700 dark:text-slate-200 font-semibold">{user.email}</p>
                </div>
                <Button onClick={handleLogout} variant="destructive" size="sm" className="shadow-sm">
                  <LogOut className="w-4 h-4 mr-2" /> Salir
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowLoginModal(true)} variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <Lock className="w-4 h-4 mr-2" /> Soy Admin
              </Button>
            )}
            {user && (
              <button
                onClick={() => window.location.href = ADMIN_EMAILS.includes(user.email || '') ? '/admin' : '/admin/config'}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-bold text-sm shadow-sm"
              >
                {ADMIN_EMAILS.includes(user.email || '') ? <LayoutDashboard size={18} /> : <Settings size={18} />}
                <span className="hidden md:inline">{ADMIN_EMAILS.includes(user.email || '') ? 'Panel Admin' : 'Ajustes Precios'}</span>
              </button>
            )}
            <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium text-sm">Ir a Inicio</button>
            <button onClick={() => window.location.href = '/aluminio'} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium text-sm">Aluminio</button>
            <button onClick={() => window.location.href = '/pvc'} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm">PVC</button>
            <button onClick={() => window.location.href = '/cotizador-termopaneles'} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium text-sm">Termopaneles</button>
          </div>
        </div>

        {/* Tabla */}
        <Card className="bg-white dark:bg-slate-900 shadow-lg border border-gray-100 dark:border-slate-800 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
              <p>Cargando presupuestos...</p>
            </div>
          ) : budgets.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400">
              <FileText className="w-12 h-12 mb-2 opacity-20" />
              <p>No hay presupuestos guardados aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">N°</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                    {user && ADMIN_EMAILS.includes(user.email || '') && (
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Usuario</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {budgets.map((budget) => (
                    <tr key={budget.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800 transition duration-150 border-b dark:border-slate-800 last:border-0">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-md font-bold text-sm ${budget.type === 'termopanel'
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-blue-100 text-blue-700'
                          }`}>
                          #{budget.budgetNumber}
                        </span>
                        {budget.type === 'termopanel' && <span className="ml-2 text-[10px] text-teal-600 bg-teal-50 border border-teal-200 px-1 rounded">Termo</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          if (budget.type === 'termopanel') return <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">Termopanel</span>;

                          const firstWin = budget.windows && budget.windows[0];
                          if (!firstWin) return <span className="text-xs text-gray-400">N/A</span>;

                          const line = (firstWin.line || '').toLowerCase();
                          const material = (firstWin.material || '').toLowerCase();
                          const systemName = (firstWin.system?.name || '').toLowerCase();

                          if (line.includes('pvc') || material.includes('anthracite') || systemName.includes('pvc')) {
                            return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">PVC</span>;
                          }
                          return <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Aluminio</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                        {budget.clientName}
                      </td>
                      {user && ADMIN_EMAILS.includes(user.email || '') && (
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                          {budget.userId ? budget.userId.substring(0, 8) + '...' : 'N/A'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {budget.date.toLocaleDateString('es-CL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Button onClick={() => handleViewDetails(budget)} variant="ghost" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 mr-2">
                          {budget.type === 'termopanel' ? 'Ver' : 'Ver'}
                        </Button>
                        {user && (
                          <>
                            <Button onClick={() => handleEdit(budget)} variant="ghost" title="Editar" className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 mr-2">
                              <Edit className="w-4 h-4" />
                            </Button>
                            {budget.type === 'window' && (
                              <Button
                                onClick={() => handleDuplicateAndSwitch(budget)}
                                variant="ghost"
                                title={`Duplicar a ${((budget.windows && budget.windows[0]?.line) || '').toLowerCase().includes('pvc') ? 'Aluminio' : 'PVC'}`}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 mr-2"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                            <Button onClick={() => handleDelete(budget)} variant="ghost" title="Eliminar" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modal Detalle */}
      {selectedBudget && (
        <BudgetDetailsDialog
          budget={selectedBudget}
          onClose={() => setSelectedBudget(null)}
        />
      )}


      {/* Login Modal */}
      {
        showLoginModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md p-8 bg-white dark:bg-slate-900 shadow-xl rounded-xl relative dark:border dark:border-slate-800">
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex justify-center mb-6">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Lock className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-slate-100 mb-2">Acceso Admin</h2>
              <p className="text-center text-gray-500 mb-6">Inicia sesión para gestionar</p>

              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold py-2">
                  Entrar
                </Button>
              </form>
            </Card>
          </div>
        )
      }
    </div >
  );
}