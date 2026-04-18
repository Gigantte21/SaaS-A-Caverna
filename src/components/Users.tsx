import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db, firebaseConfig, handleFirestoreError, OperationType } from '../firebase';
import { User, UserRole, Store } from '../types';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  Users as UsersIcon, 
  UserPlus, 
  Shield, 
  Mail, 
  Phone, 
  Calendar, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Store as StoreIcon,
  Check,
  Ban
} from 'lucide-react';
import { cn } from '../lib/utils';

export function Users() {
  const { stores } = useStore();
  const { user: currentUser, isAdmin, isGerente } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('OPERADOR');
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [status, setStatus] = useState<'pendente' | 'aprovado' | 'bloqueado'>('aprovado');

  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToBlock, setUserToBlock] = useState<string | null>(null);
  const [userToApprove, setUserToApprove] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    let q = query(collection(db, 'users'));

    // Gerentes can only see non-admin users from their stores
    if (isGerente) {
      q = query(
        collection(db, 'users'),
        where('role', 'in', ['GERENTE', 'OPERADOR']),
        where('storeIds', 'array-contains-any', currentUser.storeIds)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      // Additional in-memory filter for Gerente just in case
      if (isGerente) {
        fetchedUsers = fetchedUsers.filter(u => u.role !== 'ADMIN');
      }

      // Sort in memory: newest first, users without createdAt go to the bottom
      fetchedUsers.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setError("Erro ao carregar usuários: " + error.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const sendApprovalNotification = (user: { name: string, email: string, phone?: string }) => {
    // Mocking email and WhatsApp notifications
    console.log(`[NOTIFICATION] Sending approval email to ${user.email} for user ${user.name}`);
    if (user.phone) {
      console.log(`[NOTIFICATION] Sending approval WhatsApp to ${user.phone} for user ${user.name}`);
    }
    // In a real app, you would call an API here (e.g., SendGrid, Twilio, etc.)
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Security check: Gerente cannot create or edit Admin
    if (isGerente && role === 'ADMIN') {
      setError('Ação não permitida: Gerentes não podem criar ou promover usuários para Administrador.');
      return;
    }

    setModalLoading(true);
    setError('');

    try {
      if (editingUser) {
        const wasPending = editingUser.status === 'pendente';
        const isNowAprovado = status === 'aprovado';

        await updateDoc(doc(db, 'users', editingUser.id), {
          name,
          phone,
          role,
          storeIds: selectedStores,
          status
        });

        if (wasPending && isNowAprovado) {
          sendApprovalNotification({ name, email: editingUser.email, phone });
        }
      } else {
        if (!password) {
          setError('A senha é obrigatória para novos usuários.');
          setModalLoading(false);
          return;
        }

        // Initialize a secondary app to create the user without signing out the admin
        const appName = `SecondaryApp_${Math.random().toString(36).substring(2, 9)}`;
        const secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          const newUid = userCredential.user.uid;
          
          // Clean up secondary app
          await deleteApp(secondaryApp);

          const newUser: Omit<User, 'id'> = {
            name,
            email,
            phone,
            role,
            storeIds: selectedStores,
            status: 'aprovado',
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'users', newUid), newUser);
          
          // New users created by admin are automatically approved
          sendApprovalNotification({ name, email, phone });
        } catch (authError: any) {
          await deleteApp(secondaryApp);
          if (authError.code === 'auth/email-already-in-use') {
            throw new Error('Este email já está em uso por outro usuário.');
          } else if (authError.code === 'auth/weak-password') {
            throw new Error('A senha deve ter pelo menos 6 caracteres.');
          } else if (authError.code === 'auth/operation-not-allowed') {
            throw new Error('Autenticação por email/senha não está habilitada no Firebase.');
          } else {
            throw authError;
          }
        }
      }
      setShowModal(false);
      resetForm();
      addToast(editingUser ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error saving user:', err);
      setError(err.message || 'Erro ao salvar usuário.');
      handleFirestoreError(err, editingUser ? OperationType.UPDATE : OperationType.CREATE, editingUser ? `users/${editingUser.id}` : 'users');
    } finally {
      setModalLoading(false);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setRole('OPERADOR');
    setSelectedStores([]);
    setStatus('aprovado');
  };

  const handleEdit = (user: User) => {
    if (isGerente && user.role === 'ADMIN') {
      setError('Ação não permitida');
      return;
    }
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || '');
    setRole(user.role);
    setSelectedStores(user.storeIds);
    setStatus(user.status);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const targetUser = users.find(u => u.id === id);
    if (isGerente && targetUser?.role === 'ADMIN') {
      addToast('Ação não permitida', 'error');
      return;
    }
    if (id === currentUser?.id) {
      addToast('Você não pode excluir seu próprio usuário.', 'error');
      return;
    }
    setUserToDelete(id);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'users', userToDelete));
      addToast('Usuário excluído com sucesso!', 'success');
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (user: User) => {
    if (isGerente && user.role === 'ADMIN') {
      addToast('Ação não permitida', 'error');
      return;
    }
    setUserToApprove(user);
  };

  const confirmApprove = async () => {
    if (!userToApprove) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', userToApprove.id), { status: 'aprovado' });
      sendApprovalNotification({ name: userToApprove.name, email: userToApprove.email, phone: userToApprove.phone });
      addToast('Usuário aprovado com sucesso!', 'success');
      setUserToApprove(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userToApprove.id}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBlock = async (id: string) => {
    const targetUser = users.find(u => u.id === id);
    if (isGerente && targetUser?.role === 'ADMIN') {
      addToast('Ação não permitida', 'error');
      return;
    }
    if (id === currentUser?.id) {
      addToast('Você não pode bloquear seu próprio usuário.', 'error');
      return;
    }
    setUserToBlock(id);
  };

  const confirmBlock = async () => {
    if (!userToBlock) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', userToBlock), { status: 'bloqueado' });
      addToast('Usuário bloqueado com sucesso!', 'success');
      setUserToBlock(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userToBlock}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleStore = (storeId: string) => {
    setSelectedStores(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Usuários</h1>
          <p className="text-neutral-500">Gerencie os acessos e permissões da equipe</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all shadow-lg font-bold"
        >
          <UserPlus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {error && !showModal && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => (
          <div key={u.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100 space-y-4 relative group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-400">
                  <UsersIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">{u.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      u.role === 'ADMIN' ? "bg-purple-100 text-purple-700" :
                      u.role === 'GERENTE' ? "bg-blue-100 text-blue-700" :
                      "bg-neutral-100 text-neutral-700"
                    )}>
                      {u.role}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      u.status === 'aprovado' ? "bg-green-100 text-green-700" : 
                      u.status === 'pendente' ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {u.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {u.status === 'pendente' && (!isGerente || u.role !== 'ADMIN') && (
                  <button onClick={() => handleApprove(u)} title="Aprovar" className="p-2 hover:bg-green-50 rounded-lg text-neutral-400 hover:text-green-600 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {u.status !== 'bloqueado' && (!isGerente || u.role !== 'ADMIN') && (
                  <button onClick={() => handleBlock(u.id)} title="Bloquear" className="p-2 hover:bg-orange-50 rounded-lg text-neutral-400 hover:text-orange-500 transition-colors">
                    <Ban className="w-4 h-4" />
                  </button>
                )}
                {(!isGerente || u.role !== 'ADMIN') && (
                  <button onClick={() => handleEdit(u)} title="Editar" className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {(!isGerente || u.role !== 'ADMIN') && (
                  <button onClick={() => handleDelete(u.id)} title="Excluir" className="p-2 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-neutral-50">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Mail className="w-3.5 h-3.5" />
                {u.email}
              </div>
              {u.phone && (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <Phone className="w-3.5 h-3.5" />
                  {u.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Calendar className="w-3.5 h-3.5" />
                Criado em {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Lojas Permitidas</span>
              <div className="flex flex-wrap gap-1">
                {u.role === 'ADMIN' ? (
                  <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded-full font-bold">Todas as Lojas</span>
                ) : u.storeIds && u.storeIds.length > 0 ? (
                  u.storeIds.map(sid => {
                    const store = stores.find(s => s.id === sid);
                    return (
                      <span key={sid} className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium">
                        {store?.fantasyName || 'Loja Desconhecida'}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-neutral-400 italic">Nenhuma loja vinculada</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-10 space-y-8 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center text-white">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </h2>
                  <p className="text-sm text-neutral-500">Defina as permissões e acessos</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Email (Login)</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Telefone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                  />
                </div>
                {!editingUser && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Senha</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Nível de Acesso</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                  >
                    <option value="OPERADOR">Operador</option>
                    <option value="GERENTE">Gerente</option>
                    {isAdmin && <option value="ADMIN">Administrador</option>}
                  </select>
                </div>
                {editingUser && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'pendente' | 'aprovado' | 'bloqueado')}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="bloqueado">Bloqueado</option>
                    </select>
                  </div>
                )}
              </div>

              {role !== 'ADMIN' && (
                <div className="space-y-4">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Lojas Permitidas</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stores
                      .filter(store => isAdmin || (currentUser?.storeIds && currentUser.storeIds.includes(store.id)))
                      .map(store => (
                        <button
                          key={store.id}
                          type="button"
                          onClick={() => toggleStore(store.id)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                            selectedStores.includes(store.id)
                              ? "bg-neutral-900 border-neutral-900 text-white shadow-md"
                              : "bg-white border-neutral-100 text-neutral-600 hover:border-neutral-300"
                          )}
                        >
                        <div className="flex items-center gap-3">
                          <StoreIcon className={cn("w-5 h-5", selectedStores.includes(store.id) ? "text-white/60" : "text-neutral-400")} />
                          <div>
                            <p className="text-sm font-bold">{store.fantasyName}</p>
                            <p className={cn("text-[10px]", selectedStores.includes(store.id) ? "text-white/40" : "text-neutral-400")}>{store.city}, {store.state}</p>
                          </div>
                        </div>
                        {selectedStores.includes(store.id) && <CheckCircle2 className="w-5 h-5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4 pt-6 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-8 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-neutral-900">Excluir Usuário</h2>
              <p className="text-neutral-500">Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-6 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {userToBlock && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mx-auto">
              <Ban className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-neutral-900">Bloquear Usuário</h2>
              <p className="text-neutral-500">Tem certeza que deseja bloquear este usuário? Ele perderá o acesso ao sistema imediatamente.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setUserToBlock(null)}
                className="flex-1 px-6 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmBlock}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ban className="w-5 h-5" />}
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {userToApprove && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-neutral-900">Aprovar Usuário</h2>
              <p className="text-neutral-500">Deseja aprovar o usuário {userToApprove.name}? Ele receberá uma notificação por email.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setUserToApprove(null)}
                className="flex-1 px-6 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmApprove}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
