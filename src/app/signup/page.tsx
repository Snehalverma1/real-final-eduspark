'use client';

import { useEffect, useState } from 'react';
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
import { BookOpen, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { doc, setDoc } from 'firebase/firestore';

const formSchema = z.object({
  fullName: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: z.enum(['student', 'subject-teacher'], {
    required_error: 'You need to select a role.',
  }),
  subjects: z.string().optional(),
  experience: z.string().optional(),
})
.superRefine((data, ctx) => {
  if (data.role === 'subject-teacher') {
    if (!data.subjects || data.subjects.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subjects'],
        message: 'Please list at least one subject (at least 3 characters).',
      });
    }
    if (!data.experience || data.experience.trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['experience'],
        message: 'Please describe your experience (at least 20 characters).',
      });
    }
  }
});


type SignupFormValues = z.infer<typeof formSchema>;

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'student',
      subjects: '',
      experience: '',
    },
  });

  const { isSubmitting, watch, trigger } = form;
  const role = watch('role');

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/');
    }
  }, [user, isUserLoading, router]);

  async function onSubmit(values: SignupFormValues) {
    if (!auth || !firestore) return;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      await updateProfile(userCredential.user, {
        displayName: values.fullName,
      });

      // Create user profile in Firestore
      const userProfileData: any = {
        id: userCredential.user.uid,
        name: values.fullName,
        email: values.email,
        role: values.role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        applicationStatus: values.role === 'subject-teacher' ? 'pending' : 'approved',
      };
      
      if (values.role === 'subject-teacher') {
          userProfileData.subjects = values.subjects?.split(',').map(s => s.trim());
          userProfileData.experience = values.experience;
      }
      
      await setDoc(doc(firestore, 'userProfiles', userCredential.user.uid), userProfileData);
      
      toast({
        title: "Account Created",
        description: values.role === 'subject-teacher' ? "Your application has been submitted for review." : "Your account has been created successfully.",
      });
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

  const handleNextStep = async () => {
      const isValid = await trigger('role');
      if(isValid) {
          setStep(2);
      }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
            </div>
          <CardTitle className="text-2xl font-headline">Create an Account</CardTitle>
          <CardDescription>
            Join EduSpark to start your learning journey today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              {step === 1 && (
                <>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>I am a...</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="student" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Student
                            </FormLabel>
                          </FormItem>
                           <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="subject-teacher" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Teacher
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <Button type="button" onClick={handleNextStep}>Next</Button>
                </>
              )}

              {step === 2 && (
                <>
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <Label htmlFor="full-name">Full Name</Label>
                        <FormControl>
                          <Input id="full-name" placeholder="John Doe" required {...field} />
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
                            placeholder="m@example.com"
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

                  {role === 'subject-teacher' && (
                    <>
                      <FormField
                        control={form.control}
                        name="subjects"
                        render={({ field }) => (
                          <FormItem className="grid gap-2">
                            <Label htmlFor="subjects">Subjects You Teach</Label>
                            <FormControl>
                              <Input id="subjects" placeholder="e.g., Math, Science, History" required {...field} />
                            </FormControl>
                            <p className="text-sm text-muted-foreground">Please provide a comma-separated list of subjects.</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="experience"
                        render={({ field }) => (
                          <FormItem className="grid gap-2">
                            <Label htmlFor="experience">Teaching Experience</Label>
                            <FormControl>
                              <Textarea id="experience" placeholder="Describe your teaching experience..." required {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
