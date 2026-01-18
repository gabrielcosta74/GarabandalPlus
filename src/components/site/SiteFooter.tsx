import Link from 'next/link';
import { Facebook, Instagram, Mail, MapPin } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="bg-[#050911] pt-20 pb-10 border-t border-white/5">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-2xl text-white mb-6">Apostolado de Garabandal</h4>
            <p className="text-white/50 font-light max-w-sm">
              Dedicados a viver e compartilhar as mensagens de Nossa Senhora do Carmo de Garabandal, em união com a Santa Igreja.
            </p>
          </div>

          <div>
            <h5 className="text-white font-medium uppercase tracking-widest text-sm mb-6">Explorar</h5>
            <div className="flex flex-col space-y-4 text-white/50 text-sm font-light">
              <Link href="/tornar-membro" className="hover:text-garabandal-gold transition-colors">Tornar-me membro</Link>
              <Link href="/donations" className="hover:text-garabandal-gold transition-colors">Doações</Link>
              <Link href="/loja-online" className="hover:text-garabandal-gold transition-colors">Loja online</Link>
              <Link href="/login" className="hover:text-garabandal-gold transition-colors">Conta</Link>
            </div>
          </div>

          <div>
            <h5 className="text-white font-medium uppercase tracking-widest text-sm mb-6">Contacto</h5>
            <ul className="space-y-4 text-white/50 text-sm font-light">
              <li className="flex items-start">
                <MapPin size={16} className="mr-3 mt-1 text-garabandal-gold" />
                <span>San Sebastián de Garabandal,<br />Cantábria, Espanha</span>
              </li>
              <li className="flex items-center">
                <Mail size={16} className="mr-3 text-garabandal-gold" />
                <span>contacto@garabandal.org</span>
              </li>
            </ul>
            <div className="flex space-x-4 mt-6">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-garabandal-gold hover:text-white transition-all">
                <Facebook size={18} />
              </a>
              <a href="https://www.instagram.com/apostoladodegarabandaloficial/" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-garabandal-gold hover:text-white transition-all">
                <Instagram size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-white/30 uppercase tracking-widest">
          <p>&copy; {new Date().getFullYear()} Apostolado de Garabandal.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="#" className="hover:text-white transition-colors">Privacidade</Link>
            <Link href="#" className="hover:text-white transition-colors">Termos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
