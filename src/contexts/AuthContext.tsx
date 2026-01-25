"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabaseBrowser } from '../lib/supabase-browser';
import { Session } from '@supabase/supabase-js';
import { isActiveMember } from '../lib/store-discounts';

type User = {
    id: string;
    email?: string | null;
};

type MemberData = {
    is_membro: boolean;
    estado_quota: string | null;
    tipo_subscricao: string | null;
    numero_socio?: number | null;
};

type AuthContextType = {
    user: User | null;
    session: Session | null;
    memberData: MemberData | null;
    isMember: boolean;
    loading: boolean;
    isAuthenticated: boolean;
    refreshMemberData: () => Promise<void>;
    setSession: (session: Session | null) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSessionState] = useState<Session | null>(null);
    const [memberData, setMemberData] = useState<MemberData | null>(null);
    const [loading, setLoading] = useState(true);

    const loadMemberData = async (userId: string) => {
        if (!supabaseBrowser) return;

        const { data } = await supabaseBrowser
            .from('membros')
            .select('is_membro, estado_quota, tipo_subscricao, numero_socio')
            .eq('id', userId)
            .maybeSingle();

        setMemberData(data || null);
    };

    const refreshMemberData = async () => {
        if (user?.id) {
            await loadMemberData(user.id);
        }
    };

    useEffect(() => {
        let mounted = true;

        const loadSession = async () => {
            if (!supabaseBrowser) {
                setLoading(false);
                return;
            }

            const { data } = await supabaseBrowser.auth.getSession();
            const currentSession = data.session;
            const sessionUser = currentSession?.user;

            if (mounted) {
                setSessionState(currentSession);
                setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);

                if (sessionUser?.id) {
                    await loadMemberData(sessionUser.id);
                }
                setLoading(false);
            }
        };

        loadSession();

        // Listen for auth changes
        const { data: listener } = supabaseBrowser?.auth.onAuthStateChange(async (_event, currentSession) => {
            if (!mounted) return;

            setSessionState(currentSession);
            const sessionUser = currentSession?.user;
            setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);

            if (sessionUser?.id) {
                await loadMemberData(sessionUser.id);
            } else {
                setMemberData(null);
            }
        }) ?? { data: { subscription: { unsubscribe() { } } } };

        return () => {
            mounted = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    // Set session (called after booking creation for auto-login)
    const setSession = async (newSession: Session | null) => {
        if (!supabaseBrowser) return;

        if (newSession) {
            // CRITICAL: Set local state IMMEDIATELY for instant authentication
            console.log('⚡ [Auth] Setting session state immediately');
            setSessionState(newSession);
            setUser(newSession.user ? { id: newSession.user.id, email: newSession.user.email } : null);
            console.log('✅ [Auth] Session state set - user is now authenticated');

            // Then sync with Supabase in background (don't block)
            supabaseBrowser.auth.setSession({
                access_token: newSession.access_token,
                refresh_token: newSession.refresh_token,
            }).then(({ error }) => {
                if (error) {
                    console.error('❌ [Auth] Failed to sync session with Supabase:', error);
                } else {
                    console.log('✅ [Auth] Session synced with Supabase');
                }
            });

            // Load member data in background (don't block)
            if (newSession.user?.id) {
                loadMemberData(newSession.user.id).catch(err => {
                    console.warn('⚠️ [Auth] Failed to load member data:', err);
                });
            }
        } else {
            await supabaseBrowser.auth.signOut();
            setSessionState(null);
            setUser(null);
            setMemberData(null);
        }
    };

    // Sign out
    const signOut = async () => {
        if (!supabaseBrowser) return;

        await supabaseBrowser.auth.signOut();
        setSessionState(null);
        setUser(null);
        setMemberData(null);
        console.log('✅ [Auth] Signed out');
    };

    const isMember = isActiveMember(memberData);
    const isAuthenticated = !!session && !!user;

    return (
        <AuthContext.Provider value={{
            user,
            session,
            memberData,
            isMember,
            loading,
            isAuthenticated,
            refreshMemberData,
            setSession,
            signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
