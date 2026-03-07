
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  fullName: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type AdminFormValues = z.infer<typeof formSchema>;

export default function CreateAdminPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: AdminFormValues) {
    if (!auth || !firestore) {
      toast({
        variant: "destructive",
        title: "Initialization Error",
        description: "Firebase services are not available.",
      });
      return;
    };

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      await updateProfile(userCredential.user, {
        displayName: values.fullName,
      });

      const userProfileData = {
        id: userCredential.user.uid,
        name: values.fullName,
        email: values.email,
        role: 'admin',
        applicationStatus: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(firestore, 'userProfiles', userCredential.user.uid), userProfileData);

      toast({
        title: "Admin Account Created",
        description: "The new administrator account is ready.",
      });
      router.push('/login');
    } catch (error) {
      let title = "Sign Up Failed";
      let description = "An unexpected error occurred. Please try again.";
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/email-already-in-use') {
          description = 'This email is already in use.';
        }
      }
      toast({
        variant: "destructive",
        title: title,
        description: description,
      });
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Create Admin User</CardTitle>
          <CardDescription>
            This page should be removed after creating the initial admin account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <FormControl>
                      <Input id="full-name" placeholder="Admin User" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <FormControl>
                      <Input id="password" type="password" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Admin
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
