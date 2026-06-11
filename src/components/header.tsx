"use client";

import Link from "next/link";
import { BookOpen, LogIn, UserPlus, LogOut, User, PlusCircle, Shield, LayoutDashboard, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { Skeleton } from "./ui/skeleton";
import { doc } from "firebase/firestore";

export default function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const handleLogout = () => {
    if (auth) {
      signOut(auth);
    }
  };

  const isLoading = isUserLoading || isProfileLoading;
  const isLoggedIn = !isUserLoading && user;
  const isAdmin = userProfile?.role === 'admin';
  const isTeacher = userProfile?.role === 'subject-teacher';
  const isApproved = userProfile?.applicationStatus === 'approved';
  const canCreateCourse = (isTeacher || isAdmin) && (isApproved || isAdmin);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Link href="/" className="mr-8 flex items-center space-x-2">
          <BookOpen className="h-7 w-7 text-primary" />
          <span className="font-black font-headline inline-block text-2xl tracking-tighter">Scholars</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-bold">
          <Link
            href="/"
            className="transition-colors hover:text-primary text-foreground/70"
          >
            Courses
          </Link>
          {isLoggedIn && (
            <Link
              href="/my-learning"
              className="transition-colors hover:text-primary text-foreground/70 flex items-center gap-1.5"
            >
              <GraduationCap className="h-4 w-4" />
              My Learning
            </Link>
          )}
          {(isTeacher || isAdmin) && (
            <Link
              href={isAdmin ? "/admin" : "/dashboard"}
              className="transition-colors hover:text-primary text-foreground/70"
            >
              Dashboard
            </Link>
          )}
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-4">
          {isLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : isLoggedIn ? (
            <>
              {canCreateCourse && (
                <Button asChild variant="default" size="sm" className="hidden md:flex rounded-full px-5 shadow-lg shadow-primary/10">
                  <Link href="/create-course">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Course
                  </Link>
                </Button>
              )}
              {!isApproved && isTeacher && (
                <span className="text-[10px] uppercase font-black bg-yellow-500/10 text-yellow-600 px-3 py-1 rounded-full border border-yellow-500/20 mr-2">
                  Pending Verification
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border-2 border-primary/10 hover:border-primary/30 transition-all">
                    <Avatar className="h-full w-full">
                      <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/40/40`} alt={user.displayName || "User"} />
                      <AvatarFallback className="bg-primary/5 text-primary">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 mt-2 rounded-2xl shadow-2xl border-primary/5" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal p-4">
                    <div className="flex flex-col space-y-2">
                      <p className="text-base font-black leading-none">{user.displayName || 'Scholars User'}</p>
                      <p className="text-xs leading-none text-muted-foreground truncate">
                        {user.email}
                      </p>
                      {isAdmin && (
                        <span className="text-[10px] uppercase tracking-widest text-primary font-black mt-1 bg-primary/5 px-2 py-0.5 rounded-full w-fit">Administrator</span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <DropdownMenuItem asChild className="rounded-xl">
                        <Link href="/my-learning">
                            <GraduationCap className="mr-2 h-4 w-4" />
                            <span>My Learning Hub</span>
                        </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                        <DropdownMenuItem asChild className="text-primary font-bold focus:bg-primary/5 focus:text-primary rounded-xl">
                        <Link href="/admin">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Admin Dashboard</span>
                        </Link>
                        </DropdownMenuItem>
                    )}
                    {isTeacher && (
                        <DropdownMenuItem asChild className="rounded-xl">
                        <Link href="/dashboard">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Teacher Dashboard</span>
                        </Link>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild className="rounded-xl">
                        <Link href="/profile">
                          <User className="mr-2 h-4 w-4" />
                          <span>My Profile</span>
                        </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive font-bold focus:bg-destructive/5 focus:text-destructive rounded-xl">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="font-bold">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild className="rounded-full px-6 font-bold shadow-xl shadow-primary/20">
                <Link href="/signup">
                  <UserPlus className="mr-2 h-4 w-4" /> Get Started
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
