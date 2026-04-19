import { redirect } from "next/navigation";
import { supabaseServer } from "../../../lib/supabase";
import InvitePageContent from "./InvitePageContent";

export const dynamic = "force-dynamic";

export default async function ConvitePage({
    params,
}: {
    params: Promise<{ codigo: string }>;
}) {
    const { codigo } = await params;

    if (!supabaseServer) {
        return redirect("/tornar-membro");
    }

    const { data: padrinho, error } = await supabaseServer
        .from("membros")
        .select("nome, avatar_url")
        .eq("referral_code", codigo)
        .single();

    if (error || !padrinho) {
        redirect("/tornar-membro");
    }

    const firstName = padrinho.nome
        ? padrinho.nome.split(" ")[0]
        : "Um membro amigo";

    return (
        <InvitePageContent
            firstName={firstName}
            avatarUrl={padrinho.avatar_url}
            codigo={codigo}
            isEn={false}
        />
    );
}
