import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Button,
} from "@react-email/components";
import * as React from "react";

interface MemberLoginEmailProps {
    name: string;
    email: string;
    tempPassword?: string;
    memberNumber: number;
    loginUrl?: string;
    profileUrl?: string;
}

export const MemberLoginEmail = ({
    name = "Gabriel Costa",
    email = "membro@exemplo.com",
    tempPassword = "TEMP_PASSWORD_AQUI",
    memberNumber = 123,
    loginUrl = "https://apostoladodegarabandal.com/login",
    profileUrl = "https://apostoladodegarabandal.com/account/profile",
}: MemberLoginEmailProps) => {
    const previewText = `Acesso à sua nova Área de Membro do Apostolado de Garabandal.`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Img
                            src="https://apostoladodegarabandal.com/images/nossasenhoragarabandal.jpg"
                            width="64"
                            height="64"
                            alt="Apostolado de Garabandal"
                            style={logo}
                        />
                        <Heading style={headerTitle}>Acesso Área de Membros</Heading>
                        <Text style={headerSubtitle}>Apostolado de Garabandal</Text>
                    </Section>

                    <Section style={content}>
                        <Text style={greeting}>Olá <strong>{name}</strong>,</Text>

                        <Text style={paragraph}>
                            É com muita alegria que apresentamos a nova <strong>Área Privada de Membros</strong> do Apostolado de Garabandal.
                        </Text>

                        <Text style={paragraph}>
                            A partir de agora, terá acesso a uma plataforma exclusiva onde poderá visualizar o calendário de eventos e links de acesso (como o Terço Mensal ou partilhas), ver as suas quotas, gerir inscrições em peregrinações e aceder à sua biblioteca digital.
                        </Text>

                        <Section style={credentialsBox}>
                            <Text style={credentialsTitle}>OS SEUS DADOS DE ACESSO</Text>

                            <Text style={credentialRow}>
                                <span style={credentialLabel}>Nº Associado:</span> <span style={credentialValue}>#{memberNumber}</span>
                            </Text>
                            <Text style={credentialRow}>
                                <span style={credentialLabel}>Email:</span> <span style={credentialValue}>{email}</span>
                            </Text>
                            <Text style={credentialRow}>
                                <span style={credentialLabel}>Password Temp:</span> <span style={credentialPassword}>{tempPassword}</span>
                            </Text>
                        </Section>

                        <Text style={paragraph}>
                            Por questões de segurança, recomendamos que altere a sua password logo após o primeiro login, visitando a secção <Link href={profileUrl} style={link}>Perfil</Link>.
                        </Text>

                        <Section style={btnContainer}>
                            <Button style={button} href={loginUrl}>
                                ACEDER À ÁREA DE MEMBRO
                            </Button>
                        </Section>

                        <Text style={footerText}>
                            Se tiver alguma dúvida ou dificuldade no acesso, responda simplesmente a este e-mail.
                        </Text>

                        <Text style={signoff}>
                            Unidos em oração,<br />
                            <strong style={{ color: "#0F172A" }}>Apostolado de Garabandal</strong>
                        </Text>
                    </Section>

                    <Hr style={hr} />

                    <Section style={footer}>
                        <Text style={footerDisclaimer}>
                            Este e-mail contém credenciais pessoais intransmissíveis. Por favor, não o partilhe com terceiros.
                        </Text>
                        <Text style={footerDisclaimer}>
                            © {new Date().getFullYear()} Apostolado de Garabandal em Língua Portuguesa. Todos os direitos reservados.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default MemberLoginEmail;

const main = {
    backgroundColor: "#F8FAFC",
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
    padding: "40px 0",
};

const container = {
    margin: "0 auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    overflow: "hidden",
    width: "100%",
    maxWidth: "600px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const header = {
    padding: "48px 40px",
    textAlign: "center" as const,
    backgroundColor: "#0F172A",
    backgroundImage: "linear-gradient(rgba(15,23,42,0.95), rgba(15,23,42,0.95)), url('https://apostoladodegarabandal.com/images/nossasenhoragarabandal.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
};

const logo = {
    margin: "0 auto 24px",
    borderRadius: "100%", // Using 100% instead of 50% can sometimes behave better
    border: "2px solid rgba(255,255,255,0.9)",
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
    display: "block",
    overflow: "hidden", // Helps enforce rounding in some clients
};

const headerTitle = {
    color: "#FFFFFF",
    fontSize: "28px",
    fontWeight: "700",
    margin: "0",
    fontFamily: "Georgia, serif",
    letterSpacing: "-0.5px",
};

const headerSubtitle = {
    color: "#CBD5E1",
    fontSize: "16px",
    margin: "8px 0 0",
};

const content = {
    padding: "40px",
};

const greeting = {
    fontSize: "20px",
    color: "#0F172A",
    marginBottom: "24px",
};

const paragraph = {
    fontSize: "16px",
    lineHeight: "26px",
    color: "#334155",
    marginBottom: "24px",
};

const credentialsBox = {
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "32px",
};

const credentialsTitle = {
    fontSize: "12px",
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    marginBottom: "16px",
};

const credentialRow = {
    fontSize: "15px",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
};

const credentialLabel = {
    color: "#64748B",
    minWidth: "120px",
    display: "inline-block",
};

const credentialValue = {
    color: "#0F172A",
    fontWeight: "600",
};

const credentialPassword = {
    color: "#0F172A",
    fontWeight: "700",
    backgroundColor: "#E2E8F0",
    padding: "4px 8px",
    borderRadius: "6px",
    letterSpacing: "1px",
    fontFamily: "monospace",
};

const btnContainer = {
    textAlign: "center" as const,
    margin: "32px 0",
};

const button = {
    backgroundColor: "#CA8A04",
    borderRadius: "50px",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: "bold",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "16px 32px",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
};

const link = {
    color: "#CA8A04",
    fontWeight: "600",
    textDecoration: "underline",
};

const signoff = {
    fontSize: "16px",
    lineHeight: "24px",
    color: "#64748B",
    marginTop: "32px",
};

const footerText = {
    fontSize: "14px",
    color: "#64748B",
    fontStyle: "italic",
};

const hr = {
    borderColor: "#E2E8F0",
    margin: "0",
};

const footer = {
    padding: "24px 40px",
    backgroundColor: "#F8FAFC",
    textAlign: "center" as const,
};

const footerDisclaimer = {
    fontSize: "12px",
    color: "#94A3B8",
    margin: "0 0 8px",
};
