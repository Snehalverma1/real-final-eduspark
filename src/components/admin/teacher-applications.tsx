'use client';

import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TeacherApplications() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isAdmin = userProfile?.role === 'admin';

  const applicationsQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(
        collection(firestore, 'userProfiles'), 
        where('applicationStatus', '==', 'pending'),
        where('role', 'in', ['subject-teacher', 'class-teacher'])
    );
  }, [firestore, isAdmin]);

  const { data: applications, isLoading: areApplicationsLoading } = useCollection(applicationsQuery);
  
  const isLoading = isProfileLoading || areApplicationsLoading;

  const handleUpdateStatus = (userId: string, status: 'approved' | 'rejected') => {
    if (!firestore) return;

    const userDocRef = doc(firestore, 'userProfiles', userId);
    const updateData = { applicationStatus: status, updatedAt: new Date().toISOString() };

    updateDoc(userDocRef, updateData)
      .then(() => {
        toast({
          title: 'Status Updated',
          description: `The application has been successfully ${status}.`,
        });
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Pending Applications</CardTitle>
        <CardDescription>Review credentials for new teachers joining the platform.</CardDescription>
      </CardHeader>
      <CardContent>
         {!applications || applications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">All caught up! No pending applications.</p>
            </div>
         ) : (
            <div className="rounded-md border bg-background">
              <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                    <TableHead>Teacher Info</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Experience / Class</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {applications.map((app) => (
                    <TableRow key={app.id} className="group transition-colors">
                        <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-foreground">{app.name}</span>
                              <span className="text-xs text-muted-foreground">{app.email}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={app.role === 'subject-teacher' ? 'default' : 'secondary'} className="capitalize">
                                {app.role.replace('-', ' ')}
                            </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                            {app.role === 'subject-teacher' ? (
                            <div className="text-sm">
                                <p className="line-clamp-1"><span className="text-muted-foreground mr-1">Subjects:</span> {app.subjects?.join(', ') || 'N/A'}</p>
                                <p className="line-clamp-1 mt-0.5 italic text-muted-foreground">{app.experience || 'No experience listed'}</p>
                            </div>
                            ) : (
                            <Badge variant="outline">Class {app.class}-{app.section}</Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleUpdateStatus(app.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleUpdateStatus(app.id, 'rejected')}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
         )}
      </CardContent>
    </Card>
  );
}
