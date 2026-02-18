import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { publishPlan } from '../services/syncService';

interface UsePlanSyncReturn {
  hasPendingChanges: boolean;
  lastModified: Date | null;
  lastSynced: Date | null;
  publish: () => Promise<void>;
  loading: boolean;
  publishing: boolean;
}

export const usePlanSync = (planId: string | undefined): UsePlanSyncReturn => {
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [lastModified, setLastModified] = useState<Date | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!planId) {
        setLoading(false);
        return;
    }

    // Listen to the Plan Document for timestamp changes
    const unsub = onSnapshot(doc(db, 'plans', planId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const modified = data.lastModifiedAt?.toDate ? data.lastModifiedAt.toDate() : null;
            const synced = data.lastSyncedAt?.toDate ? data.lastSyncedAt.toDate() : null;

            setLastModified(modified);
            setLastSynced(synced);

            // Compare dates
            if (!synced) {
                // Never synced
                setHasPendingChanges(true);
            } else if (modified && modified > synced) {
                // Modified after sync
                setHasPendingChanges(true);
            } else {
                setHasPendingChanges(false);
            }
        }
        setLoading(false);
    });

    return () => unsub();
  }, [planId]);

  const handlePublish = async () => {
    if (!planId) return;
    setPublishing(true);
    try {
        await publishPlan(planId);
        // State update handled by listener above
    } catch (error) {
        console.error("Publish failed", error);
        alert("Erro ao publicar alterações. Verifique o console.");
    } finally {
        setPublishing(false);
    }
  };

  return {
    hasPendingChanges,
    lastModified,
    lastSynced,
    publish: handlePublish,
    loading,
    publishing
  };
};