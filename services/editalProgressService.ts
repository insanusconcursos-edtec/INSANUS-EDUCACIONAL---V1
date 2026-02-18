
import { 
  writeBatch, 
  doc, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { rescheduleOverdueTasks } from './scheduleService';
import { getStudentConfig } from './studentService';

export const editalProgressService = {

  /**
   * Marca um tópico ou lista de metas como concluído MANUALMENTE.
   * 1. Salva em 'edital_progress' para persistência visual no edital.
   * 2. REMOVE da agenda futura (schedules) se existir (liberando espaço).
   * 3. ACIONA REORGANIZAÇÃO (EMPUXO) para preencher o vazio com metas futuras.
   */
  async completeTopicManually(userId: string, planId: string, metaIds: string[]) {
    const batch = writeBatch(db);
    const timestamp = Timestamp.now();
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. ATUALIZAR PROGRESSO (Persistência do Check Verde no Edital)
    metaIds.forEach(id => {
        const progressRef = doc(db, 'users', userId, 'plans', planId, 'edital_progress', id);
        batch.set(progressRef, { 
            metaId: id,
            completed: true, 
            completedAt: timestamp,
            manuallyCompleted: true 
        }, { merge: true });
    });

    // 2. LIMPEZA DA AGENDA (Remove do Futuro para abrir espaço)
    let hasDeletions = false;

    if (metaIds.length > 0) {
        const scheduleRef = collection(db, 'users', userId, 'schedules');
        const q = query(
            scheduleRef, 
            where('planId', '==', planId),
            where('date', '>=', todayStr)
        );

        const snapshot = await getDocs(q);
        const metaIdSet = new Set(metaIds);

        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const items = data.items || [];
            
            // Filtra removendo os itens que são alvo da conclusão manual E estão pendentes
            const remainingItems = items.filter((item: any) => {
                const shouldRemove = metaIdSet.has(item.metaId) && item.status === 'pending';
                if (shouldRemove) hasDeletions = true;
                return !shouldRemove;
            });

            // Se houve mudança, atualiza o documento
            if (remainingItems.length !== items.length) {
                if (remainingItems.length === 0) {
                    batch.delete(docSnap.ref); // Remove documento se ficar vazio
                } else {
                    batch.update(docSnap.ref, { items: remainingItems });
                }
            }
        });
    }

    await batch.commit();

    // 3. REORGANIZAÇÃO AUTOMÁTICA (EMPUXO)
    // Se houve remoção de itens pendentes da agenda, chamamos o reagendamento 
    // para puxar as metas futuras e preencher o "buraco" de tempo criado.
    if (hasDeletions) {
        try {
            console.log("[EditalProgress] Detectado espaço livre. Reorganizando agenda...");
            const config = await getStudentConfig(userId);
            if (config && config.routine) {
                // Reutiliza a lógica robusta de rescheduleOverdueTasks que já faz "Melt & Re-Cast"
                // Isso vai pegar todas as pendências restantes e redistribuir a partir de hoje
                await rescheduleOverdueTasks(userId, planId, config.routine);
            }
        } catch (error) {
            console.error("[EditalProgress] Erro ao reorganizar agenda após conclusão manual:", error);
        }
    }

    return true;
  },

  /**
   * Utilitário para limpar registros "lixo" criados anteriormente por bugs.
   * Remove itens da agenda que tenham título "Conclusão Manual" ou similar.
   */
  async cleanupBadManualEntries(userId: string, planId: string) {
      try {
        const scheduleRef = collection(db, 'users', userId, 'schedules');
        const q = query(scheduleRef, where('planId', '==', planId));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        let count = 0;

        snapshot.docs.forEach(docSnap => {
            const items = docSnap.data().items || [];
            const cleanItems = items.filter((item: any) => {
                const isGarbage = item.title === 'Conclusão Manual' || (item.topicName === 'Manual' && item.disciplineName === 'Manual');
                return !isGarbage;
            });

            if (cleanItems.length !== items.length) {
                if (cleanItems.length === 0) {
                    batch.delete(docSnap.ref);
                } else {
                    batch.update(docSnap.ref, { items: cleanItems });
                }
                count++;
            }
        });
        
        if (count > 0) await batch.commit();
        console.log(`Limpeza concluída. ${count} documentos afetados.`);
      } catch (e) {
          console.error("Erro na limpeza:", e);
      }
  },

  /**
   * Reseta todo o progresso do edital (Checks manuais e automáticos persistidos visualmente).
   * Apaga a subcoleção 'edital_progress' do usuário para este plano.
   */
  async resetEditalProgress(userId: string, planId: string) {
    try {
        const progressRef = collection(db, 'users', userId, 'plans', planId, 'edital_progress');
        const snapshot = await getDocs(progressRef);
        
        if (snapshot.empty) return;

        const batchSize = 450;
        let batch = writeBatch(db);
        let count = 0;

        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            count++;
            if (count >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
        }
        console.log(`Progresso do edital resetado. ${snapshot.size} itens removidos.`);
    } catch (error) {
        console.error("Erro ao resetar progresso do edital:", error);
        throw error;
    }
  }
};
