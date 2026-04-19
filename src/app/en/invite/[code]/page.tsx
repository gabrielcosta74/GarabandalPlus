import { redirect } from "next/navigation";
import { supabaseServer } from "../../../../lib/supabase";
import InvitePageContent from "../../../convite/[codigo]/InvitePageContent";

export const dynamic = "force-dynamic";

export default async function EnInvitePage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;

    if (!supabaseServer) {
        return redirect("/en/become-member");
    }

    const { data: padrinho, error } = await supabaseServer
        .from("membros")
        .select("nome, avatar_url")
        .eq("referral_code", code)
        .single();

    if (error || !padrinho) {
        redirect("/en/become-member");
    }

    const firstName = padrinho.nome
        ? padrinho.nome.split(" ")[0]
        : "A friend";

    return (
        <InvitePageContent
            firstName={firstName}
            avatarUrl={padrinho.avatar_url}
            codigo={code}
            isEn={true}
        />
    );
}
