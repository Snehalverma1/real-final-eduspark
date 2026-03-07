'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Loader2, ShieldCheck } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import { doc, setDoc } from 'firebase/firestore';


const formSchema = z.object({
  fullName: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});


type SignupFormValues = z.infer<typeof formSchema>;

export default function CreateAdminPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/admin');
    }
  }, [user, isUserLoading, router]);

  async function onSubmit(values: SignupFormValues) {
    if (!auth || !firestore) return;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      await updateProfile(userCredential.user, {
        displayName: values.fullName,
      });

      // Create admin user profile in Firestore
      const userProfileData: any = {
        id: userCredential.user.uid,
        name: values.fullName,
        email: values.email,
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        applicationStatus: 'approved',
      };
      
      await setDoc(doc(firestore, 'userProfiles', userCredential.user.uid), userProfileData);
      
      toast({
        title: "Admin Account Created",
        description: "Your new admin account has been created successfully.",
      });
      // onAuthStateChanged will handle user state update and redirect
    } catch (error) {
      let title = "Sign Up Failed";
      let description = "An unexpected error occurred. Please try again.";
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/email-already-in-use') {
          description = 'This email is already in use. Please login instead.';
        }
      }
      toast({
        variant: "destructive",
        title: title,
        description: description,
      });
    }
  }

  if (isUserLoading || (!isUserLoading && user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-muted/20">
      <Card className="w-full max-w-md mx-auto shadow-2xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
                <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
          <CardTitle className="text-2xl font-headline">Create Admin Account</CardTitle>
          <CardDescription>
            This page is for creating the initial administrator account. It should be deleted after use.
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
          <div className="mt-4 text-center text-sm">
            Go back to {" "}
            <Link href="/" className="underline">
              Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
