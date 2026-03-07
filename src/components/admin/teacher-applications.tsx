'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TeacherApplications() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const applicationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'userProfiles'), 
        where('applicationStatus', '==', 'pending'),
        where('role', 'in', ['subject-teacher', 'class-teacher'])
    );
  }, [firestore]);

  const { data: applications, isLoading } = useCollection(applicationsQuery);

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'rejected') => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'userProfiles', userId);
    try {
      await updateDoc(userDocRef, { applicationStatus: status });
      toast({
        title: 'Application Updated',
        description: `The teacher application has been ${status}.`,
      });
    } catch (error) {
      console.error("Error updating application status: ", error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update the application status.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Applications</CardTitle>
        <CardDescription>Review and approve or reject pending teacher applications.</CardDescription>
      </CardHeader>
      <CardContent>
         {!applications || applications.length === 0 ? (
            <p>No pending applications.</p>
         ) : (
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {applications.map((app) => (
                <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.name}</TableCell>
                    <TableCell>{app.email}</TableCell>
                    <TableCell>
                        <Badge variant={app.role === 'subject-teacher' ? 'default' : 'secondary'}>
                            {app.role === 'subject-teacher' ? 'Subject Teacher' : 'Class Teacher'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs">
                        {app.role === 'subject-teacher' ? (
                        <div>
                            <p><span className="font-semibold text-foreground">Subjects:</span> {app.subjects?.join(', ') || 'N/A'}</p>
                            <p className="mt-1"><span className="font-semibold text-foreground">Experience:</span> {app.experience || 'N/A'}</p>
                        </div>
                        ) : (
                        <p><span className="font-semibold text-foreground">Class:</span> {app.class}-{app.section}</p>
                        )}
                  </TableCell>
                    <TableCell>
                    <Badge variant="outline">{app.applicationStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => handleUpdateStatus(app.id, 'approved')}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(app.id, 'rejected')}>Reject</Button>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
         )}
      </CardContent>
    </Card>
  );
}
