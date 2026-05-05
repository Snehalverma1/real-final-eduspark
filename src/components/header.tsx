"use client";

import Link from "next/link";
import { BookOpen, LogIn, UserPlus, LogOut, User, PlusCircle, Shield, LayoutDashboard } from "lucide-react";
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
  const isTeacher = userProfile?.role === 'class-teacher' || userProfile?.role === 'subject-teacher';
  const isApproved = userProfile?.applicationStatus === 'approved';
  const canCreateCourse = (isTeacher || isAdmin) && (isApproved || isAdmin);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-bold font-headline inline-block text-xl">EduSpark</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm lg:gap-6">
          <Link
            href="/"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            Courses
          </Link>
          {(isTeacher || isAdmin) && (
            <Link
              href={isAdmin ? "/admin" : "/dashboard"}
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Dashboard
            </Link>
          )}
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {isLoading ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : isLoggedIn ? (
            <>
              {canCreateCourse && (
                <Button asChild variant="ghost" size="sm" className="hidden md:flex">
                  <Link href="/create-course">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Course
                  </Link>
                </Button>
              )}
              {!isApproved && isTeacher && (
                <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded-full border border-yellow-500/20 mr-2">
                  Approval Pending
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8 border-2 border-primary/20">
                      <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/40/40`} alt={user.displayName || "User"} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{user.displayName || 'EduSpark User'}</p>
                      <p className="text-xs leading-none text-muted-foreground truncate">
                        {user.email}
                      </p>
                      {isAdmin && (
                        <span className="text-[10px] uppercase tracking-wider text-primary font-bold mt-1">Administrator</span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                     <DropdownMenuItem asChild className="text-primary font-medium focus:bg-primary/5 focus:text-primary">
                       <Link href="/admin">
                         <Shield className="mr-2 h-4 w-4" />
                         <span>Admin Dashboard</span>
                       </Link>
                     </DropdownMenuItem>
                  )}
                  {isTeacher && (
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Teacher Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>My Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/5 focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild>
                <Link href="/signup">
                  <UserPlus className="mr-2 h-4 w-4" /> Sign Up
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
