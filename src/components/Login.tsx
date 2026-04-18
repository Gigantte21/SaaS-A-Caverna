import React, { useState, useEffect } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Loader2, Lock, Mail, AlertCircle, User as UserIcon, Phone, ArrowLeft } from 'lucide-react';
import { ADMIN_EMAIL } from '../constants';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const { status, logout } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (status === 'pendente') {
      setError('Seu acesso ainda não foi aprovado. Entre em contato com o administrador.');
    } else if (status === 'bloqueado') {
      setError('Seu acesso foi bloqueado. Entre em contato com o administrador.');
    }
  }, [status]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      // AuthContext will handle user document creation and status checks
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Login por email e senha não está habilitado no Firebase. Contate o administrador.');
      } else {
        setError('Ocorreu um erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const isAdminEmail = cleanEmail === ADMIN_EMAIL;
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name,
        email: cleanEmail,
        phone,
        role: isAdminEmail ? 'ADMIN' : 'OPERADOR',
        status: isAdminEmail ? 'aprovado' : 'pendente',
        storeIds: [],
        createdAt: new Date().toISOString()
      });

      if (!isAdminEmail) {
        await auth.signOut();
        setSuccessMessage('Cadastro enviado para aprovação. Aguarde liberação.');
      } else {
        setSuccessMessage('Conta de administrador criada com sucesso!');
      }
      
      setIsRegistering(false);
      setName('');
      setPhone('');
      setPassword('');
    } catch (err: any) {
      console.error('Register error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Cadastro por email e senha não está habilitado no Firebase. Contate o administrador.');
      } else {
        setError('Ocorreu um erro ao criar a conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, digite seu email no campo acima para redefinir a senha.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Email de redefinição de senha enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError('Erro ao enviar email de redefinição. Verifique se o email está correto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-neutral-900 rounded-[2.5rem] flex items-center justify-center text-white font-bold text-4xl mx-auto shadow-2xl">
            P
          </div>
          <h1 className="text-3xl font-bold text-neutral-900">Precifica Já</h1>
          <p className="text-neutral-500">
            {isRegistering ? 'Crie sua conta para acessar' : 'Faça login para acessar sua conta'}
          </p>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-neutral-100 space-y-8 relative">
          {isRegistering && (
            <button 
              onClick={() => {
                setIsRegistering(false);
                setError('');
                setSuccessMessage('');
              }}
              className="absolute top-6 left-6 p-2 text-neutral-400 hover:text-neutral-900 transition-colors rounded-full hover:bg-neutral-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex flex-col gap-2 text-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
              {(status === 'pendente' || status === 'bloqueado') && (
                <button
                  onClick={() => logout()}
                  className="text-xs font-bold text-red-700 hover:underline text-left ml-8"
                >
                  Sair desta conta
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {successMessage}
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-6">
            {isRegistering && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                    Nome
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full pl-12 pr-4 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                    Telefone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full pl-12 pr-4 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-12 pr-4 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRegistering ? (
                'Criar conta'
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {!isRegistering && (
            <div className="pt-6 border-t border-neutral-100 text-center">
              <p className="text-neutral-500 mb-4">Ainda não tem uma conta?</p>
              <button
                onClick={() => {
                  setIsRegistering(true);
                  setError('');
                  setSuccessMessage('');
                }}
                className="w-full py-4 bg-white text-neutral-900 border-2 border-neutral-200 rounded-2xl font-bold hover:bg-neutral-50 transition-all flex items-center justify-center gap-2"
              >
                Criar conta
              </button>
            </div>
          )}
        </div>

        {!isRegistering && (
          <div className="text-center">
            <button 
              onClick={handleResetPassword}
              disabled={loading}
              className="text-sm text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              Esqueceu sua senha? Clique aqui para redefinir.
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
