import React, { useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, Database, X } from 'lucide-react';

export function Backup() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const collectionsToBackup = ['stores', 'costBases', 'materials', 'products', 'quotes', 'clients', 'users'];

  const handleExport = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const backupData: Record<string, any> = {};
      
      for (const colName of collectionsToBackup) {
        try {
          const querySnapshot = await getDocs(collection(db, colName));
          backupData[colName] = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, colName);
        }
      }

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `backup_precifica_ja_${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      setMessage({ type: 'success', text: 'Backup exportado com sucesso!' });
    } catch (error: any) {
      console.error("Export error:", error);
      setMessage({ type: 'error', text: 'Erro ao exportar backup: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const processImport = async (file: File) => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backupData = JSON.parse(content);

        let batch = writeBatch(db);
        let operationCount = 0;

        for (const colName of collectionsToBackup) {
          if (backupData[colName] && Array.isArray(backupData[colName])) {
            for (const item of backupData[colName]) {
              const { id, ...data } = item;
              if (id) {
                const docRef = doc(db, colName, id);
                batch.set(docRef, data);
                operationCount++;

                // Firestore batch limit is 500 operations
                if (operationCount === 490) {
                  try {
                    await batch.commit();
                  } catch (err) {
                    handleFirestoreError(err, OperationType.WRITE, colName);
                  }
                  batch = writeBatch(db);
                  operationCount = 0;
                }
              }
            }
          }
        }

        if (operationCount > 0) {
          try {
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'multi-collection-import');
          }
        }

        setMessage({ type: 'success', text: 'Backup restaurado com sucesso!' });
      } catch (error: any) {
        console.error("Import error:", error);
        setMessage({ type: 'error', text: 'Erro ao restaurar backup: ' + error.message });
      } finally {
        setLoading(false);
        setShowConfirm(false);
        setPendingFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowConfirm(true);
    event.target.value = '';
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Backup e Restauração</h1>
        <p className="text-neutral-500">Exporte e importe os dados do sistema para segurança.</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm ${
          message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-neutral-100 space-y-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Download className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Exportar Dados</h2>
            <p className="text-sm text-neutral-500 mt-2">
              Baixe um arquivo JSON contendo todos os clientes, produtos, orçamentos, lojas e usuários.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-auto"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            Fazer Backup
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-neutral-100 space-y-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Restaurar Backup</h2>
            <p className="text-sm text-neutral-500 mt-2">
              Envie um arquivo de backup anterior para restaurar os dados. Isso pode sobrescrever dados atuais.
            </p>
          </div>
          <div className="w-full mt-auto relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button
              disabled={loading}
              className="w-full py-4 bg-white text-neutral-900 border-2 border-neutral-200 rounded-2xl font-bold hover:bg-neutral-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              Restaurar Dados
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-neutral-900">Confirmar Restauração?</h3>
              <p className="text-neutral-500 text-sm">
                ATENÇÃO: A restauração do backup irá sobrescrever os dados existentes com os mesmos IDs. Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => pendingFile && processImport(pendingFile)}
                disabled={loading}
                className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Sim, Restaurar Dados
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setPendingFile(null);
                }}
                disabled={loading}
                className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
