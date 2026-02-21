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
    proxima_quota?: string | null;
    numero_socio?: number | null;
    nome?: string | null;
    avatar_url?: string | null;
    email?: string | null;
    telefone?: string | null;
    nif?: string | null;
    address?: string | null;
    postal_code?: string | null;
    country?: string | null;
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
            .select('is_membro, estado_quota, tipo_subscricao, proxima_quota, numero_socio, nome, avatar_url, email, telefone, nif, address, postal_code, country')
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
        let refreshInterval: ReturnType<typeof setInterval> | null = null;

        if (!supabaseBrowser) {
            setLoading(false);
            return;
        }

        const syncSessionState = async (currentSession: Session | null) => {
            if (!mounted) return;

            setSessionState(currentSession);
            const sessionUser = currentSession?.user;
            setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);

            try {
                if (sessionUser?.id) {
                    await loadMemberData(sessionUser.id);
                } else {
                    setMemberData(null);
                }
            } catch (err) {
                console.error('Error loading member data:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        // Initialize state by explicitly fetching the session
        supabaseBrowser.auth.getSession()
            .then(({ data: { session: currentSession } }) => syncSessionState(currentSession))
            .catch((err) => {
                if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
                    console.warn('Supabase getSession aborted (likely Strict Mode overlap).');
                    // Do not force setLoading(false) here, let the other overlap request finish it.
                    return;
                }
                console.error('Error retrieving initial session:', err);
                if (mounted) setLoading(false);
            });

        const { data: listener } = supabaseBrowser.auth.onAuthStateChange((event, currentSession) => {
            // Only update if it's not the INITIAL_SESSION to avoid race conditions with getSession() above
            if (event !== 'INITIAL_SESSION') {
                syncSessionState(currentSession);
            }
        });

        const refreshSession = async () => {
            try {
                // Because we have middleware now, the cookies refresh auto. We just sync client state.
                const { data: { session: currentSession } } = await supabaseBrowser.auth.getSession();
                await syncSessionState(currentSession);
            } catch (err: any) {
                if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
                    // Ignore aborts
                    return;
                }
                console.error('Error refreshing session:', err);
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshSession();
            }
        };

        const onWindowFocus = () => {
            refreshSession();
        };

        refreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                refreshSession();
            }
        }, 5 * 60 * 1000);

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onWindowFocus);

        return () => {
            mounted = false;
            if (refreshInterval) clearInterval(refreshInterval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onWindowFocus);
            listener.subscription.unsubscribe();
        };
    }, []);

    // Set session (called after booking creation for auto-login)
    const setSession = async (newSession: Session | null) => {
        if (!supabaseBrowser) return;

        if (newSession) {
            // CRITICAL: Set local state IMMEDIATELY for instant authentication
            setSessionState(newSession);
            setUser(newSession.user ? { id: newSession.user.id, email: newSession.user.email } : null);
            setLoading(false); // Ensure loading is clear

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
