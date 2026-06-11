
'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, addDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, Megaphone, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AlertManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newAlert, setNewAlert] = useState({ title: '', tag: 'New', color: 'text-red-500' });

  const alertsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'liveAlerts'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: alerts, isLoading } = useCollection(alertsQuery);

  const handleAddAlert = async () => {
    if (!firestore || !newAlert.title) return;
    setIsAdding(true);
    
    const alertData = {
      ...newAlert,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'liveAlerts'), alertData);
      setNewAlert({ title: '', tag: 'New', color: 'text-red-500' });
      toast({ title: "Alert Added", description: "The live ticker has been updated." });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'liveAlerts',
        operation: 'create',
        requestResourceData: alertData
      }));
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'liveAlerts', id));
      toast({ title: "Alert Removed" });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `liveAlerts/${id}`,
        operation: 'delete'
      }));
    }
  };

  return (
    <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm mt-8">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Live Alert Management
        </CardTitle>
        <CardDescription>Control the notifications shown in the global ticker.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4 items-end bg-primary/5 p-4 rounded-2xl border border-primary/10">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="title">Alert Message</Label>
            <Input 
              id="title" 
              placeholder="e.g. SSC CGL Results Out!" 
              value={newAlert.title} 
              onChange={(e) => setNewAlert(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Tag</Label>
            <Select value={newAlert.tag} onValueChange={(val) => setNewAlert(prev => ({ ...prev, tag: val }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Update">Update</SelectItem>
                <SelectItem value="Alert">Alert</SelectItem>
                <SelectItem value="Result">Result</SelectItem>
                <SelectItem value="Calendar">Calendar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddAlert} disabled={isAdding || !newAlert.title} className="h-10">
            {isAdding ? <Loader2 className="animate-spin h-4 w-4" /> : <><Plus className="mr-2 h-4 w-4" /> Add Alert</>}
          </Button>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : alerts && alerts.length > 0 ? (
            <div className="divide-y border rounded-xl bg-background overflow-hidden">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-bold border-primary/20 text-primary">
                      {alert.tag}
                    </Badge>
                    <span className="font-medium">{alert.title}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
              No active alerts. Add one above to notify students.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
